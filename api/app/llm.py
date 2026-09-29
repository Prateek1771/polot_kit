import asyncio
import os

import litellm

MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")  # bare OpenAI name -> OPENAI_API_KEY

litellm.drop_params = True
if os.getenv("LANGFUSE_PUBLIC_KEY"):
    # langfuse_otel reads LANGFUSE_HOST; docker compose points it at the host, local dev reuses the UI URL
    os.environ.setdefault("LANGFUSE_HOST", os.getenv("LANGFUSE_BASE_URL", "https://cloud.langfuse.com"))
    litellm.callbacks = ["langfuse_otel"]


def _meta(tags: dict | None):
    return {"metadata": tags} if tags else {}


async def _acompletion(**kw):
    """acompletion with exponential backoff on 429s (suites run several chats in parallel against one TPM budget)."""
    for attempt in range(6):
        try:
            return await litellm.acompletion(**kw)
        except litellm.RateLimitError:
            if attempt == 5:
                raise
            await asyncio.sleep(2 ** attempt)  # 1, 2, 4, 8, 16s


async def complete(messages: list[dict], json_mode: bool = False, tags: dict | None = None) -> tuple[str, float]:
    r = await _acompletion(
        model=MODEL,
        messages=messages,
        response_format={"type": "json_object"} if json_mode else None,
        **_meta(tags),
    )
    text = r.choices[0].message.content or ""
    if json_mode:
        text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return text, _cost(r)


async def stream(messages: list[dict], tags: dict | None = None):
    """Yields text deltas; the last item yielded is a float: the call's cost in USD."""
    chunks = []
    r = await _acompletion(model=MODEL, messages=messages, stream=True, stream_options={"include_usage": True}, **_meta(tags))
    async for ch in r:
        chunks.append(ch)
        delta = ch.choices[0].delta.content if ch.choices else None
        if delta:
            yield delta
    yield _cost(litellm.stream_chunk_builder(chunks, messages=messages))


def _cost(resp) -> float:
    try:
        return float(litellm.completion_cost(completion_response=resp) or 0)
    except Exception:
        # ponytail: unknown model price -> 0, cost shows as $0 rather than failing the chat
        return 0.0
