import { useState } from 'react';
import { ArrowDown, ArrowUp, Copy, FileDown, Plus, Trash2 } from 'lucide-react';
import { PERIOD_MONTHS, bonusRate, cloneMissions, judge, monthLabel, tallyMonth, type Inputs, type Mission, type MissionKind, type Rules } from './calc';
import { Card, Field, IconButton, NumIn, Stat, TextIn, inputCls } from './ui';

const months = Array.from({ length: PERIOD_MONTHS }, (_, i) => i);
const POLICY_TEXT = { exclude: '未入力の項目は数えずに', achieved: '未入力の項目は達成とみなして', failed: '未入力の項目は未達とみなして' } as const;
const btnCls = 'inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-bold disabled:opacity-40';

interface Props {
  rules: Rules;
  inputs: Inputs;
  setInput: <K extends keyof Inputs>(k: K, v: Inputs[K]) => void;
  goSettings: () => void;
}

export function MissionView({ rules, inputs, setInput, goSettings }: Props) {
  const [month, setMonth] = useState(0);
  const rate = bonusRate(rules, inputs);
  const label = (i: number) => monthLabel(rules.periodStart, i);
  const list = inputs.monthMissions[month] ?? [];

  const setList = (ms: Mission[]) => setInput('monthMissions', months.map((i) => (i === month ? ms : inputs.monthMissions[i] ?? [])));
  const patch = (id: string, p: Partial<Mission>) => setList(list.map((m) => (m.id === id ? { ...m, ...p } : m)));
  const move = (k: number, d: -1 | 1) => {
    const ms = [...list];
    [ms[k], ms[k + d]] = [ms[k + d], ms[k]];
    setList(ms);
  };
  /** 項目を差し込む。すでに項目がある月は上書きの確認をする */
  const fill = (ms: Mission[], what: string) => {
    if (list.length && !confirm(`${label(month)}のミッションを${what}で置き換えますか？（入力した実数は消えます）`)) return;
    setList(ms);
  };
  const prev = month > 0 ? inputs.monthMissions[month - 1] ?? [] : [];

  return (
    <>
      <Card title="月のミッション">
        <div className="mb-4 flex flex-wrap gap-1">
          {months.map((i) => {
            const t = tallyMonth(inputs.monthMissions[i] ?? []);
            const n = (inputs.monthMissions[i] ?? []).length;
            return (
              <button
                key={i}
                className={`rounded-lg px-3 py-1.5 text-sm font-bold ${month === i ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                onClick={() => setMonth(i)}
              >
                {label(i)}
                <span className="ml-1 text-[10px] font-normal opacity-80">{n ? `${t.achieved}/${n}` : '未作成'}</span>
              </button>
            );
          })}
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <button className={`${btnCls} border-slate-300 text-slate-700 hover:bg-slate-50`} disabled={!prev.length} onClick={() => fill(cloneMissions(prev), '前月の項目')}>
            <Copy className="size-4" /> 前月（{month > 0 ? label(month - 1) : '—'}）の項目をコピー
          </button>
          <button className={`${btnCls} border-slate-300 text-slate-700 hover:bg-slate-50`} disabled={!rules.missionTemplate.length} onClick={() => fill(cloneMissions(rules.missionTemplate), 'テンプレート')}>
            <FileDown className="size-4" /> テンプレートを読み込む
          </button>
          <button className="text-sm text-emerald-700 hover:underline" onClick={goSettings}>
            テンプレートを編集 →
          </button>
        </div>

        {list.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
            {label(month)}のミッションはまだありません。その月に出たミッションを「項目を追加」で入れるか、前月やテンプレートから読み込んで書き換えてください。
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="p-1">ミッション</th>
                  <th className="p-1 w-36">判定の仕方</th>
                  <th className="p-1 w-32">目標</th>
                  <th className="p-1 w-16">単位</th>
                  <th className="p-1 w-44">実数</th>
                  <th className="p-1 w-14 text-center">判定</th>
                  <th className="p-1 w-24" />
                </tr>
              </thead>
              <tbody>
                {list.map((m, k) => {
                  const numeric = m.kind !== 'check';
                  return (
                    <tr key={m.id} className="border-t border-slate-100">
                      <td className="p-1"><TextIn value={m.name} onChange={(v) => patch(m.id, { name: v })} placeholder="ミッション名" /></td>
                      <td className="p-1">
                        <select className={inputCls} value={m.kind} onChange={(e) => patch(m.id, { kind: e.target.value as MissionKind, actual: null })}>
                          <option value="gte">実数が目標以上</option>
                          <option value="lte">実数が目標以下</option>
                          <option value="check">●×を手で付ける</option>
                        </select>
                      </td>
                      <td className="p-1">{numeric ? <NumIn value={m.target} placeholder="目標" onChange={(v) => patch(m.id, { target: v })} /> : <span className="text-xs text-slate-400">—</span>}</td>
                      <td className="p-1">{numeric && <TextIn value={m.unit} onChange={(v) => patch(m.id, { unit: v })} placeholder="件・%" />}</td>
                      <td className="p-1">
                        {numeric ? (
                          <NumIn value={m.actual} placeholder="未入力" onChange={(v) => patch(m.id, { actual: v })} />
                        ) : (
                          <div className="flex gap-1">
                            {([1, 0] as const).map((v) => (
                              <button
                                key={v}
                                className={`flex-1 rounded-md border px-2 py-1 text-sm font-bold ${m.actual === v ? (v ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-rose-400 bg-rose-50 text-rose-600') : 'border-slate-300 text-slate-400'}`}
                                onClick={() => patch(m.id, { actual: m.actual === v ? null : v })}
                              >
                                {v ? '● 達成' : '× 未達'}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-1 text-center">
                        <Mark result={judge(m)} />
                        {numeric && m.target == null && <div className="text-[10px] text-amber-600">目標なし</div>}
                      </td>
                      <td className="p-1">
                        <div className="flex justify-end gap-0.5 text-slate-400">
                          <IconButton label="上へ" disabled={k === 0} onClick={() => move(k, -1)}><ArrowUp className="size-4" /></IconButton>
                          <IconButton label="下へ" disabled={k === list.length - 1} onClick={() => move(k, 1)}><ArrowDown className="size-4" /></IconButton>
                          <IconButton label="削除" danger onClick={() => setList(list.filter((x) => x.id !== m.id))}><Trash2 className="size-4" /></IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <button
          className={`${btnCls} mt-3 border-emerald-600 text-emerald-700 hover:bg-emerald-50`}
          onClick={() => setList([...list, { id: crypto.randomUUID(), name: '', kind: 'gte', target: null, unit: '', actual: null }])}
        >
          <Plus className="size-4" /> 項目を追加
        </button>
      </Card>

      <Card title="半年のミッション達成状況">
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="p-1 text-left">月</th>
                <th className="p-1 text-right">項目数</th>
                <th className="p-1 text-right">達成 ●</th>
                <th className="p-1 text-right">未達 ×</th>
                <th className="p-1 text-right">未入力</th>
                <th className="p-1 text-right">達成率</th>
              </tr>
            </thead>
            <tbody>
              {months.map((i) => {
                const ms = inputs.monthMissions[i] ?? [];
                const t = tallyMonth(ms);
                const judged = t.achieved + t.failed;
                return (
                  <tr key={i} className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${month === i ? 'bg-emerald-50/50' : ''}`} onClick={() => setMonth(i)}>
                    <td className="p-1 font-bold">{label(i)}</td>
                    <td className="p-1 text-right tabular-nums">{ms.length || <span className="text-slate-400">未作成</span>}</td>
                    <td className="p-1 text-right tabular-nums text-emerald-700">{t.achieved}</td>
                    <td className="p-1 text-right tabular-nums text-rose-600">{t.failed}</td>
                    <td className="p-1 text-right tabular-nums text-slate-400">{t.missing}</td>
                    <td className="p-1 text-right tabular-nums">{judged ? `${Math.round((t.achieved / judged) * 100)}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="達成数" value={`${rate.achieved} / ${rate.total}`} />
          <Stat label="倍率（達成率）" value={`${rate.multiplier}`} />
          <Field label={`反省文の枚数（1枚 −${rules.reflectionPenalty}%）`} value={inputs.reflections} onChange={(v) => setInput('reflections', v)} />
          <label className="block text-xs text-slate-500">
            賞与倍率を手入力（空欄なら自動）
            <NumIn value={inputs.bonusRateOverride} placeholder={`${rate.rate}`} onChange={(v) => setInput('bonusRateOverride', v)} />
          </label>
        </div>
        <p className="mt-2 text-sm">
          賞与倍率 <span className="text-lg font-bold text-emerald-700">{rate.rate}%</span>
          <span className="ml-2 text-xs text-slate-500">
            ＝ 6ヶ月分の全ミッションのうち{POLICY_TEXT[rules.missingPolicy]}達成率を出し、{rules.roundingUnit > 0 ? `${rules.roundingUnit}%単位に四捨五入` : '四捨五入せず'} − 反省文 × {rules.reflectionPenalty}%
            {rate.missing > 0 && `（未入力 ${rate.missing}項目）`}
          </span>
        </p>
      </Card>
    </>
  );
}

function Mark({ result }: { result: boolean | null }) {
  if (result == null) return <span className="inline-grid size-7 place-items-center rounded-full bg-slate-50 text-slate-300">−</span>;
  return result ? (
    <span className="inline-grid size-7 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-700">●</span>
  ) : (
    <span className="inline-grid size-7 place-items-center rounded-full bg-rose-50 font-bold text-rose-500">×</span>
  );
}
