import os, types
import main, manage
from main import Session_, Program, Course, Topic, Unit, User

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
FILES = [os.path.join(ROOT, "docs", "syllabi", "mbbs-year-2.csv"), os.path.join(ROOT, "content", "mbbs_year2_pathology.csv")]

def test_replace_catalog_deletes_everything_and_loads_mbbs(env, tmp_path):
    env.csv("program,semester,course,unit,topic,content\nMech,Semester 1,Chem,U1,Water,w\n")
    tree = env.c.get("/api/tree", headers=env.admin).json(); tid = tree[0]["semesters"][0]["courses"][0]["units"][0]["topics"][0]["id"]
    env.add_user("s@x.com", program=tree[0]["id"], semester=1); stu = env.login("s@x.com")
    assert env.c.put(f"/api/topics/{tid}/complete", headers=stu).status_code == 200  # progress that goes with the old topic
    with Session_() as s:
        manage.replace_catalog(s, types.SimpleNamespace(csv=FILES, yes=True, dir=str(tmp_path)))
    assert any(f.name.endswith(".sqlite.gz") for f in tmp_path.iterdir())  # backed up first
    with Session_() as s:
        assert [p.name for p in s.query(Program)] == ["MBBS"]
        assert sorted(c.name for c in s.query(Course)) == ["Microbiology", "Pathology", "Pharmacology"]
        path = s.query(Course).filter_by(name="Pathology").one()
        units = s.query(Unit).filter_by(course_id=path.id).order_by(Unit.position).all()
        assert [u.name for u in units][0] == "Cell injury & adaptation" and len(units) == 6
        topics = s.query(Topic).filter_by(course_id=path.id).all()
        assert len(topics) == 21 and sum(bool(t.diagram) for t in topics) == 14 and all(t.content_format == "markdown" and len(t.content) > 200 for t in topics)
        assert s.query(Topic).filter(Topic.course_id != path.id).count() == 0  # the other two courses are units only, for now
        assert s.query(User).filter_by(email="s@x.com").one().program_id is None  # users stay; their placement goes with the old program
    first = [t for t in env.c.get("/api/tree", headers=env.admin).json()[0]["semesters"][0]["courses"] if t["name"] == "Pathology"][0]["units"][0]["topics"]
    assert [t["title"] for t in first] == ["Cellular adaptations", "Reversible and irreversible cell injury", "How hypoxia injures a cell", "Necrosis and its patterns", "Apoptosis and autophagy"]

def test_replace_catalog_stops_on_a_bad_file_before_deleting(env, tmp_path):
    env.csv("program,semester,course,unit,topic,content\nMech,Semester 1,Chem,U1,Water,w\n")
    bad = tmp_path / "bad.csv"; bad.write_text("program,semester,course,unit,topic\nMBBS,,,,\n")
    with Session_() as s:
        try: manage.replace_catalog(s, types.SimpleNamespace(csv=[str(bad)], yes=True, dir=str(tmp_path))); assert False
        except SystemExit as e: assert "can't be imported" in str(e)
    with Session_() as s: assert [p.name for p in s.query(Program)] == ["Mech"]
