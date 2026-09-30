import asyncio
import contextvars
import os

import litellm

MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")  # bare OpenAI name -> OPENAI_API_KEY

litellm.drop_params = True
if os.getenv("LANGFUSE_PUBLIC_KEY"):
    # langfuse_otel reads LANGFUSE_HOST; docker compose points it at the host, local dev reuses the UI URL
    os.environ.setdefault("LANGFUSE_HOST", os.getenv("LANGFUSE_BASE_URL", "https://cloud.langfuse.com"))
    litellm.callbacks = ["langfuse_otel"]

# Langfuse session for every LiteLLM call (LLM and Jev) in the current task: the conversation id.
# asyncio tasks copy context, so parallel suite chats each keep their own.
_session: contextvars.ContextVar[str | None] = contextvars.ContextVar("langfuse_session", default=None)


def session(conv_id) -> None:
    _session.set(str(conv_id))


def _metadata(name: str, tags: list[str]) -> dict:
    return {"generation_name": name, "trace_name": name, "session_id": _session.get(), "tags": tags}


async def acall(name: str, tags: list[str], **kw):
    """litellm.acompletion with Langfuse naming/session metadata, plus exponential backoff on 429s
    (suites run several chats in parallel against one TPM budget)."""
    kw["metadata"] = _metadata(name, tags)
    for attempt in range(6):
        try:
            return await litellm.acompletion(**kw)
        except litellm.RateLimitError:
            if attempt == 5:
                raise
            await asyncio.sleep(2 ** attempt)  # 1, 2, 4, 8, 16s


async def complete(messages: list[dict], json_mode: bool = False, name: str = "llm") -> tuple[str, float]:
    r = await acall(name, ["llm"], model=MODEL, messages=messages,
                    response_format={"type": "json_object"} if json_mode else None)
    text = r.choices[0].message.content or ""
    if json_mode:
        text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return text, _cost(r)


async def stream(messages: list[dict], name: str = "llm-stream"):
    """Yields text deltas; the last item yielded is a float: the call's cost in USD."""
    chunks = []
    r = await acall(name, ["llm"], model=MODEL, messages=messages, stream=True, stream_options={"include_usage": True})
    async for ch in r:
        chunks.append(ch)
        delta = ch.choices[0].delta.content if ch.choices else None
        if delta:
            yield delta
    yield _cost(litellm.stream_chunk_builder(chunks, messages=messages))


STT_MODEL = os.getenv("STT_MODEL", "gpt-4o-mini-transcribe")  # OpenAI speech-to-text, same OPENAI_API_KEY


async def transcribe(audio: bytes, filename: str) -> str:
    """Voice mode: speech -> text via LiteLLM (traced like every other call). The filename's extension tells OpenAI the format."""
    r = await litellm.atranscription(model=STT_MODEL, file=(filename, audio), metadata=_metadata("transcribe", ["llm", "stt"]))
    return (r.text or "").strip()


def _cost(resp) -> float:
    try:
        return float(litellm.completion_cost(completion_response=resp) or 0)
    except Exception:
        # ponytail: unknown model price -> 0, cost shows as $0 rather than failing the chat
        return 0.0
