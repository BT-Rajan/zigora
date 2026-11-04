"""S45: learning support plans. A course's teacher gathers existing activities for chosen students; each student's progress is read from the records
those activities leave after they were assigned; the outcome compares the same topics before and after (tests and practice apart) and stays
"not yet established" until there is enough evidence; edits keep history and notify once; the AI only picks from existing activities."""
import datetime as dt
import main
from main import Session_, Progress, StepLog, Setting, InterventionStudent
from tests.test_class_intelligence import world, practice
from tests.test_insights import me_id


def plan(env, cid, t, q, students, h=None, **extra):
    b = {"course_id": cid, "title": "Boilers support", "description": "A little more on boilers.", "topic_ids": [t["Boilers"]], "activate": True,
         "activities": [{"kind": "study", "topic_id": t["Boilers"]}, {"kind": "revise", "topic_id": t["Boilers"]}, {"kind": "test", "ref_id": q},
                        {"kind": "ask", "topic_id": t["Boilers"], "required": False}],
         "student_ids": students, "reasons": {str(students[0]): "Boilers below 60% twice"}, **extra}
    return env.c.post("/api/interventions", headers=h or env.fac, json=b)
def row(p, uid): return next(x for x in p["students"] if x["user_id"] == uid)


def test_create_validate_and_who_may(env):
    i, q, t, cid, hs = world(env); s2, s3 = me_id("s2@x.com"), me_id("s3@x.com")
    r = plan(env, cid, t, q, [s2, s3]); assert r.status_code == 200, r.text; p = r.json()
    assert p["status"] == "active" and p["counts"]["students"] == 2 and p["counts"]["not_started"] == 2 and len(p["activities"]) == 4
    assert row(p, s2)["reason"] == "Boilers below 60% twice" and row(p, s2)["required"] == 3  # the optional "ask" isn't required
    assert plan(env, cid, t, q, [s2], h=env.stu).status_code == 403
    other = i["course"]["Workshop"]
    assert plan(env, other, t, q, [s2]).status_code in (400, 403)  # topics of another course
    assert plan(env, cid, t, 999999, [s2]).status_code == 400  # a test that isn't this course's
    env.add_user("out@x.com", program=i["prog"]["Civil"], semester=1)
    assert plan(env, cid, t, q, [me_id("out@x.com")]).status_code == 400  # not a student of this course
    assert plan(env, cid, t, q, [s2], activities=[{"kind": "magic", "topic_id": t["Boilers"]}]).status_code == 400
    assert env.c.get(f"/api/interventions/{p['id']}", headers=env.stu).status_code == 403
    assert [x["id"] for x in env.c.get("/api/interventions", headers=env.fac, params={"course_id": cid}).json()["items"]] == [p["id"]]


def test_progress_from_records_after_assignment_and_outcome(env):
    i, q, t, cid, hs = world(env); s2 = me_id("s2@x.com"); h2 = hs[1]
    p = plan(env, cid, t, q, [s2]).json(); pid = p["id"]
    base = row(p, s2)["comparison"]
    assert base["test"]["before"]["asked"] == 6 and base["test"]["before"]["percent"] == 0 and base["overall"] == "not_established"  # nothing after yet
    # old records don't count: s2 already took the test before the plan
    assert {a["kind"]: a["state"] for a in row(env.c.get(f"/api/interventions/{pid}", headers=env.fac).json(), s2)["activities"]}["test"] == "todo"
    env.c.post(f"/api/topics/{t['Boilers']}/revised", headers=h2)
    with Session_() as s: s.merge(Progress(user_id=s2, topic_id=t["Boilers"], completed_at=dt.datetime.utcnow(), last_read=dt.datetime.utcnow())); s.commit()
    x = row(env.c.get(f"/api/interventions/{pid}", headers=env.fac).json(), s2); assert x["progress"] == "in_progress" and x["done"] == 2
    for r in range(2): env.c.post(f"/api/quizzes/{q}/attempt", headers=h2, json={"answers": [0, 0, 0, 0, 0], "request_id": f"after{r}"})
    d = env.c.get(f"/api/interventions/{pid}", headers=env.fac).json(); x = row(d, s2)
    assert x["progress"] == "completed" and x["needs_review"] and d["counts"]["needs_review"] == 1
    c = x["comparison"]["test"]; assert (c["before"]["percent"], c["after"]["percent"], c["after"]["asked"], c["established"], c["direction"]) == (0, 100, 6, True, "rose")
    assert x["comparison"]["practice"]["established"] is False and x["comparison"]["overall"] == "rose"  # practice judged apart, and not yet
    assert any(n["key"].startswith("plans-review:") for n in env.c.get("/api/me/notifications", headers=env.fac).json()["items"])
    assert env.c.post(f"/api/interventions/{pid}/students/{s2}/review", headers=env.fac, json={"outcome": "great"}).status_code == 400
    d = env.c.post(f"/api/interventions/{pid}/students/{s2}/review", headers=env.fac, json={"outcome": "improved", "note": "Scale is clear now"}).json()
    assert row(d, s2)["outcome"] == "improved" and not row(d, s2)["needs_review"]
    assert not any(n["key"].startswith("plans-review:") for n in env.c.get("/api/me/notifications", headers=env.fac).json()["items"])


def test_practice_and_resource_opening(env):
    i, q, t, cid, hs = world(env); s2 = me_id("s2@x.com"); h2 = hs[1]
    res = env.c.post("/api/resources", headers=env.fac, json={"topic_id": t["Boilers"], "kind": "note", "title": "Scale", "body": "Scale forms from hard water."}).json()
    p = plan(env, cid, t, q, [s2], activities=[{"kind": "mcq", "topic_id": t["Boilers"], "size": 5}, {"kind": "resource", "ref_id": res["id"]}])
    assert p.status_code == 400  # a draft resource can't be used
    env.c.post(f"/api/resources/{res['id']}/status", headers=env.fac, json={"status": "published"})
    p = plan(env, cid, t, q, [s2], activities=[{"kind": "mcq", "topic_id": t["Boilers"], "size": 5}, {"kind": "resource", "ref_id": res["id"]}]).json()
    practice(s2, t["Boilers"], [True, True, True])
    x = {a["kind"]: a for a in row(env.c.get(f"/api/interventions/{p['id']}", headers=env.fac).json(), s2)["activities"]}
    assert x["mcq"]["state"] == "started" and x["mcq"]["evidence"] == "3/3" and x["resource"]["state"] == "todo"
    practice(s2, t["Boilers"], [True, False]); practice(s2, t["Boilers"], [True] * 9, status="abandoned")  # an abandoned set never counts
    assert env.c.post(f"/api/resources/{res['id']}/opened", headers=h2).json() == {"ok": True}
    env.c.post(f"/api/resources/{res['id']}/opened", headers=h2)  # opened again within the hour: one record
    with Session_() as s: assert s.query(StepLog).filter_by(user_id=s2, kind="resource").count() == 1
    x = {a["kind"]: a for a in row(env.c.get(f"/api/interventions/{p['id']}", headers=env.fac).json(), s2)["activities"]}
    assert (x["mcq"]["state"], x["mcq"]["evidence"], x["resource"]["state"], x["resource"]["evidence"]) == ("done", "4/5", "done", "opened")
    assert env.c.post(f"/api/resources/{res['id']}/opened", headers=env.c.headers).status_code == 401


def test_edit_keeps_history_and_notifies_once(env):
    i, q, t, cid, hs = world(env); s2, s3 = me_id("s2@x.com"), me_id("s3@x.com"); h2 = hs[1]
    p = plan(env, cid, t, q, [s2, s3]).json(); pid = p["id"]
    keys = lambda h: [n["key"] for n in env.c.get("/api/me/notifications", headers=h).json()["items"] if n["key"].startswith("plan:")]
    k1 = keys(h2); assert len(k1) == 1
    env.c.post(f"/api/topics/{t['Boilers']}/revised", headers=h2)
    acts = p["activities"]; revise = next(a for a in acts if a["kind"] == "revise")
    keep = [{"id": a["id"], "kind": a["kind"], "topic_id": a["topic_id"], "ref_id": a["ref_id"], "required": a["required"]} for a in acts if a["kind"] not in ("revise", "ask")]
    body = {"course_id": cid, "title": "Boilers support", "topic_ids": [t["Boilers"]], "activities": keep + [{"kind": "relearn", "topic_id": t["Boilers"]}], "student_ids": [s2]}
    d = env.c.put(f"/api/interventions/{pid}", headers=env.fac, json=body).json()
    gone = next(a for a in d["activities"] if a["id"] == revise["id"]); assert gone["removed_at"]  # kept as history
    x = row(d, s2); assert [a for a in x["activities"] if a["removed"]][0]["state"] == "done"  # done before removal: still shown
    assert not any(a["kind"] == "ask" for a in x["activities"])  # removed and never done: gone from their list
    assert row(d, s3)["removed"] and d["counts"]["students"] == 1
    k2 = keys(h2); assert len(k2) == 1 and k2 != k1  # one new note for the change
    assert keys(hs[2]) == []  # the removed student no longer hears about it
    d2 = env.c.put(f"/api/interventions/{pid}", headers=env.fac, json={**body, "activities": [{"id": a["id"], "kind": a["kind"], "topic_id": a["topic_id"], "ref_id": a["ref_id"]} for a in d["activities"] if not a["removed_at"]],
                                                                     "description": "Wording only"}).json()
    assert keys(h2) == k2 and d2["description"] == "Wording only"  # wording alone doesn't ring the bell again
    with Session_() as s: assert s.query(InterventionStudent).filter_by(intervention_id=pid).count() == 2  # nobody's record is deleted
    assert env.c.post(f"/api/interventions/{pid}/status", headers=env.fac, json={"status": "completed"}).json()["status"] == "completed"
    assert keys(h2) == [] and env.c.put(f"/api/interventions/{pid}", headers=env.fac, json=body).status_code == 400


def test_student_view_draft_and_baseline_frozen(env):
    i, q, t, cid, hs = world(env); s2 = me_id("s2@x.com"); h2 = hs[1]
    p = plan(env, cid, t, q, [s2], activate=False).json(); assert p["status"] == "draft"
    assert env.c.get("/api/me/support", headers=h2).json()["items"] == [] and not row(p, s2)["assigned_at"]
    env.c.post(f"/api/interventions/{p['id']}/status", headers=env.fac, json={"status": "active"})
    mine = env.c.get("/api/me/support", headers=h2).json()["items"]
    assert len(mine) == 1 and mine[0]["title"] == "Boilers support" and mine[0]["course"] == "Chem" and [a["kind"] for a in mine[0]["activities"]] == ["study", "revise", "test", "ask"]
    assert mine[0]["activities"][2]["label"] == "Mixed" and "reason" not in mine[0] and "comparison" not in mine[0]  # the teacher's reasons and numbers stay with the teacher
    assert env.c.get("/api/me/support", headers=hs[2]).json()["items"] == []
    with Session_() as s: b1 = s.query(InterventionStudent).filter_by(user_id=s2).first().baseline
    env.c.post(f"/api/quizzes/{q}/attempt", headers=h2, json={"answers": [0, 0, 0, 0, 0], "request_id": "x"})
    with Session_() as s: assert s.query(InterventionStudent).filter_by(user_id=s2).first().baseline == b1  # frozen at the start


def test_options_and_ai_suggests_only_existing(env, monkeypatch):
    i, q, t, cid, hs = world(env)
    o = env.c.get(f"/api/courses/{cid}/support-options", headers=env.fac, params={"topic_ids": str(t["Boilers"])}).json()
    assert [x["id"] for x in o["tests"]] == [q] and o["tests"][0]["questions"] == 3
    assert [x["topics"][0]["category"] for x in o["students"]] == ["attention"] * 3 + ["strong"]
    assert env.c.get(f"/api/courses/{cid}/support-options", headers=env.stu).status_code == 403
    with Session_() as s: s.merge(Setting(k="deepseek_key", v="sk-test-1234")); s.commit()
    seen = []
    async def fake(u, s, key, prompt, msg, max_tokens=None, kind="", topic_id=None, **k):
        seen.append(msg); return '{"activities": [{"id": "A1", "why": "Most need it [E1]"}, {"id": "A99", "why": "made up"}], "note": "Start with the topic."}', 50
    monkeypatch.setattr(main, "ask_ai", fake)
    r = env.c.post("/api/interventions/suggest", headers=env.fac, json={"course_id": cid, "topic_ids": [t["Boilers"]]}).json()
    assert [a["kind"] for a in r["activities"]] == ["study"] and r["dropped"] == 1 and r["suggested_by_ai"]
    assert "s2@x.com" not in seen[0] and "Test: Mixed" in seen[0]
    with Session_() as s: assert s.query(main.Intervention).count() == 0  # nothing saved or assigned
