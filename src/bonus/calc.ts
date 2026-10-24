/** 半年ごとの給与査定（ミッション達成状況シート）で、入金額から賞与・月給を予測する計算 */

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
}

/** 受注一覧の外で入る他商材の入金（マーケメディア・メイクプイなど） */
export interface Addon {
  name: string;
  amount: number;
}

export interface Mission {
  name: string;
  /** 月ごとの達成（●）。査定期間の6ヶ月分 */
  done: boolean[];
}

export interface Settings {
  /** 査定期間の最初の月（下半期なら7） */
  periodStart: number;
  addons: Addon[];
  /** 実際の月別入金額（配分後）。未入力の月は null */
  actualMonthly: (number | null)[];
  missions: Mission[];
  /** 反省文の枚数（1枚につき賞与倍率 −5%） */
  reflections: number;
  /** 賞与倍率を手入力で決めるとき（%）。null ならミッション達成から計算 */
  bonusRateOverride: number | null;
  /** 粗利率（%・参考表示） */
  grossRate: number;
  /** 賞与対象原資の率（%） */
  poolRate: number;
  /** マネジメント報酬（%）。賞与対象原資の率から差し引く */
  managementRate: number;
  grade: number;
  /** 現在の基本給 */
  baseSalary: number;
  /** 前回賞与 */
  previousBonus: number;
  /** 査定後の基本給 */
  newBaseSalary: number;
  /** 一時金 */
  lumpSum: number;
}

export const MISSION_NAMES = [
  '①売上ミッション達成',
  '②12営業日以内 新規アポ達成',
  '③5営業日以内 フォローアポ達成',
  '④有効商談率の達成（51%）',
  '⑤有効商談率の達成（33%）',
  '⑥月初計画時の目標アポ数の達成',
  '⑦勤怠・管理・休暇・資料を期限内に報告',
  '⑧クロスセル受注数達成',
  '⑨商談動画の当日投稿',
  '⑩約束の100%投稿',
];

export const DEFAULT_SETTINGS: Settings = {
  periodStart: 7,
  addons: ['マーケメディア', 'メイクプイ', 'クラウドローン', 'セールススクール'].map((name) => ({ name, amount: 0 })),
  actualMonthly: Array(PERIOD_MONTHS).fill(null),
  missions: MISSION_NAMES.map((name) => ({ name, done: Array(PERIOD_MONTHS).fill(true) })),
  reflections: 0,
  bonusRateOverride: null,
  grossRate: 66.5,
  poolRate: 20,
  managementRate: 1.2,
  grade: 0,
  baseSalary: 0,
  previousBonus: 0,
  newBaseSalary: 0,
  lumpSum: 0,
};

export type ScenarioId = 'orders' | 'stable' | 'actual';

export const SCENARIOS: { id: ScenarioId; title: string; note: string }[] = [
  { id: 'orders', title: '① 受注履歴から', note: '全受注の 配分×単月受注金額×期間内の月数' },
  { id: 'stable', title: '② 安定先のみ', note: '「安定」に印を付けた受注だけで計算' },
  { id: 'actual', title: '③ 実際の入金額から', note: '入力した月の平均で6ヶ月分を推計' },
];

/** 査定期間の n ヶ月目（0始まり）の月の名前 */
export function monthLabel(periodStart: number, i: number): string {
  return `${((periodStart - 1 + i) % 12) + 1}月`;
}

function startIndex(o: Pick<Order, 'startMonth'>): number {
  return Math.min(Math.max(Math.floor(o.startMonth) || 1, 1), PERIOD_MONTHS) - 1;
}

/** 査定期間（6ヶ月）のうち、その受注の入金がある月数 */
export function monthsInPeriod(o: Pick<Order, 'months' | 'startMonth'>): number {
  return Math.max(0, Math.min(Math.floor(o.months) || 0, PERIOD_MONTHS - startIndex(o)));
}

/** 受注履歴から見込む、その受注の期間内の入金額（配分後） */
export function expectedPayment(o: Order): number {
  return (o.share / 100) * o.monthly * monthsInPeriod(o);
}

/** 受注履歴から見込む月別の入金額（配分後） */
export function expectedMonthly(orders: Order[]): number[] {
  const out = Array<number>(PERIOD_MONTHS).fill(0);
  for (const o of orders) {
    const from = startIndex(o);
    for (let i = from; i < from + monthsInPeriod(o); i++) out[i] += (o.share / 100) * o.monthly;
  }
  return out;
}

/** 実入金の入力済みの月数 */
export function enteredMonths(actual: (number | null)[]): number {
  return actual.filter((v) => v != null).length;
}

export function scenarioPayments(orders: Order[], s: Settings, id: ScenarioId): number {
  switch (id) {
    case 'orders':
      return sum(orders.map(expectedPayment));
    case 'stable':
      return sum(orders.filter((o) => o.stable).map(expectedPayment));
    case 'actual': {
      const n = enteredMonths(s.actualMonthly);
      return n ? (sum(s.actualMonthly.map((v) => v ?? 0)) / n) * PERIOD_MONTHS : 0;
    }
  }
}

export interface BonusRate {
  achieved: number;
  total: number;
  /** 倍率（達成率％・四捨五入） */
  multiplier: number;
  /** 賞与倍率（%） */
  rate: number;
}

/**
 * 賞与倍率 = 達成率を10%単位に四捨五入 − 反省文1枚につき5%。
 * 過去シート（倍率78→80%、51/60=85→90%−反省文1枚=85%）と一致する。
 */
export function bonusRate(s: Settings): BonusRate {
  const cells = s.missions.flatMap((m) => m.done.slice(0, PERIOD_MONTHS));
  const achieved = cells.filter(Boolean).length;
  const total = cells.length;
  const multiplier = total ? Math.round((achieved / total) * 100) : 0;
  const rate = s.bonusRateOverride ?? Math.max(0, Math.round(multiplier / 10) * 10 - s.reflections * 5);
  return { achieved, total, multiplier, rate };
}

export interface Breakdown {
  /** 半年間の入金額 */
  payments: number;
  /** 他商材の加算 */
  addons: number;
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
  /** 賞与倍率（%） */
  bonusRate: number;
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
  const addons = sum(s.addons.map((a) => a.amount));
  const total = payments + addons;
  const avgMonthly = total / PERIOD_MONTHS;
  const grossProfit = avgMonthly * (s.grossRate / 100);
  const effectivePoolRate = s.poolRate - s.managementRate;
  const pool = avgMonthly * (effectivePoolRate / 100);
  const bonusTarget = pool - s.baseSalary;
  const rate = bonusRate(s).rate;
  const bonus = bonusTarget * (rate / 100);
  const lumpMonthly = s.lumpSum / PERIOD_MONTHS;
  return {
    payments,
    addons,
    total,
    avgMonthly,
    grossProfit,
    effectivePoolRate,
    pool,
    bonusTarget,
    bonusRate: rate,
    bonus,
    bonusDiff: bonus - s.previousBonus,
    lumpMonthly,
    totalSalary: s.newBaseSalary + bonus - lumpMonthly,
  };
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
