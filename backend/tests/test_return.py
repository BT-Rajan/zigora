"""S39: coming back after a break. Time away is measured from learning (topics opened or learned, tests, MCQ sets), never from opening the app; nothing
is reset or restarted; a short welcome offers a choice of where to start; the week after a break has a lighter session with revision first; closed
assignments stay closed; one gentle reminder at each threshold, which the student can turn off; teachers see a label, nothing more."""
import datetime as dt
import main
from main import Session_, Attempt, Progress, ActivityDay, StepLog, McqAttempt, Routine, Assignment, LearningCycle, NoteSeen
from tests.test_insights import two_topic_quiz, take, me_id
from tests.test_quiz_reports import setup
from tests.test_assign_window import assign
from tests.test_assignments import due

def age(days):  # everything the student did happened `days` earlier
    d = dt.timedelta(days=days)
    with Session_() as s:
        for a in s.query(Attempt): a.at -= d
        for p in s.query(Progress):
            if p.last_read: p.last_read -= d
            if p.completed_at: p.completed_at -= d
        for x in s.query(McqAttempt):
            if x.submitted_at: x.submitted_at -= d
        for x in s.query(StepLog): x.at -= d
        for x in s.query(ActivityDay): x.day -= d
        s.commit()
def welcome(env): return env.c.get("/api/me/welcome", headers=env.stu).json()
def studied(env, i, unit):  # a learned topic, an unfinished one, and a weak one (Boilers 0 of 6 over two tests)
    q, t = two_topic_quiz(env, unit); sid = me_id("stu@x.com"); now = dt.datetime.utcnow()
    with Session_() as s:
        s.add(Progress(user_id=sid, topic_id=t["Water"], reads=2, last_read=now - dt.timedelta(hours=2), completed_at=now - dt.timedelta(hours=2)))
        s.add(Progress(user_id=sid, topic_id=t["Boilers"], reads=1, last_read=now - dt.timedelta(hours=1))); s.commit()
    take(env, env.stu, q, [0, 0, 1, 1, 1]); take(env, env.stu, q, [0, 0, 1, 1, 1])
    return q, t, sid


def test_time_away_counts_learning_not_opening_the_app(env):
    i, unit = setup(env)
    assert welcome(env)["state"] == "new"  # nothing learned yet: not a "return"
    q, t, sid = studied(env, i, unit); assert welcome(env)["state"] == "active"
    age(10)
    for path in ("/api/me/today", "/api/me/notifications", "/api/me/welcome", "/api/tree", "/api/me/session"): env.c.get(path, headers=env.stu)  # opening the app
    w = welcome(env); assert (w["state"], w["days_away"], w["thresholds"]) == ("extended", 10, {"extended": 7, "long": 30})
    age(30); assert welcome(env)["state"] == "long"
    assert env.c.put("/api/admin/settings", headers=env.admin, json={"break_days": [50, 60]}).status_code == 200
    assert welcome(env)["state"] == "active"  # 40 days is under the new 50
    assert env.c.put("/api/admin/settings", headers=env.admin, json={"break_days": [30, 10]}).status_code == 400
    assert env.c.get("/api/admin/settings", headers=env.admin).json()["break_days"] == [50, 60]


def test_the_welcome_sums_up_and_offers_a_choice_without_changing_anything(env):
    i, unit = setup(env); q, t, sid = studied(env, i, unit)
    closed = assign(env, i, q, due=due(1)); open_ = assign(env, i, q, due=due(5))  # one closed while they were away, one still open
    age(12)
    with Session_() as s: s.get(Assignment, closed).due_at = dt.datetime.utcnow() - dt.timedelta(days=2); s.commit()
    with Session_() as s: before = sorted((p.topic_id, p.completed_at) for p in s.query(Progress))
    w = welcome(env)
    assert w["show"] and w["last"]["topic"] == "Boilers" and w["progress"] == {"percent": 67, "done": 1, "required": 2}  # 1 of 2 topics and the test tried
    assert [x["id"] for x in w["assignments"]["open"]] == [open_] and [x["id"] for x in w["assignments"]["closed"]] == [closed]
    keys = {p["key"]: p for p in w["paths"]}
    assert keys["resume"]["title"] == "Boilers" and keys["revise"]["topics"][0]["title"] == "Boilers" and keys["check"]["topic_id"] == t["Boilers"]
    assert {x["id"]: x["status"] for x in env.c.get("/api/me/assignments", headers=env.stu).json()["items"]}[closed] == "missed"  # stays closed
    with Session_() as s:
        assert sorted((p.topic_id, p.completed_at) for p in s.query(Progress)) == before and s.query(LearningCycle).count() == 0  # nothing reset or restarted
    assert env.c.post("/api/me/welcome", headers=env.stu, json={"what": "hide"}).json()["show"] is False
    assert welcome(env)["show"] is False and welcome(env)["easing"] is True
    assert env.c.post("/api/me/welcome", headers=env.stu, json={"what": "usual"}).json()["easing"] is False
    assert env.c.post("/api/me/welcome", headers=env.stu, json={"what": "restart"}).status_code == 400


def test_the_first_week_back_is_lighter_and_puts_revision_first(env):
    i, unit = setup(env); q, t, sid = studied(env, i, unit)
    with Session_() as s: s.add(Routine(user_id=sid, days="1111111", minutes=60, started_at=dt.datetime.utcnow() - dt.timedelta(days=60))); s.commit()
    age(15)
    d = env.c.get("/api/me/session", headers=env.stu).json()
    assert d["easing"] is True and d["missed"] == 0  # no tally of missed days
    items = d["session"]["items"]; assert items[0]["kind"] == "revise"
    assert len([x for x in items if x["kind"] not in ("revise", "review")]) <= 1  # 60 minutes is 3 new topics normally; half (at least one) now
    env.c.post(f"/api/topics/{items[0]['id']}/revised", headers=env.stu)
    assert env.c.get("/api/me/session", headers=env.stu).json()["session"]["items"][0]["done"] is True


def test_overdue_revision_can_be_spread_without_duplicates(env):
    i, unit = setup(env); q, t, sid = studied(env, i, unit)
    from main import Topic
    with Session_() as s:
        for k in range(4):
            x = Topic(title=f"Extra {k}", unit_id=unit, course_id=i["course"]["Chem"], content="x", published=True); s.add(x); s.flush()
            s.add(Progress(user_id=sid, topic_id=x.id, last_read=dt.datetime.utcnow(), completed_at=dt.datetime.utcnow()))
        s.commit()
    age(20)
    rv = env.c.get("/api/me/revision", headers=env.stu).json(); n = len(rv["overdue"] + rv["today"]); assert n >= 5
    r = env.c.post("/api/me/welcome", headers=env.stu, json={"what": "spread"}).json(); assert r["spread"] == n - 3
    rv = env.c.get("/api/me/revision", headers=env.stu).json()
    titles = [x["title"] for k in ("overdue", "today", "upcoming") for x in rv[k]]
    assert len(rv["overdue"] + rv["today"]) == 3 and len(titles) == len(set(titles))  # each topic once


def test_one_gentle_reminder_at_each_threshold_and_it_can_be_turned_off(env):
    i, unit = setup(env); q, t, sid = studied(env, i, unit)
    def bell(): return [x for x in env.c.get("/api/me/notifications", headers=env.stu).json()["items"] if x["key"].startswith("return:")]
    age(7); b = bell(); assert len(b) == 1 and b[0]["text"] == "Ready when you are: pick up where you left off" and b[0]["sub"] == "Boilers"
    age(1); assert bell() == []  # day 8: nothing again
    age(22); assert len(bell()) == 1  # day 30: the second and last
    r = env.c.put("/api/me/notifications/settings", headers=env.stu, json={"return_reminders": False}).json(); assert r["return_reminders"] is False
    assert bell() == [] and env.c.get("/api/me/notifications", headers=env.stu).json()["return_reminders"] is False


def test_teachers_see_a_label_only_and_students_see_nothing_of_others(env):
    i, unit = setup(env); q, t, sid = studied(env, i, unit); cid = i["course"]["Chem"]
    age(9)
    rows = {r["user_id"]: r for r in env.c.get(f"/api/reports/courses/{cid}/students", headers=env.admin).json()["students"]}
    assert rows[sid]["activity"] == {"state": "extended", "days_away": 9, "back_on": None}
    take(env, env.stu, q, [0, 0, 0, 0, 0])  # back: learning again today
    rows = {r["user_id"]: r for r in env.c.get(f"/api/reports/courses/{cid}/students", headers=env.admin).json()["students"]}
    assert rows[sid]["activity"]["state"] == "active" and rows[sid]["activity"]["back_on"] == main.local_day(dt.datetime.utcnow()).isoformat()
    assert welcome(env)["show"] is True  # the first day back still shows the welcome
    assert env.c.get(f"/api/reports/courses/{cid}/students", headers=env.stu).status_code == 403
