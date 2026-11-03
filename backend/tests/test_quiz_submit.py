"""S31.2: a test's submission is taken once. The app sends a request id made once per sitting; the same id again (a double tap, a retry after a lost
reply) gets the original attempt and result back, and two submissions at the same moment can't both pass an attempt limit."""
import threading, time
import main
from main import Session_, Attempt
from tests.test_quiz_reports import setup, make_quiz
from tests.test_assignments import due
from tests.test_insights import me_id


def count(q):
    with Session_() as s: return s.query(Attempt).filter_by(quiz_id=q).count()


def submit(env, q, answers, rid="", h=None):
    return env.c.post(f"/api/quizzes/{q}/attempt", headers=h or env.stu, json={"answers": answers, **({"request_id": rid} if rid else {})})


def assign(env, i, q, attempts=1):
    r = env.c.post("/api/assignments", headers=env.admin, json={"course_id": i["course"]["Chem"], "kind": "quiz", "quiz_id": q, "students": [me_id("stu@x.com")],
                                                               "due": due(), "attempts": attempts})
    assert r.status_code == 200


def test_the_same_submission_twice_is_one_attempt(env):
    i, unit = setup(env); q = make_quiz(env, unit)
    a = submit(env, q, [0, 1], "sit-1"); b = submit(env, q, [0, 1], "sit-1")
    assert a.status_code == b.status_code == 200 and count(q) == 1
    a, b = a.json(), b.json()
    assert b["already"] is True and "already" not in a
    assert {k: a[k] for k in ("attempt_id", "score", "total", "percent", "passed", "results", "areas")} == {k: b[k] for k in ("attempt_id", "score", "total", "percent", "passed", "results", "areas")}
    assert all("correct" not in x and "explanation" not in x for x in b["results"])  # the reply never carries the key when the quiz doesn't reveal it
    assert submit(env, q, [1, 1], "sit-1").json()["score"] == a["score"]  # a resend can't change what was marked
    assert env.c.get(f"/api/quizzes/{q}", headers=env.stu).json()["attempts"] == 1


def test_a_retry_after_the_last_attempt_gets_the_result_not_a_refusal(env):
    i, unit = setup(env); q = make_quiz(env, unit); assign(env, i, q, attempts=1)
    first = submit(env, q, [0, 0], "sit-1"); assert first.status_code == 200
    again = submit(env, q, [0, 0], "sit-1")  # the reply was lost; the app sends the same submission again
    assert again.status_code == 200 and again.json()["attempt_id"] == first.json()["attempt_id"] and count(q) == 1
    other = submit(env, q, [0, 0], "sit-2")  # a new sitting: the limit holds
    assert other.status_code == 403 and "all 1 attempts" in other.json()["detail"] and count(q) == 1


def test_two_submissions_at_once_cannot_pass_the_limit(env, monkeypatch):
    i, unit = setup(env); q = make_quiz(env, unit); assign(env, i, q, attempts=1)
    check = main.quiz_attempt_allowed
    def slow(*a):  # widen the gap between the check and the save, where a second submission would slip through without the lock
        check(*a); time.sleep(0.4)
    monkeypatch.setattr(main, "quiz_attempt_allowed", slow)
    out, go = [], threading.Barrier(2)
    def one(rid):
        go.wait(); out.append(submit(env, q, [0, 1], rid).status_code)
    ts = [threading.Thread(target=one, args=(r,)) for r in ("tab-a", "tab-b")]
    for t in ts: t.start()
    for t in ts: t.join()
    assert sorted(out) == [200, 403] and count(q) == 1


def test_the_same_id_twice_at_once_is_still_one_attempt(env, monkeypatch):
    i, unit = setup(env); q = make_quiz(env, unit)
    check = main.quiz_attempt_allowed
    monkeypatch.setattr(main, "quiz_attempt_allowed", lambda *a: (check(*a), time.sleep(0.3)))
    out, go = [], threading.Barrier(2)
    def one():
        go.wait(); r = submit(env, q, [0, 1], "sit-1"); out.append((r.status_code, r.json()["attempt_id"]))
    ts = [threading.Thread(target=one) for _ in range(2)]
    for t in ts: t.start()
    for t in ts: t.join()
    assert [c for c, _ in out] == [200, 200] and len({a for _, a in out}) == 1 and count(q) == 1


def test_request_ids_belong_to_one_person_and_one_quiz(env):
    i, unit = setup(env); q1 = make_quiz(env, unit); q2 = make_quiz(env, unit)
    assert submit(env, q1, [0, 1], "sit-1").status_code == 200
    r = submit(env, q2, [0, 1], "sit-1"); assert r.status_code == 409 and count(q2) == 0
    assert submit(env, q1, [0, 1], "sit-1", h=env.admin).json()["attempt_id"] != submit(env, q1, [0, 1], "sit-1").json()["attempt_id"]  # another person's id space


def test_without_an_id_each_submission_counts_as_before(env):
    i, unit = setup(env); q = make_quiz(env, unit)
    assert submit(env, q, [0, 1]).status_code == submit(env, q, [0, 1]).status_code == 200 and count(q) == 2  # older apps: unchanged
    assert submit(env, q, [0], "sit-x").status_code == 400 and count(q) == 2  # still checked: one answer per question
