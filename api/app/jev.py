"""TypeSafe Jev via the OpenRouter Decisions API.

decide() is the only entry point. It returns the `answers` dict exactly as Jev shapes it:
  noul   -> {"type": "noul", "noul": 0.96}
  choice -> {"type": "choice", "choice": "x", "confidence": .., "probabilities": {..}}
  score  -> {"type": "score", "score": 1.9, "confidence": .., "probabilities": {..}, "legend": {..}}
plus "_meta": {"cost": usd, "latency_ms": int, "model": str}.
"""
import json
import os
import time

import httpx

JEV_URL = "https://openrouter.ai/api/alpha/decisions"
JEV_MODEL = os.getenv("JEV_MODEL", "typesafe/jev-1.13")
# ponytail: LLM fallback behind a flag because the Decisions API is alpha; not a provider abstraction.
FALLBACK = os.getenv("JEV_FALLBACK") == "1"

_client = httpx.AsyncClient(timeout=20)


async def decide(state: dict, questions: dict) -> dict:
    t0 = time.perf_counter()
    if FALLBACK:
        answers, cost, model = await _llm_decide(state, questions)
    else:
        r = await _client.post(
            JEV_URL,
            headers={"Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}"},
            json={"model": JEV_MODEL, "state": state, "questions": questions},
        )
        r.raise_for_status()
        body = r.json()
        answers, cost, model = body["answers"], body.get("usage", {}).get("cost", 0), body.get("model")
    answers["_meta"] = {"cost": cost or 0, "latency_ms": int((time.perf_counter() - t0) * 1000), "model": model}
    return answers


def p(answers: dict, key: str) -> float:
    """Probability of 'yes' for a noul answer (0 if missing)."""
    return float(answers.get(key, {}).get("noul", 0))


async def _llm_decide(state: dict, questions: dict):
    from . import llm

    prompt = (
        "Answer each question about STATE. Reply with JSON only: for noul questions "
        '{"<id>": {"type":"noul","noul":<prob yes 0-1>}}, for choice {"type":"choice","choice":"<key>",'
        '"confidence":<0-1>,"probabilities":{<key>:<prob>}}, for score {"type":"score","score":<index>,'
        '"confidence":<0-1>,"probabilities":{"0":..}}.\n'
        f"STATE:\n{json.dumps(state)}\nQUESTIONS:\n{json.dumps(questions)}"
    )
    text, cost = await llm.complete([{"role": "user", "content": prompt}], json_mode=True)
    return json.loads(text), cost, "llm-fallback"
