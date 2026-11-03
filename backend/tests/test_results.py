"""S32: every result says how many were right, wrong and left blank, which attempt it was, and where the student now stands in its topics."""
from tests.test_mcq_practice import world, bank, start
from tests.test_quiz_reports import setup
from tests.test_assignments import due
from tests.test_insights import me_id


def test_a_test_result_counts_numbers_and_standing(env):
    i, unit = setup(env); w = i["topic"]["Water"]
    q = env.c.post("/api/quizzes", headers=env.admin, json={"unit_id": unit, "title": "Water quiz", "pass_percent": 50, "published": True}).json()["id"]
    qs = [{"text": f"Q{k}", "options": ["a", "b"], "correct": 0, "topic_id": w} for k in range(4)]
    assert env.c.put(f"/api/quizzes/{q}/questions", headers=env.admin, json={"questions": qs}).status_code == 200
    r = env.c.post(f"/api/quizzes/{q}/attempt", headers=env.stu, json={"answers": [0, 1, None, None]}).json()
    assert r["counts"] == {"correct": 1, "wrong": 1, "blank": 2} and r["number"] == {"n": 1, "of": None}
    assert [(a["title"], a["correct"], a["total"]) for a in r["standing"]] == [("Water", 1, 4)]
    r2 = env.c.post(f"/api/quizzes/{q}/attempt", headers=env.stu, json={"answers": [0, 0, 0, None]}).json()
    assert r2["number"]["n"] == 2 and r2["standing"][0]["correct"] == 3  # standing follows the latest attempt (a retake replaces the earlier result)
    d = env.c.get(f"/api/attempts/{r['attempt_id']}", headers=env.stu).json()  # an earlier attempt keeps its own counts and number
    assert d["counts"] == {"correct": 1, "wrong": 1, "blank": 2} and d["number"]["n"] == 1
    env.c.post("/api/assignments", headers=env.admin, json={"course_id": i["course"]["Chem"], "kind": "quiz", "quiz_id": q, "students": [me_id("stu@x.com")], "due": due(), "attempts": 3})
    r3 = env.c.post(f"/api/quizzes/{q}/attempt", headers=env.stu, json={"answers": [0, 0, 0, 0]}).json()
    assert r3["number"] == {"n": 1, "of": 3}  # the first of the assignment's three


def test_an_mcq_result_counts_numbers_and_standing(env):
    ids = world(env); bank(env, ids["water"], 6)
    a = start(env, env.stu, topic_id=ids["water"]).json()
    out = env.c.post(f"/api/mcq/attempts/{a['id']}/submit", headers=env.stu, json={"answers": {str(x["pos"]): (0 if k < 3 else None) for k, x in enumerate(a["questions"])}}).json()
    c = out["counts"]; assert c["blank"] == 2 and c["correct"] + c["wrong"] == 3 and out["number"] == {"n": 1, "of": None}
    assert [(s["title"], s["correct"], s["total"]) for s in out["standing"]] == [("Water hardness", c["correct"], 5)]
    b = start(env, env.stu, topic_id=ids["water"]).json()
    out2 = env.c.post(f"/api/mcq/attempts/{b['id']}/submit", headers=env.stu, json={"answers": {}}).json()
    assert out2["number"]["n"] == 2 and out2["counts"]["blank"] == 5 and out2["standing"][0]["total"] == 10  # every submitted set counts toward the standing
    again = env.c.get(f"/api/mcq/attempts/{a['id']}", headers=env.stu).json(); assert again["counts"] == c and again["number"]["n"] == 1
