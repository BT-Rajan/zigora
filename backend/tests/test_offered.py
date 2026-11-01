# Courses a teacher offers: made by faculty or a school teacher, seen only by the students on their list; invitations (48 hours to accept) and
# requests (48 hours to decide); keep, suspend, release, complete; open to anyone; repeat with the same students; cancel; messages and offered help.
import datetime as dt
import main
from main import Session_, User, Enrolment, Course
from tests.test_access import CSV, ids, enrol

def setup(env):
    env.csv(CSV); i = ids(); enrol("stu@x.com", i["prog"]["Mech"], 1)
    env.add_user("ann@x.com"); enrol("ann@x.com", i["prog"]["Civil"], 1); env.ann = env.login("ann@x.com")  # another program
    return i

def offer(env, h=None, **k):
    r = env.c.post("/api/offered", headers=h or env.fac, json={"name": "Python for engineers", "about": "Six weeks", "access": "enroll", "applications": True, **k}); assert r.status_code == 200, r.text
    return r.json()

def course_ids(env, h): return [c["id"] for p in env.c.get("/api/tree", headers=h).json() for sm in p["semesters"] for c in sm["courses"]]

def test_invited_students_see_it_once_they_accept_and_others_never(env):
    setup(env); c = offer(env, starts_on=dt.date.today().isoformat(), ends_on=(dt.date.today() + dt.timedelta(days=42)).isoformat())
    assert c["state"] == "running" and c["id"] in course_ids(env, env.fac) and c["id"] not in course_ids(env, env.stu)
    unit = env.c.post("/api/units", headers=env.fac, json={"name": "Basics", "course_id": c["id"]}).json()
    t = env.c.post("/api/topics", headers=env.fac, json={"title": "Variables", "unit_id": unit["id"], "content": "x = 1"}).json()
    assert env.c.get(f"/api/topics/{t['id']}", headers=env.stu).status_code == 403
    r = env.c.post(f"/api/offered/{c['id']}/invite", headers=env.fac, json={"who": ["stu@x.com", "ann@x.com", "nobody@x.com", "fac@x.com"]}).json()
    assert r["invited"] == 2 and sorted(r["not_found"]) == ["fac@x.com", "nobody@x.com"]
    inv = env.c.get("/api/offered/catalog", headers=env.ann).json()["invited"]; assert inv[0]["id"] == c["id"] and inv[0]["expires_at"]
    assert any(n["key"].startswith("inv-course:") for n in env.c.get("/api/me/notifications", headers=env.ann).json()["items"])
    with Session_() as s: eid = s.query(Enrolment).join(User, User.id == Enrolment.user_id).filter(User.email == "ann@x.com").one().id
    assert env.c.post(f"/api/enrolments/{eid}", headers=env.ann, json={"action": "accept"}).json()["mine"] == "active"
    assert c["id"] in course_ids(env, env.ann) and env.c.get(f"/api/topics/{t['id']}", headers=env.ann).status_code == 200  # another program, still in
    assert env.c.get(f"/api/topics/{t['id']}", headers=env.stu).status_code == 403  # invited but not accepted
    # the invitation lapses after 48 hours
    with Session_() as s: s.query(Enrolment).filter(Enrolment.status == "invited").update({"expires_at": dt.datetime.utcnow() - dt.timedelta(minutes=1)}); s.commit()
    with Session_() as s: e2 = s.query(Enrolment).filter(Enrolment.status == "invited").one().id
    r = env.c.post(f"/api/enrolments/{e2}", headers=env.stu, json={"action": "accept"}); assert r.status_code == 400 and "48 hours" in r.json()["detail"]

def test_requests_wait_for_the_teacher_who_keeps_suspends_and_completes(env):
    setup(env); c = offer(env)
    assert env.c.post(f"/api/offered/{c['id']}/join", headers=env.stu).json()["mine"] == "applied"
    assert any(n["key"].startswith("applied:") for n in env.c.get("/api/me/notifications", headers=env.fac).json()["items"])
    row = env.c.get(f"/api/offered/{c['id']}/roster", headers=env.fac).json()["items"][0]; assert row["status"] == "applied" and row["expires_at"]
    assert env.c.post(f"/api/enrolments/{row['id']}", headers=env.stu, json={"action": "approve"}).status_code in (400, 403)  # not theirs to approve
    assert env.c.post(f"/api/enrolments/{row['id']}", headers=env.fac, json={"action": "approve"}).json()["status"] == "active"
    assert c["id"] in course_ids(env, env.stu)
    assert env.c.post(f"/api/enrolments/{row['id']}", headers=env.fac, json={"action": "suspend"}).json()["status"] == "suspended"
    unit = env.c.post("/api/units", headers=env.fac, json={"name": "U", "course_id": c["id"]}).json(); t = env.c.post("/api/topics", headers=env.fac, json={"title": "T", "unit_id": unit["id"], "content": "c"}).json()
    r = env.c.get(f"/api/topics/{t['id']}", headers=env.stu); assert r.status_code == 403 and "on hold" in r.json()["detail"]
    assert env.c.post(f"/api/enrolments/{row['id']}", headers=env.fac, json={"action": "retain"}).json()["status"] == "active"
    assert env.c.post(f"/api/enrolments/{row['id']}", headers=env.fac, json={"action": "complete"}).json()["status"] == "completed"
    assert env.c.get(f"/api/topics/{t['id']}", headers=env.stu).status_code == 200  # can look back
    assert env.c.post(f"/api/enrolments/{row['id']}", headers=env.fac, json={"action": "release"}).json()["status"] == "released"
    assert env.c.get(f"/api/topics/{t['id']}", headers=env.stu).status_code == 403
    env.c.put(f"/api/offered/{c['id']}", headers=env.fac, json={"name": c["name"], "access": "enroll", "applications": False})
    assert env.c.post(f"/api/offered/{c['id']}/join", headers=env.ann).status_code == 403  # invitation only now

def test_an_open_course_anyone_joins_and_a_school_teacher_can_offer_one(env):
    setup(env); env.add_user("teach@x.com", "guardian")
    with Session_() as s: s.query(User).filter_by(email="teach@x.com").update({"relation": "teacher"}); s.commit()
    tch = env.login("teach@x.com"); c = offer(env, h=tch, name="Maths circle", access="open")
    unit = env.c.post("/api/units", headers=tch, json={"name": "Numbers", "course_id": c["id"]}); assert unit.status_code == 200, unit.text
    t = env.c.post("/api/topics", headers=tch, json={"title": "Primes", "unit_id": unit.json()["id"], "content": "2, 3, 5"}).json()
    assert env.c.post(f"/api/offered/{c['id']}/join", headers=env.ann).json()["mine"] == "active"
    assert env.c.get(f"/api/topics/{t['id']}", headers=env.ann).status_code == 200
    env.add_user("par@x.com", "guardian")
    with Session_() as s: s.query(User).filter_by(email="par@x.com").update({"relation": "parent"}); s.commit()
    assert env.c.post("/api/offered", headers=env.login("par@x.com"), json={"name": "Nope", "access": "open"}).status_code == 403  # parents don't offer courses
    assert env.c.post("/api/units", headers=tch, json={"name": "X", "course_id": ids()["course"]["Chem"]}).status_code == 403  # not their course

def test_repeat_with_the_same_students_and_cancel(env, monkeypatch):
    setup(env); c = offer(env, access="open")
    unit = env.c.post("/api/units", headers=env.fac, json={"name": "Week 1", "course_id": c["id"]}).json()
    env.c.post("/api/topics", headers=env.fac, json={"title": "Intro", "unit_id": unit["id"], "content": "hello"})
    env.c.post(f"/api/offered/{c['id']}/join", headers=env.stu)
    r = env.c.post(f"/api/offered/{c['id']}/repeat", headers=env.fac, json={"name": "Python, run 2", "students": "same"}).json()
    assert r["invited"] == 1 and r["repeat_of"] == c["id"] and r["topics"] == 1
    assert env.c.get("/api/offered/catalog", headers=env.stu).json()["invited"][0]["id"] == r["id"]
    sent = []; monkeypatch.setattr(main, "mail_on", lambda s=None: True); monkeypatch.setattr(main, "account_mail", lambda to, name, kind, subj, body, link, lang="en": sent.append((to, subj)))
    d = (dt.date.today() + dt.timedelta(days=2)).isoformat()
    env.c.post("/api/announcements", headers=env.fac, json={"course_id": c["id"], "kind": "class", "title": "Live", "day": d, "at": "10:00", "link": "https://meet.google.com/a-b-c"})
    sent.clear(); assert env.c.post(f"/api/offered/{c['id']}/cancel", headers=env.fac).json()["state"] == "cancelled"
    assert ("stu@x.com", "Course cancelled: Python for engineers") in sent
    assert c["id"] not in course_ids(env, env.stu) and env.c.get("/api/announcements", headers=env.stu).json()["upcoming"] == []

def test_messages_offered_help_and_moving_a_class(env, monkeypatch):
    i = setup(env)
    with Session_() as s: fac = s.query(User).filter_by(email="fac@x.com").one(); s.query(Course).filter_by(name="Chem").update({"faculty_owner_id": fac.id}); s.commit()
    cid, tid = i["course"]["Chem"], i["topic"]["Water"]
    r = env.c.post(f"/api/courses/{cid}/message", headers=env.fac, json={"subject": "Test on Friday", "text": "Revise units 1 and 2."}); assert r.json() == {"sent": 1}
    mine = env.c.get("/api/me/questions", headers=env.stu).json()["items"]; assert mine[0]["topic"] == "Test on Friday" and mine[0]["unread"] and mine[0]["message"]
    th = env.c.get(f"/api/questions/{mine[0]['id']}", headers=env.stu).json(); assert th["messages"][0]["teacher"] and th["topic_id"] is None
    assert env.c.post(f"/api/questions/{mine[0]['id']}/replies", headers=env.stu, json={"text": "Thank you, will do."}).json()["status"] == "waiting"
    assert env.c.post(f"/api/topics/{tid}/offer-help", headers=env.fac, json={"text": "Shall we go over it?"}).status_code == 400  # nobody stuck yet
    env.c.post(f"/api/topics/{tid}/doubt", headers=env.stu, json={"phrase": "hardness"})
    assert env.c.post(f"/api/topics/{tid}/offer-help", headers=env.fac, json={"text": "Shall we go over it on Monday?"}).json() == {"sent": 1}
    d = (dt.date.today() + dt.timedelta(days=3)).isoformat(); d2 = (dt.date.today() + dt.timedelta(days=4)).isoformat()
    a = env.c.post("/api/announcements", headers=env.fac, json={"course_id": cid, "kind": "class", "title": "Revision", "day": d, "at": "10:00", "link": "https://meet.google.com/a-b-c"}).json()
    m = env.c.put(f"/api/announcements/{a['id']}", headers=env.fac, json={"day": d2, "at": "15:30", "minutes": 45}); assert m.status_code == 200, m.text
    cal = env.c.get("/api/calendar", headers=env.stu, params={"start": d, "end": d2}).json()["items"]
    assert [(x["date"], x["at"]) for x in cal if x["kind"] == "class"] == [(d2, "15:30")]
