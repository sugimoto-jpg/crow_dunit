import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
import { Card, Field, NumIn, Stat, TextIn, inputCls, yen } from './ui';

const months = Array.from({ length: PERIOD_MONTHS }, (_, i) => i);
const newOrder = (): Order => ({
  id: crypto.randomUUID(),
  company: '',
  unit: '',
  share: 100,
  monthly: 0,
  months: 6,
  startMonth: 1,
  stable: true,
});

interface Props {
  orders: Order[];
  setOrders: (f: (os: Order[]) => Order[]) => void;
  rules: Rules;
  inputs: Inputs;
  setInput: <K extends keyof Inputs>(k: K, v: Inputs[K]) => void;
  goMissions: () => void;
}

export function ForecastView({ orders, setOrders, rules, inputs, setInput, goMissions }: Props) {
  const results = useMemo(
    () => SCENARIOS.map((sc) => ({ ...sc, b: calculate(scenarioPayments(orders, inputs, sc.id), rules, inputs) })),
    [orders, rules, inputs],
  );
  const expected = useMemo(() => expectedMonthly(orders), [orders]);
  const expectedStable = useMemo(() => expectedMonthly(orders.filter((o) => o.stable)), [orders]);
  const rate = bonusRate(rules, inputs);
  const label = (i: number) => monthLabel(rules.periodStart, i);
  const patchOrder = (id: string, patch: Partial<Order>) => setOrders((os) => os.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  return (
    <>
      <Card title="受注一覧">
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="p-1">社名</th>
                <th className="p-1">ユニット名</th>
                <th className="p-1 w-20">配分(%)</th>
                <th className="p-1 w-32">単月受注金額</th>
                <th className="p-1 w-20">契約月数</th>
                <th className="p-1 w-24">入金開始月</th>
                <th className="p-1 w-28 text-right">期間内見込み</th>
                <th className="p-1 w-14 text-center" title="②の予測に残す">安定</th>
                <th className="p-1 w-8" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-slate-100">
                  <td className="p-1"><TextIn value={o.company} onChange={(v) => patchOrder(o.id, { company: v })} placeholder="株式会社〇〇" /></td>
                  <td className="p-1"><TextIn value={o.unit} onChange={(v) => patchOrder(o.id, { unit: v })} placeholder="〇〇ユニット" /></td>
                  <td className="p-1"><NumIn value={o.share} onChange={(v) => patchOrder(o.id, { share: v ?? 0 })} /></td>
                  <td className="p-1"><NumIn value={o.monthly} onChange={(v) => patchOrder(o.id, { monthly: v ?? 0 })} /></td>
                  <td className="p-1"><NumIn value={o.months} onChange={(v) => patchOrder(o.id, { months: v ?? 0 })} /></td>
                  <td className="p-1">
                    <select className={inputCls} value={o.startMonth} onChange={(e) => patchOrder(o.id, { startMonth: Number(e.target.value) })}>
                      {months.map((i) => <option key={i} value={i + 1}>{label(i)}</option>)}
                    </select>
                  </td>
                  <td className="p-1 text-right tabular-nums">
                    {yen(expectedPayment(o))}
                    <div className="text-[10px] text-slate-400">{monthsInPeriod(o)}ヶ月分</div>
                  </td>
                  <td className="p-1 text-center">
                    <input type="checkbox" className="size-4 accent-emerald-600" checked={o.stable} onChange={(e) => patchOrder(o.id, { stable: e.target.checked })} />
                  </td>
                  <td className="p-1">
                    <button className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => setOrders((os) => os.filter((x) => x.id !== o.id))} aria-label="削除">
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="mt-3 inline-flex items-center gap-1 rounded-lg border border-emerald-600 px-3 py-1.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50" onClick={() => setOrders((os) => [...os, newOrder()])}>
          <Plus className="size-4" /> 受注を追加
        </button>
        <p className="mt-2 text-xs text-slate-500">期間内見込み = 配分 × 単月受注金額 × 査定期間（6ヶ月）に入る月数。</p>
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
