import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  PERIOD_MONTHS,
  bonusRate,
  calculate,
  expectedMonthly,
  expectedPayment,
  monthLabel,
  monthsInPeriod,
  scenarioPayments,
  type Order,
  type Settings,
} from '../calc';

const order = (patch: Partial<Order>): Order => ({
  id: 'x', company: 'A社', unit: '営業支援', share: 100, monthly: 100_000, months: 12, startMonth: 1, stable: true, ...patch,
});
const settings = (patch: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, ...patch });
const addons = (meikupui: number) => DEFAULT_SETTINGS.addons.map((a) => ({ ...a, amount: a.name === 'メイクプイ' ? meikupui : 0 }));
/** 10ミッション×6ヶ月のうち、先頭から achieved 個を達成にする */
const missions = (achieved: number) =>
  DEFAULT_SETTINGS.missions.map((m, i) => ({ ...m, done: Array.from({ length: PERIOD_MONTHS }, (_, j) => i * PERIOD_MONTHS + j < achieved) }));

describe('monthsInPeriod', () => {
  it('caps at the 6-month period and respects the start month', () => {
    expect(monthsInPeriod({ months: 12, startMonth: 1 })).toBe(6);
    expect(monthsInPeriod({ months: 3, startMonth: 1 })).toBe(3);
    expect(monthsInPeriod({ months: 12, startMonth: 5 })).toBe(2);
    expect(monthsInPeriod({ months: 0, startMonth: 1 })).toBe(0);
  });
  it('labels months from the period start', () => {
    expect(monthLabel(7, 0)).toBe('7月');
    expect(monthLabel(7, 5)).toBe('12月');
    expect(monthLabel(10, 4)).toBe('2月');
  });
});

describe('scenarios', () => {
  const orders = [
    order({ share: 50, monthly: 200_000, months: 6 }), // 600,000
    order({ share: 100, monthly: 100_000, months: 3, startMonth: 2, stable: false }), // 300,000
  ];
  it('sums expected and stable-only payments', () => {
    expect(expectedPayment(orders[0])).toBe(600_000);
    expect(scenarioPayments(orders, DEFAULT_SETTINGS, 'orders')).toBe(900_000);
    expect(scenarioPayments(orders, DEFAULT_SETTINGS, 'stable')).toBe(600_000);
    expect(expectedMonthly(orders)).toEqual([100_000, 200_000, 200_000, 200_000, 100_000, 100_000]);
  });
  it('extrapolates actual payments from the entered months', () => {
    const s = settings({ actualMonthly: [100_000, 300_000, null, null, null, null] });
    expect(scenarioPayments(orders, s, 'actual')).toBe(1_200_000);
    expect(scenarioPayments(orders, DEFAULT_SETTINGS, 'actual')).toBe(0);
  });
});

describe('bonusRate', () => {
  it('rounds the achievement to 10% and takes 5% per reflection', () => {
    expect(bonusRate(settings({ missions: missions(51), reflections: 1 }))).toEqual({ achieved: 51, total: 60, multiplier: 85, rate: 85 });
    expect(bonusRate(settings({ missions: missions(47) })).multiplier).toBe(78);
    expect(bonusRate(settings({ missions: missions(47) })).rate).toBe(80);
    expect(bonusRate(settings({ bonusRateOverride: 70 })).rate).toBe(70);
  });
});

describe('calculate', () => {
  it('reproduces the 2025 second-half review sheet', () => {
    const s = settings({
      actualMonthly: [2_331_779, 3_014_217, 3_264_271, 2_036_784, 2_252_683, 2_233_207],
      addons: addons(1_311_186),
      missions: missions(51),
      reflections: 1,
      baseSalary: 345_000,
      previousBonus: 112_927,
      newBaseSalary: 348_500,
      lumpSum: 50_000,
    });
    const b = calculate(scenarioPayments([], s, 'actual'), s);
    expect(Math.round(b.avgMonthly)).toBe(2_740_688);
    expect(Math.round(b.pool)).toBe(515_249);
    expect(Math.round(b.bonusTarget)).toBe(170_249);
    expect(b.bonusRate).toBe(85);
    expect(Math.round(b.bonus)).toBe(144_712);
    expect(Math.round(b.lumpMonthly)).toBe(8_333);
    expect(Math.round(b.totalSalary)).toBe(484_879);
  });

  it('reproduces the first example: pool = average × (20% − management 1.2%)', () => {
    const s = settings({ addons: addons(500_000), missions: missions(47), baseSalary: 345_000, newBaseSalary: 348_500, lumpSum: 50_000 });
    const b = calculate(1_638_450, s);
    expect(Math.round(b.avgMonthly)).toBe(356_408);
    expect(Math.round(b.pool)).toBe(67_005);
    expect(Math.round(b.bonusTarget)).toBe(-277_995);
    expect(b.bonusRate).toBe(80);
    expect(Math.round(b.bonus)).toBe(-222_396);
    expect(Math.round(b.totalSalary)).toBe(117_770);
  });
});
