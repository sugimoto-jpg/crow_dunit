import { useMemo, useState } from 'react';
import {
  PERIOD_MONTHS,
  SCENARIOS,
  actualMonthly,
  bonusRate,
  calculate,
  enteredMonths,
  expectedMonthly,
  expectedPayment,
  monthLabel,
  monthsInPeriod,
  scenarioPayments,
  type Breakdown,
  type ScenarioId,
  type Inputs,
  type Order,
  type PaymentRow,
  type Rules,
} from './calc';
import { MonthlyBars, ScenarioBars, man } from './charts';
import { Card, Field, Stat, linkBtn, money, yen } from './ui';

const months = Array.from({ length: PERIOD_MONTHS }, (_, i) => i);

interface Props {
  orders: Order[];
  payments: PaymentRow[];
  rules: Rules;
  inputs: Inputs;
  setInput: <K extends keyof Inputs>(k: K, v: Inputs[K]) => void;
  goOrders: () => void;
  goPayments: () => void;
  goMissions: () => void;
}

export function ForecastView({ orders, payments, rules, inputs, setInput, goOrders, goPayments, goMissions }: Props) {
  const actual = useMemo(() => actualMonthly(payments, rules), [payments, rules]);
  const results = useMemo(
    () => SCENARIOS.map((sc) => ({ ...sc, b: calculate(scenarioPayments(orders, actual, rules, sc.id), rules, inputs) })),
    [orders, actual, rules, inputs],
  );
  const expected = useMemo(() => expectedMonthly(orders, rules), [orders, rules]);
  const rate = bonusRate(rules, inputs);
  const label = (i: number) => monthLabel(rules.periodStart, i);
  const inPeriod = orders.filter((o) => monthsInPeriod(o, rules) > 0);
  // 基準にする予測：実入金があれば③、なければ①から始める
  const [basis, setBasis] = useState<ScenarioId>(() => (enteredMonths(actual) ? 'actual' : 'orders'));
  const main = results.find((r) => r.id === basis)!;
  const b = main.b;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-muted">基準にする予測</span>
        <div className="flex rounded-xl border border-line bg-surface p-1">
          {results.map((r) => (
            <button
              key={r.id}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold ${basis === r.id ? 'bg-accent text-white shadow-sm' : 'text-ink-2 hover:bg-surface-2'}`}
              onClick={() => setBasis(r.id)}
            >
              {SHORT[r.id]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="relative overflow-hidden rounded-2xl border border-white/5 bg-linear-to-br from-nav to-[#1d3a72] p-5 text-white shadow-sm sm:p-6 lg:col-span-3">
          <div className="text-sm font-bold text-nav-ink">予測月給（総合計給与）</div>
          <div className={`mt-1 text-5xl font-bold tracking-tight tabular-nums sm:text-6xl ${b.totalSalary < 0 ? 'text-[#ff9b9b]' : ''}`}>{money(b.totalSalary)}</div>
          <div className="mt-1 text-xs text-nav-ink">{main.title} · {main.note}</div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-[11px] sm:text-xs">
            <Part label="査定後の基本給" value={inputs.newBaseSalary} />
            <Part label="＋ 賞与額" value={b.bonus} />
            <Part label="− 一時金月割り" value={b.lumpMonthly} />
          </div>
          {inputs.newBaseSalary === 0 && (
            <p className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-xs text-white">
              査定後の基本給が未入力のため、月給に基本給が入っていません。下の「今期の条件」で入れてください。
            </p>
          )}
        </section>

        <div className="grid grid-cols-2 gap-3 lg:col-span-2">
          <Kpi label="賞与額" value={`${money(b.bonus)}`} sub={`前回比 ${b.bonusDiff >= 0 ? '+' : ''}${yen(b.bonusDiff)}`} tone={b.bonus < 0 ? 'bad' : undefined} subTone={b.bonusDiff < 0 ? 'bad' : 'good'} />
          <Kpi label="賞与倍率" value={`${rate.rate}%`} sub={`ミッション ${rate.achieved}/${rate.total}`} onClick={goMissions} />
          <Kpi label="配分原資（月平均）" value={`¥${man(b.avgMonthly)}`} sub={`×${+b.effectivePoolRate.toFixed(2)}% = ¥${man(b.pool)}`} />
          <Kpi label="半年間の入金額" value={`¥${man(b.payments)}`} sub={`他商材 ¥${man(b.addons)}`} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="3つの予測を比べる" note="総合計給与（月）。押すとその予測を基準にします">
          <ScenarioBars
            bars={results.map((r) => ({ id: r.id, label: r.title, value: r.b.totalSalary, detail: `賞与 ${money(r.b.bonus)} ・ 半年間の入金 ¥${man(r.b.payments)}` }))}
            selected={basis}
            onSelect={(id) => setBasis(id as ScenarioId)}
          />
        </Card>
        <Card
          title="月別の入金"
          note={`実際の入金は入力済み ${enteredMonths(actual)} / 6ヶ月`}
          aside={
            <button className={linkBtn} onClick={goPayments}>
              入金履歴へ →
            </button>
          }
        >
          <MonthlyBars labels={months.map(label)} actual={actual} expected={expected} />
        </Card>
      </div>

      <Card title="計算の内訳" note="3つの予測を並べて比べられます">
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <table className="w-full text-[13px] sm:text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-2 pr-2 text-left font-normal" />
                {results.map((r) => (
                  <th key={r.id} className={`px-1.5 py-2 text-right whitespace-nowrap sm:px-2 ${r.id === basis ? 'text-accent-ink' : 'font-normal'}`}>
                    {SHORT[r.id]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([key, title, strong]) => (
                <tr key={key} className={`border-t border-line ${strong ? 'font-bold' : ''}`}>
                  <td className="py-2 pr-2 text-ink-2">{typeof title === 'function' ? title(b) : title}</td>
                  {results.map((r) => {
                    const v = r.b[key];
                    return (
                      <td key={r.id} className={`px-1.5 py-2 text-right tabular-nums whitespace-nowrap sm:px-2 ${r.id === basis ? 'bg-accent-soft/50' : ''} ${v < 0 ? 'text-bad' : ''}`}>
                        {yen(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-line-strong text-base font-bold">
                <td className="py-2.5 pr-2">総合計給与（月）</td>
                {results.map((r) => (
                  <td key={r.id} className={`px-1.5 py-2.5 text-right tabular-nums whitespace-nowrap sm:px-2 ${r.id === basis ? 'bg-accent-soft/50 text-accent-ink' : ''} ${r.b.totalSalary < 0 ? 'text-bad' : ''}`}>
                    {money(r.b.totalSalary)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <details className="mt-3 text-xs text-muted">
          <summary className="cursor-pointer select-none">計算式</summary>
          <p className="mt-1 leading-relaxed">
            合計 = 半年間の入金額 + 他商材 ／ 配分原資 = 合計 ÷ 6 ／ 賞与対象原資 = 配分原資 × (賞与対象原資の率 − マネジメント報酬) ／ 賞与対象金額 = 賞与対象原資 − 現在の基本給 ／
            賞与額 = 賞与対象金額 × 賞与倍率 ／ 総合計給与 = 査定後の基本給 + 賞与額 − 一時金 ÷ 6
          </p>
        </details>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="今期の条件"
          aside={
            <button className={linkBtn} onClick={goMissions}>
              ミッション表へ →
            </button>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="現在の基本給" value={inputs.baseSalary} onChange={(v) => setInput('baseSalary', v)} />
            <Field label="査定後の基本給" value={inputs.newBaseSalary} onChange={(v) => setInput('newBaseSalary', v)} />
            <Field label="前回賞与" value={inputs.previousBonus} onChange={(v) => setInput('previousBonus', v)} />
            <Field label="一時金" value={inputs.lumpSum} onChange={(v) => setInput('lumpSum', v)} />
            <Field label="等級" value={inputs.grade} onChange={(v) => setInput('grade', v)} />
          </div>
        </Card>

        <div className="space-y-4">
          <Card
            title="受注"
            aside={
              <button className={linkBtn} onClick={goOrders}>
                受注一覧へ →
              </button>
            }
          >
            <div className="grid grid-cols-2 gap-2">
              <Stat label="査定期間に入金がある受注" value={`${inPeriod.length} / ${orders.length}件`} />
              <Stat label="① 期間内の見込み" value={`¥${man(inPeriod.reduce((s, o) => s + expectedPayment(o, rules), 0))}`} />
            </div>
          </Card>
          {rules.addonNames.length > 0 && (
            <Card title="他商材の入金" note="半年分の合計。3つの予測すべてに加算します">
              <div className="grid grid-cols-2 gap-3">
                {rules.addonNames.map((name, k) => (
                  <Field key={k} label={name} value={inputs.addons[k] ?? 0} onChange={(v) => setInput('addons', rules.addonNames.map((_, j) => (j === k ? v : inputs.addons[j] ?? 0)))} />
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

const SHORT: Record<ScenarioId, string> = { orders: '① 受注履歴', stable: '② 安定先', actual: '③ 実入金' };

/** 内訳の行：[項目, 見出し, 太字] */
const ROWS: [keyof Breakdown, string | ((b: Breakdown) => string), boolean?][] = [
  ['payments', '半年間の入金額', true],
  ['addons', '他商材'],
  ['total', '合計'],
  ['avgMonthly', '配分原資（平均月入金額）'],
  ['grossProfit', '給与対象原資（×粗利率・参考）'],
  ['pool', (b) => `賞与対象原資（×${+b.effectivePoolRate.toFixed(2)}%）`],
  ['bonusTarget', '賞与対象金額（−基本給）'],
  ['bonus', (b) => `賞与額（×${b.bonusRate}%）`, true],
  ['bonusDiff', '前回賞与との差'],
  ['lumpMonthly', '一時金月割り'],
];

function Part({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/8 px-3 py-2">
      <div className="leading-tight text-nav-ink">{label}</div>
      <div className="mt-0.5 truncate text-sm font-bold tabular-nums">{money(value)}</div>
    </div>
  );
}

function Kpi({ label, value, sub, tone, subTone, onClick }: { label: string; value: string; sub: string; tone?: 'bad'; subTone?: 'good' | 'bad'; onClick?: () => void }) {
  const body = (
    <>
      <div className="text-xs font-bold text-muted">{label}</div>
      <div className={`mt-1 truncate text-2xl font-bold tabular-nums ${tone === 'bad' ? 'text-bad' : 'text-ink'}`}>{value}</div>
      <div className={`mt-0.5 truncate text-xs ${subTone === 'bad' ? 'text-bad' : subTone === 'good' ? 'text-good' : 'text-muted'}`}>{sub}</div>
    </>
  );
  const cls = 'min-w-0 rounded-2xl border border-line bg-surface p-4 text-left shadow-[0_1px_2px_rgb(15_23_42/0.04)]';
  return onClick ? (
    <button className={`${cls} hover:border-accent`} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
