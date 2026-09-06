# Financial Formulas

## Income, Expense, Savings

```text
savings_amount = income_total - expense_total
savings_rate = savings_amount / income_total
target_savings_amount = income_total * target_saving_rate
spend_budget = income_total - target_savings_amount
```

If income is zero, savings rate is treated as unavailable.

## Credit Card Net Adjustment

```text
credit_card_net_adjustment =
  - current_billed_amount
  - current_unbilled_amount
  + previous_unbilled_amount
```

For multiple cards:

```text
total_credit_card_net_adjustment = sum(card_net_adjustment)
```

## Asset Total

Numbers-style asset total:

```text
asset_total = asset_gross_value + credit_card_net_adjustment
```

Where:

```text
asset_gross_value = sum(monthly_asset_snapshots.amount_cny)
```

## Investment Gain

```text
monthly_investment_gain =
  ending_value
  - beginning_value
  - buys
  + sells
  + cash_dividends
```

## Yearly Money-Weighted Return (Annualized XIRR)

For each calendar year with investment activity, the annualized money-weighted
return rate is computed with XIRR over one continuous flow sequence:

```text
flows:
  -(non-cash holdings at previous year end)        dated Jan 1
  +/- each buy / sell / dividend                   dated at the actual flow_date
  +(non-cash holdings at year end)                 dated Dec 31

yearly_gain =
  ending_value - beginning_value - buys + sells + dividends

annualized_return_rate = xirr(flows)
```

Rules:

- Only non-cash assets (`main_asset_category <> 'asset_cat_cash'`) count; cash
  movements (salary, spending, transfers) are excluded.
- For the current snapshot year, the sequence runs from Jan 1 to the snapshot
  month end and is labeled "year 至今".
- Years after the snapshot month are skipped; a year with no holdings and no
  flows is skipped. If XIRR cannot be solved, the rate is treated as
  unavailable.

## Allocation

```text
current_percent = category_amount / asset_gross_value
deviation_percent = current_percent - target_percent
```

Target allocation:

| Asset Category | Target |
|---|---:|
| 美股 | 70% |
| 红利低波 | 10% |
| 黄金 | 10% |
| 债券 | 10% |
| 现金 | 0% |

