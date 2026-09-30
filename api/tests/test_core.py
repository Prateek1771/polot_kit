from app.bot import SENSITIVE, demo_email, mask, named_plans, normalise_email, pick_plans, route
from app.judge import triage


def ans(intent="other", conf=0.9, **nouls):
    a = {"intent": {"type": "choice", "choice": intent, "confidence": conf}}
    a.update({k: {"type": "noul", "noul": v} for k, v in nouls.items()})
    return a


def test_triage_thresholds():
    assert [triage(p) for p in (0.95, 0.7, 0.5, 0.3, 0.05)] == ["pass", "pass", "review", "fail", "fail"]


def test_route_guards_win():
    assert route(ans("new_claim", injection=0.9), {}) == "refuse"
    assert route(ans("coverage_question", needs_human=0.8), {}) == "handoff"


def test_route_intents():
    verified = {"customer": {"name": "Neha Kapoor"}}
    assert route(ans("new_claim"), verified) == "new_claim"
    assert route(ans("claim_status"), verified) == "status"
    assert route(ans("coverage_question"), {}) == "coverage"
    assert route(ans("coverage_question", conf=0.3), {}) == "clarify"
    assert route(ans("other"), {}) == "clarify"


def test_route_stays_in_claim_flow():
    mem = {"fields": {"policy_no": "INS-1"}, "awaiting_confirm": False}
    assert route(ans("other"), mem) == "new_claim"
    assert route(ans("coverage_question"), mem) == "coverage"  # side question allowed
    assert route(ans("other"), {**mem, "claim_id": "CLM-ABC123"}) == "clarify"
    # confirming while asking a side question still files the claim
    assert route(ans("coverage_question", confirms=0.9), {**mem, "awaiting_confirm": True}) == "new_claim"
    assert route(ans("coverage_question", confirms=0.9), {**mem, "awaiting_confirm": True, "claim_id": "CLM-ABC123"}) == "coverage"


def test_redaction_and_mask():
    assert SENSITIVE.sub("[x]", "card 4111 1111 1111 1111 and aadhaar 1234 5678 9012") == "card [x] and aadhaar [x]"
    assert SENSITIVE.sub("[x]", "policy INS-44821") == "policy INS-44821"
    assert mask("INS-44821") == "•••••4821"


def test_route_identify_flow():
    # own policies, claims and claim status need a verified (signed-in) customer first
    for intent in ("my_policy", "new_claim", "claim_status"):
        assert route(ans(intent), {}) == "identify"
    assert route(ans("my_policy"), {"customer": {"name": "Priya Sharma"}}) == "my_policy"
    assert route(ans("shop_plans"), {}) == "shop"  # shoppers never need an account


def test_route_shop_flow():
    assert route(ans("shop_plans"), {}) == "shop"
    assert route(ans("other"), {"shopping": True}) == "shop"  # "Pune, 12k" answering our question
    assert route(ans("shop_plans", injection=0.95), {}) == "refuse"


PLANS = [
    {"id": "a", "category": "car", "insurer": "HDFC ERGO", "plan": "Car Secure", "premium_from_inr": 9000, "claim_settlement_ratio": 98.0},
    {"id": "b", "category": "car", "insurer": "ICICI Lombard", "plan": "Motor Protect", "premium_from_inr": 11000, "claim_settlement_ratio": 99.1},
    {"id": "c", "category": "car", "insurer": "Tata AIG", "plan": "Auto Secure", "premium_from_inr": 15000, "claim_settlement_ratio": 99.5},
    {"id": "d", "category": "health", "insurer": "Niva Bupa", "plan": "ReAssure 2.0", "premium_from_inr": 8000, "claim_settlement_ratio": 91.0},
    {"id": "e", "category": "health", "insurer": "Star Health", "plan": "Super Star", "premium_from_inr": None, "claim_settlement_ratio": 82.0},
    {"id": "f", "category": "car", "insurer": "Bajaj General (formerly Bajaj Allianz)", "plan": "Car Secure", "premium_from_inr": 9500, "claim_settlement_ratio": 97.0},
]


def test_pick_plans():
    got, ok = pick_plans(PLANS, {"category": "car", "budget_inr": 12000})
    assert ok and [p["id"] for p in got] == ["b", "a", "f"]  # within budget, best CSR first
    got, ok = pick_plans(PLANS, {"category": "car", "budget_inr": 5000})
    assert not ok and [p["id"] for p in got] == ["a", "f", "b"]  # nothing fits: cheapest, flagged
    assert [p["id"] for p in pick_plans(PLANS, {"category": "car"})[0]] == ["c", "b", "a"]
    assert pick_plans(PLANS, {"category": "term"}) == ([], False)
    # unpublished premium isn't excluded by a budget
    assert [p["id"] for p in pick_plans(PLANS, {"category": "health", "budget_inr": 5000})[0]] == ["e"]


def test_named_plans_and_name():
    assert [p["id"] for p in named_plans(PLANS, "compare hdfc ergo vs icici lombard", "car")] == ["a", "b"]
    assert [p["id"] for p in named_plans(PLANS, "Motor Protect or ReAssure 2.0?")] == ["b", "d"]
    # "Car Secure" is shared by two insurers so it isn't a distinctive name; the insurer alias "bajaj" still matches
    assert [p["id"] for p in named_plans(PLANS, "car secure from bajaj vs tata aig", "car")] == ["c", "f"]
    assert normalise_email("  Priya.Sharma@CoverWise.demo ") == "priya.sharma@coverwise.demo"
    assert demo_email("Priya  Sharma") == "priya.sharma@coverwise.demo" and demo_email(None) is None


async def test_jev_decides_through_litellm(monkeypatch):
    """decide() -> litellm.acompletion -> JevProvider -> Decisions API: answers, cost and model survive the trip."""
    import json

    import httpx

    from app import jev

    sent = {}

    def api(req: httpx.Request):
        sent.update(json.loads(req.content))
        return httpx.Response(200, json={"model": "typesafe/jev-1.13-x", "answers": {"claim": {"type": "noul", "noul": 0.98}},
                                         "usage": {"input_tokens": 283, "output_tokens": 20, "cost": 1.2e-05}})

    monkeypatch.setenv("OPENROUTER_API_KEY", "test")
    monkeypatch.setattr(jev.litellm.custom_provider_map[-1]["custom_handler"], "http", httpx.AsyncClient(transport=httpx.MockTransport(api)))
    a = await jev.decide({"msg": "my car got hit"}, {"claim": {"type": "noul", "instructions": "Incident?"}}, name="t")
    assert sent == {"model": jev.JEV_MODEL, "state": {"msg": "my car got hit"}, "questions": {"claim": {"type": "noul", "instructions": "Incident?"}}}
    assert jev.p(a, "claim") == 0.98
    assert a["_meta"]["cost"] == 1.2e-05 and a["_meta"]["model"] == "typesafe/jev-1.13-x"


async def test_keepalive_ping_survives_failures():
    """One healthy URL, one unreachable: both reported, nothing raised (the loop must never die)."""
    import httpx

    from app.main import ping

    def handler(req: httpx.Request):
        if req.url.host == "down.example":
            raise httpx.ConnectError("refused", request=req)
        return httpx.Response(200, json={"ok": True})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as c:
        out = await ping(c, ["https://api.example/health", "https://down.example/"])
    assert out == {"https://api.example/health": 200, "https://down.example/": "ConnectError"}


def test_insforge_rawsql_adapter():
    """%s -> $n, and rawsql's string-typed bigint/numeric and midnight-UTC dates come back as Python types."""
    from datetime import date

    from app.db import rows_from, to_pg

    assert to_pg("select * from t where a=%s and b = any(%s) limit %s") == "select * from t where a=$1 and b = any($2) limit $3"
    body = {"rows": [{"n": "3", "cost": "0.0012", "d": "2026-11-01T00:00:00.000Z", "j": {"x": 1}, "s": "x", "nul": None}],
            "fields": [{"name": "n", "dataTypeID": 20}, {"name": "cost", "dataTypeID": 1700}, {"name": "d", "dataTypeID": 1082},
                       {"name": "j", "dataTypeID": 3802}, {"name": "s", "dataTypeID": 25}, {"name": "nul", "dataTypeID": 20}]}
    assert rows_from(body) == [{"n": 3, "cost": 0.0012, "d": date(2026, 11, 1), "j": {"x": 1}, "s": "x", "nul": None}]
    assert rows_from({"rows": [], "fields": []}) == []


async def test_lab_routes_need_staff(monkeypatch):
    """No token -> 401; signed in but not on LAB_ADMIN_EMAILS -> 403; staff -> the user."""
    import pytest
    from fastapi import HTTPException
    from starlette.requests import Request

    from app import main

    users = {"staff-token": {"id": "u1", "email": "ops@coverwise.demo"}, "cust-token": {"id": "u2", "email": "priya.sharma@coverwise.demo"}}

    async def fake_verify(token):
        return users.get(token)

    monkeypatch.setattr(main, "verify_token", fake_verify)
    monkeypatch.setattr(main, "LAB_ADMIN_EMAILS", {"ops@coverwise.demo"})

    def req(headers=(), query=b""):
        return Request({"type": "http", "headers": [(k.encode(), v.encode()) for k, v in headers], "query_string": query})

    for r, code in ((req(), 401), (req([("authorization", "Bearer cust-token")]), 403)):
        with pytest.raises(HTTPException) as e:
            await main.lab_user(r)
        assert e.value.status_code == code
    assert (await main.lab_user(req([("authorization", "Bearer staff-token")])))["id"] == "u1"
    assert (await main.lab_user(req(query=b"access_token=staff-token")))["id"] == "u1"  # EventSource path


def test_transcribe_endpoint(monkeypatch):
    """Voice mode: audio in -> transcript out; wrong type 415, empty 400, oversized 413."""
    from fastapi.testclient import TestClient

    from app import main

    seen = {}

    async def fake_transcribe(audio, filename):
        seen["name"], seen["size"] = filename, len(audio)
        return "when does my car policy renew"

    monkeypatch.setattr(main.llm, "transcribe", fake_transcribe)
    monkeypatch.setattr(main, "MAX_AUDIO", 1000)
    c = TestClient(main.app)  # no `with`: skips lifespan (no DB needed)
    r = c.post("/transcribe", content=b"\x1aE\xdf\xa3" * 10, headers={"content-type": "audio/webm;codecs=opus"})
    assert r.status_code == 200 and r.json() == {"text": "when does my car policy renew"}
    assert seen == {"name": "voice.webm", "size": 40}
    assert c.post("/transcribe", content=b"x", headers={"content-type": "text/plain"}).status_code == 415
    assert c.post("/transcribe", content=b"", headers={"content-type": "audio/mp4"}).status_code == 400
    assert c.post("/transcribe", content=b"x" * 1001, headers={"content-type": "audio/ogg"}).status_code == 413
