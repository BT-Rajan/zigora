"""The Android app stays signed in on the same install: its sign-in is tied to the install's id and renewed quietly while it is used."""
import time, jwt, main
from main import Session_, User

DEV = {"X-Zigora-Device": "3f9c2a1e-7b4d-4e8a-9c1f-0a2b3c4d5e6f"}
def claims(t): return jwt.decode(t, main.SECRET, algorithms=["HS256"])

def test_an_app_sign_in_is_tied_to_its_install_and_lasts(env):
    r = env.c.post("/api/login", headers=DEV, json={"email": "stu@x.com", "password": "pw"}).json(); t = r["token"]; c = claims(t)
    assert c["dev"] == main.device_tag(DEV["X-Zigora-Device"]) and c["exp"] - c["iat"] >= 364 * 86400  # a year, not a week
    h = {"Authorization": "Bearer " + t}
    assert env.c.get("/api/me", headers={**h, **DEV}).status_code == 200
    assert env.c.get("/api/me", headers=h).status_code == 401  # the same sign-in from somewhere without the install's id
    assert env.c.get("/api/me", headers={**h, "X-Zigora-Device": "another-install-0000-1111"}).status_code == 401  # or another install
    w = env.c.post("/api/login", json={"email": "stu@x.com", "password": "pw"}).json()["token"]; assert "dev" not in claims(w)  # the web: as before
    assert claims(w)["exp"] - claims(w)["iat"] <= main.TOKEN_DAYS * 86400

def test_it_is_renewed_at_most_once_a_day_and_still_ends_with_a_password_change(env):
    with Session_() as s: u = s.query(User).filter_by(email="stu@x.com").one(); uid = u.id; k = main.fp(u)
    old = jwt.encode({"uid": uid, "k": k, "iat": int(time.time()) - 2 * 86400, "exp": int(time.time()) + 300 * 86400, "dev": main.device_tag(DEV["X-Zigora-Device"])}, main.SECRET)
    r = env.c.get("/api/me", headers={"Authorization": "Bearer " + old, **DEV}); new = r.headers.get("x-zigora-token")
    assert r.status_code == 200 and new and claims(new)["exp"] - time.time() > 364 * 86400 and claims(new)["dev"] == claims(old)["dev"]
    assert "x-zigora-token" not in env.c.get("/api/me", headers={"Authorization": "Bearer " + new, **DEV}).headers  # fresh: nothing to renew
    with Session_() as s: s.get(User, uid).pw = main.hp("another-password"); s.commit()
    assert env.c.get("/api/me", headers={"Authorization": "Bearer " + new, **DEV}).status_code == 401  # a password change still signs it out
