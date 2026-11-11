"""S34: a topic's revision sheet. Opening it never asks the AI; the sheet is written once per topic version and language when a student asks for it,
shared by everyone (or, from a student's own notes, kept for them); a changed topic gets a new sheet. A "your focus" box comes from the student's
own results without any AI, and a student can mark the topic revised and ask what a line of the sheet means."""
import json
import main
from main import Session_, AICache, StepLog, Topic
from tests.test_search import ai_env
from tests.test_access import ids

SHEET = {"concepts": [{"title": "Hardness", "point": "Ca and Mg salts make water hard.", "detail": "Soap forms scum instead of lather."}],
         "definitions": [{"term": "ppm", "meaning": "parts per million"}], "formulas": [{"formula": "$H = \\frac{m}{V}$", "meaning": "hardness from mass and volume"}],
         "facts": ["Boiling removes temporary hardness"], "mistakes": ["Mixing up temporary and permanent hardness"],
         "examples": [{"title": "Kettle", "text": "Scale forms when hard water boils."}], "likely": ["Define hardness (2 marks)"]}


def writer(monkeypatch, reply=None):  # the stand-in AI: counts its calls and keeps what it was told
    seen = []
    async def fake(u, s, key, prompt, msg, max_tokens=None, kind="", topic_id=None, **k):
        seen.append((prompt, msg, kind)); return json.dumps(reply or SHEET), 900
    monkeypatch.setattr(main, "ask_ai", fake); return seen


def test_a_sheet_is_written_once_and_shared(env, monkeypatch):
    ai_env(env, monkeypatch); seen = writer(monkeypatch); t = ids()["topic"]["Water hardness"]
    r = env.c.get(f"/api/topics/{t}/revision", headers=env.stu).json()
    assert r["sheet"] is None and seen == []  # opening it asks nothing
    r = env.c.get(f"/api/topics/{t}/revision?make=1", headers=env.stu).json()
    assert r["sheet"]["concepts"][0]["title"] == "Hardness" and r["sheet"]["formulas"][0]["formula"].startswith("$") and len(seen) == 1
    prompt, msg, kind = seen[0]
    assert "revision sheet" in prompt and "Topic: Water hardness" in msg and "Course:" in msg and "Unit:" in msg and "Topic content:" in msg  # the syllabus context
    again = env.c.get(f"/api/topics/{t}/revision?make=1", headers=env.admin).json()
    assert again["cached"] and len(seen) == 1  # someone else: the same sheet, no second call
    with Session_() as s:
        x = s.get(Topic, t); x.content = (x.content or "") + "\n\nNew paragraph on scale."; s.commit()
    assert env.c.get(f"/api/topics/{t}/revision", headers=env.stu).json()["sheet"] is None  # the notes changed: a new sheet when asked
    env.c.get(f"/api/topics/{t}/revision?make=1", headers=env.stu)
    with Session_() as s: assert s.query(AICache).filter_by(topic_id=t, kind="revision").count() == 2  # the earlier sheet is kept too


def test_a_reply_out_of_shape_is_not_kept(env, monkeypatch):
    ai_env(env, monkeypatch); seen = writer(monkeypatch, {"concepts": []}); t = ids()["topic"]["Water hardness"]
    assert env.c.get(f"/api/topics/{t}/revision?make=1", headers=env.stu).status_code == 502
    with Session_() as s: assert s.query(AICache).filter_by(topic_id=t, kind="revision").count() == 0


def test_focus_marking_revised_and_explaining_a_line(env, monkeypatch):
    ai_env(env, monkeypatch); writer(monkeypatch); t = ids()["topic"]["Water hardness"]
    env.c.post(f"/api/topics/{t}/highlights", headers=env.stu, json={"text": "Temporary hardness", "prefix": ""})
    env.c.post(f"/api/topics/{t}/check-result", headers=env.stu, json={"outcome": "not_yet"})
    f = env.c.get(f"/api/topics/{t}/revision", headers=env.stu).json()["focus"]
    assert f["marked"] == ["Temporary hardness"] and f["not_yet"] == 1 and f["wrong"] == [] and f["standing"] is None
    assert env.c.get(f"/api/topics/{t}/revision", headers=env.admin).json()["focus"] is None  # only a student has a focus box
    r = env.c.post(f"/api/topics/{t}/revised", headers=env.stu).json(); assert r["revised_at"]
    assert env.c.get(f"/api/topics/{t}/revision", headers=env.stu).json()["revised_at"] == r["revised_at"]
    async def line(u, s, key, prompt, msg, max_tokens=None, kind="", topic_id=None, **k): return '{"text": "It means the salts stay after boiling."}', 50
    monkeypatch.setattr(main, "ask_ai", line)
    e = env.c.post(f"/api/topics/{t}/explain", headers=env.stu, json={"text": "Mixing up temporary and permanent hardness"}).json()
    assert e["explain"]["text"].startswith("It means")
    assert env.c.post(f"/api/topics/{t}/explain", headers=env.stu, json={"text": "Mixing up  temporary and permanent hardness"}).json()["explain"]["id"] == e["explain"]["id"]  # saved


def test_a_topic_without_notes_says_so(env, monkeypatch):
    ai_env(env, monkeypatch); seen = writer(monkeypatch); t = ids()["topic"]["Water hardness"]
    with Session_() as s: s.get(Topic, t).content = ""; s.commit()
    r = env.c.get(f"/api/topics/{t}/revision?make=1", headers=env.stu).json()
    assert r["sheet"] is None and r["empty"] is True and seen == []  # nothing to revise from: the AI would make it up
