#!/bin/sh
# Single-container deploy (InsForge compute, 512 MB): one container runs Redis and the API, with the arq worker
# (Test Lab) inside the API process (INPROCESS_WORKER=1).
# docker compose overrides this and runs api / worker / redis as separate services.
# ponytail: Redis is in-container and non-persistent (queued suites are lost on restart) and the worker isn't
# supervised; move Redis and the worker to their own services when the Lab needs to survive restarts.
set -e
redis-server --daemonize yes --save "" --appendonly no
export INPROCESS_WORKER=1
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
