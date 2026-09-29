import os

from arq.connections import RedisSettings

from . import db
from .judge import judge_conversation
from .sim import run_suite

REDIS = RedisSettings.from_dsn(os.getenv("REDIS_URL", "redis://localhost:6380"))


async def run_suite_job(ctx, run_id: str, repeats: int = 1):
    try:
        await run_suite(run_id, repeats)
    except Exception:
        await db.execute("update run set status='failed' where id=%s", run_id)
        raise


async def judge_job(ctx, conv_id: str):
    await judge_conversation(conv_id)


async def startup(ctx):
    await db.open_pool()


class WorkerSettings:
    functions = [run_suite_job, judge_job]
    on_startup = startup
    redis_settings = REDIS
    job_timeout = 1800
    max_jobs = 4
