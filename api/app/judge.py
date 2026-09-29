"""Grade a finished conversation with Jev; the LLM only explains failures."""
import json

from . import db, jev, llm
from .bot import KB, SUITE

T = SUITE["thresholds"]


def triage(prob: float) -> str:
    if prob >= T["pass"]:
        return "pass"
    if prob <= T["fail"]:
        return "fail"
    return "review"


async def judge_conversation(conv_id: str):
    llm.session(conv_id)
    conv = await db.one("select * from conversation where id=%s", conv_id)
    msgs = await db.many("select role, content, cards from message where conversation_id=%s order by id", conv_id)
    if not msgs:
        return
    await db.execute("update conversation set status='judging' where id=%s", conv_id)
    claim = await db.one("select policy_no, incident_date, description from claim where conversation_id=%s", conv_id)
    goal = next((p["goal"] for p in SUITE["personas"] if p["id"] == conv["persona"]), "unknown (live user)")
    text = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in msgs)

    plans = [c for m in msgs for c in (m["cards"] or []) if c.get("type") in ("plans", "compare")]
    customer = (conv["state"] or {}).get("customer")
    a = await jev.decide({
        "transcript": text, "kb": KB, "user_goal": goal, "claim": claim or "no claim filed",
        "customer_lookup": f"verified as {customer['name']}" if customer else "no customer matched (policy details must not be shared)",
        "recommended": plans[-1] if plans else "no plans recommended",
    }, SUITE["judge"], name="jev-judge")
    nouls = {k: jev.p(a, k) for k, q in SUITE["judge"].items() if q["type"] == "noul"}
    verdicts = {k: triage(v) for k, v in nouls.items()}

    reasons, cost = {}, 0.0
    failed = [k for k, v in verdicts.items() if v == "fail"]
    if failed:
        qs = {k: SUITE["judge"][k]["instructions"] for k in failed}
        out, cost = await llm.complete([{"role": "user", "content": (
            "An evaluator marked these checks as FAILED for the conversation below. For each, give a one-sentence reason "
            f"quoting the offending turn. JSON only: {{\"<check>\": \"reason\"}}.\nCHECKS: {json.dumps(qs)}\n\nCONVERSATION:\n{text}"
        )}], json_mode=True, name="judge-explain")
        try:
            reasons = json.loads(out)
        except json.JSONDecodeError:
            reasons = {}

    for k, prob in nouls.items():
        await db.execute(
            """insert into score (conversation_id, criterion, prob, verdict, reason) values (%s,%s,%s,%s,%s)
               on conflict (conversation_id, criterion) do update set prob=excluded.prob, verdict=excluded.verdict, reason=excluded.reason""",
            conv_id, k, prob, verdicts[k], reasons.get(k),
        )
    q = a.get("quality", {})
    # ponytail: score is a 0..3 index; normalise to 0..1 for display
    quality = float(q.get("score", 0)) / (len(SUITE["judge"]["quality"]["criteria"]) - 1)
    await db.execute(
        "update conversation set status='judged', outcome=%s, quality_score=%s, judge_cost_usd=%s where id=%s",
        a.get("outcome", {}).get("choice"), quality, a["_meta"]["cost"] + cost, conv_id,
    )
