import { useMemo } from 'react';
import { ListPlus, Plus, Trash2 } from 'lucide-react';
import { actualMonthly, expectedMonthly, monthsInPeriod, paidAfterShare, periodMonths, ymLabel, type Order, type PaymentRow, type Rules } from './calc';
import { man } from './charts';
import { Card, IconButton, Labeled, NumIn, Stat, TextIn, btnPrimary, btnSecondary, useWide, yen } from './ui';

interface Props {
  payments: PaymentRow[];
  setPayments: (f: (rs: PaymentRow[]) => PaymentRow[]) => void;
  orders: Order[];
  rules: Rules;
}

const key = (company: string, unit: string) => `${company.trim()}\u0000${unit.trim()}`;
const newRow = (p: Partial<PaymentRow> = {}): PaymentRow => ({ id: crypto.randomUUID(), company: '', unit: '', share: 100, amounts: {}, ...p });

export function PaymentsView({ payments, setPayments, orders, rules }: Props) {
  const months = periodMonths(rules);
  const actual = useMemo(() => actualMonthly(payments, rules), [payments, rules]);
  const expected = useMemo(() => expectedMonthly(orders, rules), [orders, rules]);
  const patch = (id: string, p: Partial<PaymentRow>) => setPayments((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const setAmount = (r: PaymentRow, ym: string, v: number | null) => patch(r.id, { amounts: { ...r.amounts, [ym]: v } });

  /** 査定期間に入金予定がある受注のうち、まだ行がない企業・ユニット */
  const missing = useMemo(() => {
    const have = new Set(payments.map((r) => key(r.company, r.unit)));
    const seen = new Set<string>();
    return orders.filter((o) => {
      const k = key(o.company, o.unit);
      if (!o.company.trim() || have.has(k) || seen.has(k) || monthsInPeriod(o, rules) === 0) return false;
      seen.add(k);
      return true;
    });
  }, [orders, payments, rules]);

  const wide = useWide();
  const remove = (r: PaymentRow) => (
    <IconButton label="削除" danger onClick={() => confirm(`「${r.company || '名前なし'}」の入金履歴を削除しますか？`) && setPayments((rs) => rs.filter((x) => x.id !== r.id))}>
      <Trash2 className="size-4" />
    </IconButton>
  );
  const total = actual.reduce<number>((s, v) => s + (v ?? 0), 0);
  const expectedTotal = expected.reduce((s, v) => s + v, 0);
  /** 入力済みの月だけで比べた、実入金と受注履歴の見込みの差 */
  const diff = actual.reduce<number>((s, v, i) => (v == null ? s : s + v - expected[i]), 0);

  return (
    <Card title="入金履歴" note={`${ymLabel(months[0])}〜${ymLabel(months[5])}の実際の入金額（配分前）`}>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="企業・ユニット" value={`${payments.length}件`} />
        <Stat label="入力済みの月" value={`${actual.filter((v) => v != null).length} / 6ヶ月`} />
        <Stat label="実際の入金額（配分後）" value={yen(total)} />
        <Stat label="見込みとの差（入力済みの月）" value={`${diff >= 0 ? '+' : ''}${yen(diff)}`} />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          className={btnSecondary}
          disabled={!missing.length}
          onClick={() => setPayments((rs) => [...rs, ...missing.map((o) => newRow({ company: o.company.trim(), unit: o.unit.trim(), share: o.share }))])}
        >
          <ListPlus className="size-4" /> 受注一覧から企業・ユニットを追加{missing.length ? `（${missing.length}件）` : ''}
        </button>
      </div>

      {payments.length === 0 ? (
        <p className="rounded-lg bg-surface-2 p-4 text-sm text-muted">
          まだ入金履歴がありません。「受注一覧から企業・ユニットを追加」で、査定期間に入金予定がある企業・ユニットをまとめて入れられます。
        </p>
      ) : !wide ? (
        <div className="space-y-3">
          {payments.map((r) => (
            <div key={r.id} className="rounded-xl border border-line p-3">
              <div className="flex items-start gap-1">
                <Labeled label="社名" className="flex-1">
                  <TextIn value={r.company} onChange={(v) => patch(r.id, { company: v })} placeholder="株式会社〇〇" />
                </Labeled>
                <div className="pt-5">{remove(r)}</div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Labeled label="ユニット名">
                  <TextIn value={r.unit} onChange={(v) => patch(r.id, { unit: v })} placeholder="〇〇ユニット" />
                </Labeled>
                <Labeled label="配分(%)">
                  <NumIn value={r.share} onChange={(v) => patch(r.id, { share: v ?? 0 })} />
                </Labeled>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
                {months.map((ym) => (
                  <Labeled key={ym} label={`${ymLabel(ym).replace(/^\d+年/, '')}の入金`}>
                    <NumIn value={r.amounts[ym] ?? null} placeholder="—" onChange={(v) => setAmount(r, ym, v)} />
                  </Labeled>
                ))}
              </div>
              <div className="mt-3 flex justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
                <span className="text-muted">合計（配分後）</span>
                <span className="font-bold tabular-nums">{yen(months.reduce((s, ym) => s + paidAfterShare(r, ym), 0))}</span>
              </div>
            </div>
          ))}
          <div className="rounded-xl bg-surface-2 p-3">
            <div className="mb-2 text-sm font-bold">月合計（配分後）</div>
            <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
              {months.map((ym, i) => (
                <div key={ym} className="flex justify-between gap-1">
                  <span className="text-muted">{ymLabel(ym).replace(/^\d+年/, '')}</span>
                  <span className="tabular-nums">{actual[i] == null ? <span className="text-faint">—</span> : man(actual[i]!)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <table className="w-full min-w-[1240px] text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="sticky left-0 z-10 bg-surface p-1 min-w-40 text-left">社名</th>
                <th className="p-1 min-w-28 text-left">ユニット名</th>
                <th className="p-1 w-20 text-left">配分(%)</th>
                {months.map((ym) => (
                  <th key={ym} className="p-1 w-32 text-right">{ymLabel(ym).replace(/^\d+年/, '')}</th>
                ))}
                <th className="p-1 w-28 text-right">合計（配分後）</th>
                <th className="p-1 w-8" />
              </tr>
            </thead>
            <tbody>
              {payments.map((r) => (
                <tr key={r.id} className="border-t border-line hover:bg-surface-2/60">
                  <td className="sticky left-0 z-10 bg-surface p-1"><TextIn value={r.company} onChange={(v) => patch(r.id, { company: v })} placeholder="株式会社〇〇" /></td>
                  <td className="p-1"><TextIn value={r.unit} onChange={(v) => patch(r.id, { unit: v })} placeholder="〇〇ユニット" /></td>
                  <td className="p-1"><NumIn value={r.share} onChange={(v) => patch(r.id, { share: v ?? 0 })} /></td>
                  {months.map((ym) => (
                    <td key={ym} className="p-1">
                      <NumIn value={r.amounts[ym] ?? null} placeholder="—" onChange={(v) => setAmount(r, ym, v)} />
                    </td>
                  ))}
                  <td className="p-1 text-right tabular-nums">{yen(months.reduce((s, ym) => s + paidAfterShare(r, ym), 0))}</td>
                  <td className="p-1">{remove(r)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="text-sm">
              <tr className="border-t-2 border-line-strong font-bold">
                <td className="sticky left-0 z-10 bg-surface p-1" colSpan={3}>月合計（配分後）</td>
                {actual.map((v, i) => (
                  <td key={i} className="p-1 text-right tabular-nums">{v == null ? <span className="font-normal text-muted">未入力</span> : yen(v)}</td>
                ))}
                <td className="p-1 text-right tabular-nums">{yen(total)}</td>
                <td />
              </tr>
              <tr className="text-xs text-muted">
                <td className="sticky left-0 z-10 bg-surface p-1" colSpan={3}>参考：受注履歴の見込み</td>
                {expected.map((v, i) => <td key={i} className="p-1 text-right tabular-nums">{yen(v)}</td>)}
                <td className="p-1 text-right tabular-nums">{yen(expectedTotal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <button
        className={`mt-4 ${btnPrimary}`}
        onClick={() => setPayments((rs) => [...rs, newRow()])}
      >
        <Plus className="size-4" /> 企業・ユニットを追加
      </button>
      <p className="mt-2 text-xs text-muted">
        各月に実際に入金された額（配分前）を入れます。配分を掛けた額の月合計が「③ 実際の入金額から」の予測に使われます。入金がなかった月は 0、まだ分からない月は空欄にしてください（空欄の月は平均の計算に入りません）。査定期間は設定で変えられ、過去の期間の入力も残ります。
      </p>
    </Card>
  );
}
