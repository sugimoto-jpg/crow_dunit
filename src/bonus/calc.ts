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
  /** 受注した月（YYYY-MM） */
  orderMonth: string;
  /** 契約期間の最初の月（YYYY-MM） */
  contractStart: string;
  /** 契約期間の最後の月（YYYY-MM） */
  contractEnd: string;
  /** 初回入金予定月（YYYY-MM）。この月から契約月数の分だけ毎月入金がある */
  firstPayment: string;
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
  /** 査定期間の年 */
  periodYear: number;
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

/** 入金履歴：企業・ユニットごとの、月別の実際の入金額 */
export interface PaymentRow {
  id: string;
  company: string;
  unit: string;
  /** 配分（%） */
  share: number;
  /** 月（YYYY-MM）ごとの入金額（配分前）。未入力の月は持たないか null */
  amounts: Record<string, number | null>;
}

/** 今期の入力 */
export interface Inputs {
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

const today = new Date();

export const DEFAULT_RULES: Rules = {
  periodYear: today.getFullYear(),
  periodStart: today.getMonth() < 6 ? 1 : 7,
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

/** 査定期間がいつか */
export type Period = Pick<Rules, 'periodYear' | 'periodStart'>;

/** 「YYYY-MM」を月の通し番号にする。読めないときは null */
export function ymIndex(ym: string): number | null {
  const m = /^(\d{4})-(\d{1,2})$/.exec(ym.trim());
  if (!m) return null;
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? Number(m[1]) * 12 + month - 1 : null;
}

export function ymFromIndex(i: number): string {
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}

/** 「YYYY-MM」に n ヶ月足す */
export function addMonths(ym: string, n: number): string {
  const i = ymIndex(ym);
  return i == null ? ym : ymFromIndex(i + n);
}

/** 「2026-07」→「2026年7月」 */
export function ymLabel(ym: string): string {
  const i = ymIndex(ym);
  return i == null ? '未設定' : `${Math.floor(i / 12)}年${(i % 12) + 1}月`;
}

/** 査定期間の各月（YYYY-MM） */
export function periodMonths(p: Period): string[] {
  const first = p.periodYear * 12 + p.periodStart - 1;
  return Array.from({ length: PERIOD_MONTHS }, (_, k) => ymFromIndex(first + k));
}

/** 契約期間の月数（開始月・終了月を含む）。期間が読めないときは 0 */
export function contractMonths(o: Pick<Order, 'contractStart' | 'contractEnd'>): number {
  const a = ymIndex(o.contractStart);
  const b = ymIndex(o.contractEnd);
  return a == null || b == null || b < a ? 0 : b - a + 1;
}

/** 入金予定の最後の月（初回入金予定月から契約月数分）。決まらないときは空 */
export function lastPayment(o: Order): string {
  const n = contractMonths(o);
  return n && ymIndex(o.firstPayment) != null ? addMonths(o.firstPayment, n - 1) : '';
}

/** 査定期間の各月に、その受注の入金があるか */
function activeMonths(o: Order, p: Period): boolean[] {
  const a = ymIndex(o.firstPayment);
  const n = contractMonths(o);
  return periodMonths(p).map((ym) => {
    const i = ymIndex(ym)!;
    return a != null && a <= i && i < a + n;
  });
}

/** 査定期間（6ヶ月）のうち、その受注の入金がある月数 */
export function monthsInPeriod(o: Order, p: Period): number {
  return activeMonths(o, p).filter(Boolean).length;
}

/** 受注履歴から見込む、その受注の期間内の入金額（配分後） */
export function expectedPayment(o: Order, p: Period): number {
  return (o.share / 100) * o.monthly * monthsInPeriod(o, p);
}

/** 受注履歴から見込む月別の入金額（配分後） */
export function expectedMonthly(orders: Order[], p: Period): number[] {
  const out = blank(0);
  for (const o of orders) activeMonths(o, p).forEach((on, i) => on && (out[i] += (o.share / 100) * o.monthly));
  return out;
}

/** 入金履歴から、査定期間の月別の入金額（配分後）を出す。どの企業も未入力の月は null */
export function actualMonthly(rows: PaymentRow[], p: Period): (number | null)[] {
  return periodMonths(p).map((ym) => {
    const entered = rows.filter((r) => r.amounts[ym] != null);
    return entered.length ? sum(entered.map((r) => paidAfterShare(r, ym))) : null;
  });
}

/** その月の入金額（配分後） */
export function paidAfterShare(r: PaymentRow, ym: string): number {
  return ((r.amounts[ym] ?? 0) * r.share) / 100;
}

/** 実入金の入力済みの月数 */
export function enteredMonths(actual: (number | null)[]): number {
  return actual.filter((v) => v != null).length;
}

/** 予測ごとの半年間の入金額。actual は査定期間の月別の実入金額（配分後） */
export function scenarioPayments(orders: Order[], actual: (number | null)[], p: Period, id: ScenarioId): number {
  switch (id) {
    case 'orders':
      return sum(orders.map((o) => expectedPayment(o, p)));
    case 'stable':
      return sum(orders.filter((o) => o.stable).map((o) => expectedPayment(o, p)));
    case 'actual': {
      const n = enteredMonths(actual);
      return n ? (sum(actual.map((v) => v ?? 0)) / n) * PERIOD_MONTHS : 0;
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
