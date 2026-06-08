#!/bin/zsh
unset FINANCIAL_PLANNING_WORK_DB_PATH
unset FINANCIAL_PLANNING_DASHBOARD_DB_PATH
unset FINANCIAL_PLANNING_DB_PATH

echo "正式 V1 模式启动。"
echo "使用正式数据库：$HOME/Library/Application Support/com.emilylu.financial-planning/financial_planning.sqlite3"

cd "/Users/emilylu/Documents/Codex/financial_planning " || exit 1
npm run tauri:dev
