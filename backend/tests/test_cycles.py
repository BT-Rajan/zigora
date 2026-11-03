"""S37: restarting a course starts a new learning pass (cycle) without losing the old one: its finish date, test attempts and revision records stay;
the new pass counts only what is done in it. A unit restart stays within the pass and leaves other units alone. Each pass can be compared with the
last, and the topics the last pass showed weak or strong are offered to start with."""
import datetime as dt
from main import Session_, Topic, Unit, Progress, ProgressHistory, Attempt, StepLog, LearningCycle, CourseCompletion
from tests.test_completion import chem, learn, status
from tests.test_quiz_reports import make_quiz
from tests.test_insights import me_id


def redo(env, cid): return env.c.post(f"/api/courses/{cid}/redo", headers=env.stu).json()
def take(env, q, answers): return env.c.post(f"/api/quizzes/{q}/attempt", headers=env.stu, json={"answers": answers})
def cycles(env, cid, h=None, **p): return env.c.get(f"/api/courses/{cid}/cycles", headers=h or env.stu, params=p)


def finish(env):  # a finished first pass, a few days ago
    i, unit, cid, tids = chem(env); q = make_quiz(env, unit); learn(env, tids, days_ago=3); take(env, q, [0, 1])  # 50%
    with Session_() as s:
        for a in s.query(Attempt): a.at -= dt.timedelta(days=3)
        s.commit()
    st = status(env, cid); assert st["complete"] and st["cycle"] == 1
    return i, unit, cid, tids, q, st["completed_at"]


def test_a_restart_starts_a_new_pass_and_keeps_the_old_one(env):
    i, unit, cid, tids, q, first = finish(env)
    with Session_() as s: s.add(StepLog(user_id=me_id("stu@x.com"), topic_id=tids[0], kind="revised")); s.commit()
    r = redo(env, cid); assert (r["topics"], r["cycle"], r["new"]) == (len(tids), 2, True)
    st = status(env, cid)
    assert st["cycle"] == 2 and not st["complete"] and st["completed_at"] is None and st["first_completed_at"] == first  # the first finish stays
    assert st["tests"]["tried"] == 0 and st["topics"]["done"] == 0  # the new pass starts from nothing: last pass's attempt doesn't count toward it
    with Session_() as s:
        assert s.query(Attempt).count() == 1 and s.query(StepLog).filter_by(kind="revised").count() == 1  # attempts and revision records stay
        assert s.query(ProgressHistory).filter(ProgressHistory.completed_at.isnot(None)).count() == len(tids)
        c1 = s.query(LearningCycle).filter_by(number=1).one(); assert c1.ended_at and c1.completed_at and s.query(CourseCompletion).count() == 1
        aid = s.query(Attempt.id).scalar()
    assert env.c.get(f"/api/attempts/{aid}", headers=env.stu).json()["percent"] == 50  # and the student can still open the old attempt
    learn(env, tids); take(env, q, [0, 0])  # the second pass, finished
    st = status(env, cid); assert st["complete"] and st["completed_at"] != first and st["first_completed_at"] == first
    d = cycles(env, cid).json(); a, b = d["cycles"]
    assert (a["number"], a["learned"], a["average"], a["current"]) == (1, len(tids), 50, False)
    assert (b["number"], b["learned"], b["average"], b["current"], b["tests_tried"]) == (2, len(tids), 100, True, 1)
    assert d["compare"]["tests"] == [{"id": q, "title": "Water quiz", "before": 50, "after": 100}]


def test_restarting_twice_without_doing_anything_makes_no_empty_pass(env):
    i, unit, cid, tids, q, first = finish(env)
    assert redo(env, cid)["new"] is True
    r = redo(env, cid); assert (r["new"], r["cycle"], r["topics"]) == (False, 2, 0)
    with Session_() as s: assert s.query(LearningCycle).count() == 2


def test_a_unit_restart_leaves_other_units_and_the_pass_alone(env):
    i, unit, cid, tids, q, first = finish(env)
    with Session_() as s:
        u2 = Unit(name="Metals", course_id=cid, position=9); s.add(u2); s.flush()
        s.add(Topic(title="Rust", unit_id=u2.id, course_id=cid, content="Iron oxide.", published=True)); s.commit()
        t2 = s.query(Topic).filter_by(title="Rust").one().id
    learn(env, [t2])
    r = env.c.post(f"/api/units/{unit}/redo", headers=env.stu).json(); assert r["topics"] == len(tids)
    with Session_() as s:
        assert s.query(Progress).filter_by(topic_id=t2).one().completed_at  # the other unit is untouched
        assert s.query(Progress).filter(Progress.topic_id.in_(tids)).count() == 0
        c = s.query(LearningCycle).one(); assert c.number == 1 and c.ended_at is None  # still the same pass
    d = cycles(env, cid).json(); assert d["current"] == 1 and [x["unit_id"] for x in d["cycles"][0]["unit_restarts"]] == [unit]
    assert env.c.post("/api/units/999999/redo", headers=env.stu).status_code == 404


def test_relearning_starts_with_what_the_last_pass_showed(env):
    i, unit, cid, tids, q, first = finish(env)
    qq = env.c.post("/api/quizzes", headers=env.admin, json={"unit_id": unit, "title": "Topic check", "pass_percent": 50, "published": True}).json()["id"]
    env.c.put(f"/api/quizzes/{qq}/questions", headers=env.admin, json={"questions": [{"text": f"Q{k}", "options": ["a", "b"], "correct": 0, "topic_id": tids[k // 3]} for k in range(6)]})
    take(env, qq, [1, 1, 1, 0, 0, 0])  # first topic 0 of 3, second 3 of 3
    redo(env, cid)
    d = cycles(env, cid).json()
    assert [x["id"] for x in d["relearn"]["weak"]] == [tids[0]] and [x["id"] for x in d["relearn"]["strong"]] == [tids[1]]
    take(env, qq, [0, 0, 0, 1, 1, 1])  # the weak one now strong, the strong one now weak
    c = cycles(env, cid).json()["compare"]
    assert [x["id"] for x in c["improved"]] == [tids[0]] and c["still_weak"] == []


def test_one_wrong_answer_is_not_a_weak_topic(env):
    i, unit, cid, tids, q, first = finish(env)  # the Water quiz: two questions without topics, so nothing to judge a topic by
    qq = env.c.post("/api/quizzes", headers=env.admin, json={"unit_id": unit, "title": "One", "pass_percent": 50, "published": True}).json()["id"]
    env.c.put(f"/api/quizzes/{qq}/questions", headers=env.admin, json={"questions": [{"text": "Q", "options": ["a", "b"], "correct": 0, "topic_id": tids[0]}]})
    take(env, qq, [1]); redo(env, cid)
    assert cycles(env, cid).json()["relearn"] == {"weak": [], "strong": []}


def test_who_may_see_a_students_passes(env):
    i, unit, cid, tids, q, first = finish(env); redo(env, cid); sid = me_id("stu@x.com")
    d = cycles(env, cid, h=env.admin, student=sid).json(); assert d["current"] == 2
    row = next(r for r in env.c.get(f"/api/courses/{cid}/completion", headers=env.admin).json()["students"] if r["user_id"] == sid)
    assert row["cycle"] == 2 and row["first_completed_at"] == first and row["complete"] is False
    assert cycles(env, cid, student=me_id("admin@x.com")).status_code == 403  # a student can't look at someone else's
    assert cycles(env, i["course"]["Maths"]).status_code in (403, 404)
    assert env.c.post(f"/api/courses/{i['course']['Maths']}/redo", headers=env.stu).status_code in (403, 404)
