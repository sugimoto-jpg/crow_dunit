import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, calculate, expectedPayment, monthsInPeriod, scenarioPayments, type Order } from '../calc';

const order = (patch: Partial<Order>): Order => ({
  id: 'x', company: 'A社', unit: '営業支援', share: 100, monthly: 100_000, months: 12, startMonth: 1, stable: true, actual: null, ...patch,
});

describe('monthsInPeriod', () => {
  it('caps at the 6-month period and respects the start month', () => {
    expect(monthsInPeriod({ months: 12, startMonth: 1 })).toBe(6);
    expect(monthsInPeriod({ months: 3, startMonth: 1 })).toBe(3);
    expect(monthsInPeriod({ months: 12, startMonth: 5 })).toBe(2);
    expect(monthsInPeriod({ months: 0, startMonth: 1 })).toBe(0);
  });
});

describe('scenarios', () => {
  const orders = [
    order({ share: 50, monthly: 200_000, months: 6 }), // 600,000
    order({ share: 100, monthly: 100_000, months: 3, stable: false, actual: 200_000 }), // 300,000 / 実 200,000
  ];
  it('sums expected, stable-only and actual payments', () => {
    expect(expectedPayment(orders[0])).toBe(600_000);
    expect(scenarioPayments(orders, 'orders')).toBe(900_000);
    expect(scenarioPayments(orders, 'stable')).toBe(600_000);
    expect(scenarioPayments(orders, 'actual')).toBe(200_000);
  });
});

describe('calculate', () => {
  it('follows the review sheet: average → gross 66.5% → pool 20% → minus base → ×bonus rate', () => {
    const s = { ...DEFAULT_SETTINGS, makeup: 500_000, baseSalary: 345_000, newBaseSalary: 348_500, lumpSum: 50_000, previousBonus: 103_431 };
    const b = calculate(1_638_450, s);
    expect(b.total).toBe(2_138_450);
    expect(b.avgMonthly).toBeCloseTo(356_408.33, 2);
    expect(b.grossProfit).toBeCloseTo(237_011.54, 2);
    expect(b.pool).toBeCloseTo(47_402.31, 2);
    expect(b.bonusTarget).toBeCloseTo(-297_597.69, 2);
    expect(b.bonus).toBeCloseTo(-238_078.15, 2);
    expect(b.lumpMonthly).toBeCloseTo(8_333.33, 2);
    expect(b.totalSalary).toBeCloseTo(348_500 - 238_078.15 - 8_333.33, 1);
  });
});
