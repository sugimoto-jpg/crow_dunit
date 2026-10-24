import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { PLAN_LABEL, addMonths, contractMonths, contractTotal, expectedPayment, lastPayment, monthsInPeriod, paymentCount, periodMonths, ymFromIndex, ymLabel, type Order, type PaymentPlan, type Rules } from './calc';
import { Card, IconButton, NumIn, Stat, TextIn, inputCls, yen } from './ui';

const ALL = 'all';
const NONE = 'none';
const DEFAULT_CONTRACT_MONTHS = 6;
const thisMonth = () => ymFromIndex(new Date().getFullYear() * 12 + new Date().getMonth());

interface Props {
  orders: Order[];
  setOrders: (f: (os: Order[]) => Order[]) => void;
  rules: Rules;
}

export function OrdersView({ orders, setOrders, rules }: Props) {
  const [month, setMonth] = useState(ALL);
  const [inPeriodOnly, setInPeriodOnly] = useState(false);
  const patch = (id: string, p: Partial<Order>) => setOrders((os) => os.map((o) => (o.id === id ? { ...o, ...p } : o)));
  const period = periodMonths(rules);

  /** 受注月ごとの件数（新しい月が上） */
  const monthCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) m.set(o.orderMonth || NONE, (m.get(o.orderMonth || NONE) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => (a[0] === NONE ? 1 : b[0] === NONE ? -1 : b[0].localeCompare(a[0])));
  }, [orders]);

  const shown = orders
    .filter((o) => month === ALL || (o.orderMonth || NONE) === month)
    .filter((o) => !inPeriodOnly || monthsInPeriod(o, rules) > 0)
    .sort((a, b) => (b.orderMonth || '').localeCompare(a.orderMonth || ''));

  const add = () => {
    const orderMonth = month !== ALL && month !== NONE ? month : thisMonth();
    setOrders((os) => [
      ...os,
      {
        id: crypto.randomUUID(),
        company: '',
        unit: '',
        share: 100,
        monthly: 0,
        orderMonth,
        contractStart: orderMonth,
        contractEnd: addMonths(orderMonth, DEFAULT_CONTRACT_MONTHS - 1),
        plan: 'split',
        firstPayment: orderMonth,
        stable: true,
      },
    ]);
  };

  return (
    <>
      <Card title="受注一覧">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="block text-xs text-slate-500">
            受注月で絞り込む
            <select className={`${inputCls} min-w-48`} value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value={ALL}>すべて（{orders.length}件）</option>
              {monthCounts.map(([m, n]) => (
                <option key={m} value={m}>
                  {m === NONE ? '受注月なし' : ymLabel(m)}（{n}件）
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 pb-1.5 text-sm text-slate-600">
            <input type="checkbox" className="size-4 accent-emerald-600" checked={inPeriodOnly} onChange={(e) => setInPeriodOnly(e.target.checked)} />
            査定期間（{ymLabel(period[0])}〜{ymLabel(period[5])}）に入金がある受注だけ
          </label>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-4">
          <Stat label="件数" value={`${shown.length}件`} />
          <Stat label="単月受注金額（配分後）の合計" value={yen(shown.reduce((s, o) => s + (o.share / 100) * o.monthly, 0))} />
          <Stat label="査定期間内の見込み（全件）" value={yen(shown.reduce((s, o) => s + expectedPayment(o, rules), 0))} />
          <Stat label="査定期間内の見込み（安定先）" value={yen(shown.filter((o) => o.stable).reduce((s, o) => s + expectedPayment(o, rules), 0))} />
        </div>

        {shown.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">{orders.length ? '条件に合う受注はありません。' : 'まだ受注がありません。「受注を追加」から入れてください。'}</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[1560px] text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="p-1 w-36">受注月</th>
                  <th className="p-1 min-w-44">社名</th>
                  <th className="p-1 min-w-32">ユニット名</th>
                  <th className="p-1 w-20">配分(%)</th>
                  <th className="p-1 w-32">単月受注金額</th>
                  <th className="p-1 w-72">契約期間（開始〜終了）</th>
                  <th className="p-1 w-16">月数</th>
                  <th className="p-1 w-24">支払方法</th>
                  <th className="p-1 w-40">初回入金予定月</th>
                  <th className="p-1 w-28 text-right">期間内見込み</th>
                  <th className="p-1 w-12 text-center" title="②の予測に残す">安定</th>
                  <th className="p-1 w-8" />
                </tr>
              </thead>
              <tbody>
                {shown.map((o) => {
                  const n = contractMonths(o);
                  return (
                    <tr key={o.id} className="border-t border-slate-100">
                      <td className="p-1"><MonthIn value={o.orderMonth} onChange={(v) => patch(o.id, { orderMonth: v })} /></td>
                      <td className="p-1"><TextIn value={o.company} onChange={(v) => patch(o.id, { company: v })} placeholder="株式会社〇〇" /></td>
                      <td className="p-1"><TextIn value={o.unit} onChange={(v) => patch(o.id, { unit: v })} placeholder="〇〇ユニット" /></td>
                      <td className="p-1"><NumIn value={o.share} onChange={(v) => patch(o.id, { share: v ?? 0 })} /></td>
                      <td className="p-1"><NumIn value={o.monthly} onChange={(v) => patch(o.id, { monthly: v ?? 0 })} /></td>
                      <td className="p-1">
                        <div className="flex items-center gap-1">
                          <MonthIn
                            value={o.contractStart}
                            onChange={(v) =>
                              patch(o.id, {
                                contractStart: v,
                                contractEnd: n ? addMonths(v, n - 1) : o.contractEnd,
                                // 初回入金予定月を契約開始月のままにしていたら一緒に動かす
                                firstPayment: o.firstPayment === o.contractStart ? v : o.firstPayment,
                              })
                            }
                          />
                          <span className="text-slate-400">〜</span>
                          <MonthIn value={o.contractEnd} onChange={(v) => patch(o.id, { contractEnd: v })} />
                        </div>
                      </td>
                      <td className="p-1">
                        <NumIn value={n || null} placeholder="—" onChange={(v) => v && v >= 1 && patch(o.id, { contractEnd: addMonths(o.contractStart, Math.floor(v) - 1) })} />
                      </td>
                      <td className="p-1">
                        <select className={inputCls} value={o.plan} onChange={(e) => patch(o.id, { plan: e.target.value as PaymentPlan })}>
                          {(Object.keys(PLAN_LABEL) as PaymentPlan[]).map((k) => (
                            <option key={k} value={k}>{PLAN_LABEL[k]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-1">
                        <MonthIn value={o.firstPayment} onChange={(v) => patch(o.id, { firstPayment: v })} />
                        <div className="text-[10px] text-slate-400">{paymentNote(o)}</div>
                      </td>
                      <td className="p-1 text-right tabular-nums">
                        {yen(expectedPayment(o, rules))}
                        <div className="text-[10px] text-slate-400">{o.plan === 'lump' ? (monthsInPeriod(o, rules) ? '一括入金' : '期間外') : `${monthsInPeriod(o, rules)}回分`}</div>
                      </td>
                      <td className="p-1 text-center">
                        <input type="checkbox" className="size-4 accent-emerald-600" checked={o.stable} onChange={(e) => patch(o.id, { stable: e.target.checked })} />
                      </td>
                      <td className="p-1 text-slate-400">
                        <IconButton label="削除" danger onClick={() => setOrders((os) => os.filter((x) => x.id !== o.id))}>
                          <Trash2 className="size-4" />
                        </IconButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <button className="mt-3 inline-flex items-center gap-1 rounded-lg border border-emerald-600 px-3 py-1.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50" onClick={add}>
          <Plus className="size-4" /> 受注を追加
        </button>
        <p className="mt-2 text-xs text-slate-500">
          支払方法が「分割」なら、初回入金予定月から契約月数と同じ回数、毎月 配分 × 単月受注金額 の入金があるとみなします。「一括」なら、初回入金予定月に契約総額（単月受注金額 × 契約月数）× 配分 を1回で入金とみなします。期間内見込みは、そのうち査定期間に入る分です。月数を変えると終了月が、開始月を変えると同じ月数のまま終了月が動きます。
        </p>
      </Card>
    </>
  );
}

/** 入金予定の説明（分割は最終月と回数、一括は総額） */
function paymentNote(o: Order): string {
  if (!paymentCount(o)) return '入金予定なし';
  if (o.plan === 'lump') return `一括 ${yen(contractTotal(o))}円`;
  return `${ymLabel(lastPayment(o))}まで ${paymentCount(o)}回`;
}

/** 年月の入力（YYYY-MM）。月の入力に対応しないブラウザでは「2026-07」のように打てる */
function MonthIn({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input type="month" className={inputCls} value={value} placeholder="2026-07" onChange={(e) => onChange(e.target.value)} />;
}
