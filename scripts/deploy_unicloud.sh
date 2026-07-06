#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

UNICLOUD_PROVIDER="${UNICLOUD_PROVIDER:-alipay}"
UNICLOUD_PROJECT="${UNICLOUD_PROJECT:-luche}"
UNICLOUD_PROJECT_DIR="${UNICLOUD_PROJECT_DIR:-luche}"
UNICLOUD_SPACE="${UNICLOUD_SPACE:-}"
PAICHE_API_BASE="${PAICHE_API_BASE:-}"
HX_CLI="${HX_CLI:-}"
SKIP_HOSTING="${SKIP_HOSTING:-0}"

if [ -z "$UNICLOUD_SPACE" ]; then
  echo "缺少 UNICLOUD_SPACE，请填支付宝云服务空间名称或 Space ID。" >&2
  exit 1
fi

if [ "$SKIP_HOSTING" != "1" ] && [ -z "$PAICHE_API_BASE" ]; then
  echo "缺少 PAICHE_API_BASE，请填 URL 化后的 paiche-api 云函数基础地址。" >&2
  echo "示例：https://xxx.bspapp.com/http/paiche-api" >&2
  echo "如只上传云函数和数据库，可设置 SKIP_HOSTING=1。" >&2
  exit 1
fi

if [ -z "$HX_CLI" ]; then
  HX_CLI="$(command -v cli || true)"
fi
if [ -z "$HX_CLI" ] && [ -x "/Applications/HBuilderX.app/Contents/MacOS/cli" ]; then
  HX_CLI="/Applications/HBuilderX.app/Contents/MacOS/cli"
fi

if [ -z "$HX_CLI" ] || [ ! -x "$HX_CLI" ]; then
  echo "未找到 HBuilderX CLI 命令 cli。" >&2
  echo "请在 HBuilderX 菜单中安装命令行工具，或执行时传入 HX_CLI=/path/to/cli。" >&2
  exit 1
fi

echo "构建前端静态资源..."
PAICHE_API_BASE="$PAICHE_API_BASE" node frontend/build.mjs

if [ -d "$UNICLOUD_PROJECT_DIR" ]; then
  echo "同步 uniCloud 资源到 HBuilderX 项目目录 $UNICLOUD_PROJECT_DIR..."
  rm -rf "$UNICLOUD_PROJECT_DIR/uniCloud-alipay/cloudfunctions/paiche-api"
  mkdir -p "$UNICLOUD_PROJECT_DIR/uniCloud-alipay/cloudfunctions" "$UNICLOUD_PROJECT_DIR/uniCloud-alipay/database"
  cp -R "uniCloud-alipay/cloudfunctions/paiche-api" "$UNICLOUD_PROJECT_DIR/uniCloud-alipay/cloudfunctions/paiche-api"
  cp "uniCloud-alipay/database/vehicle_entries.schema.json" "$UNICLOUD_PROJECT_DIR/uniCloud-alipay/database/vehicle_entries.schema.json"
fi

echo "上传 uniCloud 云函数和公共资源..."
"$HX_CLI" cloud functions --upload all --prj "$UNICLOUD_PROJECT" --provider "$UNICLOUD_PROVIDER" --force

echo "上传数据库 schema..."
"$HX_CLI" cloud functions --upload db --prj "$UNICLOUD_PROJECT" --provider "$UNICLOUD_PROVIDER" --name vehicle_entries.schema.json --force

if [ "$SKIP_HOSTING" = "1" ]; then
  echo "已跳过前端网页托管上传。拿到 PAICHE_API_BASE 后再执行完整发布。"
  exit 0
fi

echo "上传前端网页托管..."
"$HX_CLI" hosting deploy --provider "$UNICLOUD_PROVIDER" --space "$UNICLOUD_SPACE" --source "$(pwd)/dist/h5" --prefix /

echo "uniCloud 发布命令执行完成。"
