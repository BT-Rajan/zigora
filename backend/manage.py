"""Admin CLI: create/reset admins, add students, reset any password, enable/disable, list.
Run via ./manage.sh. Omit --password to be prompted securely."""
import argparse, getpass, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))
from main import Base, engine, Session_, User, hp, upgrade_schema, applied_migrations, integrity_report, ownership_report, DB, UPLOADS

def password(given):
    while True:
        p = given or getpass.getpass("Password: ")
        if len(p) < 8: print("Use at least 8 characters."); given = None; continue
        if given or p == getpass.getpass("Confirm password: "): return p
        print("Passwords don't match, try again."); given = None

def find(s, email):
    u = s.query(User).filter_by(email=email.strip().lower()).first()
    if not u: sys.exit(f"No user with email {email}. See: ./manage.sh list")
    return u

def prepare_steps(s, x):
    """Asks the AI for a student's private gist and steps on each topic with her notes, as opening them would, and keeps them for her.
    It is not her doing: the requests don't count toward her daily limit and her step choices aren't recorded, so the app adapts only to what she does."""
    import asyncio
    import main
    from main import Topic, Unit, TopicNote, StepLog, StudyAICall, HTTPException
    who = x.student.strip().lower()
    u = s.query(User).filter((User.email == who) | (User.username == who)).first()
    if not u or u.role != "student": sys.exit(f"No student {x.student}.")
    kinds = [k.strip() for k in x.kinds.split(",") if k.strip()]
    bad = [k for k in kinds if k not in main.STEPS and k not in ("explain", "answer")]
    if bad: sys.exit("Unknown step(s): " + ", ".join(bad))
    order = {t.id: n for n, t in enumerate(s.query(Topic).join(Unit, Unit.id == Topic.unit_id).order_by(Unit.course_id, Unit.position, Topic.position))}
    tids = sorted({n.topic_id for n in s.query(TopicNote).filter_by(user_id=u.id)}, key=lambda t: order.get(t, 10**9))
    if x.limit: tids = tids[:x.limit]
    if not tids: sys.exit(f"{x.student} has no notes of her own yet. Load them first (./manage.sh load-book ...).")
    first_log = (s.query(main.func.max(StepLog.id)).scalar() or 0); first_call = (s.query(main.func.max(StudyAICall.id)).scalar() or 0)
    main.STUDY_AI_DAILY = 10 ** 9  # this run only: the student's own allowance is left as it was (the calls are removed below)
    done, failed, gate = [0], [], asyncio.Semaphore(max(1, x.parallel))
    async def one(tid, kind):
        async with gate:
            with main.Session_() as s2:
                try: await main.ai(tid, kind, s2.get(User, u.id), s2); done[0] += 1
                except HTTPException as e: failed.append(f"topic {tid} {kind}: {e.detail}")
                except Exception as e: failed.append(f"topic {tid} {kind}: {e}")
            if done[0] % 25 == 0: print(f"  {done[0]} of {len(tids) * len(kinds)} ready")
    async def run(): await asyncio.gather(*(one(t, k) for t in tids for k in kinds))
    print(f"Preparing {', '.join(kinds)} for {len(tids)} topic(s) of {u.name}…")
    asyncio.run(run())
    with main.Session_() as s3:
        s3.query(StepLog).filter(StepLog.user_id == u.id, StepLog.id > first_log).delete(synchronize_session=False)
        s3.query(StudyAICall).filter(StudyAICall.user_id == u.id, StudyAICall.id > first_call).delete(synchronize_session=False); s3.commit()
    print(f"Ready: {done[0]}. " + (f"Not ready ({len(failed)}), they will be made when she opens them:\n  " + "\n  ".join(failed[:20]) if failed else "All of them."))

def load_book(s, x):
    """A student's own book, filed under the syllabus topics of a course as her private notes, exactly as Bring your own notes stores them
    (her material and its sections, then a note per topic), so the app's own screens show and change it. Running it again replaces it."""
    import datetime as dt, json
    from main import Program, Semester, Course, Topic, CourseMaterial, TopicNote, syllabus, UPLOADS, SECRET, MAX_PARAS_CHARS
    import bookload
    mp = json.load(open(x.map, encoding="utf-8")); want = mp["course"]
    for f in x.pdfs:
        if not os.path.isfile(f): sys.exit(f"No such file: {f}")
    who = x.student.strip().lower()
    u = s.query(User).filter((User.email == who) | (User.username == who)).first()
    if not u or u.role != "student": sys.exit(f"No student {x.student}. See: ./manage.sh list")
    p = s.query(Program).filter(Program.name == want["program"]).first()
    sem = p and s.query(Semester).filter_by(program_id=p.id, name=want["semester"]).first()
    co = sem and s.query(Course).filter_by(semester_id=sem.id, name=want["course"]).first()
    if not co: sys.exit(f"No course {want['program']} > {want['semester']} > {want['course']}. Import the syllabus first: ./manage.sh import content/mbbs_year2_pharmacology.csv")
    if (u.program_id, u.semester) != (p.id, sem.semester_no): sys.exit(f"{x.student} is not placed in {want['program']}, {want['semester']}, so she can't open {co.name}. Place her on the Students page first.")
    topics = {t.title: t.id for _, ts in syllabus(s, co.id) for t in ts}
    unknown = {t for c in mp["chapters"].values() for t in [c.get("default"), *c.get("headings", {}).values(), *c.get("paragraphs", {}).values()] if t and t not in topics}
    unknown |= {t for t in mp.get("boxes", {}).values() if t and t not in topics}
    if unknown: print("Not in this course's syllabus, so left out: " + "; ".join(sorted(unknown)))
    print(f"Reading {len(x.pdfs)} PDF file(s)… (a minute or two)")
    chapters = bookload.read_book(x.pdfs)
    print(f"{len(chapters)} chapters (front matter, preface and index left out). Cutting out the figures, tables and equations…")
    pics = bookload.Pictures(x.pdfs, UPLOADS, SECRET)
    parts = bookload.file_parts(chapters, mp, pics, book_label="Your book")
    paras, secs = [], []
    for title, md in parts:
        tid = topics.get(title) if title else None
        paras.append(md)
        if secs and secs[-1]["topic_id"] == tid: secs[-1]["to"] = len(paras)
        else: secs.append({"from": len(paras), "to": len(paras), "topic_id": tid})
    if sum(len(p_) for p_ in paras) > MAX_PARAS_CHARS: sys.exit("The book is longer than one course's material can hold.")
    now = dt.datetime.utcnow(); words = sum(len(p_.split()) for p_ in paras)
    m = s.query(CourseMaterial).filter_by(user_id=u.id, course_id=co.id).first() or CourseMaterial(user_id=u.id, course_id=co.id)
    m.sources = json.dumps([{"name": mp["book"][:200], "kind": "pdf", "paras": len(paras), "words": words}], ensure_ascii=False)
    m.paras, m.sections, m.matched_by, m.saved_at, m.updated_at = json.dumps(paras, ensure_ascii=False), json.dumps(secs), "book", now, now
    s.add(m)
    course_topics = list(topics.values()) or [0]
    s.query(TopicNote).filter(TopicNote.user_id == u.id, TopicNote.topic_id.in_(course_topics)).delete(synchronize_session=False)
    per = {}
    for sec in secs:
        if sec["topic_id"]: per.setdefault(sec["topic_id"], []).append("\n\n".join(paras[sec["from"] - 1:sec["to"]]))
    for tid, chunks in per.items(): s.add(TopicNote(user_id=u.id, topic_id=tid, content="\n\n".join(chunks), updated_at=now))
    s.commit()
    print(f"Filed {words:,} words and {sum(p_.startswith('![') for p_ in paras)} pictures ({pics.made} new) under {len(per)} of {len(topics)} topics of {co.name} for {u.name}.")
    left = [t for t in topics if topics[t] not in per]
    if left: print("Topics the book doesn't cover (they keep the syllabus outline only): " + "; ".join(left))

# the demo accounts reset-demo makes: (email or username, name, role, extras). Two of each kind of person the app has.
DEMO = [("admin1@example.com", "Demo Admin 1", "admin", {}), ("admin2@example.com", "Demo Admin 2", "admin", {}),
        ("teacher1@example.com", "Demo Teacher 1", "faculty", {}), ("teacher2@example.com", "Demo Teacher 2", "faculty", {}),
        ("student1@example.com", "Demo Student 1", "student", {"placed": True}), ("student2@example.com", "Demo Student 2", "student", {"placed": True}),
        ("lite1@example.com", "Demo Lite Student 1", "student", {"self": True}), ("lite2@example.com", "Demo Lite Student 2", "student", {"self": True}),
        ("pro1@example.com", "Demo Pro Student 1", "student", {"self": True, "pro": True}), ("pro2@example.com", "Demo Pro Student 2", "student", {"self": True, "pro": True}),
        ("parent1@example.com", "Demo Parent 1", "guardian", {"relation": "parent"}), ("parent2@example.com", "Demo Parent 2", "guardian", {"relation": "parent"}),
        ("schoolteacher1@example.com", "Demo School Teacher 1", "guardian", {"relation": "teacher"}), ("schoolteacher2@example.com", "Demo School Teacher 2", "guardian", {"relation": "teacher"}),
        ("child1", "Demo Child 1", "student", {"child": 0}), ("child2", "Demo Child 2", "student", {"child": 1})]
# the demo students of the second program imported (B.E Mechanical Engineering, Year 1, in ./reset-demo.sh): a student is in one program only
DEMO2 = [("student3@example.com", "Demo Student 3", "student", {"placed": True}), ("student4@example.com", "Demo Student 4", "student", {"placed": True}),
         ("lite3@example.com", "Demo Lite Student 3", "student", {"self": True}), ("lite4@example.com", "Demo Lite Student 4", "student", {"self": True}),
         ("pro3@example.com", "Demo Pro Student 3", "student", {"self": True, "pro": True}), ("pro4@example.com", "Demo Pro Student 4", "student", {"self": True, "pro": True})]

def demo_student(key, name, ex, pw, now, place):
    """A demo student as reset-demo makes them: onboarded, college level, signed up (Lite or Pro) or placed, in the given (program_id, year)."""
    import datetime as dt
    kw = {"username": key} if "child" in ex else {"email": key}
    kw.update(onboarded_at=now, level="school" if "child" in ex else "college")  # demo students go straight to their home page
    if ex.get("self"): kw["self_registered"] = True
    if ex.get("pro"): kw["pro_until"] = now + dt.timedelta(days=365)
    if (ex.get("placed") or ex.get("self")) and place: kw.update(program_id=place[0], semester=place[1])
    return User(name=name, pw=hp(pw), role="student", active=True, must_change=False, **kw)

def places(s):
    """Each imported program's first year that has a course, in the order the programs were made: where the demo students go."""
    from main import Course, Semester
    out = []
    for c in s.query(Course).order_by(Course.id):
        sm = s.get(Semester, c.semester_id) if c.semester_id else None
        if sm and sm.program_id not in [p for p, _ in out]: out.append((sm.program_id, sm.semester_no))
    return out

def reset_demo(s, x):
    """A clean demo server: everything is deleted (users, courses, settings and AI keys, uploads, every record), the schema and its migrations stay.
    Then the given content is imported and the demo accounts made. A backup is written first."""
    import datetime as dt, shutil
    from sqlalchemy import inspect, text
    from main import Setting, Course, Semester, GuardianLink, import_csv, ImportIn
    from backup import run_backup
    pw = password(x.password)
    texts = []
    for f in x.files:
        if not os.path.isfile(f): sys.exit(f"No such file: {f}")
        texts.append((f, open(f, encoding="utf-8-sig").read()))
    with engine.connect() as c: tables = [t for t in inspect(c).get_table_names() if t != "schema_migrations"]
    with engine.connect() as c: rows = {t: c.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar() for t in ("users", "subjects", "topics", "settings") if t in tables}
    print(f"This deletes ALL data: {rows.get('users', 0)} user(s) including every admin, {rows.get('subjects', 0)} course(s), {rows.get('topics', 0)} topic(s),")
    print(f"{rows.get('settings', 0)} setting(s) (AI keys, mail, sign-in, prompts, payments), every upload, and every record of activity.")
    if not x.yes and input("Type DELETE EVERYTHING to continue: ").strip() != "DELETE EVERYTHING": sys.exit("Nothing changed.")
    for f in run_backup(DB, UPLOADS, os.path.abspath(x.dir)): print("Backup: " + f)
    s.close()
    with engine.begin() as c:
        mysql = c.dialect.name != "sqlite"
        c.execute(text("SET FOREIGN_KEY_CHECKS = 0" if mysql else "PRAGMA foreign_keys = OFF"))  # the whole set goes, so the order doesn't matter
        for t in tables: c.execute(text("DELETE FROM " + c.dialect.identifier_preparer.quote(t)))
        if mysql: c.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
    if os.path.isdir(UPLOADS):
        for n in os.listdir(UPLOADS):
            p = os.path.join(UPLOADS, n); shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    now = dt.datetime.utcnow()
    for k in ("mastery_rule_since", "assign_tie_since"): s.add(Setting(k=k, v=now.isoformat()))  # as a fresh install writes them: the current rules apply from now
    def add(name, role, **kw):
        u = User(name=name, pw=hp(pw), role=role, active=True, must_change=False, **kw); s.add(u); s.flush(); return u
    first = add(DEMO[0][1], "admin", email=DEMO[0][0]); s.commit()
    for f, t in texts:
        r = import_csv(ImportIn(csv=t, dry_run=False), first, s)
        if r["error_count"]: print(f"{f}: {r['error_count']} row(s) skipped: " + "; ".join(f"row {e['row']}: {e['error']}" for e in r["errors"][:5]))
        print(f"{f}: created " + ", ".join(f"{v} {k}" for k, v in r["created"].items()))
    co = s.query(Course).order_by(Course.id).first(); at = places(s)
    made = {DEMO[0][0]: first}
    for key, name, role, ex in DEMO[1:] + (DEMO2 if len(at) > 1 else []):
        if role == "student":
            u = demo_student(key, name, ex, pw, now, at[1] if (key, name, role, ex) in DEMO2 else at[0] if at else None); s.add(u); s.flush(); made[key] = u; continue
        kw = {"email": key}
        if role == "guardian": kw["relation"] = ex["relation"]
        made[key] = add(name, role, **kw)
    for i in (0, 1):  # each parent and each school teacher looks after one child
        for g in (f"parent{i + 1}@example.com", f"schoolteacher{i + 1}@example.com"):
            s.add(GuardianLink(guardian_id=made[g].id, student_id=made[f"child{i + 1}"].id, status="active"))
    if co:  # the first teacher runs every imported course
        for c_ in s.query(Course): c_.faculty_owner_id = made["teacher1@example.com"].id
    s.commit()
    print("\nDemo accounts (all with the password you gave):")
    for key, name, role, ex in DEMO + (DEMO2 if len(at) > 1 else []):
        kind = {"admin": "admin", "faculty": "college teacher", "guardian": ex.get("relation", "") and ("parent" if ex.get("relation") == "parent" else "school teacher")}.get(role) or \
               ("school child (signs in with the username)" if "child" in ex else "Pro student (signed up)" if ex.get("pro") else "Lite student (signed up)" if ex.get("self") else "college student")
        print(f"  {key:<28} {kind}")
    from main import Program, Semester
    def where(pl): return f"{s.get(Program, pl[0]).name}, {s.query(Semester).filter_by(program_id=pl[0], semester_no=pl[1]).first().name}"
    if at: print(f"student1/2, lite1/2 and pro1/2 are in {where(at[0])}" + (f"; student3/4, lite3/4 and pro3/4 in {where(at[1])}" if len(at) > 1 else "") + ". teacher1 owns every course.")
    print("Add an AI key under Settings > AI before using the AI (the settings were wiped too).")

def import_files(s, x):
    """The Bulk upload of the admin's Programs page, from the terminal: a preview first, then the import after a yes."""
    from main import import_csv, ImportIn
    me = s.query(User).filter_by(role="admin", active=True).order_by(User.id).first()
    if not me: sys.exit("There is no active admin. Create one first: ./manage.sh admin --email ...")
    for f in x.csv:
        if not os.path.isfile(f): sys.exit(f"No such file: {f}")
        t = open(f, encoding="utf-8-sig").read()
        r = import_csv(ImportIn(csv=t, dry_run=True), me, s)
        print(f"{f}: would create " + ", ".join(f"{v} {k}" for k, v in r["created"].items()) + f"; update {r['updated_topics']} existing topic(s)")
        for w in r["warnings"]: print("  warning: " + w)
        if r["error_count"]: sys.exit(f"{r['error_count']} row(s) can't be imported, nothing changed:\n" + "\n".join(f"  row {e['row']}: {e['error']}" for e in r["errors"]))
        if x.dry_run: continue
        if not x.yes and input("Import it? [y/N] ").strip().lower() not in ("y", "yes"): print("Skipped."); continue
        r = import_csv(ImportIn(csv=t, dry_run=False), me, s)
        print("Imported: created " + ", ".join(f"{v} {k}" for k, v in r["created"].items()) + f"; updated {r['updated_topics']} topic(s)")

def demo_students(s, x):
    """The second program's demo students (student3/4, lite3/4, pro3/4) added to a server that is already running, in the program and year named.
    Nothing is deleted; accounts that exist already are moved there and keep their password."""
    import datetime as dt
    from main import Program, Semester
    p = s.query(Program).filter(Program.name == x.program).first()
    if not p: sys.exit(f"No program called {x.program!r}. Import its content first.")
    sm = s.query(Semester).filter_by(program_id=p.id, name=x.year).first()
    if not sm or sm.semester_no is None: sys.exit(f"{x.program} has no year called {x.year!r} with a number.")
    new = [d for d in DEMO2 if not s.query(User).filter_by(email=d[0]).first()]
    pw = password(x.password) if new else None; now = dt.datetime.utcnow()
    for key, name, role, ex in DEMO2:
        u = s.query(User).filter_by(email=key).first()
        if u: u.program_id, u.semester = p.id, sm.semester_no; print(f"  {key:<24} moved to {p.name}, {sm.name}")
        else: s.add(demo_student(key, name, ex, pw, now, (p.id, sm.semester_no))); print(f"  {key:<24} made, in {p.name}, {sm.name}")
    s.commit()

def replace_catalog(s, x):
    """The whole course catalogue replaced by the given CSVs. Students' own built courses and all users stay; students lose their program and semester placement."""
    from main import Program, Course, Topic, remove, import_csv, ImportIn
    from backup import run_backup
    me = s.query(User).filter_by(role="admin", active=True).order_by(User.id).first()
    if not me: sys.exit("There is no active admin. Create one first: ./manage.sh admin --email ...")
    texts = []
    for f in x.csv:
        if not os.path.isfile(f): sys.exit(f"No such file: {f}")
        texts.append((f, open(f, encoding="utf-8-sig").read()))
    for f, t in texts:  # the files' own mistakes, before anything is touched
        r = import_csv(ImportIn(csv=t, dry_run=True), me, s)
        if r["error_count"]: sys.exit(f"{f}: {r['error_count']} row(s) can't be imported, nothing changed:\n" + "\n".join(f"  row {e['row']}: {e['error']}" for e in r["errors"]))
    print(f"This deletes {s.query(Program).count()} program(s), {s.query(Course).count()} course(s) and {s.query(Topic).count()} topic(s),")
    print("with their units, quizzes, and students' progress and test results in them. Users and students' own courses stay.")
    if not x.yes and input("Type DELETE to continue: ").strip() != "DELETE": sys.exit("Nothing changed.")
    for f in run_backup(DB, UPLOADS, os.path.abspath(x.dir)): print("Backup: " + f)
    for (pid,) in s.query(Program.id).all(): remove("programs", pid, me, s)
    for (cid,) in s.query(Course.id).all(): remove("courses", cid, me, s)  # courses outside any program (offered courses)
    for f, t in texts:
        r = import_csv(ImportIn(csv=t, dry_run=False), me, s)
        print(f"{f}: created " + ", ".join(f"{v} {k}" for k, v in r["created"].items()) + (f"; warnings: {'; '.join(r['warnings'])}" if r["warnings"] else ""))
    print("Done. Students need their program and year set again (Students page, or they choose it when they next sign in).")

def main():
    ap = argparse.ArgumentParser(description=__doc__); sub = ap.add_subparsers(dest="cmd", required=True)
    ad = sub.add_parser("admin", help="create the admin, or reset its password and re-enable it")
    ad.add_argument("--email", required=True); ad.add_argument("--name", default="Admin"); ad.add_argument("--password")
    a = sub.add_parser("add", help="create a user"); a.add_argument("--name", required=True); a.add_argument("--email", required=True)
    a.add_argument("--role", choices=["student", "faculty", "admin"], default="student"); a.add_argument("--password")
    p = sub.add_parser("passwd", help="reset the password of any user"); p.add_argument("--email", required=True); p.add_argument("--password")
    for c in ("enable", "disable"): sub.add_parser(c, help=c + " a user").add_argument("--email", required=True)
    r = sub.add_parser("role", help="change a user's role"); r.add_argument("--email", required=True); r.add_argument("--role", choices=["student", "faculty", "admin"], required=True)
    b = sub.add_parser("backup", help="dump the database and uploaded images into a folder"); b.add_argument("--dir", default=os.getenv("BACKUP_DIR") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backups")); b.add_argument("--keep-days", type=int, default=14)
    sub.add_parser("migrate", help="apply pending database migrations and list what is applied")
    sub.add_parser("owners", help="list courses that need an owner, with their old assigned faculty (changes nothing)")
    sub.add_parser("integrity", help="list programs, semesters, courses, units, topics and quizzes whose parent is missing (changes nothing)")
    sub.add_parser("list", help="list users"); sub.add_parser("check", help="exit 1 if there is no active admin")
    lb = sub.add_parser("load-book", help="file a student's own textbook (PDFs) under a course's syllabus topics as her notes, with its figures, as the app's Bring your own notes does")
    lb.add_argument("pdfs", nargs="+", help="the book's PDF files, in order"); lb.add_argument("--student", required=True, help="the student's email or username")
    lb.add_argument("--map", required=True, help="the book's map to the syllabus, e.g. content/archive/pharmacology-v1/dales_pharmacology_map.json")
    ps = sub.add_parser("prepare-steps", help="write a student's own gist and steps in advance for every topic where she has her own notes, so they open at once (uses the AI)")
    ps.add_argument("--student", required=True); ps.add_argument("--kinds", default="gist,why,example,exam,check", help="which steps (default: gist,why,example,exam,check)")
    ps.add_argument("--limit", type=int, default=0, help="only the first N topics (0 = all)"); ps.add_argument("--parallel", type=int, default=4)
    ds = sub.add_parser("demo-students", help="add the demo students student3/4, lite3/4 and pro3/4 (Lite and Pro) to a running server, placed in one program and year; nothing is deleted")
    ds.add_argument("--program", default="B.E Mechanical Engineering"); ds.add_argument("--year", default="Year 1"); ds.add_argument("--password", help="their password (asked if left out)")
    rd = sub.add_parser("reset-demo", help="back up, then DELETE ALL DATA (every user, course, setting, AI key, upload and record), optionally import content, and create demo accounts: 2 of each kind, one password")
    rd.add_argument("--import", dest="files", nargs="*", default=[], help="content CSVs to load after the wipe (e.g. content/pharmacology_mbbs_year2.csv)")
    rd.add_argument("--password", help="the demo accounts' password (asked if left out; at least 8 characters)"); rd.add_argument("--yes", action="store_true", help="don't ask to type the confirmation")
    rd.add_argument("--dir", default=os.getenv("BACKUP_DIR") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backups"))
    im = sub.add_parser("import", help="import a content CSV (programs, years, courses, units, topics); existing names are reused and nothing is deleted")
    im.add_argument("csv", nargs="+", help="content CSV files, imported in order (e.g. content/pharmacology_mbbs_year2.csv)")
    im.add_argument("--yes", action="store_true", help="import without asking"); im.add_argument("--dry-run", action="store_true", help="only show what would be created")
    rc = sub.add_parser("replace-catalog", help="back up, DELETE every program and course (their units, topics, quizzes, and students' progress and test results in them), then import content CSVs")
    rc.add_argument("csv", nargs="+", help="content CSV files, imported in order (e.g. content/pharmacology_mbbs_year2.csv)")
    rc.add_argument("--yes", action="store_true", help="don't ask to type DELETE"); rc.add_argument("--dir", default=os.getenv("BACKUP_DIR") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backups"))
    x = ap.parse_args(); upgrade_schema()
    with Session_() as s:
        if x.cmd == "migrate":
            print("Applied migrations:"); [print("  " + m) for m in applied_migrations()]; return
        if x.cmd == "owners":
            with engine.connect() as c: rep, legacy, _ = ownership_report(c)
            names = {u.id: f"{u.name} <{u.email}> ({u.role}{'' if u.active else ', disabled'})" for u in s.query(User)}
            from main import Course
            cname = {co.id: co.name for co in s.query(Course)}
            print(f"Courses with a working owner: {len(rep['owned'])}")
            for k, label in (("invalid_owner", "Owner is disabled or no longer faculty"), ("multiple_assigned", "Several faculty were assigned; pick one"),
                             ("assigned_not_faculty", "The assigned user is not active faculty"), ("no_faculty", "No faculty assigned")):
                print(f"{label}: {len(rep[k])}")
                for cid in rep[k]: print(f"  #{cid} {cname.get(cid, '')}" + ("  was assigned: " + "; ".join(names.get(x, f"user #{x}") for x in legacy[cid]) if legacy[cid] else ""))
            sys.exit(1 if any(rep[k] for k in rep if k != "owned") else 0)
        if x.cmd == "integrity":
            with engine.connect() as c: rep = integrity_report(c)
            for k, v in rep.items(): print(f"{k}: {len(v)}" + (f"  ids: {', '.join(map(str, v[:50]))}" + (" …" if len(v) > 50 else "") if v else ""))
            sys.exit(1 if any(rep.values()) else 0)
        if x.cmd == "backup":
            from backup import run_backup
            for f in run_backup(DB, UPLOADS, os.path.abspath(x.dir), x.keep_days): print("Wrote " + f)
            return
        if x.cmd == "replace-catalog": return replace_catalog(s, x)
        if x.cmd == "import": return import_files(s, x)
        if x.cmd == "reset-demo": return reset_demo(s, x)
        if x.cmd == "demo-students": return demo_students(s, x)
        if x.cmd == "load-book": return load_book(s, x)
        if x.cmd == "prepare-steps": return prepare_steps(s, x)
        if x.cmd == "check": sys.exit(0 if s.query(User).filter_by(role="admin", active=True).first() else 1)
        if x.cmd == "list":
            for u in s.query(User).order_by(User.id): print(f"{u.id:>3}  {u.role:<8} {'active' if u.active else 'disabled':<9} {u.email}  ({u.name})")
        elif x.cmd == "add":
            e = x.email.strip().lower()
            if s.query(User).filter_by(email=e).first(): sys.exit(f"{e} already exists. Use passwd to reset the password.")
            s.add(User(name=x.name, email=e, pw=hp(password(x.password)), role=x.role, must_change=x.role != "admin")); s.commit(); print(f"Created {x.role} {e}")
        elif x.cmd == "admin":
            e = x.email.strip().lower(); u = s.query(User).filter_by(email=e).first()
            if u: u.pw = hp(password(x.password)); u.role = "admin"; u.active = True; print(f"Reset password and set {e} as active admin")
            else: s.add(User(name=x.name, email=e, pw=hp(password(x.password)), role="admin")); print(f"Created admin {e}")
            s.commit()
        else:
            u = find(s, x.email)
            if x.cmd == "passwd": u.pw = hp(password(x.password)); u.must_change = u.role != "admin"
            elif x.cmd == "role": u.role = x.role
            else: u.active = x.cmd == "enable"
            s.commit(); print(f"Updated {u.email}")

if __name__ == "__main__": main()
