#!/bin/zsh
set -euo pipefail

PROJECT_DIR="/Users/emilylu/Documents/Codex/financial_planning "
REAL_DB="$HOME/Library/Application Support/com.emilylu.financial-planning/financial_planning.sqlite3"
TEST_DIR="${PROJECT_DIR}/backups/test-databases"
WORK_DB="${TEST_DIR}/monthly_update_test.sqlite3"
DASHBOARD_DB="${TEST_DIR}/dashboard_test.sqlite3"

mkdir -p "$TEST_DIR"

if [ ! -f "$REAL_DB" ]; then
  echo "找不到真实数据库：$REAL_DB"
  exit 1
fi

OLD_PORT_PIDS="$(lsof -ti tcp:1420 2>/dev/null || true)"
if [ -n "$OLD_PORT_PIDS" ]; then
  echo "关闭旧测试预览进程：$OLD_PORT_PIDS"
  kill $OLD_PORT_PIDS 2>/dev/null || true
  sleep 1
fi

OLD_APP_PIDS="$(pgrep -f 'target/debug/financial-planning' 2>/dev/null || true)"
if [ -n "$OLD_APP_PIDS" ]; then
  echo "关闭旧测试 App 进程：$OLD_APP_PIDS"
  kill $OLD_APP_PIDS 2>/dev/null || true
  sleep 1
fi

OLD_INSTALLED_APP_PIDS="$(pgrep -f '/Applications/钱迹WorthTrace.app/Contents/MacOS/financial-planning' 2>/dev/null || true)"
if [ -n "$OLD_INSTALLED_APP_PIDS" ]; then
  echo "关闭已安装正式 App 进程：$OLD_INSTALLED_APP_PIDS"
  kill $OLD_INSTALLED_APP_PIDS 2>/dev/null || true
  sleep 1
fi

find "$TEST_DIR" -maxdepth 1 -name 'monthly_update_test_*.sqlite3' -delete
find "$TEST_DIR" -maxdepth 1 -name 'dashboard_test_*.sqlite3' -delete

if [ ! -f "$DASHBOARD_DB" ]; then
  sqlite3 "$REAL_DB" ".backup '$DASHBOARD_DB'"
fi

rm -f "$WORK_DB"
sqlite3 "$DASHBOARD_DB" ".backup '$WORK_DB'"

export FINANCIAL_PLANNING_WORK_DB_PATH="$WORK_DB"
export FINANCIAL_PLANNING_DASHBOARD_DB_PATH="$DASHBOARD_DB"
export FINANCIAL_PLANNING_DB_PATH="$WORK_DB"
export FINANCIAL_PLANNING_ENV_LABEL="Test"

echo "测试模式已开启。"
echo "真实数据库不会被写入。"
echo "月更工作库固定为：$WORK_DB"
echo "看板发布库固定为：$DASHBOARD_DB"

cd "$PROJECT_DIR"
npm run tauri:dev
