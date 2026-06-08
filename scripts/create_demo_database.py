#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEST_DIR = ROOT / "backups" / "test-databases"
DEMO_DIR = ROOT / "backups" / "demo-databases"


MONEY_CAP = 9999.0
DEMO_PASSWORD = "demo123456"


def stable_number(key: str, low: float, high: float) -> float:
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    ratio = int(digest[:8], 16) / 0xFFFFFFFF
    return low + (high - low) * ratio


def fake_money(value: float | int | None, key: str, minimum: float = 3.0) -> float:
    value = float(value or 0)
    if abs(value) < 0.000001:
        return 0.0
    sign = -1 if value < 0 else 1
    base = min(abs(value) * stable_number(key, 0.18, 0.36), MONEY_CAP)
    if abs(value) >= 10:
        base = max(base, minimum)
    cents = stable_number(f"{key}|cents", 0, 0.99)
    return round(sign * min(base + cents, MONEY_CAP), 2)


def password_hash(password: str, salt: str) -> str:
    digest = hashlib.sha256(f"{salt}:{password}".encode("utf-8")).digest()
    for _ in range(120_000):
        h = hashlib.sha256()
        h.update(digest)
        h.update(salt.encode("utf-8"))
        h.update(password.encode("utf-8"))
        digest = h.digest()
    return digest.hex()


def copy_sqlite(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        target.unlink()
    src = sqlite3.connect(source)
    dst = sqlite3.connect(target)
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()


def fetch_table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in conn.execute(f"pragma table_info({table})")}


def update_setting(conn: sqlite3.Connection, key: str, value) -> None:
    conn.execute(
        """
        insert into app_settings (key, value_json, updated_at)
        values (?, ?, current_timestamp)
        on conflict(key) do update set
          value_json = excluded.value_json,
          updated_at = current_timestamp
        """,
        (key, json.dumps(value, ensure_ascii=False)),
    )


def asset_demo_name(row: sqlite3.Row, index_by_group: dict[str, int]) -> str:
    main = row["main_asset_category_id"] or ""
    asset_type = row["asset_type"] or ""
    if main == "asset_cat_us_equity":
      group = "美股"
    elif main == "asset_cat_cash":
      group = "现金"
    elif main == "asset_cat_bond":
      group = "债券"
    elif main == "asset_cat_gold":
      group = "黄金"
    elif main == "asset_cat_dividend_low_vol":
      group = "红利低波"
    elif main == "asset_cat_a_share":
      group = "A股权益"
    elif main == "asset_cat_other":
      group = "其他"
    else:
      group = "资产"
    index_by_group[group] = index_by_group.get(group, 0) + 1
    return f"{group} {chr(64 + index_by_group[group]) if index_by_group[group] <= 26 else index_by_group[group]}"


def prune_demo_assets(conn: sqlite3.Connection) -> None:
    rows = conn.execute(
        """
        select
          a.id,
          a.asset_type,
          a.main_asset_category_id,
          a.sub_asset_category_id,
          coalesce((select count(*) from dca_plans dp where dp.asset_id = a.id), 0) as dca_count,
          coalesce((select max(period_month) from monthly_asset_snapshots mas where mas.asset_id = a.id), '') as latest_month,
          coalesce((select sum(abs(amount_cny)) from monthly_asset_snapshots mas where mas.asset_id = a.id), 0) as snapshot_weight
        from assets a
        order by a.name, a.id
        """
    ).fetchall()

    def pick_asset(candidates: list[sqlite3.Row], prefer_dca: bool = False) -> str | None:
        if not candidates:
            return None
        ordered = sorted(
            candidates,
            key=lambda row: (
                row["dca_count"] if prefer_dca else 0,
                row["latest_month"],
                row["snapshot_weight"],
            ),
            reverse=True,
        )
        return ordered[0]["id"]

    keep_ids: set[str] = set()
    keep_specs = [
        lambda row: row["main_asset_category_id"] == "asset_cat_us_equity",
        lambda row: row["main_asset_category_id"] == "asset_cat_bond" or row["sub_asset_category_id"] == "asset_sub_bond_fund",
        lambda row: row["main_asset_category_id"] == "asset_cat_gold",
        lambda row: row["main_asset_category_id"] == "asset_cat_cash" and row["asset_type"] != "receivable",
    ]
    for index, matcher in enumerate(keep_specs):
        candidates = [row for row in rows if matcher(row) and row["id"] not in keep_ids]
        picked = pick_asset(candidates, prefer_dca=index == 0)
        if picked:
            keep_ids.add(picked)

    if len(keep_ids) < 4:
        fallback = sorted(rows, key=lambda row: (row["latest_month"], row["snapshot_weight"]), reverse=True)
        for row in fallback:
            keep_ids.add(row["id"])
            if len(keep_ids) >= 4:
                break

    if not keep_ids:
        return

    placeholders = ",".join("?" for _ in keep_ids)
    for table in [
        "asset_tag_links",
        "dca_plans",
        "investment_cashflows",
        "monthly_asset_snapshots",
        "monthly_dca_cashflow_overrides",
    ]:
        if table in table_names(conn) and "asset_id" in fetch_table_columns(conn, table):
            conn.execute(f"delete from {table} where asset_id not in ({placeholders})", tuple(keep_ids))
    conn.execute(f"delete from assets where id not in ({placeholders})", tuple(keep_ids))


def anonymize_assets(conn: sqlite3.Connection) -> dict[str, str]:
    rows = conn.execute(
        """
        select id, name, asset_type, main_asset_category_id, sub_asset_category_id
        from assets
        order by main_asset_category_id, sub_asset_category_id, name, id
        """
    ).fetchall()
    index_by_group: dict[str, int] = {}
    names: dict[str, str] = {}
    for row in rows:
        names[row["id"]] = asset_demo_name(row, index_by_group)

    for asset_id, name in names.items():
        conn.execute(
            """
            update assets
            set name = ?,
              platform = case
                when platform is null or platform = '' then null
                when platform like '%银行%' then '银行'
                when platform like '%证券%' then '证券账户'
                else '平台 A'
              end,
              note = null,
              updated_at = current_timestamp
            where id = ?
            """,
            (name, asset_id),
        )
        conn.execute(
            "update dca_plans set name = ?, updated_at = current_timestamp where asset_id = ?",
            (f"{name} 定投计划", asset_id),
        )
    return names


def anonymize_asset_ids(conn: sqlite3.Connection) -> None:
    rows = conn.execute("select id from assets order by main_asset_category_id, sub_asset_category_id, name, id").fetchall()
    asset_ids = {row["id"]: f"demo_asset_{index:03d}" for index, row in enumerate(rows, start=1)}
    for old_id, new_id in asset_ids.items():
        for table in [
            "asset_tag_links",
            "dca_plans",
            "investment_cashflows",
            "monthly_asset_snapshots",
            "monthly_dca_cashflow_overrides",
        ]:
            if table in table_names(conn) and "asset_id" in fetch_table_columns(conn, table):
                conn.execute(f"update {table} set asset_id = ? where asset_id = ?", (new_id, old_id))
        conn.execute("update assets set id = ? where id = ?", (new_id, old_id))

    if "dca_plans" in table_names(conn):
        rows = conn.execute("select id from dca_plans order by asset_id, start_date, id").fetchall()
        dca_ids = {row["id"]: f"demo_dca_{index:03d}" for index, row in enumerate(rows, start=1)}
        for old_id, new_id in dca_ids.items():
            for table in ["investment_cashflows", "monthly_dca_cashflow_overrides"]:
                if table in table_names(conn) and "dca_plan_id" in fetch_table_columns(conn, table):
                    conn.execute(f"update {table} set dca_plan_id = ? where dca_plan_id = ?", (new_id, old_id))
            conn.execute("update dca_plans set id = ? where id = ?", (new_id, old_id))


def anonymize_asset_category_labels(conn: sqlite3.Connection) -> None:
    labels = {
        "asset_cat_cash": "现金",
        "asset_sub_bank_payment": "银行/支付账户",
        "asset_sub_money_market_cash": "货币现金",
        "asset_sub_short_deposit": "短期存款",
        "asset_cat_us_equity": "美股",
        "asset_sub_sp500": "标普",
        "asset_sub_nasdaq": "纳斯达克",
        "asset_sub_us_tech": "科技",
        "asset_sub_info_tech": "科技",
        "asset_sub_other_us": "其他",
        "asset_cat_dividend_low_vol": "红利低波",
        "asset_sub_dividend": "红利/高股息",
        "asset_sub_low_vol": "低波/红利低波",
        "asset_sub_dividend_low_vol": "低波",
        "asset_cat_bond": "债券",
        "asset_sub_short_bond": "短债/中短债",
        "asset_sub_pure_bond": "纯债/信用债",
        "asset_sub_treasury_bond": "国债/政策金融债",
        "asset_sub_bond_fund": "纯债",
        "asset_cat_gold": "黄金",
        "asset_sub_gold_etf": "黄金ETF",
        "asset_sub_gold": "黄金ETF",
        "asset_cat_a_share": "A股权益",
        "asset_sub_a_share_broad": "宽基",
        "asset_sub_a_share_sector_active": "行业/主动",
        "asset_cat_other": "其他",
        "asset_sub_receivable": "应收",
        "asset_sub_insurance_pension": "保险/养老金",
        "asset_sub_liability": "负债",
        "asset_sub_uncategorized": "未分类",
    }
    for category_id, label in labels.items():
        conn.execute("update asset_categories set name = ? where id = ?", (label, category_id))


def anonymize_categories(conn: sqlite3.Connection) -> None:
    counters = {"expense": 0, "income": 0}
    rows = conn.execute(
        "select id, category_kind, name from categories order by category_kind, sort_order, name, id"
    ).fetchall()
    for row in rows:
        kind = row["category_kind"]
        if kind not in counters:
            continue
        if row["name"] == "Numbers校准调整":
            new_name = "系统校准"
        else:
            counters[kind] += 1
            prefix = "支出类别" if kind == "expense" else "收入类别"
            new_name = f"{prefix} {counters[kind]}"
        conn.execute(
            """
            update categories
            set name = ?, created_from_raw_category = null, note = null, updated_at = current_timestamp
            where id = ?
            """,
            (new_name, row["id"]),
        )


def anonymize_category_ids(conn: sqlite3.Connection) -> None:
    rows = conn.execute("select id, category_kind from categories order by category_kind, sort_order, name, id").fetchall()
    id_map = {row["id"]: f"demo_{row['category_kind']}_category_{index:03d}" for index, row in enumerate(rows, start=1)}
    for old_id, new_id in id_map.items():
        for table, column in [
            ("categories", "parent_id"),
            ("category_mappings", "category_id"),
            ("raw_transactions", "standard_category_id"),
            ("confirmed_transactions", "category_id"),
        ]:
            if table in table_names(conn) and column in fetch_table_columns(conn, table):
                conn.execute(f"update {table} set {column} = ? where {column} = ?", (new_id, old_id))
        conn.execute("update categories set id = ? where id = ?", (new_id, old_id))

    if "category_mappings" in table_names(conn):
        rows = conn.execute("select id from category_mappings order by source_type, raw_category, id").fetchall()
        for index, row in enumerate(rows, start=1):
            conn.execute("update category_mappings set id = ? where id = ?", (f"demo_category_map_{index:03d}", row["id"]))

    if "tags" in table_names(conn):
        rows = conn.execute("select id from tags order by group_name, name, id").fetchall()
        id_map = {row["id"]: f"demo_tag_{index:03d}" for index, row in enumerate(rows, start=1)}
        for old_id, new_id in id_map.items():
            if "asset_tag_links" in table_names(conn):
                conn.execute("update asset_tag_links set tag_id = ? where tag_id = ?", (new_id, old_id))
            conn.execute("update tags set id = ? where id = ?", (new_id, old_id))


def anonymize_tags(conn: sqlite3.Connection) -> None:
    rows = conn.execute("select id from tags order by group_name, name, id").fetchall()
    for index, row in enumerate(rows, start=1):
        conn.execute(
            "update tags set name = ?, group_name = 'Demo', updated_at = current_timestamp where id = ?",
            (f"标签 {index}", row["id"]),
        )


def anonymize_transactions(conn: sqlite3.Connection) -> None:
    for table in ["raw_transactions", "confirmed_transactions"]:
        if table == "raw_transactions":
            rows = conn.execute("select id, amount from raw_transactions order by transaction_date, source_row_no, id").fetchall()
            for row in rows:
                amount = fake_money(row["amount"], f"{table}|{row['id']}")
                conn.execute(
                    """
                    update raw_transactions
                    set amount = ?,
                      raw_category = '账单分类',
                      raw_account = 'Demo账户',
                      note = '',
                      duplicate_key = case when duplicate_key is null then null else 'demo-duplicate' end
                    where id = ?
                    """,
                    (amount, row["id"]),
                )
        else:
            rows = conn.execute("select id, amount from confirmed_transactions order by transaction_date, id").fetchall()
            for row in rows:
                amount = fake_money(row["amount"], f"{table}|{row['id']}")
                conn.execute(
                    """
                    update confirmed_transactions
                    set amount = ?,
                      raw_category_snapshot = '账单分类',
                      adjustment_reason = null,
                      note = ''
                    where id = ?
                    """,
                    (amount, row["id"]),
                )


def anonymize_asset_amounts(conn: sqlite3.Connection) -> None:
    rows = conn.execute(
        "select id, original_amount, currency, fx_rate_to_cny from monthly_asset_snapshots order by period_month, asset_id, id"
    ).fetchall()
    for row in rows:
        original = fake_money(row["original_amount"], f"snapshot|{row['id']}", minimum=12)
        amount_cny = round(min(abs(original * float(row["fx_rate_to_cny"] or 1)), MONEY_CAP), 2)
        conn.execute(
            """
            update monthly_asset_snapshots
            set original_amount = ?,
              amount_cny = ?,
              note = 'Demo 月末快照'
            where id = ?
            """,
            (original, amount_cny, row["id"]),
        )

    rows = conn.execute(
        "select id, amount, fx_rate_to_cny from investment_cashflows order by period_month, flow_date, asset_id, id"
    ).fetchall()
    for row in rows:
        amount = fake_money(row["amount"], f"cashflow|{row['id']}", minimum=5)
        amount_cny = round(min(abs(amount * float(row["fx_rate_to_cny"] or 1)), MONEY_CAP), 2)
        conn.execute(
            """
            update investment_cashflows
            set amount = ?,
              amount_cny = ?,
              note = case flow_type
                when 'buy' then 'Demo 买入'
                when 'sell' then 'Demo 卖出'
                when 'dividend' then 'Demo 分红'
                else 'Demo 现金流'
              end
            where id = ?
            """,
            (amount, amount_cny, row["id"]),
        )

    rows = conn.execute("select id, amount, weekly_rules_json from dca_plans order by asset_id, id").fetchall()
    for row in rows:
        amount = fake_money(row["amount"], f"dca|{row['id']}", minimum=10)
        weekly_rules = row["weekly_rules_json"]
        if weekly_rules:
            try:
                parsed = json.loads(weekly_rules)
                if isinstance(parsed, list):
                    for idx, item in enumerate(parsed):
                        if isinstance(item, dict):
                            item["amount"] = fake_money(item.get("amount", amount), f"dca-rule|{row['id']}|{idx}", minimum=10)
                    weekly_rules = json.dumps(parsed, ensure_ascii=False)
            except json.JSONDecodeError:
                weekly_rules = None
        conn.execute(
            "update dca_plans set amount = ?, weekly_rules_json = ?, updated_at = current_timestamp where id = ?",
            (amount, weekly_rules, row["id"]),
        )

    if "monthly_dca_cashflow_overrides" in table_names(conn):
        rows = conn.execute("select id, amount from monthly_dca_cashflow_overrides order by period_month, asset_id, id").fetchall()
        for row in rows:
            conn.execute(
                "update monthly_dca_cashflow_overrides set amount = ?, note = null where id = ?",
                (fake_money(row["amount"], f"dca-override|{row['id']}", minimum=10), row["id"]),
            )


def anonymize_credit_cards(conn: sqlite3.Connection) -> None:
    rows = conn.execute("select id from credit_cards order by id").fetchall()
    for index, row in enumerate(rows, start=1):
        conn.execute(
            """
            update credit_cards
            set name = ?, institution = 'Demo银行', note = null, updated_at = current_timestamp
            where id = ?
            """,
            (f"信用卡 {index}", row["id"]),
        )

    rows = conn.execute(
        "select id, billed_amount, unbilled_amount, previous_unbilled_amount from monthly_credit_card_entries order by period_month, id"
    ).fetchall()
    for row in rows:
        billed = fake_money(row["billed_amount"], f"card-billed|{row['id']}", minimum=20)
        unbilled = fake_money(row["unbilled_amount"], f"card-unbilled|{row['id']}", minimum=20)
        previous = fake_money(row["previous_unbilled_amount"], f"card-previous|{row['id']}", minimum=20)
        net = round(-billed - unbilled + previous, 2)
        conn.execute(
            """
            update monthly_credit_card_entries
            set billed_amount = ?,
              unbilled_amount = ?,
              previous_unbilled_amount = ?,
              net_adjustment = ?,
              note = null,
              previous_unbilled_override_reason = null
            where id = ?
            """,
            (billed, unbilled, previous, net, row["id"]),
        )

    rows = conn.execute(
        "select id, current_billed_amount, current_unbilled_amount, previous_unbilled_amount from credit_card_adjustments order by period_month, id"
    ).fetchall()
    for row in rows:
        billed = fake_money(row["current_billed_amount"], f"old-card-billed|{row['id']}", minimum=20)
        unbilled = fake_money(row["current_unbilled_amount"], f"old-card-unbilled|{row['id']}", minimum=20)
        previous = fake_money(row["previous_unbilled_amount"], f"old-card-previous|{row['id']}", minimum=20)
        net = round(-billed - unbilled + previous, 2)
        conn.execute(
            """
            update credit_card_adjustments
            set current_billed_amount = ?,
              current_unbilled_amount = ?,
              previous_unbilled_amount = ?,
              net_adjustment = ?,
              note = null
            where id = ?
            """,
            (billed, unbilled, previous, net, row["id"]),
        )


def anonymize_misc(conn: sqlite3.Connection) -> None:
    update_setting(conn, "shark_csv_path", "/Demo/账单样例.xlsx")
    update_setting(conn, "security_password_salt", "demo-salt")
    update_setting(conn, "security_password_hash", password_hash(DEMO_PASSWORD, "demo-salt"))
    update_setting(conn, "security_privacy_mode", False)

    conn.execute(
        "update import_batches set file_name = 'demo_bill.xlsx', file_path = '/Demo/demo_bill.xlsx', note = 'Demo 导入样例'"
    )
    if "category_mappings" in table_names(conn):
        rows = conn.execute("select id from category_mappings order by source_type, raw_category, id").fetchall()
        for index, row in enumerate(rows, start=1):
            conn.execute(
                "update category_mappings set raw_category = ?, updated_at = current_timestamp where id = ?",
                (f"Demo分类 {index}", row["id"]),
            )
    if "audit_logs" in table_names(conn):
        conn.execute("delete from audit_logs")
    conn.execute("update monthly_report_versions set html_path = null, pdf_path = null, excel_path = null, note = 'Demo 月报'")
    conn.execute("update monthly_closes set note = 'Demo 月报已生成'")
    conn.execute("update content_templates set note = null")


def table_names(conn: sqlite3.Connection) -> set[str]:
    return {row[0] for row in conn.execute("select name from sqlite_master where type = 'table'")}


def validate_demo(conn: sqlite3.Connection) -> None:
    checks = [
        ("confirmed_transactions", "amount"),
        ("raw_transactions", "amount"),
        ("monthly_asset_snapshots", "original_amount"),
        ("monthly_asset_snapshots", "amount_cny"),
        ("investment_cashflows", "amount"),
        ("investment_cashflows", "amount_cny"),
        ("dca_plans", "amount"),
        ("monthly_credit_card_entries", "billed_amount"),
        ("monthly_credit_card_entries", "unbilled_amount"),
        ("monthly_credit_card_entries", "previous_unbilled_amount"),
        ("credit_card_adjustments", "current_billed_amount"),
        ("credit_card_adjustments", "current_unbilled_amount"),
        ("credit_card_adjustments", "previous_unbilled_amount"),
    ]
    for table, column in checks:
        if table not in table_names(conn) or column not in fetch_table_columns(conn, table):
            continue
        max_value = conn.execute(f"select coalesce(max(abs({column})), 0) from {table}").fetchone()[0]
        if float(max_value) > MONEY_CAP + 0.01:
            raise RuntimeError(f"{table}.{column} still exceeds demo cap: {max_value}")


def anonymize_database(path: Path) -> None:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("pragma foreign_keys = off")
        conn.execute("begin")
        prune_demo_assets(conn)
        anonymize_asset_ids(conn)
        anonymize_asset_category_labels(conn)
        anonymize_categories(conn)
        anonymize_tags(conn)
        anonymize_category_ids(conn)
        anonymize_assets(conn)
        anonymize_transactions(conn)
        anonymize_asset_amounts(conn)
        anonymize_credit_cards(conn)
        anonymize_misc(conn)
        validate_demo(conn)
        conn.commit()
        conn.execute("vacuum")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Create anonymized demo databases from the latest test databases.")
    parser.add_argument("--source-dir", default=str(TEST_DIR))
    parser.add_argument("--demo-dir", default=str(DEMO_DIR))
    args = parser.parse_args()

    source_dir = Path(args.source_dir)
    demo_dir = Path(args.demo_dir)
    work_source = source_dir / "monthly_update_test.sqlite3"
    dashboard_source = source_dir / "dashboard_test.sqlite3"
    work_demo = demo_dir / "monthly_update_demo.sqlite3"
    dashboard_demo = demo_dir / "dashboard_demo.sqlite3"

    if not work_source.exists() or not dashboard_source.exists():
        raise SystemExit(f"Missing test databases in {source_dir}")

    demo_dir.mkdir(parents=True, exist_ok=True)
    copy_sqlite(work_source, work_demo)
    copy_sqlite(dashboard_source, dashboard_demo)
    anonymize_database(work_demo)
    anonymize_database(dashboard_demo)

    # Keep a tiny marker for humans. It is not used by the app.
    (demo_dir / "README.txt").write_text(
        "Demo databases. Password: demo123456. Rebuild with scripts/create_demo_database.py\n",
        encoding="utf-8",
    )
    print(f"Demo work database: {work_demo}")
    print(f"Demo dashboard database: {dashboard_demo}")
    print(f"Demo password: {DEMO_PASSWORD}")


if __name__ == "__main__":
    main()
