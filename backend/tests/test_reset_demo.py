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
