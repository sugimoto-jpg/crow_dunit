import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Plus, Trash2, Wallet } from 'lucide-react';
import {
  SCENARIOS,
  actualPayment,
  calculate,
  expectedPayment,
  monthsInPeriod,
  scenarioPayments,
  type Breakdown,
  type Order,
  type Settings,
} from './calc';
import { load, save } from './storage';

const yen = (n: number) => Math.round(n).toLocaleString('ja-JP');
const newOrder = (): Order => ({
  id: crypto.randomUUID(),
  company: '',
  unit: '',
  share: 100,
  monthly: 0,
  months: 6,
  startMonth: 1,
  stable: true,
  actual: null,
});

export function BonusApp() {
  const [initial] = useState(load);
  const [orders, setOrders] = useState<Order[]>(initial.orders.length ? initial.orders : [newOrder()]);
  const [settings, setSettings] = useState<Settings>(initial.settings);

  useEffect(() => save({ orders, settings }), [orders, settings]);

  const results = useMemo(
    () => SCENARIOS.map((sc) => ({ ...sc, b: calculate(scenarioPayments(orders, sc.id), settings) })),
    [orders, settings],
  );

  const patchOrder = (id: string, patch: Partial<Order>) => setOrders((os) => os.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v }));

  return (
    <div className="min-h-screen px-4 py-6 text-slate-800">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center gap-3">
          <Wallet className="size-7 text-emerald-600" />
          <div>
            <h1 className="text-xl font-bold">賞与・給与予測</h1>
            <p className="text-sm text-slate-500">半年ごとの査定を、受注と入金額から3通りで予測します。入力内容はこの端末にだけ保存されます。</p>
          </div>
        </header>

        <Card title="受注一覧">
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="p-1">社名</th>
                  <th className="p-1">ユニット名</th>
                  <th className="p-1 w-20">配分(%)</th>
                  <th className="p-1 w-32">単月受注金額</th>
                  <th className="p-1 w-20">契約月数</th>
                  <th className="p-1 w-24" title="査定期間の何ヶ月目から入金が始まるか">開始月(1〜6)</th>
                  <th className="p-1 w-28 text-right">期間内見込み</th>
                  <th className="p-1 w-14 text-center" title="②の予測に残す">安定</th>
                  <th className="p-1 w-32">実入金額(半年)</th>
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
                    <td className="p-1"><NumIn value={o.startMonth} onChange={(v) => patchOrder(o.id, { startMonth: v ?? 1 })} /></td>
                    <td className="p-1 text-right tabular-nums">
                      {yen(expectedPayment(o))}
                      <div className="text-[10px] text-slate-400">{monthsInPeriod(o)}ヶ月分</div>
                    </td>
                    <td className="p-1 text-center">
                      <input type="checkbox" className="size-4 accent-emerald-600" checked={o.stable} onChange={(e) => patchOrder(o.id, { stable: e.target.checked })} />
                    </td>
                    <td className="p-1">
                      <NumIn value={o.actual} onChange={(v) => patchOrder(o.id, { actual: v })} placeholder="未入力" />
                      {o.actual != null && <div className="text-right text-[10px] text-slate-400">配分後 {yen(actualPayment(o))}</div>}
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
          <p className="mt-2 text-xs text-slate-500">期間内見込み = 配分 × 単月受注金額 × 査定期間（6ヶ月）に入る月数。実入金額は配分前の金額を入れてください（配分を掛けて計算します）。</p>
        </Card>

        <Card title="査定条件">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Field label="メイクアップ" value={settings.makeup} onChange={(v) => set('makeup', v)} />
            <Field label="粗利率(%)" value={settings.grossRate} onChange={(v) => set('grossRate', v)} />
            <Field label="賞与対象原資の率(%)" value={settings.poolRate} onChange={(v) => set('poolRate', v)} />
            <Field label="マネジメント報酬(%)" value={settings.managementRate} onChange={(v) => set('managementRate', v)} />
            <Field label="賞与倍率(%)" value={settings.bonusRate} onChange={(v) => set('bonusRate', v)} />
            <Field label="倍率" value={settings.multiplier} onChange={(v) => set('multiplier', v)} />
            <Field label="等級" value={settings.grade} onChange={(v) => set('grade', v)} />
            <Field label="現在の基本給" value={settings.baseSalary} onChange={(v) => set('baseSalary', v)} />
            <Field label="前回賞与" value={settings.previousBonus} onChange={(v) => set('previousBonus', v)} />
            <Field label="査定後の基本給" value={settings.newBaseSalary} onChange={(v) => set('newBaseSalary', v)} />
            <Field label="一時金" value={settings.lumpSum} onChange={(v) => set('lumpSum', v)} />
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {results.map((r) => (
            <ScenarioCard key={r.id} title={r.title} note={r.note} b={r.b} />
          ))}
        </div>

        <p className="text-xs text-slate-500">
          計算式：合計 = 半年間の入金額 + メイクアップ ／ 配分原資 = 合計 ÷ 6 ／ 賞与対象原資 = 配分原資 × (賞与対象原資の率 − マネジメント報酬) ／ 給与対象原資 = 配分原資 × 粗利率（参考） ／
          賞与対象金額 = 賞与対象原資 − 現在の基本給 ／ 賞与額 = 賞与対象金額 × 賞与倍率 ／ 総合計給与 = 査定後の基本給 + 賞与額 − 一時金 ÷ 6
        </p>
      </div>
    </div>
  );
}

function ScenarioCard({ title, note, b }: { title: string; note: string; b: Breakdown }) {
  const rows: [string, number, boolean?][] = [
    ['半年間の入金額', b.payments, true],
    ['メイクアップ', b.makeup],
    ['合計', b.total],
    ['配分原資（平均月入金額）', b.avgMonthly],
    ['給与対象原資（×粗利率・参考）', b.grossProfit],
    [`賞与対象原資（×${+b.effectivePoolRate.toFixed(2)}%）`, b.pool],
    ['賞与対象金額（−基本給）', b.bonusTarget],
    ['賞与額', b.bonus, true],
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

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-xs text-slate-500">
      {label}
      <NumIn value={value} onChange={(v) => onChange(v ?? 0)} />
    </label>
  );
}

const inputCls = 'mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none';

function TextIn({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input className={inputCls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

/** カンマ付きで貼り付けても読める数値入力。空欄は null */
function NumIn({ value, onChange, placeholder }: { value: number | null; onChange: (v: number | null) => void; placeholder?: string }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    setText((t) => (parse(t) === value ? t : value == null ? '' : String(value)));
  }, [value]);
  return (
    <input
      className={`${inputCls} text-right tabular-nums`}
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parse(e.target.value));
      }}
    />
  );
}

function parse(t: string): number | null {
  const s = t.replace(/[,，\s円%]/g, '').replace(/[０-９．－]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
