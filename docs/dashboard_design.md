# Health Dashboard Design

## Dashboard Goal

Show confirmed monthly financial health after the monthly update is completed.

Do not show sensitive numbers on the home page. Detailed numbers belong inside the dashboard.

## Navigation

Dashboard sections:

1. Overview
2. Income, Expense, Savings
3. Expense Structure
4. Income Structure
5. Asset Allocation
6. Investment Performance
7. Monthly Report

## 1. Overview

Purpose: give a clear monthly status.

Cards:

- Net asset total.
- Income.
- Expense.
- Savings amount.
- Savings rate.
- Target savings rate comparison.
- Month close status.

Primary chart:

- Asset total trend.
- Optional overlay: savings amount.

Interactions:

- Month selector.
- Toggle: month / quarter / year.
- Click any card to jump to related section.

## 2. Income, Expense, Savings

Purpose: explain where savings came from.

Charts:

- Income vs expense by month.
- Savings amount trend.
- Savings rate trend.

Tables:

- Income category Top 4, expandable.
- Expense category Top 4, expandable.

Interactions:

- Click category to see confirmed transaction list.
- Toggle included/excluded records in detail view only.

## 3. Expense Structure

Purpose: understand spending pattern.

Charts:

- Expense category treemap or horizontal bar.
- Fixed vs flexible expense split.
- Month-over-month category change.

Alerts:

- Large expense.
- Unusual category increase.
- New auto-created category.

Interactions:

- Category drill-down.
- Filter by category, date, amount.

## 4. Income Structure

Purpose: understand income sources.

Modules:

- Salary.
- Part-time income.
- Red packets.
- Cashback.
- Second-hand sales.
- Other income.
- Non-salary income.

Charts:

- Income category share.
- Salary trend.
- Non-salary trend.
- Top income categories.
- Current month vs previous month.

## 5. Asset Allocation

Purpose: compare actual allocation with target.

Charts:

- Current allocation vs target.
- Deviation bar chart.
- Asset class trend.

Tables:

- Asset list.
- Month-end value.
- Buy/sell/dividend.
- DCA status.

Interactions:

- Click asset category to show assets inside it.
- Click asset to show monthly cashflows and DCA calendar.

## 6. Investment Performance

Purpose: show investment result without mixing it with spending.

Charts:

- Monthly investment gain.
- Buy/sell/dividend cashflow timeline.
- Asset contribution.

Metrics:

- Beginning value.
- Ending value.
- Buys.
- Sells.
- Dividends.
- Investment gain.

Interactions:

- Toggle include DCA / manual flows / dividends.
- Asset filter.

## 7. Monthly Report

Purpose: produce a readable monthly summary.

Content:

- This month's summary.
- Key changes.
- Main spending drivers.
- Asset allocation drift.
- Investment performance.
- Next month reminders.

Rules:

- Report can be generated only after final confirmation.
- If required data is missing, show blocked reasons and jump links.
