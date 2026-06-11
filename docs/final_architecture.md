# Financial Planning App Final Architecture

## Final Data Boundary

- The production SQLite database is the single source of truth.
- Production database path:
  `~/Library/Application Support/com.emilylu.financial-planning/financial_planning.sqlite3`
- Historical data is loaded only through `2026-04`.
- `2026-05` is not preloaded. It must be entered by the user through the monthly update flow.
- Shark CSV is used for income and expense records.
- Numbers history is used for investment, assets, cashflows, and credit card history.

## Main Modules

### Monthly Update

Purpose: complete one month of accounting and asset records.

Flow:

1. Import Shark bill.
2. Confirm expenses.
3. Confirm income.
4. Enter assets.
5. Adjust credit cards.
6. Final confirmation.

Rules:

- Importing CSV only completes step 01.
- Expense confirmation completes step 02 only after save succeeds.
- Income confirmation completes step 03 only after save succeeds.
- Asset entry completes step 04 only after page-level confirmation succeeds.
- Credit card adjustment completes step 05 only after card-level entries are confirmed.
- Final report is blocked if required steps, exchange rates, category mappings, duplicates, or asset confirmations are incomplete.

### Health Dashboard

Purpose: read confirmed data and analyze financial health.

Reads:

- Confirmed income and expense from `confirmed_transactions`.
- Asset snapshots from `monthly_asset_snapshots`.
- Investment flows from `investment_cashflows`.
- Credit card net adjustment from `monthly_credit_card_entries`.
- Target allocation from `portfolio_targets` and `portfolio_target_items`.

## Database Separation

One SQLite file, separated by tables:

- Income and expenses:
  `raw_transactions`, `confirmed_transactions`, `categories`, `category_mappings`, `import_batches`.
- Assets and investment:
  `assets`, `asset_categories`, `asset_tag_links`, `tags`, `monthly_asset_snapshots`, `investment_cashflows`, `dca_plans`, `monthly_dca_cashflow_overrides`.
- Credit cards:
  `credit_cards`, `monthly_credit_card_entries`.
- Monthly state:
  `monthly_step_status`, `monthly_closes`, `monthly_report_versions`.
- Settings and targets:
  `app_settings`, `exchange_rates`, `portfolio_targets`, `portfolio_target_items`.

## DCA Rules

- If an asset has an active DCA plan, it is shown as DCA enabled.
- If historical DCA cashflow exists, the asset can be inferred as DCA-related.
- This month's DCA edits become the latest active plan for future months.
- Next month inherits the latest active plan.
- The monthly DCA calendar is generated from the latest active plan.
- Daily DCA means every weekday, skipping configured China public holidays.
- Weekly DCA generates buys on selected weekdays in the current month.
- Monthly DCA generates buys on the selected day in the current month.
- Single-day DCA overrides are stored in `monthly_dca_cashflow_overrides`.
- Confirmed DCA buys are written into `investment_cashflows` with `source_kind = 'dca_auto'`.

## Historical Import Rules

- `scripts/import_numbers_history.py` rebuilds 2025-01 to 2026-04 historical records from Numbers exports.
- `scripts/validate_numbers_db.py` verifies:
  - income,
  - expense,
  - asset gross value,
  - credit card net adjustment,
  - Numbers-style asset total.
- `scripts/export_db_check.py` exports the verification workbook.
- Historical Shark CSV import scripts are not part of the final flow.
