# The teacher's side: a marked model answer on a topic, where students struggle, and announcements and classes with a video link that go into the
# calendars and the bells of the course's students and their parents (and the admins' bell).
import datetime as dt
import main
from main import Session_, Course, User, GuardianLink
from tests.test_access import CSV, ids, enrol

def setup(env):
    env.csv(CSV); i = ids(); enrol("stu@x.com", i["prog"]["Mech"], 1)
    with Session_() as s: fac = s.query(User).filter_by(email="fac@x.com").one(); s.query(Course).filter_by(name="Chem").update({"faculty_owner_id": fac.id}); s.commit()
    return i

def test_a_teacher_posts_a_marked_model_answer(env):
    i = setup(env); t = i["topic"]["Water"]
    body = {"question": "Explain temporary hardness. (5 marks)", "parts": [{"text": "Definition", "marks": 1}, {"text": "Equation on boiling", "marks": 2.5}, {"text": "  ", "marks": 3}, {"text": "Example", "marks": 1.5}]}
    r = env.c.put(f"/api/topics/{t}/model-answer", headers=env.fac, json=body); assert r.status_code == 200, r.text
    assert r.json()["total"] == 5 and len(r.json()["parts"]) == 3
    got = env.c.get(f"/api/topics/{t}", headers=env.stu).json()["model_answer"]; assert got["question"].startswith("Explain") and got["parts"][1] == {"text": "Equation on boiling", "marks": 2.5}
    assert env.c.put(f"/api/topics/{t}/model-answer", headers=env.stu, json=body).status_code == 403
    env.add_user("fac2@x.com", "faculty"); assert env.c.put(f"/api/topics/{t}/model-answer", headers=env.login("fac2@x.com"), json=body).status_code == 403
    assert env.c.put(f"/api/topics/{t}/model-answer", headers=env.fac, json={"question": "Q?", "parts": []}).status_code == 400
    env.c.delete(f"/api/topics/{t}/model-answer", headers=env.fac); assert env.c.get(f"/api/topics/{t}", headers=env.stu).json()["model_answer"] is None

def test_the_struggle_report_counts_what_students_did_when_stuck(env):
    i = setup(env); t = i["topic"]["Water"]
    env.c.post(f"/api/topics/{t}/questions", headers=env.stu, json={"text": "Why does scale form?"})
    env.c.post(f"/api/topics/{t}/doubt", headers=env.stu, json={"phrase": "hardness"})
    env.c.post(f"/api/topics/{t}/check-result", headers=env.stu, json={"outcome": "not_yet"})
    r = env.c.get("/api/reports/struggles", headers=env.fac).json(); row = r["items"][0]
    assert row["topic"] == "Water" and row["questions"] == 1 and row["doubts"] == 1 and row["not_quite"] == 1 and row["students"] == 1 and row["asked"] == ["Why does scale form?"]
    env.add_user("fac2@x.com", "faculty"); assert env.c.get("/api/reports/struggles", headers=env.login("fac2@x.com")).json()["items"] == []
    assert env.c.get("/api/reports/struggles", headers=env.stu).status_code == 403

def test_a_class_with_a_meet_link_reaches_students_parents_calendars_and_bells(env, monkeypatch):
    i = setup(env); cid = i["course"]["Chem"]
    env.add_user("par@x.com", "guardian")
    with Session_() as s:
        p = s.query(User).filter_by(email="par@x.com").one(); p.relation = "parent"; st = s.query(User).filter_by(email="stu@x.com").one()
        s.add(GuardianLink(guardian_id=p.id, student_id=st.id, status="active")); s.commit()
    sent = []; monkeypatch.setattr(main, "mail_on", lambda s=None: True); monkeypatch.setattr(main, "account_mail", lambda to, name, kind, subj, body, link, lang="en": sent.append((to, subj, body)))
    day = (dt.date.today() + dt.timedelta(days=1)).isoformat()
    bad = env.c.post("/api/announcements", headers=env.fac, json={"course_id": cid, "kind": "class", "title": "Revision class", "day": day, "at": "18:00", "link": "javascript:alert(1)"})
    assert bad.status_code == 400
    r = env.c.post("/api/announcements", headers=env.fac, json={"course_id": cid, "kind": "class", "title": "Revision class", "body": "Bring your notes", "day": day, "at": "18:00", "minutes": 45,
                                                               "link": "https://meet.google.com/abc-defg-hij"}); assert r.status_code == 200, r.text
    a = r.json(); assert a["status"] == "upcoming" and a["link"].startswith("https://meet.google.com")
    assert {x[0] for x in sent} == {"stu@x.com", "par@x.com"} and all("Revision class" in x[1] for x in sent)
    cal = env.c.get("/api/calendar", headers=env.stu, params={"start": day, "end": day}).json()["items"]
    cls = [x for x in cal if x["kind"] == "class"]; assert cls and cls[0]["link"]["join"].startswith("https://meet") and cls[0]["at"] == "18:00"
    assert any(x["kind"] == "class" for x in env.c.get("/api/calendar", headers=env.fac, params={"start": day, "end": day}).json()["items"])
    par = env.login("par@x.com"); assert env.c.get("/api/announcements", headers=par).json()["items"][0]["title"] == "Revision class"
    for h in (env.stu, par, env.admin): assert any(n["key"] == f"ann:{a['id']}" for n in env.c.get("/api/me/notifications", headers=h).json()["items"])
    assert env.c.get("/api/announcements", headers=env.stu).json()["upcoming"][0]["id"] == a["id"]
    env.add_user("other@x.com"); enrol("other@x.com", i["prog"]["Civil"], 1)
    assert env.c.get("/api/announcements", headers=env.login("other@x.com")).json()["items"] == []  # not their course
    assert env.c.post("/api/announcements", headers=env.stu, json={"course_id": cid, "title": "Hi there"}).status_code == 403
    sent.clear(); assert env.c.post(f"/api/announcements/{a['id']}/cancel", headers=env.fac).json()["status"] == "cancelled"
    assert any("cancelled" in x[1].lower() for x in sent) and not [x for x in env.c.get("/api/calendar", headers=env.stu, params={"start": day, "end": day}).json()["items"] if x["kind"] == "class"]
    n = env.c.post("/api/announcements", headers=env.fac, json={"course_id": cid, "title": "Unit test on Friday", "body": "Units 1 and 2"}).json(); assert n["kind"] == "note" and n["link"] is None

def test_a_weekly_class_fills_the_calendar_and_shows_once(env, monkeypatch):
    i = setup(env); cid = i["course"]["Chem"]
    sent = []; monkeypatch.setattr(main, "mail_on", lambda s=None: True); monkeypatch.setattr(main, "account_mail", lambda to, name, kind, subj, body, link, lang="en": sent.append((to, subj, body)))
    d0 = dt.date.today() + dt.timedelta(days=1)
    assert env.c.post("/api/announcements", headers=env.fac, json={"course_id": cid, "kind": "class", "title": "Tutorial", "day": d0.isoformat(), "at": "17:00",
                                                                   "link": "https://meet.google.com/aaa-bbbb-ccc", "weeks": 27}).status_code == 400
    r = env.c.post("/api/announcements", headers=env.fac, json={"course_id": cid, "kind": "class", "title": "Tutorial", "day": d0.isoformat(), "at": "17:00", "minutes": 50,
                                                               "link": "https://meet.google.com/aaa-bbbb-ccc", "weeks": 4}); assert r.status_code == 200, r.text
    a = r.json(); assert a["series"] and a["week"] == {"n": 1, "of": 4, "more": 3}
    assert len(sent) == 1 and "weekly" in sent[0][1].lower() and "4 times" in sent[0][2]  # one email for the whole series
    cal = env.c.get("/api/calendar", headers=env.stu, params={"start": d0.isoformat(), "end": (d0 + dt.timedelta(days=30)).isoformat()}).json()["items"]
    assert [x["date"] for x in cal if x["kind"] == "class"] == [(d0 + dt.timedelta(weeks=w)).isoformat() for w in range(4)]
    lst = env.c.get("/api/announcements", headers=env.stu).json(); assert len(lst["items"]) == 1 and len(lst["upcoming"]) == 1 and lst["items"][0]["id"] == a["id"]
    assert sum(1 for n in env.c.get("/api/me/notifications", headers=env.stu).json()["items"] if n["key"].startswith("ann:")) == 1
    # cancel just the first session: the list moves on to the second
    env.c.post(f"/api/announcements/{a['id']}/cancel", headers=env.fac)
    nxt = env.c.get("/api/announcements", headers=env.stu).json()["upcoming"][0]; assert nxt["week"]["n"] == 2 and nxt["starts_at"] > a["starts_at"]
    # cancel the rest of the series from the second on
    sent.clear(); env.c.post(f"/api/announcements/{nxt['id']}/cancel?all=true", headers=env.fac)
    assert env.c.get("/api/announcements", headers=env.stu).json()["upcoming"] == [] and len(sent) == 1 and "3 sessions" in sent[0][2]
    assert not [x for x in env.c.get("/api/calendar", headers=env.stu, params={"start": d0.isoformat(), "end": (d0 + dt.timedelta(days=30)).isoformat()}).json()["items"] if x["kind"] == "class"]

def test_the_teacher_sees_who_tapped_join(env):
    i = setup(env); cid = i["course"]["Chem"]; d0 = dt.date.today() + dt.timedelta(days=1)
    a = env.c.post("/api/announcements", headers=env.fac, json={"course_id": cid, "kind": "class", "title": "Lab briefing", "day": d0.isoformat(), "at": "10:00", "link": "https://zoom.us/j/123"}).json()
    assert a["joins"] == [] and a["class_size"] == 1
    r = env.c.post(f"/api/announcements/{a['id']}/join", headers=env.stu); assert r.json()["link"] == "https://zoom.us/j/123"
    env.c.post(f"/api/announcements/{a['id']}/join", headers=env.stu)  # twice counts once
    t = env.c.get("/api/announcements", headers=env.fac).json()["items"][0]; assert [j["name"] for j in t["joins"]] == ["stu@x.com"]
    s = env.c.get("/api/announcements", headers=env.stu).json()["items"][0]; assert s["joined"] is True and "joins" not in s  # students never see the list
    env.add_user("other@x.com"); enrol("other@x.com", i["prog"]["Civil"], 1)
    assert env.c.post(f"/api/announcements/{a['id']}/join", headers=env.login("other@x.com")).status_code == 404
