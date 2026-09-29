import json
import os
from pathlib import Path

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import AsyncConnectionPool

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://pilotkit:pilotkit@localhost:5433/pilotkit")

pool = AsyncConnectionPool(DATABASE_URL, open=False, kwargs={"row_factory": dict_row, "autocommit": True})


async def open_pool(init_schema: bool = False):
    await pool.open()
    if init_schema:
        await execute((Path(__file__).parent / "schema.sql").read_text())


async def execute(sql: str, *args):
    async with pool.connection() as c:
        await c.execute(sql, args or None)


async def one(sql: str, *args) -> dict | None:
    async with pool.connection() as c:
        return await (await c.execute(sql, args or None)).fetchone()


async def many(sql: str, *args) -> list[dict]:
    async with pool.connection() as c:
        return await (await c.execute(sql, args or None)).fetchall()


def j(v):
    """Wrap a python value for a jsonb column."""
    return Jsonb(v)


def dumps(v) -> str:
    return json.dumps(v, default=str)
