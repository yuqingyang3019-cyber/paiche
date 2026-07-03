#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
exec python3 -m uvicorn main:app --host 0.0.0.0 --port "${PORT:-9000}"
