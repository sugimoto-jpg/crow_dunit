import { DEFAULT_INPUTS, DEFAULT_RULES, type Inputs, type Order, type Rules } from './calc';

const KEY = 'aidma-bonus-forecast-v2';
const OLD_KEY = 'aidma-bonus-forecast-v1';

export interface Saved {
  orders: Order[];
  rules: Rules;
  inputs: Inputs;
}

/** 入力内容はこの端末のブラウザにだけ保存する（外部送信なし） */
export function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<Saved>;
      return {
        orders: Array.isArray(d.orders) ? d.orders : [],
        rules: { ...DEFAULT_RULES, ...d.rules },
        inputs: { ...DEFAULT_INPUTS, ...d.inputs },
      };
    }
    const old = localStorage.getItem(OLD_KEY);
    if (old) return fromV1(JSON.parse(old));
  } catch {
    /* 保存できない環境では毎回まっさらから始める */
  }
  return { orders: [], rules: DEFAULT_RULES, inputs: DEFAULT_INPUTS };
}

/** 旧版（設定と入力が1つだった頃）の保存内容を引き継ぐ。ミッションの●×は新しいミッション表で入れ直す */
function fromV1(d: { orders?: (Order & { actual?: unknown })[]; settings?: Record<string, unknown> }): Saved {
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
    actualMonthly: Array.isArray(s.actualMonthly) ? (s.actualMonthly as (number | null)[]) : DEFAULT_INPUTS.actualMonthly,
    addons: oldAddons ? oldAddons.map((a) => a.amount) : rules.addonNames.map((n) => (n === 'メイクプイ' ? num('makeup', 0) : 0)),
    reflections: num('reflections', 0),
    bonusRateOverride: typeof s.bonusRateOverride === 'number' ? s.bonusRateOverride : null,
    grade: num('grade', 0),
    baseSalary: num('baseSalary', 0),
    previousBonus: num('previousBonus', 0),
    newBaseSalary: num('newBaseSalary', 0),
    lumpSum: num('lumpSum', 0),
  };
  const orders = (Array.isArray(d.orders) ? d.orders : []).map(({ actual: _actual, ...o }) => o);
  return { orders, rules, inputs };
}

export function save(d: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* noop */
  }
}
