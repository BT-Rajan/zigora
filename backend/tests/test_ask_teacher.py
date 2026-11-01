# Ask the teacher: a student asks the teacher of a topic's course; the course's owner (or an admin, when it has none) answers in a short thread.
# Nobody else reads it, the bell and dashboards say what is waiting, and a closed question takes no more replies.
from main import Session_, Course, User, TeacherQuestion
from tests.test_access import CSV, ids, enrol

def setup(env, owned=True):
    env.csv(CSV); i = ids(); enrol("stu@x.com", i["prog"]["Mech"], 1)
    if owned:
        with Session_() as s: fac = s.query(User).filter_by(email="fac@x.com").one(); s.query(Course).filter_by(name="Chem").update({"faculty_owner_id": fac.id}); s.commit()
    return i["topic"]["Water"]

def ask(env, t, text="Why does boiling remove only temporary hardness?", h=None, excerpt=""):
    return env.c.post(f"/api/topics/{t}/questions", headers=h or env.stu, json={"text": text, "excerpt": excerpt})

def test_a_student_asks_and_the_course_teacher_answers(env):
    t = setup(env)
    r = ask(env, t, excerpt="  temporary   hardness "); assert r.status_code == 200, r.text
    q = r.json(); assert q["status"] == "waiting" and q["excerpt"] == "temporary hardness" and q["messages"][0]["mine"] is True and q["teacher"] is False
    inbox = env.c.get("/api/questions", headers=env.fac).json(); assert inbox["total"] == 1 and inbox["items"][0]["student"] == "stu@x.com" and inbox["items"][0]["topic"] == "Water"
    assert any(i["key"].startswith("questions:") for i in env.c.get("/api/me/notifications", headers=env.fac).json()["items"])
    env.add_user("fac2@x.com", "faculty"); other = env.login("fac2@x.com")
    assert env.c.get("/api/questions", headers=other).json()["total"] == 0 and env.c.get(f"/api/questions/{q['id']}", headers=other).status_code == 404  # not their course
    env.add_user("stu2@x.com"); assert env.c.get(f"/api/questions/{q['id']}", headers=env.login("stu2@x.com")).status_code == 404  # nor another student's
    a = env.c.post(f"/api/questions/{q['id']}/replies", headers=env.fac, json={"text": "Boiling breaks down the bicarbonates only."}).json()
    assert a["status"] == "answered" and a["teacher"] is True and a["messages"][-1]["teacher"] is True and a["messages"][-1]["who"] == "fac@x.com"
    assert env.c.get("/api/questions", headers=env.fac).json()["total"] == 0  # nothing waiting now
    mine = env.c.get("/api/me/questions", headers=env.stu).json()["items"]; assert mine[0]["unread"] is True and mine[0]["status"] == "answered"
    assert any(i["key"].startswith("answer:") for i in env.c.get("/api/me/notifications", headers=env.stu).json()["items"])
    env.c.get(f"/api/questions/{q['id']}", headers=env.stu)  # read it
    assert env.c.get("/api/me/questions", headers=env.stu).json()["items"][0]["unread"] is False
    assert not any(i["key"].startswith("answer:") for i in env.c.get("/api/me/notifications", headers=env.stu).json()["items"])
    f = env.c.post(f"/api/questions/{q['id']}/replies", headers=env.stu, json={"text": "And sulphates stay?"}).json(); assert f["status"] == "waiting"
    assert env.c.post(f"/api/questions/{q['id']}/close", headers=env.stu).json()["status"] == "closed"
    r = env.c.post(f"/api/questions/{q['id']}/replies", headers=env.fac, json={"text": "Yes."}); assert r.status_code == 400 and "closed" in r.json()["detail"]

def test_without_an_owner_the_admins_answer_and_the_dashboard_says_so(env):
    t = setup(env, owned=False); ask(env, t)
    assert env.c.get("/api/questions", headers=env.fac).json()["total"] == 0 and env.c.get("/api/questions", headers=env.admin).json()["total"] == 1
    assert any(x["key"] == "questions" for x in env.c.get("/api/admin/dashboard", headers=env.admin).json()["items"])

def test_only_students_ask_within_limits_and_only_where_they_study(env):
    t = setup(env)
    assert ask(env, t, h=env.fac).status_code == 403 and ask(env, t, "hi").status_code == 400 and ask(env, t, "x" * 1001).status_code == 400
    assert ask(env, ids()["topic"]["Limits"]).status_code == 403  # another program's topic
    for _ in range(10): assert ask(env, t).status_code == 200
    assert ask(env, t).status_code == 429
    with Session_() as s: assert s.query(TeacherQuestion).count() == 10
