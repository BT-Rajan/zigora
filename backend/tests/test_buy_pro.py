# Buying Pro online: the admin saves Razorpay keys and offers; a Lite student opens a payment link and Pro starts when Razorpay confirms it
# (signed return, signed webhook, or asking Razorpay), once per payment, adding to any Pro already running. Nothing about Razorpay is faked
# but the network: the tests stand in for its API and sign as it does.
import datetime as dt, hashlib, hmac, json
import main
from main import Session_, User, Payment
from tests.test_plans import lite_person

SECRET, HOOK = "sk_secret_123", "hook_secret_456"

def setup(env, monkeypatch, offers=None):
    r = env.c.put("/api/admin/payments/settings", headers=env.admin, json={"key_id": "rzp_test_abc123XYZ", "key_secret": SECRET, "webhook_secret": HOOK,
                                                                         "currency": "inr", "offers": offers or [{"days": 30, "price": 149}, {"days": 365, "price": 999.5}]})
    assert r.status_code == 200, r.text
    calls, links = [], {}
    async def fake(s, method, path, body=None):
        calls.append((method, path, body))
        if method == "POST": links["plink_1"] = {"id": "plink_1", "status": "created", "amount_paid": 0, "payments": []}; return {"id": "plink_1", "short_url": "https://rzp.io/i/abc"}
        return links[path.rsplit("/", 1)[1]]
    monkeypatch.setattr(main, "razorpay", fake)
    return calls, links

def sig(secret, msg): return hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
def back(env, p, status="paid", pid="pay_9", secret=SECRET, follow=False):
    q = {"razorpay_payment_id": pid, "razorpay_payment_link_id": p.link_id, "razorpay_payment_link_reference_id": p.ref, "razorpay_payment_link_status": status,
         "razorpay_signature": sig(secret, f"{p.link_id}|{p.ref}|{status}|{pid}")}
    return env.c.get("/api/pay/return", params=q, follow_redirects=follow)
def pay(): 
    with Session_() as s: return s.query(Payment).order_by(Payment.id.desc()).first()
def until(uid):
    with Session_() as s: return s.get(User, uid).pro_until

def test_a_lite_student_buys_pro_and_it_starts_once(env, monkeypatch):
    calls, _ = setup(env, monkeypatch); h, uid = lite_person(env)
    o = env.c.get("/api/me/pro/offers", headers=h).json(); assert o["on"] is True and o["currency"] == "INR" and [x["days"] for x in o["offers"]] == [30, 365]
    r = env.c.post("/api/me/pro/buy", headers=h, json={"offer": 1}); assert r.status_code == 200, r.text
    assert r.json()["url"] == "https://rzp.io/i/abc"
    body = calls[0][2]; assert body["amount"] == 99950 and body["currency"] == "INR" and body["callback_url"].endswith("/api/pay/return") and body["customer"]["email"] == "lite@x.com"
    p = pay(); assert p.status == "created" and p.link_id == "plink_1" and p.days == 365
    assert back(env, p, secret="wrong").headers["location"].endswith("#paid=check") and until(uid) is None  # a forged return does nothing
    r = back(env, p); assert r.status_code == 303 and r.headers["location"].endswith("/app/#paid=ok")
    end = until(uid); assert end and 364 <= (end - dt.datetime.utcnow()).days <= 365
    back(env, p); assert until(uid) == end  # counted once
    assert env.c.get("/api/me/plan", headers=h).json()["plan"] == "pro" and pay().payment_id == "pay_9"
    paid = env.c.get("/api/admin/payments", headers=env.admin).json(); assert paid["total"] == 1 and paid["items"][0]["amount"] == 999.5 and paid["items"][0]["who"] == "lite@x.com"

def test_the_webhook_or_asking_razorpay_starts_it_and_days_add_up(env, monkeypatch):
    calls, links = setup(env, monkeypatch); h, uid = lite_person(env)
    with Session_() as s: s.get(User, uid).pro_until = dt.datetime.utcnow() + dt.timedelta(days=10); s.commit()
    env.c.post("/api/me/pro/buy", headers=h, json={"offer": 0}); p = pay()
    ev = json.dumps({"event": "payment_link.paid", "payload": {"payment_link": {"entity": {"id": p.link_id, "reference_id": p.ref, "amount_paid": p.amount}}, "payment": {"entity": {"id": "pay_w", "amount": p.amount}}}})
    assert env.c.post("/api/pay/webhook", content=ev, headers={"X-Razorpay-Signature": "bad"}).status_code == 400
    assert env.c.post("/api/pay/webhook", content=ev, headers={"X-Razorpay-Signature": sig(HOOK, ev)}).json() == {"ok": True}
    assert 39 <= (until(uid) - dt.datetime.utcnow()).days <= 40  # 10 left + 30 bought
    env.c.post("/api/me/pro/buy", headers=h, json={"offer": 0}); p2 = pay(); assert p2.id != p.id
    assert env.c.post("/api/me/pro/check", headers=h).json()["paid"] == 0  # not paid yet
    links["plink_1"].update(status="paid", amount_paid=p2.amount, payments=[{"payment_id": "pay_c"}])
    r = env.c.post("/api/me/pro/check", headers=h).json(); assert r["paid"] == 1 and r["plan"] == "pro" and 69 <= (until(uid) - dt.datetime.utcnow()).days <= 70

def test_only_lite_or_pro_people_buy_and_only_when_it_is_set_up(env, monkeypatch):
    h, _ = lite_person(env)
    assert env.c.get("/api/me/pro/offers", headers=h).json()["on"] is False
    assert env.c.post("/api/me/pro/buy", headers=h, json={"offer": 0}).status_code == 400
    setup(env, monkeypatch)
    assert env.c.get("/api/me/pro/offers", headers=env.stu).json()["on"] is False  # the college's own students already use its AI
    assert env.c.post("/api/me/pro/buy", headers=env.stu, json={"offer": 0}).status_code == 403
    assert env.c.post("/api/me/pro/buy", headers=h, json={"offer": 5}).status_code == 400
    cfg = env.c.get("/api/admin/payments/settings", headers=env.admin).json()
    assert cfg["secret_set"] and cfg["webhook_set"] and SECRET not in json.dumps(cfg) and cfg["webhook_url"].endswith("/api/pay/webhook")
    with Session_() as s: assert SECRET not in (main.setting(s, "pay_key_secret") or "")  # stored sealed
    for bad in ({"key_id": "abc"}, {"currency": "rupees"}, {"offers": [{"days": 0, "price": 5}]}, {"offers": [{"days": 30, "price": 0}]}):
        assert env.c.put("/api/admin/payments/settings", headers=env.admin, json=bad).status_code == 400
    assert env.c.get("/api/admin/payments/settings", headers=h).status_code == 403
    assert env.c.put("/api/admin/payments/settings", headers=env.admin, json={"remove": True}).json()["on"] is False
