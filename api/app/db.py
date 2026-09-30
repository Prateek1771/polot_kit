"""Postgres on InsForge, through the project's admin raw-SQL endpoint (a cloud project has no direct Postgres port).

Same helpers as before: execute/one/many take psycopg-style %s placeholders and return rows as dicts. The admin API
key is server-only: this module runs in the API/worker, never in the browser.
"""
import json
import os
import re
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from uuid import UUID

import httpx

INSFORGE_URL = os.getenv("INSFORGE_URL", "")
INSFORGE_API_KEY = os.getenv("INSFORGE_API_KEY", "")
RAWSQL = "/api/database/advance/rawsql"

# rawsql serialises bigint/numeric as strings and dates as midnight-UTC timestamps (the server runs in GMT);
# restore Python types by the column's Postgres type id.
_CAST = {20: int, 21: int, 23: int, 1700: float, 1082: lambda s: date.fromisoformat(s[:10])}

_client: httpx.AsyncClient | None = None


class DBError(RuntimeError):
    pass


async def open_pool(init_schema: bool = False):
    global _client
    if not (INSFORGE_URL and INSFORGE_API_KEY):
        raise RuntimeError("INSFORGE_URL and INSFORGE_API_KEY must be set")
    # ponytail: one HTTP round-trip per statement, no transactions; nothing here needs multi-statement atomicity
    _client = httpx.AsyncClient(base_url=INSFORGE_URL, headers={"Authorization": f"Bearer {INSFORGE_API_KEY}"},
                                timeout=30, limits=httpx.Limits(max_connections=20))
    if init_schema:
        await execute((Path(__file__).parent / "schema.sql").read_text())


async def close_pool():
    if _client:
        await _client.aclose()


def to_pg(sql: str) -> str:
    """psycopg %s placeholders -> Postgres $1, $2 ... (our SQL has no literal %)."""
    n = iter(range(1, 10_000))
    return re.sub(r"%s", lambda _: f"${next(n)}", sql)


def _param(v):
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, UUID):
        return str(v)
    return v


def rows_from(body: dict) -> list[dict]:
    casts = {f["name"]: _CAST[f["dataTypeID"]] for f in body.get("fields") or [] if f.get("dataTypeID") in _CAST}
    return [{k: casts[k](v) if v is not None and k in casts else v for k, v in r.items()} for r in body.get("rows") or []]


async def _run(sql: str, args: tuple) -> list[dict]:
    body = {"query": to_pg(sql)}
    if args:
        body["params"] = [_param(a) for a in args]
    r = await _client.post(RAWSQL, json=body)
    if r.status_code >= 400:
        raise DBError(f"{r.status_code}: {r.text[:500]}")
    return rows_from(r.json())


async def execute(sql: str, *args):
    await _run(sql, args)


async def one(sql: str, *args) -> dict | None:
    rows = await _run(sql, args)
    return rows[0] if rows else None


async def many(sql: str, *args) -> list[dict]:
    return await _run(sql, args)


def j(v):
    """A Python value for a jsonb column (sent as JSON text; Postgres casts it from the column type)."""
    return json.dumps(v, default=str)


def dumps(v) -> str:
    return json.dumps(v, default=str)
