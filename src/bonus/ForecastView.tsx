import { useMemo } from 'react';
import {
  PERIOD_MONTHS,
  SCENARIOS,
  bonusRate,
  calculate,
  enteredMonths,
  expectedMonthly,
  expectedPayment,
  monthLabel,
  monthsInPeriod,
  scenarioPayments,
  type Breakdown,
  type Inputs,
  type Order,
  type Rules,
} from './calc';
import { Card, Field, NumIn, Stat, yen } from './ui';

const months = Array.from({ length: PERIOD_MONTHS }, (_, i) => i);

interface Props {
  orders: Order[];
  rules: Rules;
  inputs: Inputs;
  setInput: <K extends keyof Inputs>(k: K, v: Inputs[K]) => void;
  goOrders: () => void;
  goMissions: () => void;
}

export function ForecastView({ orders, rules, inputs, setInput, goOrders, goMissions }: Props) {
  const results = useMemo(
    () => SCENARIOS.map((sc) => ({ ...sc, b: calculate(scenarioPayments(orders, inputs, rules, sc.id), rules, inputs) })),
    [orders, rules, inputs],
  );
  const expected = useMemo(() => expectedMonthly(orders, rules), [orders, rules]);
  const expectedStable = useMemo(() => expectedMonthly(orders.filter((o) => o.stable), rules), [orders, rules]);
  const rate = bonusRate(rules, inputs);
  const label = (i: number) => monthLabel(rules.periodStart, i);
  const inPeriod = orders.filter((o) => monthsInPeriod(o, rules) > 0);

  return (
    <>
      <Card
        title="受注"
        aside={
          <button className="text-sm font-bold text-emerald-700 hover:underline" onClick={goOrders}>
            受注一覧を開く →
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="登録した受注" value={`${orders.length}件`} />
          <Stat label="査定期間に入金がある受注" value={`${inPeriod.length}件`} />
          <Stat label="① 期間内の見込み（全件）" value={yen(inPeriod.reduce((s, o) => s + expectedPayment(o, rules), 0))} />
          <Stat label="② 期間内の見込み（安定先）" value={yen(inPeriod.filter((o) => o.stable).reduce((s, o) => s + expectedPayment(o, rules), 0))} />
        </div>
      </Card>

      <Card title="月別の入金額">
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="p-1 text-left" />
                {months.map((i) => <th key={i} className="p-1 text-right">{label(i)}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th className="p-1 text-left text-xs font-normal text-slate-600">実際の入金額（配分後）</th>
                {months.map((i) => (
                  <td key={i} className="p-1">
                    <NumIn
                      value={inputs.actualMonthly[i] ?? null}
                      placeholder="未入力"
                      onChange={(v) => setInput('actualMonthly', months.map((j) => (j === i ? v : inputs.actualMonthly[j] ?? null)))}
                    />
                  </td>
                ))}
              </tr>
              <tr className="text-xs text-slate-500">
                <th className="p-1 text-left font-normal">① 受注履歴の見込み</th>
                {expected.map((v, i) => <td key={i} className="p-1 text-right tabular-nums">{yen(v)}</td>)}
              </tr>
              <tr className="text-xs text-slate-500">
                <th className="p-1 text-left font-normal">② 安定先の見込み</th>
                {expectedStable.map((v, i) => <td key={i} className="p-1 text-right tabular-nums">{yen(v)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          評価シートの月別の金額を入れます。期の途中なら入金済みの月だけ入れれば、その平均で6ヶ月分を推計します（入力済み {enteredMonths(inputs.actualMonthly)} / 6ヶ月）。
        </p>
        {rules.addonNames.length > 0 && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {rules.addonNames.map((name, k) => (
                <Field key={k} label={name} value={inputs.addons[k] ?? 0} onChange={(v) => setInput('addons', rules.addonNames.map((_, j) => (j === k ? v : inputs.addons[j] ?? 0)))} />
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">他商材の入金は半年分の合計を入れます。3つの予測すべてに加算します（商材名は設定で変えられます）。</p>
          </>
        )}
      </Card>

      <Card
        title="今期の条件"
        aside={
          <button className="text-sm font-bold text-emerald-700 hover:underline" onClick={goMissions}>
            ミッション表を開く →
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="ミッション達成" value={`${rate.achieved} / ${rate.total}（${rate.multiplier}%）`} />
          <Stat label="賞与倍率" value={`${rate.rate}%`} />
          <Field label="等級" value={inputs.grade} onChange={(v) => setInput('grade', v)} />
          <Field label="現在の基本給" value={inputs.baseSalary} onChange={(v) => setInput('baseSalary', v)} />
          <Field label="前回賞与" value={inputs.previousBonus} onChange={(v) => setInput('previousBonus', v)} />
          <Field label="査定後の基本給" value={inputs.newBaseSalary} onChange={(v) => setInput('newBaseSalary', v)} />
          <Field label="一時金" value={inputs.lumpSum} onChange={(v) => setInput('lumpSum', v)} />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {results.map((r) => (
          <ScenarioCard key={r.id} title={r.title} note={r.note} b={r.b} />
        ))}
      </div>

      <p className="text-xs text-slate-500">
        計算式：合計 = 半年間の入金額 + 他商材 ／ 配分原資 = 合計 ÷ 6 ／ 賞与対象原資 = 配分原資 × (賞与対象原資の率 − マネジメント報酬) ／
        賞与対象金額 = 賞与対象原資 − 現在の基本給 ／ 賞与額 = 賞与対象金額 × 賞与倍率 ／ 総合計給与 = 査定後の基本給 + 賞与額 − 一時金 ÷ 6
      </p>
    </>
  );
}

function ScenarioCard({ title, note, b }: { title: string; note: string; b: Breakdown }) {
  const rows: [string, number, boolean?][] = [
    ['半年間の入金額', b.payments, true],
    ['他商材', b.addons],
    ['合計', b.total],
    ['配分原資（平均月入金額）', b.avgMonthly],
    ['給与対象原資（×粗利率・参考）', b.grossProfit],
    [`賞与対象原資（×${+b.effectivePoolRate.toFixed(2)}%）`, b.pool],
    ['賞与対象金額（−基本給）', b.bonusTarget],
    [`賞与額（×${b.bonusRate}%）`, b.bonus, true],
    ['前回賞与との差', b.bonusDiff],
    ['一時金月割り', b.lumpMonthly],
  ];
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-bold">{title}</h2>
      <p className="mb-3 text-xs text-slate-500">{note}</p>
      <dl className="space-y-1 text-sm">
        {rows.map(([label, v, strong]) => (
          <div key={label} className={`flex justify-between gap-2 ${strong ? 'font-bold' : ''}`}>
            <dt className="text-slate-600">{label}</dt>
            <dd className={`tabular-nums ${v < 0 ? 'text-rose-600' : ''}`}>{yen(v)}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex items-baseline justify-between rounded-lg bg-emerald-50 px-3 py-2">
        <span className="text-sm font-bold text-emerald-800">総合計給与（月）</span>
        <span className={`text-xl font-bold tabular-nums ${b.totalSalary < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>¥{yen(b.totalSalary)}</span>
      </div>
    </section>
  );
}
