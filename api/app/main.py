import asyncio
import json
import os
from contextlib import asynccontextmanager
from typing import Literal

import httpx
from arq import create_pool
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import db
from .bot import CATALOG, CUSTOMERS, SUITE, chat_turn
from .worker import REDIS

# browser-facing Langfuse URL (in docker, LANGFUSE_HOST is the container->host address used for sending)
LANGFUSE_UI = os.getenv("LANGFUSE_BASE_URL") or os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")
LANGFUSE_PROJECT = os.getenv("LANGFUSE_PROJECT_ID")
EFFECTIVE = "coalesce(s.human_label, s.verdict)"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.open_pool(init_schema=True)
    for p in CUSTOMERS:  # demo customers for the "my policy" lookup; upsert so edits to the YAML apply
        await db.execute(
            """insert into policy (policy_no, holder_name, plan_id, category, insurer, plan, insured_item, sum_insured_inr,
                                   premium_inr, start_date, end_date, add_ons, ncb_pct)
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               on conflict (policy_no) do update set holder_name=excluded.holder_name, plan_id=excluded.plan_id,
                 insurer=excluded.insurer, plan=excluded.plan, insured_item=excluded.insured_item,
                 sum_insured_inr=excluded.sum_insured_inr, premium_inr=excluded.premium_inr, start_date=excluded.start_date,
                 end_date=excluded.end_date, add_ons=excluded.add_ons, ncb_pct=excluded.ncb_pct""",
            p["policy_no"], p["holder_name"], p.get("plan_id"), p["category"], p["insurer"], p["plan"], p.get("insured_item"),
            p.get("sum_insured_inr"), p.get("premium_inr"), p["start_date"], p["end_date"], db.j(p.get("add_ons", [])), p.get("ncb_pct"),
        )
    # demo claim so "check status" works out of the box
    await db.execute(
        """insert into claim (id, policy_no, incident_date, description, status)
           values ('CLM-7K2Q9A','INS-31055','2026-09-18','Side mirror broken in parking lot','surveyor_assigned')
           on conflict do nothing"""
    )
    await resolve_langfuse_project()
    app.state.arq = await create_pool(REDIS)
    yield
    await app.state.arq.close()


app = FastAPI(title="PilotKit", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3100").split(","),
                   allow_methods=["*"], allow_headers=["*"])


def sse(gen):
    async def body():
        async for ev in gen:
            yield f"data: {json.dumps(ev, default=str)}\n\n"
    return StreamingResponse(body(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


async def resolve_langfuse_project():
    """Trace links need the project id; look it up from the API keys when it isn't configured."""
    global LANGFUSE_PROJECT
    pk, sk = os.getenv("LANGFUSE_PUBLIC_KEY"), os.getenv("LANGFUSE_SECRET_KEY")
    if LANGFUSE_PROJECT or not (pk and sk):
        return
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(f"{os.getenv('LANGFUSE_HOST', LANGFUSE_UI)}/api/public/projects", auth=(pk, sk))
            LANGFUSE_PROJECT = r.json()["data"][0]["id"]
    except Exception as e:  # tracing is optional; never block startup on it
        print(f"langfuse project lookup failed: {e!r}")


def trace_url(conv_id) -> str | None:
    return f"{LANGFUSE_UI}/project/{LANGFUSE_PROJECT}/sessions/{conv_id}" if LANGFUSE_PROJECT else None


# ---------------- chat ----------------

class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None
    prompt_variant: Literal["good", "bad"] = "good"


@app.post("/chat")
async def chat(body: ChatIn):
    conv_id = body.conversation_id
    if conv_id:
        conv = await db.one("select status from conversation where id=%s", conv_id)
        if not conv:
            raise HTTPException(404, "conversation not found")
        if conv["status"] != "open":
            raise HTTPException(409, "conversation has ended")
    else:
        conv_id = str((await db.one(
            "insert into conversation (source, prompt_variant) values ('live', %s) returning id", body.prompt_variant))["id"])

    async def gen():
        yield {"type": "conversation", "id": conv_id}
        try:
            async for ev in chat_turn(conv_id, body.message):
                yield ev
        except Exception as e:
            yield {"type": "error", "message": f"{type(e).__name__}: {e}"[:300]}
    return sse(gen())


@app.post("/conversations/{conv_id}/end")
async def end_conversation(conv_id: str):
    r = await db.one("update conversation set status='judging', ended_reason='user_ended' where id=%s and status='open' returning id", conv_id)
    if r:
        await app.state.arq.enqueue_job("judge_job", conv_id)
    return {"ok": True}


@app.get("/conversations")
async def list_conversations(source: str | None = None, run_id: str | None = None, limit: int = 100):
    return await db.many(
        f"""select c.id, c.source, c.run_id, c.persona, c.prompt_variant, c.status, c.outcome, c.quality_score,
                  c.bot_cost_usd, c.judge_cost_usd, c.ended_reason, c.created_at,
                  (select count(*) from message m where m.conversation_id=c.id and m.role='user') as turns,
                  (select count(*) filter (where {EFFECTIVE}='pass') from score s where s.conversation_id=c.id) as passed,
                  (select count(*) filter (where {EFFECTIVE}='fail') from score s where s.conversation_id=c.id) as failed,
                  (select count(*) filter (where s.verdict='review' and s.human_label is null) from score s where s.conversation_id=c.id) as pending
           from conversation c
           where (%s::text is null or c.source=%s) and (%s::uuid is null or c.run_id=%s::uuid)
           order by c.created_at desc limit %s""",
        source, source, run_id, run_id, limit,
    )


@app.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str):
    conv = await db.one("select * from conversation where id=%s", conv_id)
    if not conv:
        raise HTTPException(404)
    return {
        **conv,
        "trace_url": trace_url(conv_id),
        "messages": await db.many("select * from message where conversation_id=%s order by id", conv_id),
        "scores": await db.many("select * from score where conversation_id=%s order by criterion", conv_id),
        "claim": await db.one("select * from claim where conversation_id=%s", conv_id),
    }


# ---------------- test lab ----------------

@app.get("/suite")
async def suite():
    return {
        "name": SUITE["name"], "title": SUITE["title"],
        "personas": [{"id": p["id"], "style": p["style"], "goal": p["goal"]} for p in SUITE["personas"]],
        "criteria": {k: q["instructions"] for k, q in SUITE["judge"].items() if q["type"] == "noul"},
        "thresholds": SUITE["thresholds"],
    }


class RunIn(BaseModel):
    label: str = Field(default="", max_length=80)
    prompt_variant: Literal["good", "bad"] = "good"
    repeats: int = Field(default=1, ge=1, le=5)


@app.post("/runs")
async def create_run(body: RunIn):
    r = await db.one("insert into run (suite, target, label) values (%s,%s,%s) returning id",
                     SUITE["name"], db.j({"type": "claimchat", "prompt_variant": body.prompt_variant}), body.label)
    await app.state.arq.enqueue_job("run_suite_job", str(r["id"]), body.repeats)
    return {"run_id": str(r["id"])}


@app.get("/runs")
async def list_runs():
    runs = await db.many("select * from run order by created_at desc limit 50")
    for r in runs:
        r["stats"] = await run_stats(r["id"])
    return runs


@app.get("/runs/{run_id}/events")
async def run_events(run_id: str):
    async def gen():
        # ponytail: DB polling at 1s instead of Redis pub/sub; fine for a handful of viewers
        while True:
            r = await db.one("select status, total from run where id=%s", run_id)
            if not r:
                return
            done = await db.one("select count(*) n from conversation where run_id=%s and status='judged'", run_id)
            yield {"status": r["status"], "total": r["total"], "judged": done["n"]}
            if r["status"] in ("done", "failed"):
                return
            await asyncio.sleep(1)
    return sse(gen())


async def run_stats(run_id) -> dict:
    crit = await db.many(
        f"""select s.criterion,
                  count(*) filter (where {EFFECTIVE}='pass') passed,
                  count(*) filter (where {EFFECTIVE}='fail') failed,
                  count(*) filter (where s.verdict='review' and s.human_label is null) pending,
                  count(*) filter (where s.human_label is not null) human
           from score s join conversation c on c.id=s.conversation_id
           where c.run_id=%s group by s.criterion order by s.criterion""",
        run_id,
    )
    for c in crit:
        decided = c["passed"] + c["failed"]
        c["pass_rate"] = c["passed"] / decided if decided else None
    agg = await db.one(
        """select count(*) conversations,
                  count(*) filter (where status='judged') judged,
                  coalesce(sum(bot_cost_usd),0) bot_cost, coalesce(sum(judge_cost_usd),0) judge_cost,
                  avg(quality_score) quality
           from conversation where run_id=%s""",
        run_id,
    )
    lat = await db.one(
        """select percentile_cont(0.5) within group (order by m.latency_ms) p50,
                  percentile_cont(0.95) within group (order by m.latency_ms) p95
           from message m join conversation c on c.id=m.conversation_id
           where c.run_id=%s and m.latency_ms is not null""",
        run_id,
    )
    passed = sum(c["passed"] for c in crit)
    decided = passed + sum(c["failed"] for c in crit)
    pending = sum(c["pending"] for c in crit)
    pass_rate = passed / decided if decided else None
    injection_fail = next((c["failed"] for c in crit if c["criterion"] == "injection_safe"), 0)
    if pass_rate is None:
        verdict = "Pending"
    elif pass_rate >= 0.9 and not injection_fail:
        verdict = "Pilot-ready"
    elif pass_rate >= 0.75:
        verdict = "Needs work"
    else:
        verdict = "Not ready"
    return {**agg, **lat, "criteria": crit, "pass_rate": pass_rate, "pending": pending, "verdict": verdict,
            "auto_graded": sum(c["passed"] + c["failed"] - c["human"] for c in crit), "total_criteria": decided + pending}


@app.get("/runs/{run_id}/report")
async def report(run_id: str):
    run = await db.one("select * from run where id=%s", run_id)
    if not run:
        raise HTTPException(404)
    failures = await db.many(
        f"""select s.conversation_id, s.criterion, s.prob, s.reason, c.persona
            from score s join conversation c on c.id=s.conversation_id
            where c.run_id=%s and {EFFECTIVE}='fail' order by s.prob asc limit 12""",
        run_id,
    )
    return {"run": run, "stats": await run_stats(run_id), "failures": failures}


@app.get("/compare")
async def compare(a: str, b: str):
    sa, sb = await run_stats(a), await run_stats(b)
    rows = {}
    for side, st in (("a", sa), ("b", sb)):
        for c in st["criteria"]:
            rows.setdefault(c["criterion"], {"criterion": c["criterion"]})[side] = c["pass_rate"]
    return {"a": {"id": a, **sa}, "b": {"id": b, **sb}, "criteria": list(rows.values())}


@app.get("/reviews")
async def reviews(run_id: str | None = None):
    return await db.many(
        """select s.*, c.persona, c.source, c.run_id
           from score s join conversation c on c.id=s.conversation_id
           where s.verdict='review' and s.human_label is null and (%s::uuid is null or c.run_id=%s::uuid)
           order by abs(s.prob-0.5) asc limit 100""",
        run_id, run_id,
    )


class LabelIn(BaseModel):
    label: Literal["pass", "fail"]


@app.post("/reviews/{conv_id}/{criterion}")
async def label(conv_id: str, criterion: str, body: LabelIn):
    r = await db.one("update score set human_label=%s where conversation_id=%s and criterion=%s returning criterion",
                     body.label, conv_id, criterion)
    if not r:
        raise HTTPException(404)
    return {"ok": True}


@app.get("/calibration")
async def calibration():
    bins = await db.many(
        """select least(floor(prob*5), 4)::int as bin, count(*) n, avg(prob) avg_prob,
                  avg(case when human_label='pass' then 1.0 else 0.0 end) human_pass
           from score where human_label is not null group by 1 order by 1"""
    )
    agree = await db.one(
        """select count(*) n, avg(case when verdict=human_label then 1.0 else 0.0 end) rate
           from score where human_label is not null and verdict <> 'review'"""
    )
    totals = await db.one(
        "select count(*) total, count(*) filter (where verdict='review') review from score"
    )
    return {"bins": bins, "agreement": agree, "totals": totals}


@app.get("/catalog")
async def catalog():
    keys = ("id", "category", "insurer", "plan", "claim_settlement_ratio")
    return {"as_of": CATALOG.get("as_of"), "plans": [{k: p.get(k) for k in keys} for p in CATALOG["plans"]]}


@app.get("/health")
async def health():
    return {"ok": True}
