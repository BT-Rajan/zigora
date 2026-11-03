"""S33: an assignment can open later, carries instructions, and counts the best, latest or first on-time attempt; an attempt counts only for the
assignment it was made for; students hear about new tests and ones due within a day in the bell (and so the daily email)."""
import datetime as dt
import main
from main import Session_, Attempt, Assignment, Setting
from tests.test_quiz_reports import setup, make_quiz
from tests.test_assignments import due
from tests.test_insights import me_id


def later(hours):  # a time on the students' clock, as the form sends it
    return (dt.datetime.utcnow() + dt.timedelta(minutes=main.DAY_OFFSET) + dt.timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M")
def assign(env, i, q, **kw):
    r = env.c.post("/api/assignments", headers=env.admin, json={"course_id": i["course"]["Chem"], "kind": "quiz", "quiz_id": q, "students": [me_id("stu@x.com")],
                                                               "due": due(), "attempts": 0, **kw})
    assert r.status_code == 200, r.text; return r.json()["id"]
def mine(env): return {x["id"]: x for x in env.c.get("/api/me/assignments", headers=env.stu).json()["items"]}
def take(env, q, answers=(0, 0)): return env.c.post(f"/api/quizzes/{q}/attempt", headers=env.stu, json={"answers": list(answers)})


def test_an_assignment_opens_at_its_start_time(env):
    i, unit = setup(env); q = make_quiz(env, unit)
    aid = assign(env, i, q, opens=later(5), instructions="Closed book. 20 minutes.")
    a = mine(env)[aid]; assert a["status"] == "upcoming" and a["instructions"] == "Closed book. 20 minutes." and a["opens"] == later(5)
    for r in (env.c.get(f"/api/quizzes/{q}", headers=env.stu), take(env, q),
              env.c.put(f"/api/quizzes/{q}/draft", headers=env.stu, json={"request_id": "s", "answers": {}, "version": 1})):
        assert r.status_code == 403 and "opens on" in r.json()["detail"]
    assert env.c.get(f"/api/quizzes/{q}", headers=env.admin).status_code == 200  # the teacher can still see it
    with Session_() as s: s.get(Assignment, aid).opens_at = dt.datetime.utcnow() - dt.timedelta(minutes=1); s.commit()
    assert mine(env)[aid]["status"] == "to_do"
    r = take(env, q).json()
    with Session_() as s: assert s.get(Attempt, r["attempt_id"]).assignment_id == aid  # the attempt says which assignment it was for
    assert mine(env)[aid]["status"] == "done"


def test_the_start_must_come_before_the_due_time_and_the_rule_must_be_known(env):
    i, unit = setup(env); q = make_quiz(env, unit)
    body = {"course_id": i["course"]["Chem"], "kind": "quiz", "quiz_id": q, "students": [me_id("stu@x.com")], "due": due(1), "attempts": 1}
    assert env.c.post("/api/assignments", headers=env.admin, json={**body, "opens": due(2)}).status_code == 400
    assert env.c.post("/api/assignments", headers=env.admin, json={**body, "counts": "average"}).status_code == 400


def test_which_attempt_counts_is_the_teachers_choice(env):
    i, unit = setup(env); q = make_quiz(env, unit); aid = assign(env, i, q)
    for answers in ((0, 1), (0, 0), (1, 1)): take(env, q, answers)  # 50%, 100%, 0%
    seen = {}
    for rule in ("best", "latest", "first"):
        assert env.c.patch(f"/api/assignments/{aid}", headers=env.admin, json={"counts": rule}).json()["counts"] == rule
        seen[rule] = env.c.get(f"/api/assignments/{aid}", headers=env.admin).json()["rows"][0]["best"]
        assert mine(env)[aid]["best"] == seen[rule]
    assert seen == {"best": 100, "latest": 0, "first": 50}


def test_an_attempt_counts_for_one_assignment_only(env):
    i, unit = setup(env); q = make_quiz(env, unit)
    soon = assign(env, i, q, due=due(1), attempts=1); later_one = assign(env, i, q, due=due(3), attempts=1)
    take(env, q)
    m = mine(env); assert (m[soon]["used"], m[later_one]["used"]) == (1, 0)  # the one due first takes it; the other still has its attempt
    take(env, q)  # the next sitting goes to the one still open
    m = mine(env); assert (m[soon]["used"], m[later_one]["used"]) == (1, 1)


def test_attempts_from_before_tying_keep_the_old_rule(env):
    i, unit = setup(env); q = make_quiz(env, unit); aid = assign(env, i, q)
    with Session_() as s:
        s.get(Setting, "assign_tie_since").v = (dt.datetime.utcnow() + dt.timedelta(hours=1)).isoformat()  # attempts were tied only from later on
        s.add(Attempt(quiz_id=q, user_id=me_id("stu@x.com"), score=1, total=2, percent=50, detail="[]")); s.commit()
    assert mine(env)[aid]["used"] == 1


def test_the_bell_tells_of_a_new_test_and_one_due_soon(env):
    i, unit = setup(env); q = make_quiz(env, unit); aid = assign(env, i, q, due=due(3))
    def bell(): return {x["key"]: x for x in env.c.get("/api/me/notifications", headers=env.stu).json()["items"]}
    b = bell(); assert b[f"assignment:{aid}:new"]["sub"].startswith("New test · due ") and b[f"assignment:{aid}:new"]["text"] == "Water quiz"
    with Session_() as s: s.get(Assignment, aid).due_at = dt.datetime.utcnow() + dt.timedelta(hours=5); s.commit()
    b = bell(); assert f"assignment:{aid}:soon" in b and b[f"assignment:{aid}:soon"]["sub"].startswith("Due within a day · ")
    take(env, q)
    assert not [k for k in bell() if k.startswith(f"assignment:{aid}")]  # done: nothing to remind of
    upcoming = assign(env, i, q, opens=later(5))
    assert not [k for k in bell() if k.startswith(f"assignment:{upcoming}")]  # not open yet: no news until it is


def test_home_and_bell_dont_offer_a_test_before_it_opens(env):
    i, unit = setup(env); q = make_quiz(env, unit)
    def offered(): return [x for x in env.c.get("/api/me/today", headers=env.stu).json()["focus"] if x.get("quiz_id") == q]
    assert offered()  # a new quiz is offered as usual
    aid = assign(env, i, q, opens=later(12))
    assert not offered() and not [x for x in env.c.get("/api/me/notifications", headers=env.stu).json()["items"] if str(q) in x["key"] or x["text"] == "Water quiz"]
    with Session_() as s: s.get(Assignment, aid).opens_at = None; s.commit()
    assert offered()
