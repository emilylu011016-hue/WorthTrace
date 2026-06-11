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

