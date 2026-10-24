import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INPUTS,
  DEFAULT_RULES,
  PERIOD_MONTHS,
  bonusRate,
  calculate,
  expectedMonthly,
  expectedPayment,
  judge,
  monthLabel,
  monthsInPeriod,
  scenarioPayments,
  cloneMissions,
  tallyMonth,
  type Inputs,
  type Mission,
  type Order,
} from '../calc';

const order = (patch: Partial<Order>): Order => ({
  id: 'x', company: 'A社', unit: '営業支援', share: 100, monthly: 100_000, months: 12, startMonth: 1, stable: true, ...patch,
});
const inputs = (patch: Partial<Inputs>): Inputs => ({ ...DEFAULT_INPUTS, ...patch });
const checkRules = DEFAULT_RULES;
const check = (actual: number | null): Mission => ({ id: crypto.randomUUID(), name: 'm', kind: 'check', target: null, unit: '', actual });
/** 毎月10個のチェック型ミッションで、先頭から achieved マスを●、残りを×にする */
const records = (achieved: number): Inputs['monthMissions'] =>
  Array.from({ length: PERIOD_MONTHS }, (_, j) => Array.from({ length: 10 }, (_, k) => check(j * 10 + k < achieved ? 1 : 0)));
const addons = (meikupui: number) => DEFAULT_RULES.addonNames.map((n) => (n === 'メイクプイ' ? meikupui : 0));

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
    expect(scenarioPayments(orders, DEFAULT_INPUTS, 'orders')).toBe(900_000);
    expect(scenarioPayments(orders, DEFAULT_INPUTS, 'stable')).toBe(600_000);
    expect(expectedMonthly(orders)).toEqual([100_000, 200_000, 200_000, 200_000, 100_000, 100_000]);
  });
  it('extrapolates actual payments from the entered months', () => {
    expect(scenarioPayments(orders, inputs({ actualMonthly: [100_000, 300_000, null, null, null, null] }), 'actual')).toBe(1_200_000);
    expect(scenarioPayments(orders, DEFAULT_INPUTS, 'actual')).toBe(0);
  });
});

describe('judge', () => {
  const sales = (actual: number | null, target: number | null = 1_000_000): Mission => ({ id: 's', name: '売上', kind: 'gte', target, unit: '円', actual });
  const late = (actual: number): Mission => ({ id: 'l', name: '遅刻', kind: 'lte', target: 0, unit: '回', actual });
  it('compares the actual value with the target', () => {
    expect(judge(sales(1_000_000))).toBe(true);
    expect(judge(sales(999_999))).toBe(false);
    expect(judge(late(0))).toBe(true);
    expect(judge(late(1))).toBe(false);
    expect(judge(sales(null))).toBeNull();
    expect(judge(sales(5, null))).toBeNull();
    expect(judge(check(1))).toBe(true);
    expect(judge(check(0))).toBe(false);
  });
  it('tallies a month and copies missions without their actual values', () => {
    expect(tallyMonth([sales(2_000_000), sales(1), check(null)])).toEqual({ achieved: 1, failed: 1, missing: 1 });
    const copied = cloneMissions([sales(2_000_000)]);
    expect(copied[0]).toMatchObject({ name: '売上', target: 1_000_000, actual: null });
    expect(copied[0].id).not.toBe('s');
  });
});

describe('bonusRate', () => {
  it('rounds the achievement to 10% and takes 5% per reflection', () => {
    expect(bonusRate(checkRules, inputs({ monthMissions: records(51), reflections: 1 }))).toEqual({ achieved: 51, total: 60, missing: 0, multiplier: 85, rate: 85 });
    expect(bonusRate(checkRules, inputs({ monthMissions: records(47) }))).toMatchObject({ multiplier: 78, rate: 80 });
    expect(bonusRate(checkRules, inputs({ bonusRateOverride: 70 })).rate).toBe(70);
  });
  it('follows the rules from the settings sheet', () => {
    const i = inputs({ monthMissions: records(47), reflections: 1 });
    expect(bonusRate({ ...checkRules, roundingUnit: 5, reflectionPenalty: 10 }, i).rate).toBe(70);
    expect(bonusRate({ ...checkRules, roundingUnit: 0 }, i).rate).toBe(73);
  });
  it('counts the missions of each month, even when the number of missions differs', () => {
    const i = inputs({ monthMissions: [[check(1), check(1), check(0)], [check(1)], [], [], [], []] });
    expect(bonusRate(checkRules, i)).toMatchObject({ achieved: 3, total: 4, multiplier: 75, rate: 80 });
  });
  it('counts unentered missions by the missing-month policy', () => {
    const i = inputs({ monthMissions: [[check(1), check(0), ...Array.from({ length: 58 }, () => check(null))], [], [], [], [], []] });
    expect(bonusRate(checkRules, i)).toMatchObject({ achieved: 1, total: 2, missing: 58, multiplier: 50 });
    expect(bonusRate({ ...checkRules, missingPolicy: 'achieved' }, i)).toMatchObject({ achieved: 59, total: 60 });
    expect(bonusRate({ ...checkRules, missingPolicy: 'failed' }, i)).toMatchObject({ achieved: 1, total: 60 });
  });
});

describe('calculate', () => {
  it('reproduces the 2025 second-half review sheet', () => {
    const i = inputs({
      actualMonthly: [2_331_779, 3_014_217, 3_264_271, 2_036_784, 2_252_683, 2_233_207],
      addons: addons(1_311_186),
      monthMissions: records(51),
      reflections: 1,
      baseSalary: 345_000,
      previousBonus: 112_927,
      newBaseSalary: 348_500,
      lumpSum: 50_000,
    });
    const b = calculate(scenarioPayments([], i, 'actual'), checkRules, i);
    expect(Math.round(b.avgMonthly)).toBe(2_740_688);
    expect(Math.round(b.pool)).toBe(515_249);
    expect(Math.round(b.bonusTarget)).toBe(170_249);
    expect(b.bonusRate).toBe(85);
    expect(Math.round(b.bonus)).toBe(144_712);
    expect(Math.round(b.lumpMonthly)).toBe(8_333);
    expect(Math.round(b.totalSalary)).toBe(484_879);
  });

  it('reproduces the first example: pool = average × (20% − management 1.2%)', () => {
    const i = inputs({ addons: addons(500_000), monthMissions: records(47), baseSalary: 345_000, newBaseSalary: 348_500, lumpSum: 50_000 });
    const b = calculate(1_638_450, checkRules, i);
    expect(Math.round(b.avgMonthly)).toBe(356_408);
    expect(Math.round(b.pool)).toBe(67_005);
    expect(Math.round(b.bonusTarget)).toBe(-277_995);
    expect(b.bonusRate).toBe(80);
    expect(Math.round(b.bonus)).toBe(-222_396);
    expect(Math.round(b.totalSalary)).toBe(117_770);
  });
});
