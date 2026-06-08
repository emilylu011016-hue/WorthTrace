#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
import sqlite3
from pathlib import Path

from create_demo_database import DEMO_PASSWORD, password_hash, update_setting


ROOT = Path(__file__).resolve().parents[1]
RUNTIME_DEMO_DIR = ROOT / "backups" / "demo-databases"
EXPORT_DEMO_DIR = ROOT / "database" / "demo"

BUSINESS_TABLES = [
    "raw_transactions",
    "import_batches",
    "confirmed_transactions",
    "asset_tag_links",
    "dca_plans",
    "investment_cashflows",
    "monthly_asset_snapshots",
    "credit_card_adjustments",
    "exchange_rates",
    "portfolio_target_items",
    "portfolio_targets",
    "monthly_closes",
    "monthly_report_versions",
    "audit_logs",
    "monthly_step_status",
    "credit_cards",
    "monthly_credit_card_entries",
    "monthly_dca_cashflow_overrides",
    "monthly_update_runs",
    "fx_rate_cache",
    "fx_rate_overrides",
    "monthly_fx_rate_locks",
    "template_render_logs",
    "assets",
]

ASSET_CATEGORIES = [
    ("asset_cat_bond", "债券基金", None, "main", 10),
    ("asset_cat_us_equity", "指数基金", None, "main", 20),
    ("asset_cat_gold", "黄金", None, "main", 30),
    ("asset_cat_cash", "现金", None, "main", 50),
    ("asset_sub_bond_fund", "债券基金", "asset_cat_bond", "sub", 11),
    ("asset_sub_sp500", "标普", "asset_cat_us_equity", "sub", 21),
    ("asset_sub_nasdaq", "纳斯达克", "asset_cat_us_equity", "sub", 22),
    ("asset_sub_other_us", "其他指数", "asset_cat_us_equity", "sub", 24),
    ("asset_sub_gold", "黄金", "asset_cat_gold", "sub", 31),
    ("asset_sub_cash", "现金", "asset_cat_cash", "sub", 52),
    ("asset_sub_receivable", "应收押金", "asset_cat_cash", "sub", 53),
]

ASSET_CATEGORY_TREE = [
    {
        "id": "fund",
        "label": "基金",
        "children": [
            {
                "id": "asset_cat_bond",
                "label": "债券基金",
                "children": [{"id": "asset_sub_bond_fund", "label": "债券基金", "children": []}],
            },
            {
                "id": "asset_cat_us_equity",
                "label": "指数基金",
                "children": [
                    {"id": "asset_sub_sp500", "label": "标普", "children": []},
                    {"id": "asset_sub_nasdaq", "label": "纳斯达克", "children": []},
                    {"id": "asset_sub_other_us", "label": "其他指数", "children": []},
                ],
            },
        ],
    },
    {
        "id": "cash",
        "label": "现金",
        "children": [
            {"id": "asset_sub_cash", "label": "现金", "children": []},
            {"id": "asset_sub_receivable", "label": "应收押金", "children": []},
        ],
    },
    {
        "id": "gold",
        "label": "黄金",
        "children": [{"id": "asset_sub_gold", "label": "黄金", "children": []}],
    },
]


def table_names(conn: sqlite3.Connection) -> set[str]:
    return {row[0] for row in conn.execute("select name from sqlite_master where type = 'table'")}


def reset_database(path: Path) -> None:
    conn = sqlite3.connect(path)
    try:
        existing_tables = table_names(conn)
        conn.execute("begin")
        for table in BUSINESS_TABLES:
            if table in existing_tables:
                conn.execute(f"delete from {table}")
        if "asset_categories" in existing_tables:
            conn.execute("delete from asset_categories")
            conn.executemany(
                """
                insert into asset_categories (id, name, parent_id, level, is_active, sort_order)
                values (?, ?, ?, ?, 1, ?)
                """,
                ASSET_CATEGORIES,
            )
        update_setting(conn, "official_start_date", "2026-04-30")
        update_setting(conn, "base_currency", "CNY")
        update_setting(conn, "target_saving_rate", 0.3)
        update_setting(conn, "onboarding_completed", False)
        update_setting(conn, "onboarding_asset_entry_skipped", False)
        update_setting(conn, "onboarding_allocation_targets_skipped", True)
        update_setting(conn, "dashboard_enabled_sections", ["总览", "收支储蓄", "支出结构", "资产配置", "投资表现", "月报"])
        update_setting(conn, "dashboard_custom_analysis_prompts", [])
        update_setting(conn, "dashboard_custom_allocation_targets", [])
        update_setting(conn, "asset_category_tree", ASSET_CATEGORY_TREE)
        update_setting(conn, "security_password_salt", "demo-salt")
        update_setting(conn, "security_password_hash", password_hash(DEMO_PASSWORD, "demo-salt"))
        update_setting(conn, "security_privacy_mode", False)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def main() -> None:
    runtime_work = RUNTIME_DEMO_DIR / "monthly_update_demo.sqlite3"
    runtime_dashboard = RUNTIME_DEMO_DIR / "dashboard_demo.sqlite3"
    for path in [runtime_work, runtime_dashboard]:
        if not path.exists():
            raise FileNotFoundError(f"Demo database not found: {path}")
        reset_database(path)

    EXPORT_DEMO_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(runtime_work, EXPORT_DEMO_DIR / "monthly_update_demo.sqlite3")
    shutil.copy2(runtime_dashboard, EXPORT_DEMO_DIR / "dashboard_demo.sqlite3")
    print("Demo 数据库已恢复为干净初始化状态。")


if __name__ == "__main__":
    main()
