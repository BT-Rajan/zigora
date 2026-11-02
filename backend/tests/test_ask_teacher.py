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

def photo():
    import base64, io
    from PIL import Image
    buf = io.BytesIO(); Image.new("RGB", (40, 30), "white").save(buf, "PNG"); return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

def test_a_photo_goes_with_a_question_or_an_answer(env):
    t = setup(env)
    q = env.c.post(f"/api/topics/{t}/questions", headers=env.stu, json={"text": "", "photo": photo()}).json()
    img = q["messages"][0]["image"]; assert img.startswith("/api/qimg/") and img.endswith(".jpg")
    r = env.c.get(img); assert r.status_code == 200 and r.headers["content-type"] == "image/jpeg"
    assert env.c.get("/api/qimg/../../main.py").status_code == 404 and env.c.get("/api/qimg/" + "0" * 32 + ".jpg").status_code == 404
    assert env.c.post(f"/api/topics/{t}/questions", headers=env.stu, json={"text": "", "photo": "data:image/png;base64,bm90IGFuIGltYWdl"}).status_code == 400
    a = env.c.post(f"/api/questions/{q['id']}/replies", headers=env.fac, json={"text": "See the marked line", "photo": photo()}).json()
    assert a["messages"][-1]["image"] and a["messages"][-1]["teacher"] is True

def test_the_teacher_shares_an_answer_with_the_class_without_naming_the_student(env):
    t = setup(env); env.add_user("stu2@x.com"); i = ids(); enrol("stu2@x.com", i["prog"]["Mech"], 1); other = env.login("stu2@x.com")
    q = ask(env, t, "Why does scale form in boilers?").json()
    assert env.c.post(f"/api/questions/{q['id']}/share", headers=env.fac, json={"shared": True}).status_code == 400  # not answered yet
    env.c.post(f"/api/questions/{q['id']}/replies", headers=env.fac, json={"text": "Calcium carbonate settles out on hot surfaces."})
    assert env.c.post(f"/api/questions/{q['id']}/share", headers=env.stu, json={"shared": True}).status_code == 403  # only the teacher
    assert env.c.get(f"/api/topics/{t}/class-questions", headers=other).json()["items"] == []
    r = env.c.post(f"/api/questions/{q['id']}/share", headers=env.fac, json={"shared": True}).json(); assert r["shared"] is True
    items = env.c.get(f"/api/topics/{t}/class-questions", headers=other).json()["items"]
    assert len(items) == 1 and items[0]["mine"] is False and [m["who"] for m in items[0]["messages"]] == [None, "fac@x.com"] and "stu@x.com" not in str(items)
    assert env.c.get(f"/api/topics/{t}/class-questions", headers=env.stu).json()["items"][0]["mine"] is True
    assert env.c.get(f"/api/topics/{i['topic']['Limits']}/class-questions", headers=other).status_code == 403
    env.c.post(f"/api/questions/{q['id']}/share", headers=env.fac, json={"shared": False})
    assert env.c.get(f"/api/topics/{t}/class-questions", headers=other).json()["items"] == []

def test_lite_students_see_asking_comes_with_pro(env):
    from tests.test_plans import lite_person
    t = setup(env); h, uid = lite_person(env)
    with Session_() as s: u = s.get(User, uid); stu = s.query(User).filter_by(email="stu@x.com").one(); u.program_id, u.semester = stu.program_id, stu.semester; s.commit()
    assert env.c.get(f"/api/topics/{t}", headers=h).json()["ask"] == "pro" and env.c.get(f"/api/topics/{t}", headers=env.stu).json()["ask"] == "on"
    assert env.c.get(f"/api/topics/{t}", headers=env.fac).json()["ask"] is None
    r = ask(env, t, h=h); assert r.status_code == 403 and "comes with Pro" in r.json()["detail"]
    import datetime as dt
    with Session_() as s: s.get(User, uid).pro_until = dt.datetime.utcnow() + dt.timedelta(days=5); s.commit()
    assert ask(env, t, h=h).status_code == 200

def test_similar_shared_answers_show_while_a_student_writes(env):
    t = setup(env); env.add_user("stu2@x.com"); i = ids(); enrol("stu2@x.com", i["prog"]["Mech"], 1); other = env.login("stu2@x.com")
    q = ask(env, t, "Why does boiling remove temporary hardness of water?").json()
    env.c.post(f"/api/questions/{q['id']}/replies", headers=env.fac, json={"text": "Bicarbonates break down on heating."})
    sim = lambda text: env.c.get(f"/api/topics/{t}/similar", headers=other, params={"q": text}).json()["items"]
    assert sim("how does boiling remove hardness") == []  # not shared yet
    env.c.post(f"/api/questions/{q['id']}/share", headers=env.fac, json={"shared": True})
    got = sim("how does boiling remove hardness"); assert len(got) == 1 and got[0]["messages"][1]["text"].startswith("Bicarbonates") and got[0]["messages"][0]["who"] is None
    assert sim("ion exchange resin regeneration") == [] and sim("why") == []
    assert env.c.get(f"/api/topics/{i['topic']['Limits']}/similar", headers=other, params={"q": "boiling hardness"}).status_code == 403

def test_a_student_withdraws_a_question_before_it_is_answered(env):
    t = setup(env); q = ask(env, t, excerpt="temporary hardness").json(); assert q["can_withdraw"] is True
    assert env.c.post(f"/api/questions/{q['id']}/withdraw", headers=env.fac).status_code == 403  # only the student who asked
    assert env.c.post(f"/api/questions/{q['id']}/withdraw", headers=env.stu).json() == {"ok": True}
    assert env.c.get("/api/questions", headers=env.fac).json()["total"] == 0 and env.c.get("/api/questions?status=all", headers=env.fac).json()["total"] == 0  # gone from the teacher's list
    assert not any(i["key"].startswith("questions:") for i in env.c.get("/api/me/notifications", headers=env.fac).json()["items"])
    assert env.c.get("/api/me/questions", headers=env.stu).json()["items"] == [] and env.c.get(f"/api/questions/{q['id']}", headers=env.stu).status_code == 404
    with Session_() as s:
        from main import TeacherReply
        x = s.get(TeacherQuestion, q["id"]); assert x.status == "withdrawn" and x.excerpt is None and s.query(TeacherReply).filter_by(question_id=x.id).count() == 0  # its words are gone
    for _ in range(9): assert ask(env, t).status_code == 200
    assert ask(env, t).status_code == 429  # a withdrawn question still counts toward the day's ten
    a = env.c.get("/api/me/questions", headers=env.stu).json()["items"][0]["id"]
    env.c.post(f"/api/questions/{a}/replies", headers=env.fac, json={"text": "Bicarbonates only."})
    assert env.c.get(f"/api/questions/{a}", headers=env.stu).json()["can_withdraw"] is False
    r = env.c.post(f"/api/questions/{a}/withdraw", headers=env.stu); assert r.status_code == 400 and "close it" in r.json()["detail"]  # answered: close it instead
