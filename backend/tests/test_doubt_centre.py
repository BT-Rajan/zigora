"""S42: the doubt management centre. A teacher sees and counts only their own courses' doubts (admins every course, with the unassigned ones);
filters, search and sort run on the server; overdue exists only when an admin sets response targets; reports count by course, unit and topic."""
import datetime as dt
import main
from main import Session_, TeacherQuestion
from tests.test_ask_teacher import setup, ask
from tests.test_access import ids
from tests.test_insights import me_id

def world(env):
    t = setup(env); i = ids(); env.add_user("stu2@x.com", program=i["prog"]["Mech"], semester=1); s2 = env.login("stu2@x.com")
    a = ask(env, t, "Why does boiling remove temporary hardness?").json()["id"]
    b = ask(env, t, "What is a ppm?").json()["id"]
    c = ask(env, t, "Is rain water hard?", h=s2).json()["id"]
    d = ask(env, i["topic"]["Tools"], "Which spanner for M8 bolts?").json()["id"]  # Workshop: no owner, so unassigned
    with Session_() as s:  # submitted a day apart, oldest first
        for k, qid in enumerate((a, b, c, d)):
            x = s.get(TeacherQuestion, qid); x.at = x.updated = dt.datetime.utcnow() - dt.timedelta(days=4 - k)
        s.commit()
    return t, i, s2, a, b, c, d
def lst(env, h, **p): return env.c.get("/api/questions", headers=h, params={"sort": "priority", **p}).json()
def summ(env, h): return env.c.get("/api/questions/summary", headers=h).json()


def test_scope_and_counts_match_the_list(env):
    t, i, s2, a, b, c, d = world(env)
    f = summ(env, env.fac); assert (f["pending"], f["answered"], f["follow_up"], f["resolved"], f["unassigned"], f["overdue"]) == (3, 0, 0, 0, None, None)
    assert lst(env, env.fac)["total"] == 3 and {x["id"] for x in lst(env, env.fac)["items"]} == {a, b, c}
    ad = summ(env, env.admin); assert (ad["pending"], ad["unassigned"]) == (4, 1)
    assert [x["id"] for x in lst(env, env.admin, unassigned=True)["items"]] == [d] and lst(env, env.admin, unassigned=True)["items"][0]["teacher"] is None
    env.add_user("fac2@x.com", "faculty"); f2 = env.login("fac2@x.com")
    assert summ(env, f2)["pending"] == 0 and lst(env, f2)["total"] == 0  # not their course
    assert env.c.get("/api/questions/summary", headers=env.stu).status_code == 403
    assert env.c.get("/api/questions", headers=env.fac, params={"unassigned": True}).status_code == 403  # admins only
    for k in ("pending", "answered", "follow_up", "resolved"): assert lst(env, env.fac, label=k)["total"] == summ(env, env.fac)[k]


def test_states_priority_and_sorting(env):
    t, i, s2, a, b, c, d = world(env)
    env.c.post(f"/api/questions/{a}/replies", headers=env.fac, json={"text": "Bicarbonates break down."})
    env.c.post(f"/api/questions/{a}/replies", headers=env.stu, json={"text": "And sulphates?"})  # follow-up, newest activity
    env.c.post(f"/api/questions/{c}/replies", headers=env.fac, json={"text": "Usually soft."}); env.c.post(f"/api/questions/{c}/close", headers=env.fac)
    f = summ(env, env.fac); assert (f["pending"], f["follow_up"], f["answered"], f["resolved"]) == (1, 1, 0, 1)
    items = lst(env, env.fac)["items"]; assert [x["id"] for x in items] == [b, a, c]  # unanswered oldest first, then the follow-up, then the rest
    assert [x["label"] for x in items] == ["pending", "follow_up", "resolved"] and items[0]["student"] and items[0]["unit"] and items[0]["preview"] == "What is a ppm?"
    assert [x["id"] for x in lst(env, env.fac, sort="followups")["items"]][0] == a
    assert [x["id"] for x in lst(env, env.fac, sort="submitted")["items"]] == [c, b, a]
    assert lst(env, env.fac, sort="bogus").get("detail")


def test_filters_search_and_pages(env):
    t, i, s2, a, b, c, d = world(env)
    assert [x["id"] for x in lst(env, env.fac, student="stu2")["items"]] == [c]
    assert [x["id"] for x in lst(env, env.fac, q="ppm")["items"]] == [b]  # question text
    assert lst(env, env.fac, q="Water")["total"] == 3 and lst(env, env.admin, q="Tools")["total"] == 1  # topic name
    assert lst(env, env.fac, q="stu2")["total"] == 1  # student name
    assert lst(env, env.fac, topic_id=t, student="stu@x", label="pending")["total"] == 2  # filters combine
    day = main.local_day(dt.datetime.utcnow())
    assert lst(env, env.fac, since=(day - dt.timedelta(days=3)).isoformat())["total"] == 2 and lst(env, env.fac, until=(day - dt.timedelta(days=4)).isoformat())["total"] == 1
    p1 = lst(env, env.fac, limit=2); p2 = lst(env, env.fac, limit=2, offset=2)
    assert p1["total"] == p2["total"] == 3 and len(p1["items"]) == 2 and len(p2["items"]) == 1 and not {x["id"] for x in p1["items"]} & {x["id"] for x in p2["items"]}
    assert lst(env, env.fac, course_id=i["course"]["Workshop"])["total"] == 0  # another course's doubts never show


def test_overdue_only_with_a_target(env):
    t, i, s2, a, b, c, d = world(env)
    assert summ(env, env.fac)["overdue"] is None and lst(env, env.fac, overdue=True)["total"] == 0
    assert env.c.put("/api/admin/settings", headers=env.admin, json={"doubt_hours": [60, 12]}).status_code == 200
    f = summ(env, env.fac); assert f["targets"] == {"first_hours": 60, "followup_hours": 12} and f["overdue"] == 2  # a and b waited 4 and 3 days; c 2 (48 h)
    assert {x["id"] for x in lst(env, env.fac, overdue=True)["items"]} == {a, b}
    env.c.post(f"/api/questions/{a}/replies", headers=env.fac, json={"text": "Answer."}); env.c.post(f"/api/questions/{a}/replies", headers=env.stu, json={"text": "Still?"})
    assert summ(env, env.fac)["overdue"] == 1  # a follow-up only now: within its 12 hours
    with Session_() as s: s.get(TeacherQuestion, a).updated -= dt.timedelta(hours=13); s.commit()
    row = next(x for x in lst(env, env.fac)["items"] if x["id"] == a); assert row["overdue"] and row["label"] == "follow_up" and row["first_response_hours"] is not None
    assert env.c.put("/api/admin/settings", headers=env.admin, json={"doubt_hours": [48, -1]}).status_code == 400
    assert env.c.put("/api/admin/settings", headers=env.fac, json={"doubt_hours": [1, 1]}).status_code == 403


def test_report_counts(env):
    t, i, s2, a, b, c, d = world(env)
    env.c.post(f"/api/questions/{a}/replies", headers=env.fac, json={"text": "Answer."}); env.c.post(f"/api/questions/{a}/close", headers=env.fac)
    env.c.post(f"/api/questions/{a}/replies", headers=env.stu, json={"text": "Reopening, still unsure."})
    env.c.post(f"/api/questions/{a}/replies", headers=env.fac, json={"text": "Look again."}); env.c.post(f"/api/questions/{a}/replies", headers=env.stu, json={"text": "Still unsure."})
    r = env.c.get("/api/questions/report", headers=env.fac).json()
    assert (r["total"], r["pending"], r["follow_up"], r["reopened"]) == (3, 2, 1, 1)
    assert r["by_topic"][0]["name"] == "Water" and r["by_topic"][0]["doubts"] == 3 and r["by_course"] == [{"id": i["course"]["Chem"], "name": "Chem", "doubts": 3, "pending": 2, "follow_up": 1, "reopened": 1}]
    assert r["asks_again"] == [{"id": me_id("stu@x.com"), "name": "stu@x.com", "follow_ups": 2}]
    assert env.c.get("/api/questions/report", headers=env.admin).json()["total"] == 4
