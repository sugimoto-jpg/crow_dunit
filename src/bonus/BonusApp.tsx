import { useEffect, useState } from 'react';
import { Banknote, Calculator, ClipboardCheck, ClipboardList, Settings as SettingsIcon, Wallet } from 'lucide-react';
import type { Inputs, Order, PaymentRow, Rules } from './calc';
import { ForecastView } from './ForecastView';
import { MissionView } from './MissionView';
import { OrdersView } from './OrdersView';
import { PaymentsView } from './PaymentsView';
import { SettingsView } from './SettingsView';
import { load, save } from './storage';

type Tab = 'forecast' | 'orders' | 'payments' | 'missions' | 'settings';
const TABS = [
  { id: 'forecast', label: '予測', short: '予測', note: '今期の給与・賞与の見込み', icon: Calculator },
  { id: 'orders', label: '受注一覧', short: '受注', note: '受注と契約・入金予定', icon: ClipboardList },
  { id: 'payments', label: '入金履歴入力', short: '入金', note: '企業・ユニット別の実際の入金', icon: Banknote },
  { id: 'missions', label: 'ミッション表', short: 'ミッション', note: '毎月のミッションと賞与倍率', icon: ClipboardCheck },
  { id: 'settings', label: '設定', short: '設定', note: '計算ルール・テンプレート', icon: SettingsIcon },
] as const;

export function BonusApp() {
  const [initial] = useState(load);
  const [orders, setOrders] = useState<Order[]>(initial.orders);
  const [rules, setRules] = useState<Rules>(initial.rules);
  const [inputs, setInputs] = useState<Inputs>(initial.inputs);
  const [payments, setPayments] = useState<PaymentRow[]>(initial.payments);
  const [tab, setTab] = useState<Tab>('forecast');

  useEffect(() => save({ orders, rules, inputs, payments }), [orders, rules, inputs, payments]);

  const setRule = <K extends keyof Rules>(k: K, v: Rules[K]) => setRules((r) => ({ ...r, [k]: v }));
  const setInput = <K extends keyof Inputs>(k: K, v: Inputs[K]) => setInputs((s) => ({ ...s, [k]: v }));

  const current = TABS.find((t) => t.id === tab)!;
  const go = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-screen bg-canvas text-ink lg:flex">
      {/* PC：左のメニュー */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-nav px-3 py-5 text-nav-ink lg:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <span className="grid size-9 place-items-center rounded-xl bg-white/10 text-white">
            <Wallet className="size-5" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold text-white">賞与・給与予測</div>
            <div className="text-[11px] opacity-70">{periodText(rules)}</div>
          </div>
        </div>
        <nav className="space-y-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${tab === id ? 'bg-white/12 text-white' : 'hover:bg-white/6 hover:text-white'}`}
              onClick={() => go(id)}
            >
              <Icon className="size-4.5" />
              {label}
            </button>
          ))}
        </nav>
        <p className="mt-auto px-2 text-[11px] leading-relaxed opacity-60">入力内容はこの端末のブラウザにだけ保存されます。</p>
      </aside>

      <main className="min-w-0 flex-1 px-4 pt-4 pb-28 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl space-y-5">
          <header className="flex items-end justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-muted lg:hidden">
                <Wallet className="size-3.5" /> 賞与・給与予測
              </div>
              <h1 className="text-xl font-bold sm:text-2xl">{current.label}</h1>
              <p className="text-sm text-muted">{current.note}</p>
            </div>
            <button className="shrink-0 rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold text-ink-2 hover:bg-surface-2" onClick={() => go('settings')}>
              {periodText(rules)}
            </button>
          </header>

          {tab === 'forecast' && <ForecastView orders={orders} payments={payments} rules={rules} inputs={inputs} setInput={setInput} goOrders={() => go('orders')} goPayments={() => go('payments')} goMissions={() => go('missions')} />}
          {tab === 'orders' && <OrdersView orders={orders} setOrders={setOrders} rules={rules} />}
          {tab === 'payments' && <PaymentsView payments={payments} setPayments={setPayments} orders={orders} rules={rules} />}
          {tab === 'missions' && <MissionView rules={rules} inputs={inputs} setInput={setInput} goSettings={() => go('settings')} />}
          {tab === 'settings' && <SettingsView rules={rules} setRule={setRule} reset={(r) => setRules(r)} />}
        </div>
      </main>

      {/* スマホ：下のタブ */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {TABS.map(({ id, short, icon: Icon }) => (
          <button
            key={id}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-bold ${tab === id ? 'text-accent-ink' : 'text-muted'}`}
            onClick={() => go(id)}
          >
            <Icon className="size-5" />
            {short}
          </button>
        ))}
      </nav>
    </div>
  );
}

function periodText(r: Rules): string {
  return `${r.periodYear}年 ${r.periodStart === 1 ? '上半期' : '下半期'}`;
}
