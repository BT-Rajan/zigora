"""A student's own textbook filed under a course's syllabus as her notes (manage.py load-book), and her private steps made in advance (prepare-steps)."""
import json, os, types
import main, manage, bookload
from main import Session_, User, Topic, TopicNote, CourseMaterial, PrivateAnswer, StepLog, StudyAICall
from bookload import Item

SYLLABUS = ("program,semester,semester_no,course,unit,topic\nM.B.B.S,Year 2,2,Pharmacology,Unit 1,Receptors\n,,,,,Dose–response\n"
            ",,,,Unit 2,Cholinergic drugs\n,,,,,Anticholinergic drugs\n,,,,,Not in the book\n")
MAP = {"book": "A Pharmacology Book (2nd ed.)", "course": {"program": "M.B.B.S", "semester": "Year 2", "course": "Pharmacology"},
       "chapters": {"3": {"default": "Receptors", "headings": {"ANTAGONISTS": "Dose–response"}},
                    "11": {"default": "Cholinergic drugs", "headings": {"MUSCARINIC RECEPTORS": "Anticholinergic drugs"}},
                    "25": {"default": None}},
       "boxes": {"Clinical uses of drugs acting on muscarinic receptors": "Anticholinergic drugs"}}

def it(kind, **k): return Item(kind, "L", k.pop("top", 0), k.pop("bottom", 10), 0, 100, **k)
def book():  # what bookload.read_book makes of a PDF: chapters of (kind, markdown or item, item)
    h = lambda t, l=2: ("heading", t, it("line", text=t, level=l))
    p = lambda t: ("text", t, it("line", text=t))
    return [{"num": "3", "title": "General principles of drug action", "parts": [
                p("Pharmacology concerns how drugs act on **receptors**."), h("RECEPTORS AS DRUG TARGETS"), p("An agonist activates a receptor."),
                ("figure", None, it("figure", label="Fig. 3.1", caption="**Fig. 3.1** Receptor states.", page=13)),
                h("ANTAGONISTS"), p("A competitive antagonist shifts the curve to the right."),
                ("equation", None, it("equation", page=14))]},
            {"num": "11", "title": "Outline of transmission", "parts": [
                p("Acetylcholine acts at nicotinic and muscarinic receptors."), h("MUSCARINIC RECEPTORS"), p("**Atropine** blocks them."),
                ("table", None, it("table", label="Table 11.2", caption="Examples of drugs acting on muscarinic receptors", page=58)),
                ("box", None, it("box", text="Clinical uses of drugs acting on muscarinic receptors", lines=[("• **Antagonists**:", 0), ("• Cardiovascular: bradycardia (**atropine**).", 6)]))]},
            {"num": "25", "title": "Drugs and the ear", "parts": [p("Ototoxic drugs damage hearing.")]}]

def load(env, monkeypatch, tmp_path, who="meena@x.com"):
    env.csv(SYLLABUS)
    with Session_() as s:
        from main import Program, Semester
        pr = s.query(Program).filter_by(name="M.B.B.S").one(); sem = s.query(Semester).filter_by(program_id=pr.id).one()
        s.add(User(name="Meena", email="meena@x.com", pw=main.hp("pw"), role="student", program_id=pr.id, semester=sem.semester_no)); s.commit()
    monkeypatch.setattr(bookload, "read_book", lambda paths: book())
    class Pics:
        made = 0
        def __init__(self, *a): pass
        def __call__(self, i): Pics.made += 1; return f"/api/uploads/{Pics.made:032x}.webp"
    monkeypatch.setattr(bookload, "Pictures", Pics)
    m = tmp_path / "map.json"; m.write_text(json.dumps(MAP)); pdf = tmp_path / "book.pdf"; pdf.write_bytes(b"%PDF-1.4")
    with Session_() as s: manage.load_book(s, types.SimpleNamespace(pdfs=[str(pdf)], student=who, map=str(m)))
    with Session_() as s: return {t.title: t.id for t in s.query(Topic)}

def note(tid):
    with Session_() as s: n = s.query(TopicNote).filter_by(topic_id=tid).first(); return n.content if n else None

def test_the_book_is_filed_under_the_syllabus_as_her_notes(env, monkeypatch, tmp_path):
    t = load(env, monkeypatch, tmp_path)
    r = note(t["Receptors"]); assert r.startswith("*Your book, chapter 3: General principles of drug action*")
    assert "**receptors**" in r and "## Receptors as drug targets" in r and "![Fig. 3.1](/api/uploads/" in r and "**Fig. 3.1** Receptor states." in r
    assert "competitive antagonist" not in r  # its own topic
    d = note(t["Dose–response"]); assert d.startswith("*Your book, chapter 3") and "## Antagonists" in d and "![Equation](" in d
    a = note(t["Anticholinergic drugs"])
    assert "## Muscarinic receptors" in a and "**Table 11.2** Examples of drugs acting on muscarinic receptors\n\n![Table 11.2](" in a
    assert "> **Clinical uses of drugs acting on muscarinic receptors**\n>\n> - **Antagonists**:\n>   - Cardiovascular: bradycardia (**atropine**)." in a
    assert note(t["Cholinergic drugs"]).count("Acetylcholine acts") == 1 and note(t["Not in the book"]) is None
    assert not any("Ototoxic" in (note(x) or "") for x in t.values())  # a chapter outside the syllabus is left out
    with Session_() as s:
        m = s.query(CourseMaterial).one(); secs = json.loads(m.sections); paras = json.loads(m.paras)
        assert json.loads(m.sources)[0]["name"] == "A Pharmacology Book (2nd ed.)" and m.matched_by == "book" and m.saved_at
        assert secs[0]["from"] == 1 and secs[-1]["to"] == len(paras) and all(a_["to"] + 1 == b_["from"] for a_, b_ in zip(secs, secs[1:]))  # in order, nothing skipped
        assert secs[-1]["topic_id"] is None  # the ear chapter, kept in her material but filed nowhere
    stu = env.login("meena@x.com")
    v = env.c.get(f"/api/courses/{json.loads(json.dumps(m.course_id))}/my-material", headers=stu).json()  # the app's own screen shows it
    assert (v["covered"], v["with_notes"], v["topics"]) == (4, 4, 5)
    assert env.c.get(f"/api/topics/{t['Anticholinergic drugs']}", headers=stu).json()["my_notes"] == a
    with Session_() as s: manage.load_book(s, types.SimpleNamespace(pdfs=[str(tmp_path / "book.pdf")], student="meena@x.com", map=str(tmp_path / "map.json")))
    with Session_() as s: assert s.query(CourseMaterial).count() == 1 and s.query(TopicNote).count() == 4  # loading again replaces it

def test_a_student_must_be_placed_in_the_course(env, monkeypatch, tmp_path):
    env.csv(SYLLABUS); env.add_user("other@x.com")
    m = tmp_path / "map.json"; m.write_text(json.dumps(MAP)); pdf = tmp_path / "b.pdf"; pdf.write_bytes(b"%PDF")
    with Session_() as s:
        try: manage.load_book(s, types.SimpleNamespace(pdfs=[str(pdf)], student="other@x.com", map=str(m))); assert False
        except SystemExit as e: assert "is not placed in" in str(e)

def test_her_steps_are_made_in_advance_without_using_her_allowance(env, monkeypatch, tmp_path):
    t = load(env, monkeypatch, tmp_path)
    with Session_() as s: s.merge(main.Setting(k="deepseek_key", v="sk-test")); s.commit()
    sent = []
    async def chat(k, messages, **kw):
        sent.append(messages[1]["content"])
        return json.dumps({"points": ["a", "b", "c"], "hook": "h", "hook_answer": "x", "text": "t", "question": "q", "answer": "a"}), 10
    monkeypatch.setattr(main, "chat", chat)
    with Session_() as s: manage.prepare_steps(s, types.SimpleNamespace(student="meena@x.com", kinds="gist,why,check", limit=0, parallel=2))
    with Session_() as s:
        assert s.query(PrivateAnswer).count() == 12 and s.query(main.AICache).count() == 0  # 4 topics with her notes x 3 steps, kept for her alone
        assert s.query(StepLog).count() == 0 and s.query(StudyAICall).count() == 0  # nothing she did, nothing counted
    assert any("Atropine" in m for m in sent) and len(sent) == 12
    stu = env.login("meena@x.com"); n = len(sent)
    r = env.c.get(f"/api/topics/{t['Anticholinergic drugs']}/ai/gist", headers=stu).json()
    assert r["own_notes"] and r["cached"] and len(sent) == n  # opens at once: nothing is sent
