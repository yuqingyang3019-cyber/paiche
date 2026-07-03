#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

export PYTHONPATH="$(pwd)/python:${PYTHONPATH:-}"

python3 - <<'PY'
try:
    import uvicorn  # noqa: F401
except Exception as exc:
    raise SystemExit(f"缺少 agent/python 运行时依赖，请先构建离线部署包: {exc}")
PY

exec python3 -m uvicorn main:app --host 0.0.0.0 --port "${PORT:-9000}"
