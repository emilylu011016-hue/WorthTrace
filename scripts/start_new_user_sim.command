#!/bin/zsh
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SIM_DIR="${PROJECT_DIR}/backups/new-user-sim"
WORK_DB="${SIM_DIR}/new_user.sqlite3"

mkdir -p "$SIM_DIR"

# 每次启动都清空，保证是真正的「新用户空库」
rm -f "$WORK_DB"

OLD_PORT_PIDS="$(lsof -ti tcp:1420 2>/dev/null || true)"
if [ -n "$OLD_PORT_PIDS" ]; then
  echo "关闭旧预览进程：$OLD_PORT_PIDS"
  kill $OLD_PORT_PIDS 2>/dev/null || true
  sleep 1
fi

OLD_APP_PIDS="$(pgrep -f 'target/debug/financial-planning' 2>/dev/null || true)"
if [ -n "$OLD_APP_PIDS" ]; then
  echo "关闭旧 App 进程：$OLD_APP_PIDS"
  kill $OLD_APP_PIDS 2>/dev/null || true
  sleep 1
fi

OLD_INSTALLED_APP_PIDS="$(pgrep -f '/Applications/钱迹WorthTrace.app/Contents/MacOS/financial-planning' 2>/dev/null || true)"
if [ -n "$OLD_INSTALLED_APP_PIDS" ]; then
  echo "关闭已安装 App 进程：$OLD_INSTALLED_APP_PIDS"
  kill $OLD_INSTALLED_APP_PIDS 2>/dev/null || true
  sleep 1
fi

export FINANCIAL_PLANNING_WORK_DB_PATH="$WORK_DB"
export FINANCIAL_PLANNING_DB_PATH="$WORK_DB"
export FINANCIAL_PLANNING_ENV_LABEL="NewUserSim"

echo "新用户模拟模式已开启。"
echo "数据库是空的，首次打开会跑初始化和 onboarding。"
echo "工作库和看板库共用同一个新数据库。"
echo "不会写入正式数据库。"
echo "数据库：$WORK_DB"

cd "$PROJECT_DIR"
npm run tauri:dev
