"""S31.1: editing a test never rewrites what past attempts show. Saving keeps each question's id, an attempt keeps its own copy of the questions as the
student saw them, and the one-time migration gives older attempts that copy from the questions still there."""
import json
from main import Session_, Attempt, Question, engine, attempt_question_copies
from sqlalchemy import text
from tests.test_quiz_reports import setup, make_quiz, QS


def saved(env, q):  # the questions as the editor loads them, ids included
    return env.c.get(f"/api/quizzes/{q}", headers=env.admin).json()["questions"]


def save(env, q, qs):
    body = [{k: x[k] for k in ("id", "text", "options", "correct", "explanation", "topic_id", "area", "image", "option_images") if k in x} for x in qs]
    r = env.c.put(f"/api/quizzes/{q}/questions", headers=env.admin, json={"questions": body}); assert r.status_code == 200, r.text


def review(env, aid, h=None): return env.c.get(f"/api/attempts/{aid}", headers=h or env.stu).json()


def test_saving_unchanged_keeps_ids_and_every_review(env):
    i, unit = setup(env); q = make_quiz(env, unit)
    aid = env.c.post(f"/api/quizzes/{q}/attempt", headers=env.stu, json={"answers": [0, 1]}).json()["attempt_id"]
    make_quiz(env, unit)  # another test afterwards, as on a live server: recreated questions would get new ids
    before = [x["id"] for x in saved(env, q)]
    save(env, q, saved(env, q))
    assert [x["id"] for x in saved(env, q)] == before
    r = review(env, aid)
    assert (len(r["questions"]), r["changed"], r["score"]) == (2, 0, 1) and [x["chosen"] for x in r["questions"]] == [0, 1]
    assert sum(a["total"] for a in r["areas"]) == 2
    res = env.c.get(f"/api/quizzes/{q}/results", headers=env.admin).json()
    assert [x["total"] for x in res["questions"]] == [1, 1]  # the class's per-question figures still count the attempt


def test_rewording_keeps_the_question_and_the_old_review_shows_what_was_asked(env):
    i, unit = setup(env); q = make_quiz(env, unit)
    aid = env.c.post(f"/api/quizzes/{q}/attempt", headers=env.stu, json={"answers": [0, 0]}).json()["attempt_id"]
    qs = saved(env, q); ids = [x["id"] for x in qs]
    qs[0] = {**qs[0], "text": "Which salt makes water temporarily hard?", "explanation": "Reworded."}
    save(env, q, qs)
    assert [x["id"] for x in saved(env, q)] == ids and saved(env, q)[0]["text"].startswith("Which salt")
    r = review(env, aid)
    assert r["questions"][0]["text"] == QS[0]["text"] and r["changed"] == 0  # what the student saw, not today's wording
    res = env.c.get(f"/api/quizzes/{q}/results", headers=env.admin).json()
    assert res["questions"][0]["total"] == 1


def test_changing_the_choices_or_key_makes_a_new_question_and_keeps_the_old_score(env):
    i, unit = setup(env); q = make_quiz(env, unit)
    aid = env.c.post(f"/api/quizzes/{q}/attempt", headers=env.stu, json={"answers": [0, 0]}).json()["attempt_id"]
    qs = saved(env, q); old = [x["id"] for x in qs]
    qs[1] = {**qs[1], "correct": 1}  # the key was wrong
    qs[0] = {**qs[0], "options": qs[0]["options"] + ["MgCl2"]}  # a choice added
    save(env, q, qs)
    new = [x["id"] for x in saved(env, q)]
    assert new[0] not in old and new[1] not in old
    r = review(env, aid, env.admin)
    assert r["score"] == 2 and r["percent"] == 100 and r["changed"] == 0  # the attempt is not re-marked
    assert [x["correct"] for x in r["questions"]] == [0, 0] and len(r["questions"][0]["options"]) == 3  # its own copy: the key and choices it was marked on
    res = env.c.get(f"/api/quizzes/{q}/results", headers=env.admin).json()
    assert [x["total"] for x in res["questions"]] == [0, 0]  # answers to the old choices aren't counted against the new questions


def test_removing_a_question_leaves_past_attempts_reviewable(env):
    i, unit = setup(env); q = make_quiz(env, unit)
    aid = env.c.post(f"/api/quizzes/{q}/attempt", headers=env.stu, json={"answers": [0, 1]}).json()["attempt_id"]
    save(env, q, saved(env, q)[:1])
    with Session_() as s: assert s.query(Question).filter_by(quiz_id=q).count() == 1
    r = review(env, aid)
    assert len(r["questions"]) == 2 and r["changed"] == 0 and [x["ok"] for x in r["questions"]] == [True, False]
    assert sum(a["total"] for a in r["areas"]) == 2  # strengths still count the removed question


def test_the_copy_respects_reveal_and_ownership(env):
    i, unit = setup(env); q = make_quiz(env, unit)  # reveal is off
    aid = env.c.post(f"/api/quizzes/{q}/attempt", headers=env.stu, json={"answers": [0, 1]}).json()["attempt_id"]
    save(env, q, saved(env, q)[:1])
    r = review(env, aid)
    assert all("correct" not in x and "explanation" not in x for x in r["questions"])
    assert "correct" in review(env, aid, env.admin)["questions"][1]
    with Session_() as s: snap = json.loads(s.get(Attempt, aid).snapshot)
    assert [x["correct"] for x in snap] == [0, 0]  # kept on the server; shown only to who may see it


def test_editor_ids_are_checked_against_the_quiz(env):
    i, unit = setup(env); q1 = make_quiz(env, unit); q2 = make_quiz(env, unit)
    other = saved(env, q2)[0]["id"]
    qs = saved(env, q1); qs[0] = {**qs[0], "id": other}; qs[1] = {**qs[1], "id": qs[1]["id"]}
    save(env, q1, qs)
    assert other not in [x["id"] for x in saved(env, q1)] and other in [x["id"] for x in saved(env, q2)]  # another test's question is never taken over
    dup = saved(env, q1); dup[1] = {**dup[1], "id": dup[0]["id"], "text": dup[0]["text"], "options": dup[0]["options"], "correct": dup[0]["correct"]}
    save(env, q1, dup)
    assert len({x["id"] for x in saved(env, q1)}) == 2  # one id is never given to two questions


def test_migration_fills_copies_for_older_attempts(env):
    i, unit = setup(env); q = make_quiz(env, unit)
    a1 = env.c.post(f"/api/quizzes/{q}/attempt", headers=env.stu, json={"answers": [0, 1]}).json()["attempt_id"]
    with Session_() as s:
        gone = s.query(Question).filter_by(quiz_id=q).order_by(Question.pos).all()[1].id
        a0 = Attempt(quiz_id=q, user_id=s.get(Attempt, a1).user_id, score=0, total=1, percent=0, detail=None); s.add(a0)  # made before answers were kept
        s.query(Attempt).filter_by(id=a1).update({Attempt.snapshot: None}); s.commit(); a0 = a0.id  # as if made before this release
        s.query(Question).filter_by(id=gone).delete(); s.commit()  # and one of its questions was already lost
    with engine.begin() as c: attempt_question_copies(c)
    with engine.begin() as c: attempt_question_copies(c)  # running again changes nothing
    with Session_() as s:
        snap = json.loads(s.get(Attempt, a1).snapshot)
        assert snap[0]["text"] == QS[0]["text"] and snap[1] is None and s.get(Attempt, a0).snapshot is None
    r = review(env, a1)
    assert len(r["questions"]) == 1 and r["changed"] == 1  # the lost one stays lost; the other is now safe from later edits
    save(env, q, [{**saved(env, q)[0], "text": "Reworded"}])
    assert review(env, a1)["questions"][0]["text"] == QS[0]["text"]
    with engine.connect() as c: assert c.execute(text("SELECT COUNT(*) FROM quiz_attempts WHERE snapshot IS NULL AND detail IS NOT NULL")).scalar() == 0
