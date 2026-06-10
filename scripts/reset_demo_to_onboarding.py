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
    ("asset_cat_cash", "现金", None, "main", 10),
    ("asset_sub_bank_payment", "银行/支付账户", "asset_cat_cash", "sub", 11),
    ("asset_sub_money_market_cash", "货币现金", "asset_cat_cash", "sub", 12),
    ("asset_sub_receivable", "应收押金", "asset_cat_cash", "sub", 13),
    ("asset_cat_us_equity", "全球资产", None, "main", 20),
    ("asset_sub_us_market", "美股", "asset_cat_us_equity", "sub", 21),
    ("asset_sub_sp500", "标普", "asset_sub_us_market", "sub", 22),
    ("asset_sub_nasdaq", "纳斯达克", "asset_sub_us_market", "sub", 23),
    ("asset_sub_hk_market", "港股", "asset_cat_us_equity", "sub", 24),
    ("asset_sub_emerging_market", "新兴市场", "asset_cat_us_equity", "sub", 25),
    ("asset_cat_dividend_low_vol", "红利低波", None, "main", 30),
    ("asset_sub_dividend", "红利", "asset_cat_dividend_low_vol", "sub", 31),
    ("asset_sub_low_vol", "低波", "asset_cat_dividend_low_vol", "sub", 32),
    ("asset_cat_bond", "债券", None, "main", 40),
    ("asset_sub_short_bond", "短债", "asset_cat_bond", "sub", 41),
    ("asset_sub_pure_bond", "纯债", "asset_cat_bond", "sub", 42),
    ("asset_sub_treasury_bond", "国债", "asset_cat_bond", "sub", 43),
    ("asset_cat_gold", "黄金", None, "main", 50),
    ("asset_sub_gold_etf", "黄金ETF", "asset_cat_gold", "sub", 51),
    ("asset_cat_a_share", "A股权益", None, "main", 60),
    ("asset_sub_a_share_broad", "宽基", "asset_cat_a_share", "sub", 61),
    ("asset_sub_a_share_sector_active", "行业/主动", "asset_cat_a_share", "sub", 62),
    ("asset_cat_other", "其他", None, "main", 90),
    ("asset_sub_insurance_pension", "保险/养老金", "asset_cat_other", "sub", 92),
    ("asset_sub_uncategorized", "未分类", "asset_cat_other", "sub", 99),
]

ASSET_CATEGORY_TREE = [
    {
        "id": "asset_cat_cash",
        "label": "现金",
        "children": [
            {"id": "asset_sub_bank_payment", "label": "银行/支付账户", "children": []},
            {"id": "asset_sub_money_market_cash", "label": "货币现金", "children": []},
            {"id": "asset_sub_receivable", "label": "应收押金", "children": []},
        ],
    },
    {
        "id": "asset_cat_us_equity",
        "label": "全球资产",
        "children": [
            {
                "id": "asset_sub_us_market",
                "label": "美股",
                "children": [
                    {"id": "asset_sub_sp500", "label": "标普", "children": []},
                    {"id": "asset_sub_nasdaq", "label": "纳斯达克", "children": []},
                ],
            },
            {"id": "asset_sub_hk_market", "label": "港股", "children": []},
            {"id": "asset_sub_emerging_market", "label": "新兴市场", "children": []},
        ],
    },
    {
        "id": "asset_cat_dividend_low_vol",
        "label": "红利低波",
        "children": [
            {"id": "asset_sub_dividend", "label": "红利", "children": []},
            {"id": "asset_sub_low_vol", "label": "低波", "children": []},
        ],
    },
    {
        "id": "asset_cat_bond",
        "label": "债券",
        "children": [
            {"id": "asset_sub_short_bond", "label": "短债", "children": []},
            {"id": "asset_sub_pure_bond", "label": "纯债", "children": []},
            {"id": "asset_sub_treasury_bond", "label": "国债", "children": []},
        ],
    },
    {
        "id": "asset_cat_gold",
        "label": "黄金",
        "children": [
            {"id": "asset_sub_gold_etf", "label": "黄金ETF", "children": []},
        ],
    },
    {
        "id": "asset_cat_a_share",
        "label": "A股权益",
        "children": [
            {"id": "asset_sub_a_share_broad", "label": "宽基", "children": []},
            {"id": "asset_sub_a_share_sector_active", "label": "行业/主动", "children": []},
        ],
    },
    {
        "id": "asset_cat_other",
        "label": "其他",
        "children": [
            {"id": "asset_sub_insurance_pension", "label": "保险/养老金", "children": []},
            {"id": "asset_sub_uncategorized", "label": "未分类", "children": []},
        ],
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
        update_setting(conn, "onboarding_allocation_targets_skipped", False)
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
