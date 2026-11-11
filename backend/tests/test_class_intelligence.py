"""S44: classroom learning intelligence, read from existing records. A topic is judged only once 3+ students have enough evidence (each by the S38
rule); tests and practice are apart; a resent submit counts once and abandoned sets never; every figure has its sample size; drill-down and AI are
for the course's teachers only, and the AI is given numbered evidence (no names) and flagged when it states numbers that aren't in it."""
import datetime as dt
import main
from main import Session_, McqAttempt, McqAttemptItem, Setting, AICache
from tests.test_quiz_reports import setup
from tests.test_insights import two_topic_quiz, me_id

def world(env):
    i, unit = setup(env); q, t = two_topic_quiz(env, unit); cid = i["course"]["Chem"]; hs = [env.stu]
    for k in (2, 3, 4):
        env.add_user(f"s{k}@x.com", program=i["prog"]["Mech"], semester=1); hs.append(env.login(f"s{k}@x.com"))
    for n, h in enumerate(hs):  # Water: 2 right each time (4 questions over two sittings: too few to judge). Boilers: three get all wrong twice, one gets all right
        boilers = [0, 0, 0] if n == 3 else [1, 1, 1]
        for r in range(2): env.c.post(f"/api/quizzes/{q}/attempt", headers=h, json={"answers": [0, 0] + boilers, "request_id": f"r{n}{r}"})
    env.c.post(f"/api/quizzes/{q}/attempt", headers=hs[0], json={"answers": [0, 0, 1, 1, 1], "request_id": "r00"})  # a resent submit: the same attempt
    for h in hs[:3]: env.c.post(f"/api/topics/{t['Boilers']}/questions", headers=h, json={"text": "Why does boiler scale form from hard water?"})
    return i, q, t, cid, hs
def topics(env, cid, h=None, **p): return {x["title"]: x for x in env.c.get(f"/api/reports/courses/{cid}/topics", headers=h or env.admin, params=p).json()["topics"]}
def practice(uid, tid, oks, status="submitted"):
    with Session_() as s:
        a = McqAttempt(user_id=uid, mode="topic", source="bank", topic_id=tid, status=status, score=sum(oks), total=len(oks), submitted_at=dt.datetime.utcnow() if status == "submitted" else None)
        s.add(a); s.flush()
        for k, ok in enumerate(oks): s.add(McqAttemptItem(attempt_id=a.id, pos=k, item_id=900 + k, topic_id=tid, snapshot='{"text": "Q", "options": ["a", "b"], "correct": 0}', ok=ok, chosen=0 if ok else 1))
        s.commit()


def test_topic_figures_denominators_and_rule(env):
    i, q, t, cid, hs = world(env)
    r = env.c.get(f"/api/reports/courses/{cid}/topics", headers=env.admin).json(); assert r["students"] == 4 and r["rule"]["min_assessed"] == 3
    b = topics(env, cid)["Boilers"]
    assert (b["students"], b["assessed"], b["evidence"], b["needs_attention"], b["strong"]) == (4, 4, 4, 3, 1)
    assert b["tests"] == {"percent": 25, "right": 6, "asked": 24, "students": 4}  # the resent submit counted once: 4 students x 2 sittings x 3
    assert b["status"] == "needs_study" and b["doubts"] == 3 and b["doubt_students"] == 3 and b["unresolved"] == 3 and b["common_wrong"] == 3
    assert {x["key"] for x in b["recommendations"]} >= {"explain", "common", "practice"}
    w = topics(env, cid)["Water"]; assert (w["assessed"], w["evidence"], w["status"]) == (4, 0, "not_assessed")  # 4 questions each: not enough to judge
    assert w["studied"] == 0 and w["learned"] == 0  # nobody opened it: studying isn't inferred from test scores


def test_practice_apart_abandoned_never_and_dates(env):
    i, q, t, cid, hs = world(env); sid = me_id("stu@x.com")
    practice(sid, t["Water"], [True, True, False]); practice(sid, t["Water"], [False] * 5, status="abandoned")
    w = topics(env, cid)["Water"]; assert w["practice"] == {"percent": 67, "right": 2, "asked": 3, "students": 1} and w["tests"]["asked"] == 16
    tomorrow = (main.local_day(dt.datetime.utcnow()) + dt.timedelta(days=1)).isoformat()
    b = topics(env, cid, since=tomorrow)["Boilers"]; assert (b["assessed"], b["doubts"], b["status"]) == (0, 0, "not_assessed")


def test_drill_down_groups_and_student_detail(env):
    i, q, t, cid, hs = world(env)
    d = env.c.get(f"/api/reports/courses/{cid}/topics/{t['Boilers']}", headers=env.admin).json()
    assert d["categories"]["attention"] == 3 and d["categories"]["strong"] == 1 and d["total"] == 4
    assert [x["category"] for x in d["students"]] == ["attention"] * 3 + ["strong"]  # grouped by where they stand, not ranked by score
    cw = d["common_wrong"][0]; assert (cw["answered"], cw["wrong_picks"], cw["wrong_option"]) == (8, 6, 1)
    assert d["doubt_groups"][0]["students"] == 3 and len(d["doubt_groups"][0]["doubts"]) == 3
    only = env.c.get(f"/api/reports/courses/{cid}/topics/{t['Boilers']}", headers=env.admin, params={"category": "strong"}).json(); assert only["total"] == 1
    sid = me_id("s2@x.com")
    x = env.c.get(f"/api/reports/courses/{cid}/topics/{t['Boilers']}/students/{sid}", headers=env.admin).json()
    assert x["label"] == "needs_study" and len(x["sittings"]) == 2 and len(x["repeated_errors"]) == 3 and x["doubts"][0]["label"] == "pending"


def test_only_the_courses_teachers(env):
    i, q, t, cid, hs = world(env)
    env.add_user("fac2@x.com", "faculty"); f2 = env.login("fac2@x.com")
    for h in (env.stu, f2):
        assert env.c.get(f"/api/reports/courses/{cid}/topics", headers=h).status_code == 403
        assert env.c.get(f"/api/reports/courses/{cid}/topics/{t['Boilers']}", headers=h).status_code == 403
    env.add_user("civ@x.com", program=i["prog"]["Civil"], semester=1)
    assert env.c.get(f"/api/reports/courses/{cid}/topics/{t['Boilers']}/students/{me_id('civ@x.com')}", headers=env.admin).status_code == 404  # not this course's
    assert env.c.get(f"/api/reports/courses/{cid}/topics/{i['topic']['Tools']}", headers=env.admin).status_code == 404  # another course's topic


def test_ai_explains_only_the_evidence(env, monkeypatch):
    i, q, t, cid, hs = world(env)
    with Session_() as s: s.merge(Setting(k="deepseek_key", v="sk-test-1234")); s.commit()
    seen = []
    async def fake(u, s, key, prompt, msg, max_tokens=None, kind="", topic_id=None, **k):
        seen.append(msg); return "Students mix up scale and hardness [E5]. About 97 percent struggle [E2].", 100
    monkeypatch.setattr(main, "ask_ai", fake)
    r = env.c.post(f"/api/reports/courses/{cid}/topics/{t['Boilers']}/explain", headers=env.admin).json()
    assert r["cited"] == ["E2", "E5"] and r["unverified_numbers"] == ["97"] and r["evidence"][0]["id"] == "E1"
    assert "s2@x.com" not in seen[0] and "stu@x.com" not in seen[0] and "(6 of 8 answers)" in seen[0]
    again = env.c.post(f"/api/reports/courses/{cid}/topics/{t['Boilers']}/explain", headers=env.admin).json()
    assert again["cached"] is True and len(seen) == 1
    with Session_() as s: assert s.query(AICache).filter_by(kind="class").count() == 1
    assert env.c.post(f"/api/reports/courses/{cid}/topics/{t['Boilers']}/explain", headers=env.stu).status_code == 403
