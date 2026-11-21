"""A textbook PDF -> clean Markdown parts, ready to file under a course's syllabus topics as a student's own notes.

Written for the page design of Dale's Pharmacology Condensed (3rd ed.): two columns of Times body text, Futura headings,
framed figures with "Fig. N.M" captions, ruled tables with "Table N.M" captions, and shaded "Clinical use" boxes titled in
Helvetica Neue Black. Front matter, the preface, the index, the running heads, page numbers and any watermark are left out.

Text stays text (headings, paragraphs, lists, bold drug names, the boxes as call-outs); figures, tables and equations,
which don't survive as text, become pictures cropped from the page, with their captions kept as text."""
import re
from dataclasses import dataclass, field

BODY = ("TimesNRMT", "TnQ")  # the body text, and the font its Greek letters and symbols come from
SUP = str.maketrans("0123456789+-−=()n", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁻⁼⁽⁾ⁿ")
SUB = str.maketrans("0123456789+-−=()", "₀₁₂₃₄₅₆₇₈₉₊₋₋₌₍₎")
MID = 306  # the gutter between the two columns, in points (pages are 612 wide)
KEEP_HYPHEN = {"non", "anti", "self", "well", "low", "high", "long", "short", "cross", "first", "second", "third", "pro", "co", "pre", "post", "semi", "multi",
               "inter", "intra", "extra", "over", "under", "half", "sub", "super", "dose", "drug", "age", "time", "life", "end", "all", "one", "two"}


def font(c): return c["fontname"].split("+")[-1]
def is_body(c): return font(c).startswith(BODY) and 5 <= c["size"] <= 9.6


@dataclass
class Item:  # one thing on a page, in reading order: a line of text, or a region to show as a picture, or a call-out box
    kind: str  # "line", "figure", "table", "equation", "box", "chapter"
    col: str  # "L", "R" or "F" (full width)
    top: float; bottom: float; x0: float; x1: float
    text: str = ""; level: int = 0  # a line's heading level (0 = body text)
    page: int = 0; pdf: int = 0
    caption: str = ""; label: str = ""  # "Fig. 3.1"
    lines: list = field(default_factory=list)  # a box's lines: (text, indent)
    bold_lead: bool = False


def column(x0, x1, width=612):
    if x1 - x0 > 330: return "F"
    return "L" if (x0 + x1) / 2 < width / 2 else "R"


def line_text(chars):
    """Characters of one line -> text with Markdown bold/italic, sub- and superscripts, and spaces where the gaps are."""
    chars = sorted(chars, key=lambda c: c["x0"])
    main = max((c["size"] for c in chars), default=9)
    base = max((c["bottom"] for c in chars if c["size"] >= main - 0.6), default=0)
    runs = []  # [text, style]
    prev = None
    for c in chars:
        t = c["text"]
        if c["size"] < main - 1.5 and t.strip():  # smaller type: a superscript sits higher, a subscript lower
            t = t.translate(SUP) if c["bottom"] < base - 1.2 else t.translate(SUB)
        f = font(c); style = ("b" if "Bold" in f or "Black" in f or "Heavy" in f else "") + ("i" if "Italic" in f or "Oblique" in f else "")
        if prev is not None:
            gap = c["x0"] - prev["x1"]
            if gap > 0.22 * min(c["size"], prev["size"]) and not runs[-1][0].endswith(" ") and t != " ": runs.append([" ", runs[-1][1]])
        if runs and runs[-1][1] == style: runs[-1][0] += t
        else: runs.append([t, style])
        prev = c
    return runs


def runs_md(runs, plain=False):
    out = ""
    for t, st in runs:
        if plain or not st.strip() or not t.strip(): out += t; continue
        lead, core, trail = re.match(r"^(\s*)(.*?)(\s*)$", t, re.S).groups()
        if "b" in st and "i" in st: core = f"***{core}***"
        elif "b" in st: core = f"**{core}**"
        elif "i" in st and len(core) > 1: core = f"*{core}*"
        out += lead + core + trail
    return merge_marks(out).replace("\u00a0", " ")


def merge_marks(t):  # "**a** **b**" -> "**a b**", "*a* *b*" -> "*a b*": neighbouring runs in the same style become one
    for m in ("***", "**", "*"):
        q = re.escape(m)
        t = re.sub(rf"(?<=[^\s*]){q}(\s+){q}(?=[^\s*])", r"\1", t)
    return t


def group_lines(chars, tol=2.6):
    """Characters -> lines: main-size characters by baseline; smaller ones (sub/superscripts) join the nearest line."""
    big = sorted([c for c in chars if c["size"] >= 7.5], key=lambda c: c["bottom"])
    small = [c for c in chars if c["size"] < 7.5]
    lines = []
    for c in big:
        if lines and abs(lines[-1]["bottom"] - c["bottom"]) <= tol: lines[-1]["chars"].append(c)
        else: lines.append({"bottom": c["bottom"], "chars": [c]})
    for c in small:
        near = min(lines, key=lambda l: abs(l["bottom"] - c["bottom"]), default=None)
        if near and -7 <= c["bottom"] - near["bottom"] <= 4: near["chars"].append(c)
        else: lines.append({"bottom": c["bottom"], "chars": [c]})
    for l in lines:
        cs = [c for c in l["chars"] if c["text"].strip()] or l["chars"]  # a leading space character would hide a line's indent
        l.update(top=min(c["top"] for c in cs), x0=min(c["x0"] for c in cs), x1=max(c["x1"] for c in cs))
    return sorted(lines, key=lambda l: l["top"])


def inside(c, b, pad=1.5): return b[0] - pad <= c["x0"] and b[1] - pad <= c["top"] and c["x1"] <= b[2] + pad and c["bottom"] <= b[3] + pad


def page_items(p, pno, pdfno):
    """One page -> its items in reading order (bands split by full-width items; in each band the left column, then the right)."""
    W = p.width
    chars = [c for c in p.chars if c["upright"] and c["top"] < 785 and not (font(c) == "Helvetica" and c["size"] > 11)]  # no running head, no watermark
    words = p.extract_words(extra_attrs=["fontname", "size"])
    items, taken = [], []
    # chapter banner: a big number and the chapter's title at the top of its first page
    ban = [c for c in chars if font(c).startswith("Futura-Heavy") and c["size"] >= 13 and c["top"] < 70]
    if ban:
        num = "".join(c["text"] for c in sorted(ban, key=lambda c: c["x0"]) if c["size"] > 20).strip()
        title = runs_md(line_text([c for c in ban if c["size"] < 20]), plain=True).strip()
        items.append(Item("chapter", "F", 0, 1, 0, W, text=title, label=num, page=pno, pdf=pdfno)); taken += ban
    # figures: a frame (rounded box) holding a bold "Fig. N.M" caption; the picture is the frame above its caption
    frames = [o for o in p.curves + p.rects if o["x1"] - o["x0"] > 120 and o["bottom"] - o["top"] > 40]
    for k, w in enumerate(words):
        if w["text"] == "Fig." and "Bold" in w["fontname"] and k + 1 < len(words) and re.match(r"^\d+\.\d+$", words[k + 1]["text"]):
            fr = [o for o in frames if o["x0"] - 2 <= w["x0"] and o["top"] - 2 <= w["top"] and o["x1"] + 2 >= w["x1"] and o["bottom"] + 2 >= w["bottom"]]
            if not fr: continue
            o = min(fr, key=lambda o: (o["x1"] - o["x0"]) * (o["bottom"] - o["top"]))
            box = (o["x0"], o["top"], o["x1"], o["bottom"])
            inner = [c for c in chars if inside(c, box)]
            cap = [c for c in inner if c["top"] >= w["top"] - 1 and font(c).startswith(("HelveticaNeue", "TnQ"))]
            caption = " ".join(runs_md(line_text(l["chars"])).strip() for l in group_lines(cap))
            items.append(Item("figure", column(o["x0"], o["x1"], W), o["top"], w["top"] - 6, o["x0"], o["x1"], caption=fix_text(caption),
                              label=f"Fig. {words[k + 1]['text']}", page=pno, pdf=pdfno))
            taken += inner
    rest = [c for c in chars if c not in taken] if taken else chars
    # tables: a bold "Table N.M" caption, then the ruled table and its footnotes, all in Helvetica (or small Times) until the body text resumes
    for k, w in enumerate(words):
        if w["text"] == "Table" and "Bold" in w["fontname"] and 0 <= w["x0"] < W and k + 1 < len(words) and re.match(r"^\d+\.\d+$", words[k + 1]["text"]):
            if any(inside({"x0": w["x0"], "top": w["top"], "x1": w["x1"], "bottom": w["bottom"]}, (i.x0, i.top, i.x1, i.bottom)) for i in items if i.kind == "figure"): continue
            # its width: the caption's column, or the whole page when the table's own text runs across the gutter (and no other table sits beside it)
            left = w["x0"] < MID - 10
            others = [v for v in words if v["text"] == "Table" and "Bold" in v["fontname"] and v is not w and abs(v["top"] - w["top"]) < 300 and (v["x0"] < MID - 10) != left]
            def flow(x0, x1):  # -> the caption's lines (bold, at the top) as one line, and the bottom of the table and its notes
                capl, bottom, last, in_cap = None, w["bottom"], w["bottom"], True
                for l in group_lines([c for c in rest if c["top"] >= w["top"] - 1 and x0 - 4 <= c["x0"] and c["x1"] <= x1 + 6]):
                    f = max((font(c) for c in l["chars"]), key=lambda f: sum(font(c) == f for c in l["chars"]))
                    if l["top"] - last > 18 or (f.startswith("TimesNRMT") and max(c["size"] for c in l["chars"]) > 8.6) or f.startswith("Futura"): break
                    if in_cap and "Bold" in f:
                        capl = l if capl is None else {**capl, "chars": capl["chars"] + [{**c, "bottom": capl["bottom"], "top": capl["top"], "x0": c["x0"] + 1000, "x1": c["x1"] + 1000} for c in l["chars"]], "bottom2": l["bottom"]}
                    else: in_cap = False
                    bottom = last = l["bottom"]
                return capl, bottom
            x0, x1 = (min(w["x0"] - 2, 46), MID - 4) if left else (MID + 2, W - 46)
            capl, bottom = flow(x0, x1)
            panels = [(o["x0"], o["top"], o["x1"], o["bottom"]) for o in p.curves + p.rects if o.get("fill") and o["x1"] - o["x0"] > 150]
            across = [c for c in rest if w["top"] - 1 <= c["top"] <= bottom and font(c).startswith(("HelveticaNeue", "TnQ")) and (c["x0"] > MID + 4 if left else c["x1"] < MID - 4)
                      and not any(inside(c, b_) for b_ in panels)]  # a box beside the table is not part of it
            if across and not others:
                x0, x1 = 46, W - 46; capl, bottom = flow(x0, x1)
            col = column(x0, x1, W)
            cap_chars = capl["chars"] if capl else []
            caption = runs_md(line_text(cap_chars), plain=True).strip()
            region = [c for c in rest if w["top"] - 1 <= c["top"] and c["bottom"] <= bottom + 1 and x0 - 4 <= c["x0"] and c["x1"] <= x1 + 6]
            top = (capl.get("bottom2", capl["bottom"]) if capl else w["bottom"]) + 4
            if bottom - top < 12: taken += region; continue  # nothing under the caption here (the table is on the next page)
            items.append(Item("table", col, top, bottom + 2, x0, x1, caption=fix_text(caption),
                              label=f"Table {words[k + 1]['text']}", page=pno, pdf=pdfno))
            taken += region
    rest = [c for c in chars if c not in taken]
    # boxes: a shaded panel (a header bar holding a title in Helvetica Neue Black, and the panel under it). Its text becomes a call-out;
    # a panel with drawing in it (arrows from drugs to their uses) becomes a picture under its title instead
    titles = [c for c in rest if font(c) == "HelveticaNeue-Black"]
    fills = [o for o in p.curves + p.rects if o.get("fill") and o["x1"] - o["x0"] > 150]
    for tl in group_lines(titles):
        if any(c in taken for c in tl["chars"]): continue
        head = [o for o in fills if o["x0"] - 2 <= tl["x0"] and tl["x1"] <= o["x1"] + 2 and o["top"] - 2 <= tl["top"] <= o["bottom"]]
        if head:
            h = min(head, key=lambda o: o["bottom"] - o["top"])
            panel = [o for o in fills if abs(o["x0"] - h["x0"]) < 6 and abs(o["x1"] - h["x1"]) < 6 and h["top"] - 2 <= o["top"] <= h["bottom"] + 8]
            region = (min(o["x0"] for o in panel), min(o["top"] for o in panel), max(o["x1"] for o in panel), max(o["bottom"] for o in panel))
            inside_chars = [c for c in rest if inside(c, region, pad=2)]
            got = group_lines(inside_chars)
        else:  # no panel drawn: the title and the Helvetica lines that follow it in its column
            col0 = column(tl["x0"], tl["x1"], W) if tl["x1"] - tl["x0"] < 330 else "F"
            cx0 = 40 if col0 in "LF" else MID; cx1 = W if col0 in "RF" else MID
            got, last = [], tl["top"]
            for l in group_lines([c for c in rest if c["top"] >= tl["top"] - 1 and cx0 <= c["x0"] and c["x1"] <= cx1]):
                if l["top"] - last > 16 or not all(font(c).startswith(("HelveticaNeue", "TnQ")) for c in l["chars"]): break
                got.append(l); last = l["bottom"]
            region = (cx0, tl["top"] - 4, cx1, last + 4) if got else None
        if not got or region is None: continue
        title_lines = [l for l in got if all(font(c) in ("HelveticaNeue-Black", "TnQ") for c in l["chars"] if c["text"].strip())]  # a Greek letter in a title comes from the symbol font
        body = [l for l in got if l not in title_lines]
        if not body: continue  # a word in heavy type on its own (a label in a drawing), not a box
        title = fix_text(" ".join(runs_md(line_text(l["chars"]), plain=True).strip() for l in title_lines))
        col = column(region[0], region[2], W)
        drawn = [o for o in p.lines + p.curves if o not in fills and region[0] <= o["x0"] and o["x1"] <= region[2] and region[1] <= o["top"] and o["bottom"] <= region[3]]
        if len(drawn) >= 3:  # a diagram in a panel: a picture of the panel below its title
            top = max(l["bottom"] for l in title_lines) + 3 if title_lines else region[1]
            items.append(Item("figure", col, top, region[3], region[0], region[2], caption=title, label=title, page=pno, pdf=pdfno))
        else:
            left = min(l["x0"] for l in body)
            items.append(Item("box", col, region[1], region[3], region[0], region[2], text=title,
                              lines=[(runs_md(line_text(l["chars"])).strip(), l["x0"] - left) for l in body], page=pno, pdf=pdfno))
        for l in got: taken += l["chars"]
    rest = [c for c in chars if c not in taken]
    for o in p.lines + p.rects:  # a full-width rule (under a chapter's introduction) separates bands of the page
        if o["x1"] - o["x0"] > 400 and abs(o["bottom"] - o["top"]) < 3 and 40 < o["top"] < 780 and not any(i.kind == "figure" and i.top <= o["top"] <= i.bottom for i in items):
            items.append(Item("rule", "F", o["top"], o["bottom"], o["x0"], o["x1"], page=pno, pdf=pdfno))
    # what's left: page numbers (dropped), headings, body lines, and anything set in other fonts (equations, labels) -> pictures
    rest = [c for c in rest if not (font(c) in ("Futura-Bold", "Futura") and c["text"].strip().isdigit())]
    edge = {}
    for side, lo, hi in (("L", 0, MID), ("R", MID, W)):  # each column's left edge: where most body lines start
        xs = sorted(l["x0"] for l in group_lines([c for c in rest if is_body(c) and lo <= (c["x0"] + c["x1"]) / 2 < hi]) if len(l["chars"]) > 20)
        edge[side] = xs[len(xs) // 5] if xs else (48 if side == "L" else 312)
    for side, lo, hi in (("L", 0, MID), ("R", MID, W)):
        cs = [c for c in rest if lo <= (c["x0"] + c["x1"]) / 2 < hi]
        other = []
        for l in group_lines(cs):
            ch = [c for c in l["chars"] if c["text"].strip()]
            if not ch: continue
            f0 = max((font(c) for c in ch), key=lambda f: sum(font(c) == f for c in ch))
            body_share = sum(is_body(c) for c in ch) / len(ch)
            sz = max(c["size"] for c in ch)
            if f0.startswith("Futura"):
                lvl = 2 if sz >= 10.6 else 3 if sz >= 9.6 and "Oblique" not in f0 else 4 if "HeavyOblique" in f0 else 5  # Futura Heavy 11, 10, Heavy Oblique 9, Oblique 9
                items.append(Item("line", side, l["top"], l["bottom"], l["x0"], l["x1"], text=runs_md(line_text(l["chars"]), plain=True).strip(), level=lvl, page=pno, pdf=pdfno))
            elif l["x0"] - edge[side] > 24 and l["x1"] - l["x0"] < 150 and not re.match(r"^(•|\d+\.\s)", "".join(c["text"] for c in ch)):
                other.append(l)  # a short line set well in from the column's edge: a worked equation or a label, shown as a picture
            elif body_share >= 0.7 and len(ch) >= 3 or (body_share == 1):
                runs = line_text(l["chars"])
                items.append(Item("line", side, l["top"], l["bottom"], l["x0"], l["x1"], text=runs_md(runs), page=pno, pdf=pdfno,
                                  bold_lead=bool(runs) and "b" in runs[0][1]))
            else: other.append(l)
        # equations and other set pieces: neighbouring lines in other fonts become one picture
        groups = []
        for l in other:
            if groups and l["top"] - groups[-1][-1]["bottom"] < 16: groups[-1].append(l)
            else: groups.append([l])
        for g in groups:
            t, b = min(l["top"] for l in g), max(l["bottom"] for l in g)
            x0, x1 = min(l["x0"] for l in g), max(l["x1"] for l in g)
            if b - t < 4 and x1 - x0 < 20: continue
            cs_ = [c for l in g for c in l["chars"] if c["text"].strip()]
            tabular = sum(font(c).startswith("HelveticaNeue") for c in cs_) > len(cs_) / 2  # set like a table (a table without a caption, or one continued)
            items.append(Item("table" if tabular else "equation", side, t - 3, b + 3, max(lo, x0 - 6), min(hi, x1 + 6), label="Table" if tabular else "", page=pno, pdf=pdfno))
    # an equation drawn across body lines in the same place is a picture of the whole: body lines inside it go
    eqs = [i for i in items if i.kind == "equation"]
    items = [i for i in items if not (i.kind == "line" and i.level == 0 and any(e.col == i.col and e.top <= i.top and i.bottom <= e.bottom and len(i.text) < 40 for e in eqs))]
    return order(items, W)


def order(items, W):
    full = sorted([i for i in items if i.col == "F"], key=lambda i: i.top)
    bounds = [-1] + [i.top for i in full] + [10_000]
    out = []
    for k in range(len(bounds) - 1):
        lo, hi = bounds[k], bounds[k + 1]
        band = [i for i in items if i.col != "F" and lo <= i.top < hi]
        out += sorted([i for i in band if i.col == "L"], key=lambda i: i.top) + sorted([i for i in band if i.col == "R"], key=lambda i: i.top)
        if k < len(full): out.append(full[k])
    return out


def fix_text(t):
    t = re.sub(r"\s+", " ", t).strip()
    return t.replace(" ,", ",").replace(" .", ".").replace("( ", "(").replace(" )", ")").replace(" ;", ";").replace(" :", ":")




def paragraphs(items):
    """Items in reading order (across pages) -> Markdown paragraphs. Returns [(kind, markdown, item)] where kind is chapter/heading/text/figure/table/equation/box."""
    out, cur = [], None  # cur: {"kind": "p"|"li", "text", "left", "col", "page"}
    lefts = {}
    for i in items:
        if i.kind == "line" and i.level == 0: lefts.setdefault((i.pdf, i.page, i.col), []).append(i.x0)
    lefts = {k: sorted(v)[len(v) // 5] for k, v in lefts.items()}  # the column's left edge: most lines start there
    def flush():
        nonlocal cur
        if cur: out.append(("text", finish(cur["text"]), cur["item"]))
        cur = None
    for i in items:
        if i.kind == "rule": flush(); continue
        if i.kind != "line":
            flush()
            last = out[-1][2] if out else None
            if i.kind == "equation" and last is not None and last.kind == "equation" and (last.pdf, last.page, last.col) == (i.pdf, i.page, i.col) and i.top - last.bottom < 60:
                last.top, last.bottom, last.x0, last.x1 = min(last.top, i.top), max(last.bottom, i.bottom), min(last.x0, i.x0), max(last.x1, i.x1); continue
            if i.kind == "box" and last is not None and last.kind == "box" and norm(last.text) == norm(i.text):
                last.lines += i.lines; continue  # the same box, continued on the next page under its title again
            out.append((i.kind, i, i)); continue
        if i.level:
            flush()
            if out and out[-1][0] == "heading" and out[-1][2].level == i.level and out[-1][2].page == i.page and i.top - out[-1][2].bottom < 6:
                out[-1] = ("heading", out[-1][1] + " " + i.text, i)
            else: out.append(("heading", i.text, i))
            continue
        t = i.text.strip()
        left = lefts.get((i.pdf, i.page, i.col), i.x0); indent = i.x0 - left
        bullet = bool(re.match(r"^(•|\d+\.\s|[a-z]\)\s)", re.sub(r"^\*+", "", t)))
        new_place = cur is not None and (cur["page"], cur["col"]) != (i.page, i.col)
        if cur is None: start = True
        elif bullet: start = True
        elif new_place: start = indent > 4  # a paragraph runs on into the next column or page unless the next line is indented
        elif cur["kind"] == "li": start = indent < 3 or i.top - cur["bottom"] > 5
        else: start = indent > 4 or i.top - cur["bottom"] > 5
        if start:
            flush(); cur = {"kind": "li" if bullet else "p", "text": t, "item": i}
        else:
            prev = cur["text"].rstrip()
            m = re.search(r"(\w+)-(\**)$", prev); n = re.match(r"^(\**)[a-z]", t)
            if m and n:  # a word broken over two lines, maybe inside *italics*: marked, and decided once the whole book's words are known (polish)
                cur["text"] = prev[:m.start() + len(m.group(1))] + "\u00ad" + (t[len(n.group(1)):] if m.group(2) == n.group(1) else m.group(2) + t)
            else: cur["text"] = prev + " " + t
        cur.update(page=i.page, col=i.col, bottom=i.bottom)
    flush()
    return out


def finish(t):
    t = fix_text(t)
    t = re.sub(r"^•\s*", "- ", t)
    return t.replace("** **", " ").replace("**  **", " ")


def caption_md(i):  # "**Fig. 3.1** Schematic diagram …": the label in bold, once, then the caption
    c = re.sub(r"^\s*(Fig\.|Table)\s*\d+\.\d+\s*", "", i.caption.replace("**", "")).strip()
    c = re.sub(r"(?<!\*)\*(?!\*)", "", c) if c.count("*") % 2 else c
    return f"**{i.label}** {c}".strip()


def read_book(paths, skip_chapters=("preface",), stop_at=("index",)):
    """PDF files of one book, in order -> chapters [{"num", "title", "parts": [(kind, markdown or Item, Item)]}]. Pages before the first chapter
    (cover, title pages, contents) are left out, as are the chapters named in skip_chapters and everything from a chapter named in stop_at."""
    import pdfplumber
    items = []
    for k, path in enumerate(paths):
        with pdfplumber.open(path) as pdf:
            for n, p in enumerate(pdf.pages, 1): items += page_items(p, n, k)
    chapters, cur = [], None
    for kind, x, it in paragraphs(items):
        if kind == "chapter":
            name = it.text.lower().strip()
            if any(name.startswith(w) for w in stop_at): break
            cur = {"num": it.label, "title": it.text, "parts": [], "skip": any(name.startswith(w) for w in skip_chapters)}
            chapters.append(cur); continue
        if kind == "heading" and cur is not None and norm(x) in [norm(w) for w in stop_at]:  # the index has no chapter banner of its own (the contents page names it too)
            cur["parts"] = [q for q in cur["parts"] if (q[2].pdf, q[2].page) != (it.pdf, it.page)]  # nor anything already read from its first page
            break
        if cur is None or cur["skip"]: continue
        cur["parts"].append((kind, x, it))
    chapters = [c for c in chapters if not c["skip"]]
    for c in chapters: c["parts"] = place_floats(c["parts"])
    return chapters


def place_floats(parts):
    """A figure or table goes where the text first mentions it ("see Fig. 11.11"), after that paragraph (after the whole list when the mention
    leads into one), rather than wherever it was set on the page, so it never breaks up a paragraph or a list. One never mentioned stays put."""
    def mentions(label):
        kind, num = label.split(" ", 1)
        word = r"Fig(?:ure)?s?\.?" if kind == "Fig." else r"Tables?"
        return re.compile(rf"\b{word}\s*(?:[\d.]+\s*(?:,|and|&)\s*)*{re.escape(num)}(?![\d.]*\d)")
    floats = [q for q in parts if q[0] in ("figure", "table") and re.match(r"^(Fig\.|Table) \d+\.\d+$", q[2].label or "")]
    rest = [q for q in parts if q not in floats]
    placed = {}  # index in rest -> floats to put after it
    for q in floats:
        rx = mentions(q[2].label); at = None
        for k, (kind, x, it) in enumerate(rest):
            text = x if isinstance(x, str) else (it.text + " " + " ".join(t for t, _ in it.lines)) if kind == "box" else ""
            if text and rx.search(text): at = k; break
        if at is None:  # never mentioned: after the part that came before it on the page
            before = parts[:parts.index(q)]; at = max((rest.index(b) for b in before if b in rest), default=-1)
        else:
            if rest[at][0] == "heading":  # mentioned in a heading: after the paragraph under it
                at += 1 if at + 1 < len(rest) and rest[at + 1][0] == "text" else 0
            while at + 1 < len(rest) and rest[at + 1][0] == "text" and re.match(r"^(- |\d+\. )", rest[at + 1][1]) and \
                    (re.match(r"^(- |\d+\. )", rest[at][1] if isinstance(rest[at][1], str) else "") or str(rest[at][1]).rstrip().endswith(":")):
                at += 1  # the list it leads into, or is part of, stays together
        placed.setdefault(at, []).append(q)
    out = list(placed.get(-1, []))
    for k, q in enumerate(rest): out.append(q); out += placed.get(k, [])
    return out


def norm(t): return re.sub(r"[^a-z]", "", (t or "").lower())


def box_md(i):
    """A call-out box -> a Markdown quote: its title in bold, then its bullets (nested where the book nests them) and any plain lines."""
    rows = []  # [level, text]
    for t, ind in i.lines:
        t = t.strip()
        if not t: continue
        if t.startswith("•"): rows.append([1 if ind > 4 else 0, t.lstrip("•").strip()])
        elif rows:
            prev = rows[-1][1].rstrip(); m = re.search(r"(\w+)-(\**)$", prev); n = re.match(r"^(\**)[a-z]", t)
            rows[-1][1] = (prev[:m.start() + len(m.group(1))] + "\u00ad" + t if m and n else prev + " " + t)
        else: rows.append([-1, t])
    out = [f"> **{i.text}**", ">"]
    for lvl, t in rows: out.append("> " + "  " * max(lvl, 0) + ("- " if lvl >= 0 else "") + fix_text(merge_marks(t)))
    return "\n".join(out)


WORD = re.compile(r"[A-Za-z][A-Za-z\-]*[A-Za-z]|[A-Za-z]")


def vocabulary(chapters):
    from collections import Counter
    v = Counter()
    for c in chapters:
        for kind, x, it in c["parts"]:
            texts = [x] if isinstance(x, str) else [it.caption, it.text] + [t for t, _ in it.lines]
            for t in texts: v.update(w.lower() for w in WORD.findall((t or "").replace("\u00ad", " ")))
    return v


def polish(text, vocab):
    """Decisions that need the whole book's words: a line-break hyphen joins its halves unless the book writes the word hyphenated,
    and a list item's first letter set apart from its word ("C ardiovascular", "m yasthenia") rejoins it."""
    def hy(m):
        a, marks, b = m.group(1), m.group(2), m.group(3)
        joined, hyph = (a + b).lower(), (a + "-" + b).lower()
        if vocab[hyph] > vocab[joined] or (not vocab[joined] and a.lower() in KEEP_HYPHEN): return a + "-" + marks + b
        return a + marks + b
    text = re.sub(r"(\w+)\u00ad(\**)(\w+)", hy, text).replace("\u00ad", "-")
    def cap(m):
        lead, s1, letter, s2, s3, rest = m.groups()
        whole = (letter + rest).lower()
        if vocab[whole] > vocab[rest.lower()]: return lead + (s3 or s1) + letter + rest  # the whole word is the book's usual one
        return m.group(0)
    return re.sub(r"(^|(?:^|\n)(?:>\s*)?\s*(?:-|\d+\.)\s+)(\**)([A-Za-z])(\**)\s+(\**)([A-Za-z][a-z]*)", cap, text)


def key(t): return re.sub(r"[\W_]+", "", (t or "").lower())


def best(rules, text):  # the longest rule that the text starts with
    k = key(text); hits = [(len(key(r)), v) for r, v in (rules or {}).items() if key(r) and k.startswith(key(r))]
    return max(hits, key=lambda h: h[0])[1] if hits else KeyError


ACRONYM = re.compile(r"\b[A-Z][A-Z0-9₀-₉]{1,6}s?\b")


def sentence_case(h, cased):
    """'RECEPTORS AS DRUG TARGETS' -> 'Receptors as drug targets', keeping the abbreviations the book writes in capitals (ACE, NSAIDs, HIV)."""
    if h != h.upper() or not re.search(r"[A-Z]{3}", h): return h
    out = []
    for k, w in enumerate(h.split()):
        core = re.sub(r"[^\w₀-₉’'-]", "", w)
        if cased.get(core, 0) > cased.get(core.lower(), 0) + cased.get(core.capitalize(), 0) or core in ("DNA", "RNA", "CNS", "HIV", "AIDS", "ACE", "MAO"):
            out.append(w)
        elif core.upper().endswith("S") and cased.get(core[:-1], 0) > 2: out.append(w[:-1] + "s")  # NSAIDS -> NSAIDs
        else: out.append(w.lower() if k else w.capitalize())
    return " ".join(out)


def file_parts(chapters, mapping, picture, book_label="Your book"):
    """Chapters -> [(topic title or None, markdown paragraph)] in book order, filed by the map. picture(item) -> the image's URL.
    Each run of paragraphs for one topic starts with a line saying where in the book it comes from."""
    from collections import Counter
    vocab = vocabulary(chapters)
    cased = Counter()
    for c in chapters:
        for kind, x, it in c["parts"]:
            if kind == "text": cased.update(re.findall(r"[A-Za-z][\w₀-₉]+", x))
    out = []
    for c in chapters:
        cm = mapping["chapters"].get(c["num"], {"default": None})
        at = {1: cm.get("default")}
        last_src = None
        for kind, x, it in c["parts"]:
            topic = at[max(at)]
            if kind == "heading":
                r = best(cm.get("headings"), x)
                topic = r if r is not KeyError else at[max(l for l in at if l < it.level)] if any(l < it.level for l in at) else at[1]
                at = {l: t for l, t in at.items() if l < it.level}; at[it.level] = topic
                md = ["#" * it.level + " " + sentence_case(polish(x, vocab), cased)]
            elif kind == "text":
                r = best(cm.get("paragraphs"), re.sub(r"[*_]", "", x))
                if r is not KeyError: topic = r
                md = [polish(x, vocab)]
            elif kind == "box":
                r = best(mapping.get("boxes"), it.text)
                if r is not KeyError: topic = r
                md = [polish(box_md(it), vocab)]
            elif kind in ("figure", "table"):
                url = picture(it)
                if not it.label.startswith(("Fig.", "Table")):  # a box drawn as a diagram: filed by its title like the other boxes, the title above it
                    r = best(mapping.get("boxes"), it.label)
                    if r is not KeyError: topic = r
                    md = [f"> **{polish(it.label, vocab)}**", f"![{it.label}]({url})"]
                elif not it.caption: md = [f"![{it.label}]({url})"]
                else:
                    cap = polish(caption_md(it), vocab)
                    md = [cap, f"![{it.label}]({url})"] if kind == "table" else [f"![{it.label}]({url})", cap]  # a table's caption above it, a figure's below
            elif kind == "equation":
                md = [f"![Equation]({picture(it)})"]
            else: continue
            src = (topic, c["num"])
            if topic is not None and (not out or out[-1][0] != topic or last_src != src):
                out.append((topic, f"*{book_label}, chapter {c['num']}: {c['title']}*"))
            last_src = src
            for m in md: out.append((topic, m))
    return out


class Pictures:
    """Crops figures, tables and equations from the rendered pages into WebP files in a folder; returns their /api/uploads/ URLs.
    Names are derived from a secret and the item, so loading the same book again reuses the same files and nobody can guess them."""
    SCALE = 3  # 216 dpi: sharp on a phone and on a large screen
    def __init__(self, paths, folder, secret):
        import pypdfium2
        self.docs = [pypdfium2.PdfDocument(p) for p in paths]; self.folder = folder; self.secret = secret; self.cache = {}; self.made = 0
    def page(self, pdf, n):
        k = (pdf, n)
        if k not in self.cache:
            if len(self.cache) > 6: self.cache.clear()
            self.cache[k] = self.docs[pdf][n - 1].render(scale=self.SCALE).to_pil().convert("RGB")
        return self.cache[k]
    def __call__(self, it):
        import hashlib, hmac, os
        name = hmac.new(self.secret.encode(), f"{it.pdf}:{it.page}:{it.kind}:{it.label}:{it.top:.0f}:{it.x0:.0f}".encode(), hashlib.sha256).hexdigest()[:32] + ".webp"
        path = os.path.join(self.folder, name)
        if not os.path.isfile(path):
            img = self.page(it.pdf, it.page); s = self.SCALE; pad = 3
            box = (max(0, int((it.x0 - pad) * s)), max(0, int((it.top - pad) * s)), min(img.width, int((it.x1 + pad) * s)), min(img.height, int((it.bottom + pad) * s)))
            if box[2] - box[0] < 10 or box[3] - box[1] < 10: return ""
            os.makedirs(self.folder, exist_ok=True)
            img.crop(box).save(path, "WEBP", quality=82, method=6); self.made += 1
        return f"/api/uploads/{name}"
