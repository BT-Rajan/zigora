"""After first signing in, a student who signed up completes their profile once: course of study, then a plan."""
import main
from main import Session_, User, Program, Semester
from tests.test_registration import reg, GOOD  # noqa: F401  (the fixture)

def test_a_new_student_completes_their_profile_once_and_older_ones_are_never_asked(reg):
    with Session_() as s:
        p = Program(name="B.E. Civil", pattern="semester"); s.add(p); s.flush(); s.add(Semester(name="Semester 1", program_id=p.id, semester_no=1)); s.commit(); pid = p.id
    assert reg.start().status_code == 200
    r = reg.c.post("/api/register/verify", json={"email": "asha@college.edu", "code": reg.code()}).json(); u, h = r["user"], {"Authorization": "Bearer " + r["token"]}
    assert u["profile_needed"] is True and u["placed"] is False and u["plan"] == "lite"
    places = reg.c.get("/api/me/places", headers=h).json(); assert places["college"][0]["id"] == pid
    assert reg.c.put("/api/me/profile", headers=h, json={"program_id": pid, "semester": 2, "plan": "free"}).status_code == 400  # no semester 2
    me = reg.c.put("/api/me/profile", headers=h, json={"program_id": pid, "semester": 1, "plan": "free"}).json()["user"]
    assert (me["profile_needed"], me["placed"], me["plan"]) == (False, True, "lite")
    assert reg.c.get("/api/me", headers=h).json()["profile_needed"] is False  # asked once
    assert reg.c.get("/api/me", headers=reg.stu).json()["profile_needed"] is False  # made by the admin: never asked
    with Session_() as s: x = s.query(User).filter_by(email="asha@college.edu").one(); assert (x.program_id, x.semester) == (pid, 1)
