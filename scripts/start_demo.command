#!/bin/zsh
set -euo pipefail

PROJECT_DIR="/Users/emilylu/Documents/Codex/financial_planning "
DEMO_DIR="${PROJECT_DIR}/backups/demo-databases"
WORK_DB="${DEMO_DIR}/monthly_update_demo.sqlite3"
DASHBOARD_DB="${DEMO_DIR}/dashboard_demo.sqlite3"

if [ ! -f "$WORK_DB" ] || [ ! -f "$DASHBOARD_DB" ]; then
  echo "找不到 demo 数据库，先创建脱敏 demo 数据库。"
  cd "$PROJECT_DIR"
  python3 scripts/create_demo_database.py
fi

cd "$PROJECT_DIR"

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

OLD_INSTALLED_APP_PIDS="$(pgrep -f '/Applications/Financial Planning.app/Contents/MacOS/financial-planning' 2>/dev/null || true)"
if [ -n "$OLD_INSTALLED_APP_PIDS" ]; then
  echo "关闭已安装 App 进程：$OLD_INSTALLED_APP_PIDS"
  kill $OLD_INSTALLED_APP_PIDS 2>/dev/null || true
  sleep 1
fi

export FINANCIAL_PLANNING_WORK_DB_PATH="$WORK_DB"
export FINANCIAL_PLANNING_DASHBOARD_DB_PATH="$DASHBOARD_DB"
export FINANCIAL_PLANNING_DB_PATH="$WORK_DB"
export FINANCIAL_PLANNING_ENV_LABEL="Demo"

echo "Demo 模式已开启。"
echo "正式数据库不会被写入。"
echo "测试数据库不会被写入。"
echo "Demo 月更工作库：$WORK_DB"
echo "Demo 看板发布库：$DASHBOARD_DB"
echo "Demo 密码：demo123456"

npm run tauri:dev
