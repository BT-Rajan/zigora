import os, types
import main, manage
from main import Session_, Program, Course, Topic, Unit, User

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
FILES = [os.path.join(ROOT, "content", "mbbs_year2_pharmacology.csv")]

def test_replace_catalog_deletes_everything_and_loads_mbbs(env, tmp_path):
    env.csv("program,semester,course,unit,topic,content\nMech,Semester 1,Chem,U1,Water,w\n")
    tree = env.c.get("/api/tree", headers=env.admin).json(); tid = tree[0]["semesters"][0]["courses"][0]["units"][0]["topics"][0]["id"]
    env.add_user("s@x.com", program=tree[0]["id"], semester=1); stu = env.login("s@x.com")
    assert env.c.put(f"/api/topics/{tid}/complete", headers=stu).status_code == 200  # progress that goes with the old topic
    with Session_() as s:
        manage.replace_catalog(s, types.SimpleNamespace(csv=FILES, yes=True, dir=str(tmp_path)))
    assert any(f.name.endswith(".sqlite.gz") for f in tmp_path.iterdir())  # backed up first
    with Session_() as s:
        assert [p.name for p in s.query(Program)] == ["M.B.B.S"]
        assert [c.name for c in s.query(Course)] == ["Pharmacology"]
        ph = s.query(Course).one()
        units = s.query(Unit).filter_by(course_id=ph.id).order_by(Unit.position).all()
        assert len(units) == 20 and units[0].name == "Unit 1 – General Pharmacological Principles" and units[-1].name == "Unit 20 – Miscellaneous Drugs"
        topics = s.query(Topic).filter_by(course_id=ph.id).all()
        assert len(topics) == 99 and sum(bool(t.diagram) for t in topics) == 29 and all(t.content_format == "markdown" and t.content.startswith("**What this topic covers**") for t in topics)
        assert s.query(User).filter_by(email="s@x.com").one().program_id is None  # users stay; their placement goes with the old program
    first = env.c.get("/api/tree", headers=env.admin).json()[0]["semesters"][0]["courses"][0]["units"][1]["topics"]
    assert [t["title"] for t in first][:2] == ["General considerations of the autonomic nervous system", "Cholinergic transmission and cholinergic drugs"]

def test_replace_catalog_stops_on_a_bad_file_before_deleting(env, tmp_path):
    env.csv("program,semester,course,unit,topic,content\nMech,Semester 1,Chem,U1,Water,w\n")
    bad = tmp_path / "bad.csv"; bad.write_text("program,semester,course,unit,topic\nMBBS,,,,\n")
    with Session_() as s:
        try: manage.replace_catalog(s, types.SimpleNamespace(csv=[str(bad)], yes=True, dir=str(tmp_path))); assert False
        except SystemExit as e: assert "can't be imported" in str(e)
    with Session_() as s: assert [p.name for p in s.query(Program)] == ["Mech"]

def test_import_fills_an_existing_course_without_deleting(env, capsys):
    env.csv("program,semester,course,unit,topic,content\nM.B.B.S,Year 2,Pharmacology,Old unit,Kept,k\nB.E,Semester 1,Chem,U1,Water,w\n")
    with Session_() as s: manage.import_files(s, types.SimpleNamespace(csv=FILES, yes=True, dry_run=False))
    with Session_() as s:
        assert sorted(p.name for p in s.query(Program)) == ["B.E", "M.B.B.S"] and s.query(Course).count() == 2  # reused, nothing deleted
        ph = s.query(Course).filter_by(name="Pharmacology").one()
        assert s.query(Unit).filter_by(course_id=ph.id).count() == 21 and s.query(Topic).filter_by(course_id=ph.id).count() == 100
    assert "would create 0 programs, 0 semesters, 0 courses, 20 units, 99 topics" in capsys.readouterr().out
    with Session_() as s: manage.import_files(s, types.SimpleNamespace(csv=FILES, yes=True, dry_run=False))
    with Session_() as s: assert s.query(Topic).count() == 101  # a second run adds nothing
