#!/usr/bin/env sh
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WHEELHOUSE="$ROOT/agent/wheelhouse"
TARGET="$ROOT/agent/python"
REQ="$ROOT/agent/requirements.txt"
FC_PYTHON_VERSION="${FC_PYTHON_VERSION:-3.12}"
FC_PLATFORM="${FC_PLATFORM:-manylinux2014_x86_64}"

if [ ! -d "$WHEELHOUSE" ] || ! ls "$WHEELHOUSE"/*.whl >/dev/null 2>&1; then
  echo "缺少 wheelhouse/*.whl，不能构建离线运行时依赖" >&2
  exit 1
fi

rm -rf "$TARGET"
mkdir -p "$TARGET"

if [ "$(uname -s)" = "Linux" ]; then
  python3 -m pip install \
    --no-index \
    --find-links "$WHEELHOUSE" \
    --no-compile \
    --target "$TARGET" \
    -r "$REQ"
else
  python3 -m pip install \
    --no-index \
    --find-links "$WHEELHOUSE" \
    --no-compile \
    --target "$TARGET" \
    --platform "$FC_PLATFORM" \
    --python-version "$FC_PYTHON_VERSION" \
    --implementation cp \
    --only-binary=:all: \
    -r "$REQ"
fi

echo "agent/python 离线运行时依赖构建完成"
