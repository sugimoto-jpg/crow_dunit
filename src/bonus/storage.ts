import { DEFAULT_INPUTS, DEFAULT_RULES, PERIOD_MONTHS, addMonths, periodMonths, type Inputs, type Mission, type MissionDef, type Order, type PaymentRow, type Period, type Rules } from './calc';

const KEY = 'aidma-bonus-forecast-v2';
const OLD_KEY = 'aidma-bonus-forecast-v1';

export interface Saved {
  orders: Order[];
  rules: Rules;
  inputs: Inputs;
  /** 入金履歴（企業・ユニット別） */
  payments: PaymentRow[];
}

/** 入力内容はこの端末のブラウザにだけ保存する（外部送信なし） */
export function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<Saved>;
      const rules = { ...DEFAULT_RULES, ...d.rules };
      return migratePayments(
        migrateMissions({
          orders: migrateOrders(Array.isArray(d.orders) ? d.orders : [], rules),
          rules,
          inputs: { ...DEFAULT_INPUTS, ...d.inputs },
          payments: Array.isArray(d.payments) ? d.payments : [],
        }),
      );
    }
    const old = localStorage.getItem(OLD_KEY);
    if (old) return fromV1(JSON.parse(old));
  } catch {
    /* 保存できない環境では毎回まっさらから始める */
  }
  return { orders: [], rules: DEFAULT_RULES, inputs: DEFAULT_INPUTS, payments: [] };
}

/** 月別の合計だけを入れていた頃の実入金額を、入金履歴の1行に移す */
function migratePayments(d: Saved): Saved {
  const { actualMonthly, ...inputs } = d.inputs as Inputs & { actualMonthly?: (number | null)[] };
  if (!actualMonthly) return d;
  const months = periodMonths(d.rules);
  const amounts = Object.fromEntries(months.flatMap((ym, k) => (actualMonthly[k] != null ? [[ym, actualMonthly[k]]] : [])));
  const payments = Object.keys(amounts).length
    ? [...d.payments, { id: crypto.randomUUID(), company: '合計（以前の入力）', unit: '', share: 100, amounts }]
    : d.payments;
  return { ...d, inputs: inputs as Inputs, payments };
}

type OldOrder = Partial<Order> & { id: string; months?: number; startMonth?: number; actual?: unknown };

/** 契約月数と「査定期間の何ヶ月目から」で持っていた頃の受注を、契約期間（開始月〜終了月）に直す */
function migrateOrders(orders: OldOrder[], p: Period): Order[] {
  const months = periodMonths(p);
  return orders.map(({ months: n, startMonth, actual: _actual, ...o }) => {
    // 初回入金予定月・支払方法がなかった頃は、契約期間の開始月から毎月（分割）の入金としていた
    if (o.contractStart != null) return { ...o, firstPayment: o.firstPayment ?? o.contractStart, plan: o.plan ?? 'split' } as Order;
    const start = months[Math.min(Math.max((startMonth ?? 1) - 1, 0), PERIOD_MONTHS - 1)];
    return {
      company: '',
      unit: '',
      share: 100,
      monthly: 0,
      stable: true,
      ...o,
      orderMonth: start,
      contractStart: start,
      contractEnd: addMonths(start, Math.max((n ?? 1) - 1, 0)),
      firstPayment: start,
      plan: 'split',
    };
  });
}

type OldRecord = { actual: (number | null)[]; target: (number | null)[] };

/**
 * ミッションが全月共通だった頃の保存内容を、月ごとのミッションに移す。
 * 共通の項目はテンプレートにし、記録のある月にだけ項目を作る。
 */
function migrateMissions(d: Saved): Saved {
  const rules = d.rules as Rules & { missions?: MissionDef[] };
  const inputs = d.inputs as Inputs & { records?: Record<string, OldRecord> };
  if (rules.missions) {
    const { missions, ...rest } = rules;
    d.rules = { ...rest, missionTemplate: missions };
  }
  if (inputs.records) {
    const { records, ...rest } = inputs;
    const defs = d.rules.missionTemplate;
    const monthMissions = Array.from({ length: PERIOD_MONTHS }, (_, i): Mission[] =>
      defs.some((m) => records[m.id]?.actual[i] != null)
        ? defs.map((m) => ({ ...m, id: crypto.randomUUID(), target: records[m.id]?.target[i] ?? m.target, actual: records[m.id]?.actual[i] ?? null }))
        : [],
    );
    d.inputs = { ...rest, monthMissions };
  }
  return d;
}

/** 旧版（設定と入力が1つだった頃）の保存内容を引き継ぐ。ミッションの●×は新しいミッション表で入れ直す */
function fromV1(d: { orders?: unknown[]; settings?: Record<string, unknown> }): Saved {
  const s = d.settings ?? {};
  const num = (k: string, fallback: number) => (typeof s[k] === 'number' ? (s[k] as number) : fallback);
  const rules: Rules = {
    ...DEFAULT_RULES,
    periodStart: num('periodStart', DEFAULT_RULES.periodStart),
    poolRate: num('poolRate', DEFAULT_RULES.poolRate),
    managementRate: num('managementRate', DEFAULT_RULES.managementRate),
    grossRate: num('grossRate', DEFAULT_RULES.grossRate),
  };
  const oldAddons = Array.isArray(s.addons) ? (s.addons as { name: string; amount: number }[]) : null;
  if (oldAddons) rules.addonNames = oldAddons.map((a) => a.name);
  const inputs: Inputs = {
    ...DEFAULT_INPUTS,
    addons: oldAddons ? oldAddons.map((a) => a.amount) : rules.addonNames.map((n) => (n === 'メイクプイ' ? num('makeup', 0) : 0)),
    reflections: num('reflections', 0),
    bonusRateOverride: typeof s.bonusRateOverride === 'number' ? s.bonusRateOverride : null,
    grade: num('grade', 0),
    baseSalary: num('baseSalary', 0),
    previousBonus: num('previousBonus', 0),
    newBaseSalary: num('newBaseSalary', 0),
    lumpSum: num('lumpSum', 0),
  };
  const orders = migrateOrders(Array.isArray(d.orders) ? (d.orders as OldOrder[]) : [], rules);
  const actualMonthly = Array.isArray(s.actualMonthly) ? (s.actualMonthly as (number | null)[]) : undefined;
  return migratePayments({ orders, rules, inputs: { ...inputs, actualMonthly } as Inputs, payments: [] });
}

export function save(d: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* noop */
  }
}
