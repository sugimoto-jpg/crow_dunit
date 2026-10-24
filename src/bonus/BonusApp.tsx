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
  { id: 'forecast', label: '予測', icon: Calculator },
  { id: 'orders', label: '受注一覧', icon: ClipboardList },
  { id: 'payments', label: '入金履歴入力', icon: Banknote },
  { id: 'missions', label: 'ミッション表', icon: ClipboardCheck },
  { id: 'settings', label: '設定', icon: SettingsIcon },
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

  return (
    <div className="min-h-screen px-4 py-6 text-slate-800">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center gap-3">
          <Wallet className="size-7 text-emerald-600" />
          <div className="flex-1">
            <h1 className="text-xl font-bold">賞与・給与予測</h1>
            <p className="text-sm text-slate-500">半年ごとの査定を、受注と入金額から3通りで予測します。入力内容はこの端末にだけ保存されます。</p>
          </div>
        </header>

        <nav className="flex gap-1 rounded-xl bg-slate-200/70 p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold ${tab === id ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
              onClick={() => setTab(id)}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </nav>

        {tab === 'forecast' && <ForecastView orders={orders} payments={payments} rules={rules} inputs={inputs} setInput={setInput} goOrders={() => setTab('orders')} goPayments={() => setTab('payments')} goMissions={() => setTab('missions')} />}
        {tab === 'orders' && <OrdersView orders={orders} setOrders={setOrders} rules={rules} />}
        {tab === 'payments' && <PaymentsView payments={payments} setPayments={setPayments} orders={orders} rules={rules} />}
        {tab === 'missions' && <MissionView rules={rules} inputs={inputs} setInput={setInput} goSettings={() => setTab('settings')} />}
        {tab === 'settings' && <SettingsView rules={rules} setRule={setRule} reset={(r) => setRules(r)} />}
      </div>
    </div>
  );
}
