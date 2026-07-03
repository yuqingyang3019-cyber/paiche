#!/usr/bin/env sh
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WHEELHOUSE="$ROOT/agent/wheelhouse"
REQ="$ROOT/agent/requirements.txt"
FC_PYTHON_VERSION="${FC_PYTHON_VERSION:-3.12}"
FC_PLATFORM="${FC_PLATFORM:-manylinux2014_x86_64}"

if [ ! -f "$REQ" ]; then
  echo "::error::缺少 $REQ" >&2
  exit 1
fi

if [ ! -d "$WHEELHOUSE" ] || ! ls "$WHEELHOUSE"/*.whl >/dev/null 2>&1; then
  echo "::error::wheelhouse 缺失或为空，请先执行 scripts/build_wheelhouse.sh" >&2
  exit 1
fi

count="$(ls "$WHEELHOUSE"/*.whl | wc -l | tr -d ' ')"
echo "检查 wheelhouse（${count} 个 whl）能否离线满足 requirements.txt ..."

py_major="$(python3 -c 'import sys; print(sys.version_info.major)')"
py_minor="$(python3 -c 'import sys; print(sys.version_info.minor)')"

if [ "$(uname -s)" = "Linux" ] && [ "$py_major" = "3" ] && [ "$py_minor" = "12" ]; then
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "$tmpdir"' EXIT
  python3 -m venv "$tmpdir/venv"
  "$tmpdir/venv/bin/python" -m pip install -q --no-index --find-links "$WHEELHOUSE" -r "$REQ"
  "$tmpdir/venv/bin/python" - <<'PY'
import fastapi
import httpx
import openai
import openpyxl
import uvicorn
import wechatpy

print("wheelhouse 离线安装与关键包导入检查通过（Linux Python 3.12）")
PY
  exit 0
fi

python3 -m pip install --no-index --find-links "$WHEELHOUSE" -r "$REQ" \
  --dry-run --ignore-installed \
  --python-version "$FC_PYTHON_VERSION" \
  --platform "$FC_PLATFORM" \
  --only-binary=:all: >/dev/null

echo "wheelhouse 离线依赖解析检查通过（目标 Python ${FC_PYTHON_VERSION} / ${FC_PLATFORM}）"
