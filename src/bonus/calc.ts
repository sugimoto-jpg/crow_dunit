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

/** 判定の仕方：実数が目標以上で達成 / 目標以下で達成 / ●×を手で付ける */
export type MissionKind = 'gte' | 'lte' | 'check';

/** ミッションの定義（設定のテンプレートに使う） */
export interface MissionDef {
  id: string;
  name: string;
  kind: MissionKind;
  /** 目標値 */
  target: number | null;
  unit: string;
}

/** ある月のミッション。ミッションは毎月変わるので、月ごとに項目・目標・実数を持つ */
export interface Mission extends MissionDef {
  /** 実数（チェック型は 1=● / 0=×）。未入力は null */
  actual: number | null;
}

/** 実数が未入力のミッションをどう数えるか */
export type MissingPolicy = 'exclude' | 'achieved' | 'failed';

/** 設定シート：会社のルール。あとから変えられる */
export interface Rules {
  /** 査定期間の最初の月（下半期なら7） */
  periodStart: number;
  /** 賞与対象原資の率（%） */
  poolRate: number;
  /** マネジメント報酬（%）。賞与対象原資の率から差し引く */
  managementRate: number;
  /** 粗利率（%・参考表示） */
  grossRate: number;
  /** 賞与倍率を何%単位に四捨五入するか（0なら四捨五入しない） */
  roundingUnit: number;
  /** 反省文1枚あたりの減額（%） */
  reflectionPenalty: number;
  missingPolicy: MissingPolicy;
  /** 新しい月に読み込むミッションのテンプレート */
  missionTemplate: MissionDef[];
  /** 他商材の名前 */
  addonNames: string[];
}

/** 今期の入力 */
export interface Inputs {
  /** 実際の月別入金額（配分後）。未入力の月は null */
  actualMonthly: (number | null)[];
  /** 他商材の半年分の入金（addonNames と同じ並び） */
  addons: number[];
  /** 月ごとのミッション（6ヶ月分） */
  monthMissions: Mission[][];
  /** 反省文の枚数 */
  reflections: number;
  /** 賞与倍率を手入力で決めるとき（%）。null ならミッション表から計算 */
  bonusRateOverride: number | null;
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

const blank = <T,>(v: T): T[] => Array(PERIOD_MONTHS).fill(v);
const def = (id: string, name: string, kind: MissionKind = 'check', target: number | null = null, unit = ''): MissionDef => ({ id, name, kind, target, unit });

export const DEFAULT_RULES: Rules = {
  periodStart: 7,
  poolRate: 20,
  managementRate: 1.2,
  grossRate: 66.5,
  roundingUnit: 10,
  reflectionPenalty: 5,
  missingPolicy: 'exclude',
  missionTemplate: [
    def('m1', '①売上ミッション達成', 'gte', null, '円'),
    def('m2', '②12営業日以内 新規アポ達成'),
    def('m3', '③5営業日以内 フォローアポ達成'),
    def('m4', '④有効商談率の達成（51%）', 'gte', 51, '%'),
    def('m5', '⑤有効商談率の達成（33%）', 'gte', 33, '%'),
    def('m6', '⑥月初計画時の目標アポ数の達成'),
    def('m7', '⑦勤怠・管理・休暇・資料を期限内に報告'),
    def('m8', '⑧クロスセル受注数達成'),
    def('m9', '⑨商談動画の当日投稿'),
    def('m10', '⑩約束の100%投稿'),
  ],
  addonNames: ['マーケメディア', 'メイクプイ', 'クラウドローン', 'セールススクール'],
};

export const DEFAULT_INPUTS: Inputs = {
  actualMonthly: blank(null),
  addons: [0, 0, 0, 0],
  monthMissions: Array.from({ length: PERIOD_MONTHS }, () => []),
  reflections: 0,
  bonusRateOverride: null,
  grade: 0,
  baseSalary: 0,
  previousBonus: 0,
  newBaseSalary: 0,
  lumpSum: 0,
};

/** テンプレートや前月の項目から、その月のミッションを作る（実数は空にする） */
export function cloneMissions(defs: MissionDef[]): Mission[] {
  return defs.map(({ name, kind, target, unit }) => ({ id: crypto.randomUUID(), name, kind, target, unit, actual: null }));
}

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
  const out = blank(0);
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

export function scenarioPayments(orders: Order[], inputs: Inputs, id: ScenarioId): number {
  switch (id) {
    case 'orders':
      return sum(orders.map(expectedPayment));
    case 'stable':
      return sum(orders.filter((o) => o.stable).map(expectedPayment));
    case 'actual': {
      const n = enteredMonths(inputs.actualMonthly);
      return n ? (sum(inputs.actualMonthly.map((v) => v ?? 0)) / n) * PERIOD_MONTHS : 0;
    }
  }
}

/** ミッションを達成したか。判定できないとき（未入力・目標なし）は null */
export function judge(m: Mission): boolean | null {
  if (m.actual == null) return null;
  if (m.kind === 'check') return m.actual > 0;
  if (m.target == null) return null;
  return m.kind === 'gte' ? m.actual >= m.target : m.actual <= m.target;
}

export interface MonthTally {
  achieved: number;
  failed: number;
  missing: number;
}

export function tallyMonth(missions: Mission[]): MonthTally {
  const t = { achieved: 0, failed: 0, missing: 0 };
  for (const m of missions) {
    const r = judge(m);
    if (r == null) t.missing++;
    else if (r) t.achieved++;
    else t.failed++;
  }
  return t;
}

export interface BonusRate {
  achieved: number;
  /** 達成率の分母（数えたマスの数） */
  total: number;
  /** 判定できなかったマスの数 */
  missing: number;
  /** 倍率（達成率％・四捨五入） */
  multiplier: number;
  /** 賞与倍率（%） */
  rate: number;
}

/**
 * 賞与倍率 = 達成率を roundingUnit 単位に四捨五入 − 反省文 × reflectionPenalty。
 * 過去シート（倍率78→80%、51/60=85→90%−反省文1枚=85%）と一致する。
 */
export function bonusRate(rules: Rules, inputs: Inputs): BonusRate {
  let achieved = 0;
  let total = 0;
  let missing = 0;
  for (const missions of inputs.monthMissions.slice(0, PERIOD_MONTHS)) {
    const t = tallyMonth(missions);
    achieved += t.achieved + (rules.missingPolicy === 'achieved' ? t.missing : 0);
    total += t.achieved + t.failed + (rules.missingPolicy === 'exclude' ? 0 : t.missing);
    missing += t.missing;
  }
  const multiplier = total ? Math.round((achieved / total) * 100) : 0;
  const rounded = rules.roundingUnit > 0 ? Math.round(multiplier / rules.roundingUnit) * rules.roundingUnit : multiplier;
  const rate = inputs.bonusRateOverride ?? Math.max(0, rounded - inputs.reflections * rules.reflectionPenalty);
  return { achieved, total, missing, multiplier, rate };
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

export function calculate(payments: number, rules: Rules, inputs: Inputs): Breakdown {
  const addons = sum(inputs.addons.slice(0, rules.addonNames.length));
  const total = payments + addons;
  const avgMonthly = total / PERIOD_MONTHS;
  const grossProfit = avgMonthly * (rules.grossRate / 100);
  const effectivePoolRate = rules.poolRate - rules.managementRate;
  const pool = avgMonthly * (effectivePoolRate / 100);
  const bonusTarget = pool - inputs.baseSalary;
  const rate = bonusRate(rules, inputs).rate;
  const bonus = bonusTarget * (rate / 100);
  const lumpMonthly = inputs.lumpSum / PERIOD_MONTHS;
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
    bonusDiff: bonus - inputs.previousBonus,
    lumpMonthly,
    totalSalary: inputs.newBaseSalary + bonus - lumpMonthly,
  };
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
