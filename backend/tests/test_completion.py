"""S36: a course is finished when every required topic is marked learned and every course test has been tried (any score: finishing is not
mastering). Optional topics never block it; the date it first happened is kept, once; teachers see every student's standing; a few milestones."""
import datetime as dt
from main import Session_, Topic, Unit, Progress, CourseCompletion
from tests.test_quiz_reports import setup, make_quiz
from tests.test_insights import me_id


def chem(env):
    i, unit = setup(env); cid = i["course"]["Chem"]
    with Session_() as s: s.add(Topic(title="Hardness", unit_id=unit, course_id=cid, content="Ca and Mg salts.", published=True, position=9)); s.commit()  # a second topic
    with Session_() as s: tids = [t.id for t in s.query(Topic).join(Unit, Unit.id == Topic.unit_id).filter(Unit.course_id == cid, Topic.published != False)]  # noqa: E712
    return i, unit, cid, tids
def learn(env, tids, days_ago=0):
    with Session_() as s:
        for t in tids: s.merge(Progress(user_id=me_id("stu@x.com"), topic_id=t, completed_at=dt.datetime.utcnow() - dt.timedelta(days=days_ago)))
        s.commit()
def status(env, cid): return next(c for c in env.c.get("/api/me/completion", headers=env.stu).json()["courses"] if c["course_id"] == cid)


def test_finishing_needs_every_required_topic_and_every_test_tried(env):
    i, unit, cid, tids = chem(env); q = make_quiz(env, unit)
    st = status(env, cid); assert (st["complete"], st["percent"], st["completed_at"]) == (False, 0, None) and st["tests"] == {"total": 1, "tried": 0}
    learn(env, tids, days_ago=2)
    st = status(env, cid); assert not st["complete"] and st["pending_tests"] == [{"id": q, "title": "Water quiz"}] and st["remaining"] == []
    env.c.post(f"/api/quizzes/{q}/attempt", headers=env.stu, json={"answers": [None, None]})  # 0%: tried is enough to finish; it isn't mastery
    st = status(env, cid); assert st["complete"] and st["percent"] == 100 and st["average"] == 0 and st["completed_at"]
    first = st["completed_at"]; status(env, cid)
    with Session_() as s: assert s.query(CourseCompletion).count() == 1  # recorded once
    with Session_() as s:  # the course grows afterwards: not finished now, but the day it was finished stays
        s.add(Topic(title="New topic", unit_id=unit, course_id=cid, content="x", published=True)); s.commit()
    st = status(env, cid); assert not st["complete"] and st["completed_at"] == first and [r["title"] for r in st["remaining"]] == ["New topic"]


def test_optional_topics_never_block(env):
    i, unit, cid, tids = chem(env)
    learn(env, tids[1:])
    assert not status(env, cid)["complete"]
    with Session_() as s: s.get(Topic, tids[0]).optional = True; s.commit()
    st = status(env, cid); assert st["complete"] and st["topics"]["optional"] == 1 and st["topics"]["required"] == len(tids) - 1
    t = env.c.get(f"/api/topics/{tids[0]}", headers=env.admin).json(); assert t["optional"] is True


def test_teachers_see_each_students_standing(env):
    i, unit, cid, tids = chem(env); learn(env, tids[:1])
    d = env.c.get(f"/api/courses/{cid}/completion", headers=env.admin).json()
    row = next(r for r in d["students"] if r["user_id"] == me_id("stu@x.com"))
    assert row["complete"] is False and row["topics_left"] == len(tids) - 1 and row["percent"] == round(100 / len(tids))
    assert env.c.get(f"/api/courses/{cid}/completion", headers=env.stu).status_code == 403


def test_milestones(env):
    i, unit, cid, tids = chem(env); q = make_quiz(env, unit)
    a = {x["key"]: x for x in env.c.get("/api/me/achievements", headers=env.stu).json()["items"]}
    assert all(x["at"] is None for x in a.values()) and set(a) == {"first_unit", "first_course", "steady", "improved", "hard_topic"}
    learn(env, tids)
    env.c.post(f"/api/quizzes/{q}/attempt", headers=env.stu, json={"answers": [None, None]})  # 0%
    env.c.post(f"/api/quizzes/{q}/attempt", headers=env.stu, json={"answers": [0, 0]})  # 100%: 100 points better
    a = {x["key"]: x for x in env.c.get("/api/me/achievements", headers=env.stu).json()["items"]}
    assert a["first_unit"]["at"] and a["first_course"]["at"] and a["first_course"]["detail"] == "Chem"
    assert a["improved"]["at"] and a["improved"]["detail"] == "Water quiz: 0% → 100%"
    assert a["steady"]["at"] is None  # nothing revised yet


def test_a_hard_topic_overcome(env):
    i, unit, cid, tids = chem(env)
    q = env.c.post("/api/quizzes", headers=env.admin, json={"unit_id": unit, "title": "Topic check", "pass_percent": 50, "published": True}).json()["id"]
    env.c.put(f"/api/quizzes/{q}/questions", headers=env.admin, json={"questions": [{"text": f"Q{k}", "options": ["a", "b"], "correct": 0, "topic_id": tids[0]} for k in range(2)]})
    env.c.post(f"/api/quizzes/{q}/attempt", headers=env.stu, json={"answers": [1, 1]})  # 0% on the topic
    a = {x["key"]: x for x in env.c.get("/api/me/achievements", headers=env.stu).json()["items"]}; assert a["hard_topic"]["at"] is None
    env.c.post(f"/api/quizzes/{q}/attempt", headers=env.stu, json={"answers": [0, 0]})  # then 100%
    a = {x["key"]: x for x in env.c.get("/api/me/achievements", headers=env.stu).json()["items"]}
    assert a["hard_topic"]["at"] and a["hard_topic"]["detail"] == "Water"
