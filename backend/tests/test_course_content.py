"""The Pharmacology course the demo server loads (content/pharmacology_mbbs_year2.csv): 75 chapters, and the chapters written so far."""
import os
from main import Session_, Course, Unit, Topic

CSV = os.path.join(os.path.dirname(__file__), "..", "..", "content", "pharmacology_mbbs_year2.csv")

def test_the_pharmacology_course_loads_with_75_chapters(env):
    r = env.c.post("/api/admin/import", headers=env.admin, json={"csv": open(CSV, encoding="utf-8").read(), "dry_run": False}).json()
    assert r["error_count"] == 0 and r["created"]["courses"] == 1 and r["created"]["units"] == 75
    with Session_() as s:
        co = s.query(Course).one(); units = s.query(Unit).filter_by(course_id=co.id).order_by(Unit.position).all()
        assert units[0].name.startswith("1. Introduction") and units[-1].name == "75. Drug interactions"
        first = s.query(Topic).filter_by(unit_id=units[0].id).order_by(Topic.position).all()
        assert len(first) == 11 and first[0].title == "What pharmacology is about" and first[-1].title == "Parenteral routes: injections"
        assert sum(bool(t.diagram) for t in first) == 2 and all("KD Tripathi" in (t.diagram_note or "KD Tripathi") for t in first)
        for t in first:  # each topic: headings, bold key words, an exam tip and a recap; a question pattern for the exam angle
            assert t.content.count("## ") >= 1 and t.content.count("**") >= 10 and "> **Exam tip**" in t.content and "Quick recap" in t.content and t.question_pattern
        assert all("(as seen in a book by KD Tripathi" in t.content for t in first if t.diagram)

EM = os.path.join(os.path.dirname(__file__), "..", "..", "content", "engineering_mechanics_be_mech_year1.csv")

def test_engineering_mechanics_loads_beside_pharmacology(env):
    for f in (CSV, EM):
        r = env.c.post("/api/admin/import", headers=env.admin, json={"csv": open(f, encoding="utf-8").read(), "dry_run": False}).json(); assert r["error_count"] == 0
    with Session_() as s:
        co = s.query(Course).filter_by(name="Engineering Mechanics").one(); units = s.query(Unit).filter_by(course_id=co.id).order_by(Unit.position).all()
        assert len(units) == 17 and units[0].name == "Unit I · 1. Fundamentals of engineering mechanics" and units[15].name.startswith("Unit V · 16.")
        assert s.query(Topic).filter_by(course_id=co.id).count() == 155
        assert all(s.query(Topic).filter_by(unit_id=u.id).order_by(Topic.position.desc()).first().title in ("Chapter summary and practice problems", "A model examination paper with worked solutions") for u in units)
        assert s.query(Course).count() == 2  # Pharmacology is untouched
