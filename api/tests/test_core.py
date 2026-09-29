from app.bot import SENSITIVE, mask, named_plans, normalise_name, pick_plans, route
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
    assert route(ans("new_claim"), {}) == "new_claim"
    assert route(ans("claim_status"), {}) == "status"
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
    assert route(ans("my_policy"), {}) == "identify"
    assert route(ans("other"), {"awaiting_name": True}) == "identify"  # "Priya Sharma" typed after we asked
    assert route(ans("my_policy"), {"customer": {"name": "Priya Sharma"}}) == "my_policy"
    assert route(ans("shop_plans"), {"awaiting_name": True}) == "shop"  # can leave the lookup to browse plans


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
    assert normalise_name("  Priya   SHARMA ") == "priya sharma"
