export type Money = number;

export type Cashflow = {
  date: string;
  amount: Money;
};

export type AllocationItem = {
  key: string;
  label: string;
  currentAmount: Money;
  targetPercent: number;
};

export type AllocationResult = AllocationItem & {
  currentPercent: number;
  deviationPercent: number;
};

export function calculateSavingsRate(income: Money, expense: Money): number | null {
  if (income <= 0) return null;
  return (income - expense) / income;
}

export function calculateSpendBudget(income: Money, targetSavingsRate: number): {
  idealSavings: Money;
  spendBudget: Money;
} {
  const idealSavings = income * targetSavingsRate;
  return {
    idealSavings,
    spendBudget: income - idealSavings
  };
}

export function calculateCreditCardNetAdjustment(input: {
  currentBilledAmount: Money;
  currentUnbilledAmount: Money;
  previousUnbilledAmount: Money;
}): Money {
  return (
    -input.currentBilledAmount -
    input.currentUnbilledAmount +
    input.previousUnbilledAmount
  );
}

export function calculateNetWorth(assetGrossValue: Money, creditCardNetAdjustment: Money): Money {
  return assetGrossValue + creditCardNetAdjustment;
}

export function calculateAllocation(items: AllocationItem[]): AllocationResult[] {
  const total = items.reduce((sum, item) => sum + item.currentAmount, 0);

  return items.map((item) => {
    const currentPercent = total > 0 ? item.currentAmount / total : 0;
    return {
      ...item,
      currentPercent,
      deviationPercent: currentPercent - item.targetPercent
    };
  });
}

export function calculateMonthlyInvestmentGain(input: {
  beginningValue: Money;
  endingValue: Money;
  buys: Money;
  sells: Money;
  cashDividends: Money;
}): Money {
  return (
    input.endingValue -
    input.beginningValue -
    input.buys +
    input.sells +
    input.cashDividends
  );
}

export function annualizedToPeriodReturn(annualizedReturn: number, days: number): number {
  return Math.pow(1 + annualizedReturn, days / 365) - 1;
}

export function xirr(cashflows: Cashflow[], guess = 0.1): number {
  const flows = cashflows
    .map((flow) => ({
      date: new Date(`${flow.date}T00:00:00`),
      amount: flow.amount
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (flows.length < 2) {
    throw new Error("XIRR requires at least two cashflows.");
  }

  const hasPositive = flows.some((flow) => flow.amount > 0);
  const hasNegative = flows.some((flow) => flow.amount < 0);
  if (!hasPositive || !hasNegative) {
    throw new Error("XIRR requires at least one positive and one negative cashflow.");
  }

  const firstDate = flows[0].date.getTime();
  const npv = (rate: number) =>
    flows.reduce((sum, flow) => {
      const days = (flow.date.getTime() - firstDate) / 86_400_000;
      return sum + flow.amount / Math.pow(1 + rate, days / 365);
    }, 0);

  const derivative = (rate: number) =>
    flows.reduce((sum, flow) => {
      const days = (flow.date.getTime() - firstDate) / 86_400_000;
      const years = days / 365;
      return sum - (years * flow.amount) / Math.pow(1 + rate, years + 1);
    }, 0);

  let rate = guess;
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const value = npv(rate);
    if (Math.abs(value) < 1e-7) return rate;

    const slope = derivative(rate);
    if (Math.abs(slope) < 1e-12) break;

    const next = rate - value / slope;
    if (!Number.isFinite(next) || next <= -0.999999) break;
    if (Math.abs(next - rate) < 1e-10) return next;
    rate = next;
  }

  throw new Error("XIRR did not converge.");
}
