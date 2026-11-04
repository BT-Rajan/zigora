"""S40: escalating a doubt to the teacher, on top of the existing Ask the teacher. The topic decides course, unit and teacher; the AI answer it came
from is looked up on the server (a short excerpt, never pasted text); a resent ask makes no second question; the student sees each doubt's status."""
import json
from main import Session_, TeacherQuestion, DoubtAnswer, AICache, PrivateAnswer, Topic
from tests.test_ask_teacher import setup, ask
from tests.test_insights import me_id

def doubt(tid, text="Temporary hardness is caused by bicarbonates, which boiling breaks down."):
    with Session_() as s: d = DoubtAnswer(qhash="h" + text[:20], topic_id=tid, phrase="temporary hardness", text=text); s.add(d); s.commit(); return d.id
def esc(env, t, ai=None, rid="r1", text="I still don't see why boiling matters.", h=None):
    return env.c.post(f"/api/topics/{t}/questions", headers=h or env.stu, json={"text": text, "request_id": rid, **({"ai": ai} if ai else {})})


def test_from_a_topic_the_context_and_teacher_come_from_the_syllabus(env):
    t = setup(env)
    q = esc(env, t).json()
    assert (q["topic"], q["course"], q["unit"], q["label"], q["answered_by"], q["ai"]) == ("Water", "Chem", q["unit"], "pending", "fac@x.com", None) and q["unit"]
    assert env.c.get("/api/questions", headers=env.fac).json()["total"] == 1


def test_from_an_ai_answer_the_server_attaches_a_short_excerpt(env):
    t = setup(env); d = doubt(t, "Bicarbonates break down on boiling. " * 80)
    q = esc(env, t, {"kind": "doubt", "id": d}).json()
    assert q["ai"]["q"] == "temporary hardness" and q["ai"]["a"].startswith("Bicarbonates break down") and len(q["ai"]["a"]) <= 1201
    with Session_() as s: row = s.get(TeacherQuestion, q["id"]); assert (row.ai_kind, row.ai_ref) == ("doubt", d)
    teacher = env.c.get(f"/api/questions/{q['id']}", headers=env.fac).json(); assert teacher["ai"] == q["ai"]  # the teacher sees what the AI said
    with Session_() as s:
        other = s.query(Topic).filter(Topic.id != t).first().id
        line = AICache(topic_id=t, kind="line", chash="x", text=json.dumps({"text": "It means the salts stay."})); s.add(line)
        mine = PrivateAnswer(user_id=me_id("admin@x.com"), topic_id=t, kind="explain", chash="y", text="not yours"); s.add(mine); s.commit(); lid, pid = line.id, mine.id
    assert esc(env, t, {"kind": "topic", "id": lid}, rid="r2").json()["ai"]["a"] == "It means the salts stay."
    assert esc(env, other, {"kind": "doubt", "id": d}, rid="r3").status_code in (400, 403, 404)  # an answer from another topic
    assert esc(env, t, {"kind": "private", "id": pid}, rid="r4").status_code == 400  # someone else's private answer
    assert esc(env, t, {"kind": "chat", "id": 1}, rid="r5").status_code == 400


def test_a_resent_ask_is_one_question(env):
    t = setup(env)
    a, b = esc(env, t, rid="same").json(), esc(env, t, rid="same").json()
    assert a["id"] == b["id"]
    with Session_() as s: assert s.query(TeacherQuestion).count() == 1
    assert esc(env, t, rid="other").json()["id"] != a["id"]


def test_no_teacher_yet_the_doubt_is_kept_and_admins_see_it(env):
    t = setup(env, owned=False)
    q = esc(env, t).json(); assert q["answered_by"] is None and q["label"] == "pending"
    assert env.c.get("/api/questions", headers=env.admin).json()["total"] == 1 and env.c.get("/api/questions", headers=env.fac).json()["total"] == 0


def test_history_labels_and_privacy(env):
    t = setup(env); q = esc(env, t).json()
    env.c.post(f"/api/questions/{q['id']}/replies", headers=env.fac, json={"text": "Bicarbonates."})
    assert env.c.get("/api/me/questions", headers=env.stu).json()["items"][0]["label"] == "answered"
    env.c.post(f"/api/questions/{q['id']}/replies", headers=env.stu, json={"text": "And sulphates?"})
    items = env.c.get("/api/me/questions", headers=env.stu).json()["items"]; assert items[0]["label"] == "follow_up" and items[0]["at"]
    env.c.post(f"/api/questions/{q['id']}/close", headers=env.stu)
    assert env.c.get("/api/me/questions", headers=env.stu).json()["items"][0]["label"] == "resolved"
    env.add_user("stu2@x.com"); h2 = env.login("stu2@x.com")
    assert env.c.get(f"/api/questions/{q['id']}", headers=h2).status_code == 404 and env.c.get("/api/me/questions", headers=h2).json()["items"] == []
    env.add_user("fac2@x.com", "faculty"); assert env.c.get(f"/api/questions/{q['id']}", headers=env.login("fac2@x.com")).status_code == 404
    assert env.c.post(f"/api/topics/{t}/questions", headers=env.fac, json={"text": "x" * 10, "request_id": "f"}).status_code == 403  # students ask
