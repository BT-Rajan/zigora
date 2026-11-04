"""S41: teachers answer doubts in the same thread: text with maths, a photo, a document; the student says "I understand now" or asks again; a
resolved doubt can be reopened twice within 14 days; an edited explanation keeps its earlier text; every status change is recorded."""
import base64, datetime as dt
from main import Session_, TeacherQuestion, QuestionEvent, ReplyEdit, TeacherReply
from tests.test_ask_teacher import setup, ask

PDF = "data:application/pdf;base64," + base64.b64encode(b"%PDF-1.4 notes").decode()
def q_(env, qid, h=None): return env.c.get(f"/api/questions/{qid}", headers=h or env.stu).json()
def say(env, qid, text, h, **kw): return env.c.post(f"/api/questions/{qid}/replies", headers=h, json={"text": text, **kw})


def test_answer_with_maths_and_a_document_then_understood(env):
    t = setup(env); qid = ask(env, t).json()["id"]
    assert q_(env, qid, env.fac)["messages"][0]["text"].startswith("Why does boiling")  # the teacher opens it
    r = say(env, qid, "Hardness $H = \\frac{m}{V}$ falls when $Ca(HCO_3)_2$ breaks down. See https://youtu.be/abc123XYZ00", env.fac, file={"name": "notes.pdf", "data": PDF})
    assert r.status_code == 200, r.text; m = r.json()["messages"][-1]
    assert "$H = \\frac{m}{V}$" in m["text"] and m["file"]["name"] == "notes.pdf" and r.json()["label"] == "answered" and r.json()["status"] != "closed"  # answered, not resolved
    assert env.c.get(m["file"]["url"].split("?")[0]).status_code == 200
    assert say(env, qid, "Here is my file", env.stu, file={"name": "x.pdf", "data": PDF}).status_code == 403  # students send photos, not documents
    d = q_(env, qid); assert d["messages"][-1]["teacher"] and d["label"] == "answered"
    u = env.c.post(f"/api/questions/{qid}/understood", headers=env.stu).json(); assert (u["label"], u["helpful"]) == ("resolved", True)
    assert [(e["before"], e["after"]) for e in u["events"]] == [("pending", "answered"), ("answered", "resolved")]
    assert env.c.post(f"/api/questions/{qid}/understood", headers=env.fac).status_code == 403


def test_follow_up_answer_resolve_and_reopen_twice(env):
    t = setup(env); qid = ask(env, t).json()["id"]
    assert env.c.post(f"/api/questions/{qid}/understood", headers=env.stu).status_code == 400  # nothing answered yet
    say(env, qid, "Bicarbonates break down.", env.fac)
    f = say(env, qid, "I still have a doubt: what about sulphates?", env.stu).json(); assert (f["label"], f["helpful"]) == ("follow_up", False)
    say(env, qid, "Sulphates stay: that is permanent hardness.", env.fac)
    with Session_() as s: assert s.query(TeacherQuestion).count() == 1  # one thread throughout
    r = env.c.post(f"/api/questions/{qid}/close", headers=env.fac).json(); assert r["label"] == "resolved" and r["can_reopen"] is False  # the teacher's view
    assert q_(env, qid)["can_reopen"] is True and q_(env, qid)["reopens_left"] == 2
    assert say(env, qid, "Teacher again", env.fac).status_code == 400  # a teacher doesn't reopen
    for left in (1, 0):
        x = say(env, qid, "Still unsure about the formula.", env.stu).json(); assert x["label"] == "follow_up"
        say(env, qid, "Look at the units.", env.fac); env.c.post(f"/api/questions/{qid}/close", headers=env.fac)
        assert q_(env, qid)["reopens_left"] == left
    r = say(env, qid, "One more?", env.stu); assert r.status_code == 400 and "closed" in r.json()["detail"]  # twice is the limit
    with Session_() as s: assert s.query(QuestionEvent).filter_by(question_id=qid).count() >= 8 and all(e.user_id for e in s.query(QuestionEvent))


def test_reopening_ends_after_14_days(env):
    t = setup(env); qid = ask(env, t).json()["id"]; say(env, qid, "Answer.", env.fac); env.c.post(f"/api/questions/{qid}/understood", headers=env.stu)
    with Session_() as s: s.get(TeacherQuestion, qid).resolved_at -= dt.timedelta(days=15); s.commit()
    assert q_(env, qid)["can_reopen"] is False and say(env, qid, "Again", env.stu).status_code == 400


def test_an_edited_explanation_keeps_its_history_and_attachment(env):
    t = setup(env); qid = ask(env, t).json()["id"]
    m = say(env, qid, "Boilng removes it.", env.fac, file={"name": "n.pdf", "data": PDF}).json()["messages"][-1]
    e = env.c.put(f"/api/questions/{qid}/replies/{m['id']}", headers=env.fac, json={"text": "Boiling removes temporary hardness."}).json()["messages"][-1]
    assert e["text"] == "Boiling removes temporary hardness." and e["edited"] and e["file"]["name"] == "n.pdf"
    h = env.c.get(f"/api/questions/{qid}/replies/{m['id']}/edits", headers=env.stu).json(); assert [x["text"] for x in h["items"]] == ["Boilng removes it."]
    first = q_(env, qid)["messages"][0]["id"]
    assert env.c.put(f"/api/questions/{qid}/replies/{first}", headers=env.fac, json={"text": "changed"}).status_code == 403  # not their reply
    assert env.c.put(f"/api/questions/{qid}/replies/{first}", headers=env.stu, json={"text": "changed"}).status_code == 403  # students don't edit
    with Session_() as s: assert s.query(ReplyEdit).count() == 1 and s.get(TeacherReply, first).text.startswith("Why")


def test_only_the_student_and_the_course_teacher(env):
    t = setup(env); qid = ask(env, t).json()["id"]
    env.add_user("fac2@x.com", "faculty"); f2 = env.login("fac2@x.com"); env.add_user("stu2@x.com"); s2 = env.login("stu2@x.com")
    for h in (f2, s2):
        assert env.c.get(f"/api/questions/{qid}", headers=h).status_code == 404 and say(env, qid, "Let me answer", h).status_code == 404
        assert env.c.post(f"/api/questions/{qid}/close", headers=h).status_code == 404 and env.c.post(f"/api/questions/{qid}/understood", headers=h).status_code == 404
    m = say(env, qid, "Answer.", env.fac).json()["messages"][-1]
    assert env.c.put(f"/api/questions/{qid}/replies/{m['id']}", headers=f2, json={"text": "x" * 5}).status_code == 404
    assert env.c.get(f"/api/questions/{qid}/replies/{m['id']}/edits", headers=s2).status_code == 404
