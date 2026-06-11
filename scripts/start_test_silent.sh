#!/bin/zsh
set -euo pipefail

PROJECT_DIR="/Users/emilylu/Documents/Codex/financial_planning "
REAL_DB="$HOME/Library/Application Support/com.emilylu.financial-planning/financial_planning.sqlite3"
TEST_DIR="${PROJECT_DIR}/backups/test-databases"
WORK_DB="${TEST_DIR}/monthly_update_test.sqlite3"
DASHBOARD_DB="${TEST_DIR}/dashboard_test.sqlite3"
RUNTIME_DIR="${PROJECT_DIR}/.codex-runtime"
LOG_FILE="${RUNTIME_DIR}/test-app.log"
PID_FILE="${RUNTIME_DIR}/test-app.pid"
SOURCE_APP_BUNDLE="${PROJECT_DIR}/src-tauri/target/release/bundle/macos/钱迹WorthTrace.app"
TEST_APP_DIR="$HOME/Applications"
TEST_APP_BUNDLE="${TEST_APP_DIR}/钱迹WorthTrace 测试版.app"
TEST_APP_EXEC="${TEST_APP_BUNDLE}/Contents/MacOS/financial-planning"
APP_EXEC="${SOURCE_APP_BUNDLE}/Contents/MacOS/financial-planning"

mkdir -p "$TEST_DIR" "$RUNTIME_DIR"

if [ ! -f "$REAL_DB" ]; then
  echo "找不到真实数据库：$REAL_DB"
  exit 1
fi

kill_matches() {
  local pattern="$1"
  local pids
  pids="$(pgrep -f "$pattern" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    kill $pids 2>/dev/null || true
  fi
}

OLD_PORT_PIDS="$(lsof -ti tcp:1420 2>/dev/null || true)"
if [ -n "$OLD_PORT_PIDS" ]; then
  kill $OLD_PORT_PIDS 2>/dev/null || true
fi

kill_matches 'target/debug/financial-planning'
kill_matches 'src-tauri/target/release/bundle/macos/钱迹WorthTrace.app/Contents/MacOS/financial-planning'
kill_matches '钱迹WorthTrace 测试版.app/Contents/MacOS/financial-planning'
kill_matches 'node .*/node_modules/.bin/tauri dev'
kill_matches 'npm run tauri:dev'
kill_matches '/Applications/钱迹WorthTrace.app/Contents/MacOS/financial-planning'

sleep 1

find "$TEST_DIR" -maxdepth 1 -name 'monthly_update_test_*.sqlite3' -delete
find "$TEST_DIR" -maxdepth 1 -name 'dashboard_test_*.sqlite3' -delete

if [ ! -f "$DASHBOARD_DB" ]; then
  sqlite3 "$REAL_DB" ".backup '$DASHBOARD_DB'"
fi

rm -f "$WORK_DB"
sqlite3 "$DASHBOARD_DB" ".backup '$WORK_DB'"

cd "$PROJECT_DIR"

if [ "${REBUILD_TEST_APP:-0}" = "1" ] || [ ! -x "$APP_EXEC" ]; then
  npm run tauri:build > "$LOG_FILE" 2>&1
fi

mkdir -p "$TEST_APP_DIR"
rm -rf "$TEST_APP_BUNDLE"
cp -R "$SOURCE_APP_BUNDLE" "$TEST_APP_BUNDLE"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName 钱迹WorthTrace 测试版" "$TEST_APP_BUNDLE/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleName 钱迹WorthTrace 测试版" "$TEST_APP_BUNDLE/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.emilylu.financial-planning.test" "$TEST_APP_BUNDLE/Contents/Info.plist"
xattr -dr com.apple.quarantine "$TEST_APP_BUNDLE" 2>/dev/null || true

echo "$$" > "$PID_FILE"
echo "测试 APP 前台运行中。关闭本 Codex 后台会话会关闭 APP。" > "$LOG_FILE"

exec env \
  FINANCIAL_PLANNING_WORK_DB_PATH="$WORK_DB" \
  FINANCIAL_PLANNING_DASHBOARD_DB_PATH="$DASHBOARD_DB" \
  FINANCIAL_PLANNING_DB_PATH="$WORK_DB" \
  FINANCIAL_PLANNING_ENV_LABEL="Test" \
  "$TEST_APP_EXEC"
