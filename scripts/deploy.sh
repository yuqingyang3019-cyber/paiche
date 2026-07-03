#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

missing=""
for var in DASHSCOPE_API_KEY WEWORK_CORP_ID WEWORK_AGENT_ID WEWORK_AGENT_SECRET; do
  val="$(printenv "$var" || true)"
  if [ -z "$val" ]; then
    missing="$missing $var"
  fi
done
if [ -n "${missing# }" ]; then
  echo "缺少部署必需环境变量：${missing# }" >&2
  echo "请使用 GitHub Actions 部署，或先在当前 shell 注入这些变量。" >&2
  exit 1
fi

bash scripts/check_wheelhouse.sh
bash scripts/build_python_vendor.sh
bash scripts/check_python_vendor.sh

echo "离线运行时依赖检查通过，开始部署..."
s deploy -t s.yaml --assume-yes
