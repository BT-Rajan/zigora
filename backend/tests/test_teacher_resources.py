"""S43: teacher resources on a course, unit or topic. Drafts are for the course's teachers; students of the course see published ones inside the topic;
every edit is a new version (the earlier ones stay, and files are shared, not copied); documents and videos download only for those who may see them."""
import base64
from main import Session_, TeacherResource, ResourceVersion
from tests.test_ask_teacher import setup
from tests.test_access import ids

PDF = "data:application/pdf;base64," + base64.b64encode(b"%PDF-1.4 hardness notes").decode()
MP4 = "data:video/mp4;base64," + base64.b64encode(b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 64).decode()
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
def mk(env, h=None, **b): return env.c.post("/api/resources", headers=h or env.fac, json=b)
def topic_res(env, t, h=None): return env.c.get(f"/api/topics/{t}/resources", headers=h or env.stu).json()["items"]


def test_kinds_drafts_publishing_and_who_sees_them(env):
    t = setup(env); i = ids(); cid = i["course"]["Chem"]; unit = i["unit"][cid]
    note = mk(env, topic_id=t, kind="note", title="Hardness in short", body="Temporary hardness: $Ca(HCO_3)_2$ breaks down on boiling.").json()
    assert note["status"] == "draft" and note["level"] == "topic" and note["course_id"] == cid
    assert topic_res(env, t) == []  # a draft: not for students
    assert [x["title"] for x in topic_res(env, t, env.fac)] == ["Hardness in short"]  # its teacher sees it
    env.c.post(f"/api/resources/{note['id']}/status", headers=env.fac, json={"status": "published"})
    img = env.c.post("/api/uploads", headers=env.fac, content=PNG).json()["url"]
    mk(env, unit_id=unit, kind="image", title="Scale in a kettle", image=img, publish=True)
    doc = mk(env, course_id=cid, kind="document", title="Unit notes", file={"name": "notes.pdf", "data": PDF}, publish=True).json()
    mk(env, topic_id=t, kind="video", title="Boiling demo", url="https://youtu.be/abc123XYZ00", publish=True)
    vid = mk(env, topic_id=t, kind="video", title="Lab clip", file={"name": "lab.mp4", "data": MP4}, publish=True).json()
    mk(env, topic_id=t, kind="link", title="Reference", url="https://en.wikipedia.org/wiki/Hard_water", publish=True)
    mk(env, topic_id=t, kind="example", title="Worked: ppm", body="1. $ppm = \\frac{mg}{L}$\n2. ...", publish=True)
    got = topic_res(env, t); assert [x["level"] for x in got][:5] == ["topic"] * 5 and {x["kind"] for x in got} == {"note", "image", "document", "video", "link", "example"}
    assert "status" not in got[0]  # students don't get the staff fields
    r = env.c.get(doc["file"]["url"].replace("/resources", "/api/resources"), headers=env.stu); assert r.status_code == 200 and r.content.startswith(b"%PDF")
    assert env.c.get(f"/api/resources/{doc['id']}/file").status_code == 401  # a link alone opens nothing
    assert env.c.get(f"/api/resources/{vid['id']}/file", headers=env.stu).headers["content-type"] == "video/mp4"
    env.add_user("civ@x.com", program=i["prog"]["Civil"], semester=1); civ = env.login("civ@x.com")
    assert env.c.get(f"/api/topics/{t}/resources", headers=civ).status_code == 403 and env.c.get(f"/api/resources/{doc['id']}/file", headers=civ).status_code in (403, 404)


def test_validation_and_who_may_manage(env):
    t = setup(env); i = ids(); cid = i["course"]["Chem"]
    assert mk(env, topic_id=t, kind="note", title="", body="x" * 10).status_code == 400
    assert mk(env, topic_id=t, kind="link", title="Bad", url="javascript:alert(1)").status_code == 400
    assert mk(env, topic_id=t, kind="document", title="Exe", file={"name": "x.exe", "data": PDF}).status_code == 400
    assert mk(env, topic_id=t, kind="document", title="Fake", file={"name": "x.pdf", "data": "data:,aGVsbG8="}).status_code == 400  # not really a PDF
    assert mk(env, topic_id=t, kind="video", title="Fake", file={"name": "x.mp4", "data": PDF}).status_code == 400
    assert mk(env, topic_id=t, kind="image", title="Img", image="https://evil.example/x.png").status_code == 400
    assert mk(env, course_id=i["course"]["Workshop"], topic_id=t, kind="note", title="Mismatch", body="hello there").status_code == 400  # topic of another course
    assert mk(env, env.stu, topic_id=t, kind="note", title="Mine", body="student note").status_code == 403
    env.add_user("fac2@x.com", "faculty"); assert mk(env, env.login("fac2@x.com"), topic_id=t, kind="note", title="X", body="not my course").status_code == 403
    r = mk(env, topic_id=t, kind="note", title="N", body="text here").json()
    assert env.c.put(f"/api/resources/{r['id']}", headers=env.stu, json={"title": "Hacked", "body": "zzz"}).status_code == 403
    assert env.c.post(f"/api/resources/{r['id']}/status", headers=env.stu, json={"status": "published"}).status_code == 403


def test_versions_are_kept_and_students_get_the_latest(env):
    t = setup(env)
    r = mk(env, topic_id=t, kind="document", title="Notes v1", file={"name": "v1.pdf", "data": PDF}, publish=True).json()
    e = env.c.put(f"/api/resources/{r['id']}", headers=env.fac, json={"title": "Notes v2", "description": "Clearer"}).json()  # no new file: the old one carries over
    assert (e["version"], e["title"], e["file"]["name"]) == (2, "Notes v2", "v1.pdf")
    with Session_() as s:
        v1, v2 = s.query(ResourceVersion).filter_by(resource_id=r["id"]).order_by(ResourceVersion.number).all()
        assert v1.title == "Notes v1" and v1.file == v2.file  # the earlier version stays; the file isn't copied
    same = env.c.put(f"/api/resources/{r['id']}", headers=env.fac, json={"title": "Notes v2", "description": "Clearer"}).json(); assert same["version"] == 2  # nothing changed: no version
    h = env.c.get(f"/api/resources/{r['id']}/versions", headers=env.fac).json(); assert [x["version"] for x in h["items"]] == [2, 1] and h["items"][0]["current"]
    assert [x["title"] for x in topic_res(env, t)] == ["Notes v2"] and topic_res(env, t)[0]["version"] == 2
    assert env.c.get(f"/api/resources/{r['id']}/file?v=1", headers=env.stu).status_code == 404  # students: only the current version
    assert env.c.get(f"/api/resources/{r['id']}/file?v=1", headers=env.fac).status_code == 200  # its teacher: any version
    env.c.post(f"/api/resources/{r['id']}/status", headers=env.fac, json={"status": "archived"})
    assert topic_res(env, t) == [] and env.c.get(f"/api/resources/{r['id']}/file", headers=env.stu).status_code == 404
    with Session_() as s: assert s.query(TeacherResource).count() == 1 and s.query(ResourceVersion).count() == 2  # archived, not deleted
    assert [x["status"] for x in env.c.get(f"/api/courses/{r['course_id']}/resources", headers=env.fac).json()["items"]] == ["archived"]
