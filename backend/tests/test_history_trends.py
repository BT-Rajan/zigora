"""S38: a student's learning history and performance trends, worked out from the records already kept (nothing new stored). Tests and MCQ practice
stay apart; a resent submit counts once; topics are judged only from enough evidence (5+ questions over 2+ sittings); insights carry the numbers they
come from; teachers see their own course's students only."""
import datetime as dt
import main
from main import Session_, Attempt, Progress, StepLog, McqAttempt, McqAttemptItem
from tests.test_insights import two_topic_quiz, take, me_id
from tests.test_quiz_reports import setup

def practice(uid, tid, oks, days_ago=0):  # a submitted MCQ set on one topic
    with Session_() as s:
        at = dt.datetime.utcnow() - dt.timedelta(days=days_ago)
        a = McqAttempt(user_id=uid, mode="topic", source="bank", topic_id=tid, status="submitted", score=sum(oks), total=len(oks), percent=round(100 * sum(oks) / len(oks)), submitted_at=at)
        s.add(a); s.flush()
        for i, ok in enumerate(oks): s.add(McqAttemptItem(attempt_id=a.id, pos=i, topic_id=tid, snapshot="{}", ok=ok))
        s.commit()
def hist(env, h=None, **p): return env.c.get("/api/me/history", headers=h or env.stu, params=p)
def trends(env, **p): return env.c.get("/api/me/trends", headers=env.stu, params=p).json()


def test_the_history_lists_what_happened_once_each_and_filters(env):
    i, unit = setup(env); q, t = two_topic_quiz(env, unit); sid = me_id("stu@x.com"); cid = i["course"]["Chem"]
    for _ in range(2): env.c.post(f"/api/quizzes/{q}/attempt", headers=env.stu, json={"answers": [0, 0, 1, 1, 1], "request_id": "same-sitting"})  # a resent submit
    with Session_() as s:
        s.add(Progress(user_id=sid, topic_id=t["Water"], completed_at=dt.datetime.utcnow())); s.add(StepLog(user_id=sid, topic_id=t["Water"], kind="revised"))
        s.add(StepLog(user_id=sid, topic_id=t["Water"], kind="line")); s.commit()  # an AI explanation: not a learning event
    practice(sid, t["Boilers"], [1, 0, 1])
    d = hist(env).json(); kinds = [e["kind"] for e in d["items"]]
    assert sorted(kinds) == ["learned", "practice", "revised", "test"]  # the resent submit once; the explanation step and the unfinished unit not at all
    test = next(e for e in d["items"] if e["kind"] == "test"); assert (test["title"], test["percent"], test["attempt"], test["course_id"]) == ("Mixed", 40, 1, cid)
    p = next(e for e in d["items"] if e["kind"] == "practice"); assert (p["title"], p["percent"], p["course_id"]) == ("Boilers", 67, cid)
    with Session_() as s:
        for a in s.query(Attempt): a.at -= dt.timedelta(days=10)
        s.commit()
    today = main.local_day(dt.datetime.utcnow())
    assert "test" not in [e["kind"] for e in hist(env, since=(today - dt.timedelta(days=2)).isoformat()).json()["items"]]
    assert [e["kind"] for e in hist(env, until=(today - dt.timedelta(days=5)).isoformat()).json()["items"]] == ["test"]
    assert hist(env, course_id=i["course"]["Maths"]).json()["items"] == [] and hist(env, kind="practice").json()["total"] == 1
    assert {e["unit_id"] for e in hist(env, unit_id=unit).json()["items"]} == {unit}
    assert hist(env, since="31/01/2026").status_code == 400


def test_trends_keep_tests_and_practice_apart_and_judge_topics_fairly(env):
    i, unit = setup(env); q, t = two_topic_quiz(env, unit); sid = me_id("stu@x.com")
    take(env, env.stu, q, [0, 0, 1, 1, 0])  # Water 2/2, Boilers 1/3
    d = trends(env)
    assert d["test_answers"] == {"right": 3, "wrong": 2, "percent": 60} and d["practice"]["sets"] == 0
    by = {x["title"]: x for x in d["topics"]}
    assert (by["Boilers"]["status"], by["Boilers"]["right"], by["Boilers"]["asked"]) == ("not_assessed", 1, 3)  # one sitting, wrong answers: not called weak
    practice(sid, t["Boilers"], [0, 0, 0])
    d = trends(env); b = {x["title"]: x for x in d["topics"]}["Boilers"]
    assert (b["status"], b["right"], b["asked"], b["sittings"], b["test_percent"], b["practice_percent"]) == ("needs_study", 1, 6, 2, 33, 0)
    assert d["practice"] == {"sets": 1, "right": 0, "wrong": 3, "percent": 0, "weeks": d["practice"]["weeks"]} and d["practice"]["weeks"][0]["asked"] == 3
    take(env, env.stu, q, [0, 0, 0, 0, 0])  # the test again: 100%
    d = trends(env); m = d["tests"][0]
    assert (m["first"], m["latest"], m["best"], m["change"], len(m["attempts"])) == (60, 100, 100, 40, 2) and [x["percent"] for x in d["timeline"]] == [60, 100]
    assert d["retakes"] == {"tests": 1, "first": 60, "latest": 100}


def test_insights_are_made_from_the_numbers(env):
    i, unit = setup(env); q, t = two_topic_quiz(env, unit); sid = me_id("stu@x.com")
    take(env, env.stu, q, [0, 0, 1, 1, 1]); take(env, env.stu, q, [0, 0, 0, 0, 0])  # Boilers 0% then 100%
    with Session_() as s:
        s.add(Progress(user_id=sid, topic_id=t["Water"], completed_at=dt.datetime.utcnow() - dt.timedelta(days=30)))
        for a in s.query(Attempt): a.at -= dt.timedelta(days=20)  # nothing since: Water not revised for two weeks
        s.commit()
    ins = {x["kind"]: x for x in trends(env)["insights"]}
    assert ins["improved"]["text"] == "Your accuracy in Boilers improved from 0% to 100%." and ins["improved"]["numbers"]["from"] == 0
    assert ins["retakes"]["numbers"] == {"tests": 1, "first": 40, "latest": 100}
    assert ins["not_revised"]["text"] == "You have not revised 1 topic in the last two weeks."


def test_cycles_come_with_a_course(env):
    i, unit = setup(env); q, t = two_topic_quiz(env, unit); cid = i["course"]["Chem"]
    take(env, env.stu, q, [0, 0, 0, 0, 0]); env.c.post(f"/api/courses/{cid}/redo", headers=env.stu)
    d = trends(env, course_id=cid); assert d["cycles"]["current"] == 2 and d["cycles"]["cycles"][0]["average"] == 100 and d["cycles"]["cycles"][1]["average"] is None


def test_teachers_see_their_own_courses_students_only(env):
    i, unit = setup(env); q, t = two_topic_quiz(env, unit); sid = me_id("stu@x.com"); cid = i["course"]["Chem"]
    take(env, env.stu, q, [0, 0, 1, 1, 1]); take(env, env.stu, q, [0, 0, 0, 0, 0])
    r = env.c.get(f"/api/reports/courses/{cid}/students/{sid}/trends", headers=env.admin).json()
    assert r["student"] and r["tests"][0]["change"] == 60 and r["cycles"]["current"] == 1
    c = env.c.get(f"/api/reports/courses/{cid}/trends", headers=env.admin).json()
    assert c["tests"][0] == {"id": q, "title": "Mixed", "students": 1, "first": 40, "best": 100, "retook": 1, "retake_first": 40, "retake_latest": 100} and c["months"][0]["attempts"] == 2
    assert env.c.get(f"/api/reports/courses/{cid}/students/{sid}/trends", headers=env.stu).status_code == 403
    assert env.c.get(f"/api/reports/courses/{cid}/trends", headers=env.stu).status_code == 403
    assert env.c.get(f"/api/reports/courses/{cid}/students/{me_id('admin@x.com')}/trends", headers=env.admin).status_code == 404  # not a student of it
    assert env.c.get(f"/api/reports/courses/{i['course']['Workshop']}/trends", headers=env.fac).status_code == 403
