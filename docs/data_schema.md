# Data Schema Notes

## Income And Expense

### `raw_transactions`

Stores imported Shark CSV rows.

Important rules:

- Original CSV data is preserved.
- User edits do not modify raw rows.
- Duplicate detection is advisory only.

### `confirmed_transactions`

Stores confirmed income and expense records.

Important fields:

- `transaction_type`: `income` or `expense`.
- `amount`: decimal amount, keep two digits in display.
- `currency`: default `CNY`.
- `category_id`: mapped or user-selected category.
- `include_in_stats`: whether it counts toward summaries.
- `confirmation_status`: confirmation state.
- `source_kind`: imported, manual, historical, adjustment, etc.

## Assets

### `assets`

Stores the user's asset list.

Important fields:

- asset name,
- asset type,
- main category,
- sub category,
- currency,
- platform,
- tags,
- DCA enabled state,
- active/inactive status.

Inactive assets keep history but can be skipped in future months.

### `monthly_asset_snapshots`

Stores month-end asset value.

Important rules:

- One asset can have one version-1 snapshot per month.
- Future months are entered by the user in the app.
- Historical data is loaded from Numbers only through `2026-04`.

### `investment_cashflows`

Stores buys, sells, dividends, and confirmed DCA flows.

Important fields:

- `flow_type`: `buy`, `sell`, `dividend`.
- `source_kind`: `monthly_asset_entry`, `dca_auto`, `historical_numbers_cashflow`.
- `dca_plan_id`: links automatic DCA flow to the plan.

## DCA

### `dca_plans`

Stores active and inactive DCA plans.

Latest active plans are inherited by future months.

Supported frequency:

- `daily`: every weekday, skipping configured public holidays.
- `weekly`: selected weekday rules.
- `monthly`: selected day of month.

### `monthly_dca_cashflow_overrides`

Stores one-off monthly changes:

- pause this buy,
- adjust amount,
- adjust currency,
- add note.

## Credit Cards

### `credit_cards`

Stores credit card list.

### `monthly_credit_card_entries`

Stores monthly card values:

- current billed amount,
- current unbilled amount,
- previous unbilled amount,
- net adjustment,
- confirmation state.

Previous unbilled amount is carried from the prior month's current unbilled amount.

