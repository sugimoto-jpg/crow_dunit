import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { DEFAULT_RULES, type MissingPolicy, type MissionDef, type MissionKind, type Rules } from './calc';
import { Card, Field, NumIn, TextIn, inputCls } from './ui';

interface Props {
  rules: Rules;
  setRule: <K extends keyof Rules>(k: K, v: Rules[K]) => void;
  reset: (r: Rules) => void;
}

export function SettingsView({ rules, setRule, reset }: Props) {
  const setMission = (id: string, patch: Partial<MissionDef>) => setRule('missions', rules.missions.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const move = (k: number, d: -1 | 1) => {
    const ms = [...rules.missions];
    [ms[k], ms[k + d]] = [ms[k + d], ms[k]];
    setRule('missions', ms);
  };

  return (
    <>
      <Card title="査定期間">
        <select className={`${inputCls} max-w-xs`} value={rules.periodStart} onChange={(e) => setRule('periodStart', Number(e.target.value))}>
          <option value={1}>上半期（1月〜6月）</option>
          <option value={7}>下半期（7月〜12月）</option>
        </select>
      </Card>

      <Card title="賞与の計算ルール">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="賞与対象原資の率(%)" value={rules.poolRate} onChange={(v) => setRule('poolRate', v)} />
          <Field label="マネジメント報酬(%)" value={rules.managementRate} onChange={(v) => setRule('managementRate', v)} />
          <Field label="粗利率(%・参考表示)" value={rules.grossRate} onChange={(v) => setRule('grossRate', v)} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          賞与対象原資 = 配分原資 × (賞与対象原資の率 − マネジメント報酬) = 配分原資 × {+(rules.poolRate - rules.managementRate).toFixed(2)}%
        </p>
      </Card>

      <Card title="賞与倍率のルール">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="四捨五入の単位(%・0で四捨五入しない)" value={rules.roundingUnit} onChange={(v) => setRule('roundingUnit', v)} />
          <Field label="反省文1枚あたりの減額(%)" value={rules.reflectionPenalty} onChange={(v) => setRule('reflectionPenalty', v)} />
          <label className="block text-xs text-slate-500">
            未入力の月の扱い
            <select className={inputCls} value={rules.missingPolicy} onChange={(e) => setRule('missingPolicy', e.target.value as MissingPolicy)}>
              <option value="exclude">数えない（入力済みの月だけで達成率）</option>
              <option value="achieved">達成とみなす</option>
              <option value="failed">未達とみなす</option>
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500">賞与倍率 = 達成数 ÷ マスの数 を四捨五入の単位で丸め − 反省文の枚数 × 減額。期の途中は「数えない」にすると、ここまでの達成ペースで予測できます。</p>
      </Card>

      <Card title="ミッション項目">
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="p-1">項目名</th>
                <th className="p-1 w-36">判定の仕方</th>
                <th className="p-1 w-36">毎月の目標</th>
                <th className="p-1 w-20">単位</th>
                <th className="p-1 w-24" />
              </tr>
            </thead>
            <tbody>
              {rules.missions.map((m, k) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="p-1"><TextIn value={m.name} onChange={(v) => setMission(m.id, { name: v })} /></td>
                  <td className="p-1">
                    <select className={inputCls} value={m.kind} onChange={(e) => setMission(m.id, { kind: e.target.value as MissionKind })}>
                      <option value="gte">実数が目標以上</option>
                      <option value="lte">実数が目標以下</option>
                      <option value="check">●×を手で付ける</option>
                    </select>
                  </td>
                  <td className="p-1">
                    {m.kind === 'check' ? <span className="text-xs text-slate-400">—</span> : <NumIn value={m.target} placeholder="月ごとに入力" onChange={(v) => setMission(m.id, { target: v })} />}
                  </td>
                  <td className="p-1">{m.kind !== 'check' && <TextIn value={m.unit} onChange={(v) => setMission(m.id, { unit: v })} placeholder="件・%・円" />}</td>
                  <td className="p-1">
                    <div className="flex justify-end gap-0.5 text-slate-400">
                      <IconButton label="上へ" disabled={k === 0} onClick={() => move(k, -1)}><ArrowUp className="size-4" /></IconButton>
                      <IconButton label="下へ" disabled={k === rules.missions.length - 1} onClick={() => move(k, 1)}><ArrowDown className="size-4" /></IconButton>
                      <IconButton label="削除" danger onClick={() => confirm(`「${m.name}」を削除しますか？`) && setRule('missions', rules.missions.filter((x) => x.id !== m.id))}>
                        <Trash2 className="size-4" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          className="mt-3 inline-flex items-center gap-1 rounded-lg border border-emerald-600 px-3 py-1.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
          onClick={() => setRule('missions', [...rules.missions, { id: crypto.randomUUID(), name: '', kind: 'gte', target: null, unit: '' }])}
        >
          <Plus className="size-4" /> 項目を追加
        </button>
        <p className="mt-2 text-xs text-slate-500">毎月の目標を空欄にすると、ミッション表で月ごとに目標を入れられます（売上目標など）。目標を入れていても、月ごとに上書きできます。</p>
      </Card>

      <Card title="他商材">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {rules.addonNames.map((n, k) => (
            <div key={k} className="flex items-center gap-1">
              <TextIn value={n} onChange={(v) => setRule('addonNames', rules.addonNames.map((x, j) => (j === k ? v : x)))} />
              <IconButton label="削除" danger onClick={() => setRule('addonNames', rules.addonNames.filter((_, j) => j !== k))}>
                <Trash2 className="size-4" />
              </IconButton>
            </div>
          ))}
        </div>
        <button
          className="mt-3 inline-flex items-center gap-1 rounded-lg border border-emerald-600 px-3 py-1.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
          onClick={() => setRule('addonNames', [...rules.addonNames, ''])}
        >
          <Plus className="size-4" /> 商材を追加
        </button>
        <p className="mt-2 text-xs text-slate-500">ここに並べた商材ごとに、予測画面で半年分の入金額を入れられます。</p>
      </Card>

      <button
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-rose-600"
        onClick={() => confirm('設定を初期値に戻しますか？（受注やミッションの記録は消えません）') && reset(DEFAULT_RULES)}
      >
        <RotateCcw className="size-4" /> 設定を初期値に戻す
      </button>
    </>
  );
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      className={`rounded p-1 disabled:opacity-30 ${danger ? 'hover:bg-rose-50 hover:text-rose-600' : 'hover:bg-slate-100 hover:text-slate-700'}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
