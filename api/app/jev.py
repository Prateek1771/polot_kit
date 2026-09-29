"""TypeSafe Jev via the OpenRouter Decisions API, called through LiteLLM.

decide() is the only entry point. It returns the `answers` dict exactly as Jev shapes it:
  noul   -> {"type": "noul", "noul": 0.96}
  choice -> {"type": "choice", "choice": "x", "confidence": .., "probabilities": {..}}
  score  -> {"type": "score", "score": 1.9, "confidence": .., "probabilities": {..}, "legend": {..}}
plus "_meta": {"cost": usd, "latency_ms": int, "model": str}.

Jev is a decisions model, so OpenRouter rejects it on /chat/completions. JevProvider is a LiteLLM custom
provider that forwards {state, questions} to /api/alpha/decisions, so each decision still runs through
litellm.acompletion: the Langfuse callback traces it (input, answers, tokens, cost) in the chat's session.
"""
import json
import os
import time

import httpx
import litellm
from litellm import CustomLLM, ModelResponse
from litellm.types.utils import Usage

from . import llm

JEV_URL = "https://openrouter.ai/api/alpha/decisions"
JEV_MODEL = os.getenv("JEV_MODEL", "typesafe/jev-1.13")
# ponytail: LLM fallback behind a flag because the Decisions API is alpha; not a provider abstraction.
FALLBACK = os.getenv("JEV_FALLBACK") == "1"


class JevProvider(CustomLLM):
    """`jev/<openrouter model>`: the single user message is JSON {"state": .., "questions": ..}; the reply
    content is Jev's `answers` as JSON, and Jev's billed cost is passed through as the response cost."""

    def __init__(self):
        super().__init__()
        self.http = httpx.AsyncClient(timeout=20)

    async def acompletion(self, model, messages, model_response: ModelResponse, **_) -> ModelResponse:
        r = await self.http.post(
            JEV_URL,
            headers={"Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}"},
            json={"model": model, **json.loads(messages[-1]["content"])},
        )
        if r.status_code == 429:
            raise litellm.RateLimitError(r.text, llm_provider="jev", model=model)
        r.raise_for_status()
        body, usage = r.json(), r.json().get("usage", {})
        model_response.model = body.get("model", model)
        model_response.choices[0].message.content = json.dumps(body["answers"])
        model_response.usage = Usage(prompt_tokens=usage.get("input_tokens", 0), completion_tokens=usage.get("output_tokens", 0),
                                     total_tokens=usage.get("input_tokens", 0) + usage.get("output_tokens", 0))
        model_response._hidden_params["response_cost"] = float(usage.get("cost") or 0)
        return model_response


litellm.custom_provider_map = [*litellm.custom_provider_map, {"provider": "jev", "custom_handler": JevProvider()}]


async def decide(state: dict, questions: dict, name: str = "jev") -> dict:
    t0 = time.perf_counter()
    if FALLBACK:
        answers, cost, model = await _llm_decide(state, questions, name)
    else:
        r = await llm.acall(name, ["jev"], model=f"jev/{JEV_MODEL}",
                            messages=[{"role": "user", "content": json.dumps({"state": state, "questions": questions})}])
        answers, cost, model = json.loads(r.choices[0].message.content), r._hidden_params.get("response_cost") or 0, r.model
    answers["_meta"] = {"cost": cost, "latency_ms": int((time.perf_counter() - t0) * 1000), "model": model}
    return answers


def p(answers: dict, key: str) -> float:
    """Probability of 'yes' for a noul answer (0 if missing)."""
    return float(answers.get(key, {}).get("noul", 0))


async def _llm_decide(state: dict, questions: dict, name: str):
    prompt = (
        "Answer each question about STATE. Reply with JSON only: for noul questions "
        '{"<id>": {"type":"noul","noul":<prob yes 0-1>}}, for choice {"type":"choice","choice":"<key>",'
        '"confidence":<0-1>,"probabilities":{<key>:<prob>}}, for score {"type":"score","score":<index>,'
        '"confidence":<0-1>,"probabilities":{"0":..}}.\n'
        f"STATE:\n{json.dumps(state)}\nQUESTIONS:\n{json.dumps(questions)}"
    )
    text, cost = await llm.complete([{"role": "user", "content": prompt}], json_mode=True, name=f"{name}-fallback")
    return json.loads(text), cost, "llm-fallback"
