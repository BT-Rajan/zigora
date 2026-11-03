"""S35: when to revise each topic, replayed from the evidence (never stored): the same 1/3/7/14/30-day rule as study courses. A check (MCQ set or
test on the topic) at 80%+ moves it on, under 60% brings it back the next day; reading the sheet is a review at the same interval and never moves it
on; postponing adds days."""
import datetime as dt
import main
from main import Session_, Progress, revision_replay
from tests.test_mcq_practice import world, bank, start

T0 = dt.datetime(2026, 1, 1, 12, 0)
def at(days): return T0 + dt.timedelta(days=days)


def test_the_replay_rule():
    assert revision_replay([]) is None
    r = revision_replay([(at(0), "learned", None)]); assert (r["step"], r["due"], r["checks"]) == (0, at(1), 0)  # learned: due a day later
    good = [(at(0), "learned", None), (at(1), "check", 0.9), (at(2), "check", 1.0)]
    r = revision_replay(good); assert (r["step"], r["due"]) == (2, at(2 + 3))  # two good checks: on to 3 days
    r = revision_replay(good + [(at(5), "check", 0.4)]); assert (r["step"], r["due"], r["last_ratio"]) == (0, at(6), 0.4)  # a poor one: back to tomorrow
    r = revision_replay(good + [(at(5), "check", 0.7)]); assert (r["step"], r["due"]) == (2, at(5 + 3))  # in between: the same interval again
    r = revision_replay(good + [(at(5), "read", None)]); assert (r["step"], r["due"], r["checks"]) == (2, at(5 + 3), 2)  # reading: reviewed, not moved on
    r = revision_replay(good + [(at(3), "postpone", 7)]); assert r["due"] == at(5 + 7)  # postponed from the due date
    r = revision_replay(good + [(at(9), "postpone", 1)]); assert r["due"] == at(10)  # postponed when already overdue: from now
    r = revision_replay([(at(0), "read", None)]); assert r["due"] == at(1)  # revised without being marked learned: it enters
    steps = [(at(0), "learned", None)] + [(at(i), "check", 1.0) for i in range(1, 9)]
    assert revision_replay(steps)["step"] == len(main.REVIEW_DAYS)  # never past the last interval


def learned(env, tid, days_ago):
    with Session_() as s:
        s.add(Progress(user_id=env.ids["stu"], topic_id=tid, completed_at=dt.datetime.utcnow() - dt.timedelta(days=days_ago))); s.commit()


def test_the_dashboard_groups_orders_and_postpones(env):
    ids = world(env); learned(env, ids["water"], 5); learned(env, ids["rust"], 1)
    d = env.c.get("/api/me/revision", headers=env.stu).json()
    assert [x["title"] for x in d["overdue"]] == ["Water hardness"] and [x["title"] for x in d["today"]] == ["Corrosion"]
    w = d["overdue"][0]; assert (w["checked"], w["weak"], w["step"], w["interval"]) == (False, False, 0, 1)  # learned but never checked
    assert d["intervals"] == [1, 3, 7, 14, 30] and d["upcoming"] == [] and d["recent"] == []
    assert env.c.post(f"/api/me/revision/{ids['water']}/postpone", headers=env.stu, json={"days": 2}).status_code == 400
    assert env.c.post(f"/api/me/revision/{ids['vel']}/postpone", headers=env.stu, json={"days": 1}).status_code == 404  # not on their list
    r = env.c.post(f"/api/me/revision/{ids['water']}/postpone", headers=env.stu, json={"days": 3}).json()
    assert r["due"] == (main.local_day(dt.datetime.utcnow()) + dt.timedelta(days=3)).isoformat()  # overdue: three days from today
    d = env.c.get("/api/me/revision", headers=env.stu).json(); assert [x["title"] for x in d["upcoming"]] == ["Water hardness"] and d["overdue"] == []
    bell = {x["key"]: x for x in env.c.get("/api/me/notifications", headers=env.stu).json()["items"]}
    note = next(v for k, v in bell.items() if k.startswith("revise:")); assert note["text"] == "Topics to revise: 1" and note["sub"] == ""


def test_a_knowledge_check_moves_the_schedule_and_reading_does_not(env):
    ids = world(env); bank(env, ids["water"], 6); learned(env, ids["water"], 3)
    env.c.post(f"/api/topics/{ids['water']}/revised", headers=env.stu)  # read the sheet: reviewed, not checked
    x = env.c.get("/api/me/revision", headers=env.stu).json()["upcoming"][0]
    assert (x["checked"], x["step"], x["last"]["kind"], x["interval"]) == (False, 0, "read", 1)
    a = start(env, env.stu, topic_id=ids["water"]).json()  # the optional knowledge check: a set from the topic's bank questions
    env.c.post(f"/api/mcq/attempts/{a['id']}/submit", headers=env.stu, json={"answers": {}})  # all left blank: 0%
    d = env.c.get("/api/me/revision", headers=env.stu).json()
    x = (d["upcoming"] + d["today"])[0]; assert (x["checked"], x["weak"], x["step"], x["last"]["percent"], x["wrong"]) == (True, True, 0, 0, 5)
    assert x["due"] == (main.local_day(dt.datetime.utcnow()) + dt.timedelta(days=1)).isoformat()  # weak: back tomorrow
    assert [r["title"] for r in d["recent"]] == ["Water hardness"]


def test_weak_topics_and_repeated_mistakes_come_first(env):
    ids = world(env); bank(env, ids["water"], 6); learned(env, ids["water"], 9); learned(env, ids["rust"], 9)
    a = start(env, env.stu, topic_id=ids["water"]).json(); env.c.post(f"/api/mcq/attempts/{a['id']}/submit", headers=env.stu, json={"answers": {}})
    with Session_() as s:  # that check was a while ago, so both are overdue
        for at_ in s.query(main.McqAttempt): at_.submitted_at -= dt.timedelta(days=5)
        s.commit()
    assert [x["title"] for x in env.c.get("/api/me/revision", headers=env.stu).json()["overdue"]] == ["Water hardness", "Corrosion"]
