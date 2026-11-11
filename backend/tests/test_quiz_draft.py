"""S31.3: a test's answers are kept as the student goes (a draft per student and test), so a refresh, Back or a closed app carries on. A draft is never
an attempt; a late save can't undo a newer one; submitting ends it, and a submitted sitting can't be saved again."""
from main import Session_, Attempt, QuizDraft
from tests.test_quiz_reports import setup, make_quiz


def ids(env, q, h=None): return [x["id"] for x in env.c.get(f"/api/quizzes/{q}", headers=h or env.stu).json()["questions"]]
def draft(env, q, h=None): return env.c.get(f"/api/quizzes/{q}", headers=h or env.stu).json()["draft"]
def save(env, q, answers, version, rid="sit-1", h=None):
    return env.c.put(f"/api/quizzes/{q}/draft", headers=h or env.stu, json={"request_id": rid, "answers": answers, "version": version})


def test_answers_are_kept_and_come_back(env):
    i, unit = setup(env); q = make_quiz(env, unit); a, b = ids(env, q)
    assert draft(env, q) is None
    r = save(env, q, {a: 0}, 1).json(); assert r["saved"] is True and r["draft"]["answers"] == {str(a): 0}
    r = save(env, q, {a: 0, b: 1}, 2).json(); assert r["saved"] is True
    d = draft(env, q); assert d["answers"] == {str(a): 0, str(b): 1} and d["version"] == 2 and d["request_id"] == "sit-1"  # a refresh gets them back
    with Session_() as s: assert s.query(Attempt).count() == 0  # keeping answers is never an attempt
    assert env.c.get(f"/api/quizzes/{q}", headers=env.stu).json()["attempts"] == 0


def test_a_late_save_cannot_undo_a_newer_one(env):
    i, unit = setup(env); q = make_quiz(env, unit); a, b = ids(env, q)
    save(env, q, {a: 0, b: 1}, 3)
    r = save(env, q, {a: 1}, 2).json()  # sent earlier, arrived later
    assert r["saved"] is False and r["draft"]["answers"] == {str(a): 0, str(b): 1} and r["draft"]["version"] == 3
    assert save(env, q, {a: 0, b: 1}, 3).json()["saved"] is False  # the same save again changes nothing
    assert save(env, q, {a: 1, b: None}, 4).json()["draft"]["answers"] == {str(a): 1}  # a cleared answer is cleared


def test_submitting_ends_the_draft_and_the_sitting_stays_submitted(env):
    i, unit = setup(env); q = make_quiz(env, unit); a, b = ids(env, q)
    save(env, q, {a: 0, b: 1}, 2)
    r = env.c.post(f"/api/quizzes/{q}/attempt", headers=env.stu, json={"answers": [0, 1], "request_id": "sit-1"}).json()
    assert r["score"] == 1 and draft(env, q) is None
    late = save(env, q, {a: 1, b: 0}, 3)  # a save that arrives after the submit
    assert late.status_code == 409 and draft(env, q) is None
    again = env.c.post(f"/api/quizzes/{q}/attempt", headers=env.stu, json={"answers": [1, 0], "request_id": "sit-1"}).json()
    assert again["already"] and again["attempt_id"] == r["attempt_id"] and again["score"] == 1  # the submitted answers stand
    assert save(env, q, {a: 1}, 1, rid="sit-2").json()["saved"] is True  # a new sitting (Try again) starts its own draft


def test_answers_are_checked_and_drafts_are_private(env):
    i, unit = setup(env); q1 = make_quiz(env, unit); q2 = make_quiz(env, unit); a, b = ids(env, q1); c, _ = ids(env, q2)
    assert save(env, q1, {a: 5}, 1).status_code == 400  # not a choice
    assert save(env, q1, {c: 0}, 1).status_code == 400  # another quiz's question
    assert save(env, q1, {a: 0}, 1, rid="").status_code == 400
    save(env, q1, {a: 0}, 1)
    assert draft(env, q1, env.admin) is None  # another person's draft is never shown
    with Session_() as s: assert s.query(QuizDraft).count() == 1


def test_a_draft_needs_a_quiz_the_student_may_take(env):
    i, unit = setup(env); q = make_quiz(env, unit, published=False)
    assert env.c.put(f"/api/quizzes/{q}/draft", headers=env.stu, json={"request_id": "s", "answers": {}, "version": 1}).status_code == 404
