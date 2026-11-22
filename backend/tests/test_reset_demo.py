import os, types
import main, manage
from main import Session_, Program, Course, Topic, User, Setting, GuardianLink, UPLOADS

PHARM = os.path.join(os.path.dirname(__file__), "..", "..", "content", "archive", "pharmacology-v1", "mbbs_year2_pharmacology.csv")

def test_reset_demo_wipes_everything_and_makes_demo_accounts(env, tmp_path):
    env.csv("program,semester,course,unit,topic,content\nB.E,Semester 1,Chem,U1,Water,w\n")
    tree = env.c.get("/api/tree", headers=env.admin).json(); tid = tree[0]["semesters"][0]["courses"][0]["units"][0]["topics"][0]["id"]
    env.add_user("old@x.com", program=tree[0]["id"], semester=1); old = env.login("old@x.com")
    assert env.c.put(f"/api/topics/{tid}/complete", headers=old).status_code == 200
    with Session_() as s: s.merge(Setting(k="deepseek_key", v="secret")); s.commit()
    os.makedirs(UPLOADS, exist_ok=True); open(os.path.join(UPLOADS, "x.png"), "wb").write(b"1")
    with Session_() as s:
        manage.reset_demo(s, types.SimpleNamespace(files=[PHARM], password="demo1234", yes=True, dir=str(tmp_path)))
    assert any(f.name.endswith(".sqlite.gz") for f in tmp_path.iterdir())  # backed up first
    assert set(os.listdir(UPLOADS)) <= set(os.listdir(main.FIGURES))  # every upload wiped; only the figures shipped with the content come back
    with Session_() as s:
        assert [p.name for p in s.query(Program)] == ["M.B.B.S"] and s.query(Topic).count() == 99
        assert {x.k for x in s.query(Setting)} == {"mastery_rule_since", "assign_tie_since"}  # the AI key and every other setting are gone
        users = s.query(User).all(); assert len(users) == 16 and not s.query(User).filter_by(email="old@x.com").first()
        assert sum(u.role == "admin" for u in users) == 2 and sum(u.role == "faculty" for u in users) == 2 and sum(u.role == "guardian" for u in users) == 4
        assert sum(bool(u.self_registered) for u in users) == 4 and sum(bool(u.pro_until) for u in users) == 2
        assert s.query(GuardianLink).count() == 4
        t1 = s.query(User).filter_by(email="teacher1@example.com").one(); assert s.query(Course).one().faculty_owner_id == t1.id
        st = s.query(User).filter_by(email="student1@example.com").one(); assert st.program_id == s.query(Program).one().id and st.semester == 2
    assert env.c.get("/api/me", headers=old).status_code == 401  # an old sign-in opens nothing
    for e in ("admin2@example.com", "teacher1@example.com", "student1@example.com", "lite1@example.com", "pro1@example.com", "parent1@example.com", "schoolteacher2@example.com", "child1"):
        r = env.c.post("/api/login", json={"email": e, "password": "demo1234"}); assert r.status_code == 200, (e, r.text)
    stu = env.login("student1@example.com", "demo1234")
    assert env.c.get(f"/api/tree", headers=stu).status_code == 200

CONTENT = os.path.join(os.path.dirname(__file__), "..", "..", "content")

def test_reset_demo_places_a_second_set_of_students_in_the_second_program(env, tmp_path):
    files = [os.path.join(CONTENT, f) for f in ("pharmacology_mbbs_year2.csv", "engineering_mechanics_be_mech_year1.csv")]
    with Session_() as s:
        manage.reset_demo(s, types.SimpleNamespace(files=files, password="demo1234", yes=True, dir=str(tmp_path)))
    with Session_() as s:
        mbbs = s.query(Program).filter_by(name="M.B.B.S").one(); mech = s.query(Program).filter_by(name="B.E Mechanical Engineering").one()
        assert s.query(User).count() == 22
        for k in ("student1", "student2", "lite1", "lite2", "pro1", "pro2"):
            u = s.query(User).filter_by(email=k + "@example.com").one(); assert (u.program_id, u.semester) == (mbbs.id, 2), k
        for k in ("student3", "student4", "lite3", "lite4", "pro3", "pro4"):
            u = s.query(User).filter_by(email=k + "@example.com").one(); assert (u.program_id, u.semester) == (mech.id, 1), k
        assert s.query(User).filter_by(email="pro3@example.com").one().pro_until and s.query(User).filter_by(email="lite3@example.com").one().self_registered
    stu = env.login("student3@example.com", "demo1234")
    tree = env.c.get("/api/tree", headers=stu).json()
    assert [p["name"] for p in tree] == ["B.E Mechanical Engineering"] and tree[0]["semesters"][0]["courses"][0]["name"] == "Engineering Mechanics"

def test_demo_students_join_a_running_server_without_deleting_anything(env):
    env.csv(open(os.path.join(CONTENT, "engineering_mechanics_be_mech_year1.csv"), encoding="utf-8").read())
    env.add_user("lite3@example.com")  # already there: moved, password kept
    with Session_() as s: before = s.query(User).count()
    with Session_() as s: manage.demo_students(s, types.SimpleNamespace(program="B.E Mechanical Engineering", year="Year 1", password="demo1234"))
    with Session_() as s:
        mech = s.query(Program).filter_by(name="B.E Mechanical Engineering").one(); assert s.query(User).count() == before + 5
        assert all((u.program_id, u.semester) == (mech.id, 1) for u in s.query(User).filter(User.email.in_([d[0] for d in manage.DEMO2])))
    assert env.c.post("/api/login", json={"email": "pro4@example.com", "password": "demo1234"}).status_code == 200
