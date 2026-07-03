#!/usr/bin/env sh
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$ROOT/agent/python"

if [ ! -d "$TARGET" ]; then
  echo "::error::缺少 agent/python，请先执行 scripts/build_python_vendor.sh" >&2
  exit 1
fi

for path in \
  "$TARGET/fastapi" \
  "$TARGET/openai" \
  "$TARGET/openpyxl" \
  "$TARGET/uvicorn" \
  "$TARGET/wechatpy" \
  "$TARGET/Crypto"; do
  if [ ! -e "$path" ]; then
    echo "::error::agent/python 缺少运行时依赖: $path" >&2
    exit 1
  fi
done

if [ "$(uname -s)" = "Linux" ]; then
  PYTHONPATH="$TARGET${PYTHONPATH:+:$PYTHONPATH}" python3 - <<'PY'
import fastapi
import httpx
import openai
import openpyxl
import uvicorn
import wechatpy
from Crypto.Cipher import AES

print("agent/python 运行时依赖导入检查通过")
PY
else
  echo "agent/python 文件完整性检查通过（非 Linux 环境跳过二进制包导入）"
fi
