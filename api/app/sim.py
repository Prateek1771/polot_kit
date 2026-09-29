"""Test Lab: simulated users chat with ClaimChat. Jev picks each next move, the LLM writes the words."""
import asyncio
import json

from . import db, jev, llm
from .bot import SUITE, chat_turn
from .judge import judge_conversation

MAX_TURNS = 8
MOVE_HINT = {
    "continue": "Answer the assistant and keep pursuing your goal.",
    "switch_topic": "Bring up another part of your goal or a side question.",
    "escalate": "Show frustration; complain or ask for a human.",
}


async def _user_message(persona: dict, history: list[dict], move: str):
    convo = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in history[-10:]) or "(chat just opened)"
    return await llm.complete([{"role": "user", "content": (
        f"You are role-playing a customer chatting with an insurance chatbot.\nSTYLE: {persona['style']}\n"
        f"GOAL: {persona['goal']}\nFACTS YOU KNOW (share only when relevant): {json.dumps(persona.get('facts', {}))}\n"
        f"NEXT MOVE: {move}\n\nCONVERSATION SO FAR:\n{convo}\n\n"
        "Write ONLY your next chat message (1-2 short sentences), nothing else."
    )}])


async def simulate(run_id: str, persona: dict, variant: str):
    row = await db.one(
        "insert into conversation (source, run_id, persona, prompt_variant) values ('sim',%s,%s,%s) returning id",
        run_id, persona["id"], variant,
    )
    conv_id = str(row["id"])
    try:
        await _converse(conv_id, persona)
    except Exception as e:
        # mark it so the Lab shows an error instead of a conversation stuck "in progress"
        await db.execute("update conversation set status='error', ended_reason=%s where id=%s", f"error: {type(e).__name__}", conv_id)
        raise
    # ponytail: simulator's own LLM/Jev cost is harness overhead, not tracked
    await judge_conversation(conv_id)


async def _converse(conv_id: str, persona: dict):
    history, move, ended = [], MOVE_HINT["continue"], "max_turns"
    for _ in range(MAX_TURNS):
        text, _ = await _user_message(persona, history, move)
        reply = ""
        async for ev in chat_turn(conv_id, text.strip()):
            if ev["type"] == "done":
                reply = ev["reply"]
        history += [{"role": "user", "content": text}, {"role": "assistant", "content": reply}]
        a = await jev.decide(
            {"persona": persona["style"], "goal": persona["goal"],
             "last_turns": "\n".join(f"{m['role'].upper()}: {m['content']}" for m in history[-4:])},
            SUITE["next_move"],
        )
        choice = a["next_move"]["choice"]
        if choice in ("give_up", "goal_met"):
            ended = choice
            break
        move = MOVE_HINT[choice]
    await db.execute("update conversation set ended_reason=%s where id=%s", ended, conv_id)


async def run_suite(run_id: str, repeats: int = 1, concurrency: int = 5):
    run = await db.one("select * from run where id=%s", run_id)
    variant = run["target"].get("prompt_variant", "good")
    jobs = [p for p in SUITE["personas"] for _ in range(repeats)]
    await db.execute("update run set status='running', total=%s where id=%s", len(jobs), run_id)
    sem = asyncio.Semaphore(concurrency)

    async def one(p):
        async with sem:
            try:
                await simulate(run_id, p, variant)
            except Exception as e:  # one broken conversation must not kill the run
                print(f"sim {p['id']} failed: {e!r}")

    await asyncio.gather(*(one(p) for p in jobs))
    await db.execute("update run set status='done' where id=%s", run_id)
