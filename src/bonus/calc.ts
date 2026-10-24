/** 半年ごとの給与査定で、入金額から賞与・月給を予測する計算 */

export const PERIOD_MONTHS = 6;

export interface Order {
  id: string;
  company: string;
  unit: string;
  /** 配分（%） */
  share: number;
  /** 単月受注金額（円） */
  monthly: number;
  /** 契約月数 */
  months: number;
  /** 査定期間の何ヶ月目から入金が始まるか（1〜6） */
  startMonth: number;
  /** 安定して入金がありそうな先か（②の予測に残す） */
  stable: boolean;
  /** 査定期間中に実際に入金された額（円・配分前）。未入力は null */
  actual: number | null;
}

export interface Settings {
  /** メイクアップ（入金額に上乗せする調整額） */
  makeup: number;
  /** 粗利率（%） */
  grossRate: number;
  /** 賞与対象原資の率（%） */
  poolRate: number;
  /** マネジメント報酬（%）。賞与対象原資の率から差し引く */
  managementRate: number;
  /** 倍率・等級（査定表の参考値） */
  multiplier: number;
  grade: number;
  /** 現在の基本給 */
  baseSalary: number;
  /** 前回賞与 */
  previousBonus: number;
  /** 賞与倍率（%） */
  bonusRate: number;
  /** 査定後の基本給 */
  newBaseSalary: number;
  /** 一時金 */
  lumpSum: number;
}

export const DEFAULT_SETTINGS: Settings = {
  makeup: 0,
  grossRate: 66.5,
  poolRate: 20,
  managementRate: 1.2,
  multiplier: 0,
  grade: 0,
  baseSalary: 0,
  previousBonus: 0,
  bonusRate: 80,
  newBaseSalary: 0,
  lumpSum: 0,
};

export type ScenarioId = 'orders' | 'stable' | 'actual';

export const SCENARIOS: { id: ScenarioId; title: string; note: string }[] = [
  { id: 'orders', title: '① 受注履歴から', note: '全受注の 配分×単月受注金額×期間内の月数' },
  { id: 'stable', title: '② 安定先のみ', note: '「安定」に印を付けた受注だけで計算' },
  { id: 'actual', title: '③ 実際の入金額から', note: '実入金額×配分（未入力の行は0円）' },
];

/** 査定期間（6ヶ月）のうち、その受注の入金がある月数 */
export function monthsInPeriod(o: Pick<Order, 'months' | 'startMonth'>): number {
  const start = Math.min(Math.max(Math.floor(o.startMonth) || 1, 1), PERIOD_MONTHS);
  return Math.max(0, Math.min(Math.floor(o.months) || 0, PERIOD_MONTHS - start + 1));
}

/** 受注履歴から見込む、その受注の期間内の入金額（配分後） */
export function expectedPayment(o: Order): number {
  return (o.share / 100) * o.monthly * monthsInPeriod(o);
}

/** 実際の入金額（配分後） */
export function actualPayment(o: Order): number {
  return (o.share / 100) * (o.actual ?? 0);
}

export function scenarioPayments(orders: Order[], id: ScenarioId): number {
  switch (id) {
    case 'orders':
      return sum(orders.map(expectedPayment));
    case 'stable':
      return sum(orders.filter((o) => o.stable).map(expectedPayment));
    case 'actual':
      return sum(orders.map(actualPayment));
  }
}

export interface Breakdown {
  /** 半年間の入金額 */
  payments: number;
  makeup: number;
  /** 合計 */
  total: number;
  /** 配分原資（平均月入金額） */
  avgMonthly: number;
  /** 給与対象原資（平均月入金額×粗利率。参考値） */
  grossProfit: number;
  /** 賞与対象原資に掛ける率（%）＝賞与対象原資の率−マネジメント報酬 */
  effectivePoolRate: number;
  /** 賞与対象原資（配分原資×実効率） */
  pool: number;
  /** 賞与対象金額（賞与対象原資−基本給） */
  bonusTarget: number;
  /** 賞与額（賞与対象金額×賞与倍率） */
  bonus: number;
  /** 前回賞与との差 */
  bonusDiff: number;
  /** 一時金の月割り */
  lumpMonthly: number;
  /** 総合計給与（査定後基本給＋賞与額−一時金月割り） */
  totalSalary: number;
}

export function calculate(payments: number, s: Settings): Breakdown {
  const total = payments + s.makeup;
  const avgMonthly = total / PERIOD_MONTHS;
  const grossProfit = avgMonthly * (s.grossRate / 100);
  const effectivePoolRate = s.poolRate - s.managementRate;
  const pool = avgMonthly * (effectivePoolRate / 100);
  const bonusTarget = pool - s.baseSalary;
  const bonus = bonusTarget * (s.bonusRate / 100);
  const lumpMonthly = s.lumpSum / PERIOD_MONTHS;
  return {
    payments,
    makeup: s.makeup,
    total,
    avgMonthly,
    grossProfit,
    effectivePoolRate,
    pool,
    bonusTarget,
    bonus,
    bonusDiff: bonus - s.previousBonus,
    lumpMonthly,
    totalSalary: s.newBaseSalary + bonus - lumpMonthly,
  };
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
