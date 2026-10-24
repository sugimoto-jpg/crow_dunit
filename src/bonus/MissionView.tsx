import { useState } from 'react';
import { ArrowDown, ArrowUp, Copy, FileDown, Plus, Trash2 } from 'lucide-react';
import { PERIOD_MONTHS, bonusRate, cloneMissions, judge, monthLabel, tallyMonth, type Inputs, type Mission, type MissionKind, type Rules } from './calc';
import { Card, Field, IconButton, Labeled, NumIn, Stat, TextIn, btnPrimary, btnSecondary, inputCls, useWide } from './ui';

const months = Array.from({ length: PERIOD_MONTHS }, (_, i) => i);
const POLICY_TEXT = { exclude: '未入力の項目は数えずに', achieved: '未入力の項目は達成とみなして', failed: '未入力の項目は未達とみなして' } as const;

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

  /** 1つのミッションの入力欄（PC の表とスマホのカードで同じものを使う） */
  const fields = (m: Mission, k: number) => {
    const numeric = m.kind !== 'check';
    return {
      name: <TextIn value={m.name} onChange={(v) => patch(m.id, { name: v })} placeholder="ミッション名" />,
      kind: (
        <select className={inputCls} value={m.kind} onChange={(e) => patch(m.id, { kind: e.target.value as MissionKind, actual: null })}>
          <option value="gte">実数が目標以上</option>
          <option value="lte">実数が目標以下</option>
          <option value="check">●×を手で付ける</option>
        </select>
      ),
      target: numeric ? <NumIn value={m.target} placeholder="目標" onChange={(v) => patch(m.id, { target: v })} /> : <span className="text-xs text-muted">—</span>,
      unit: numeric && <TextIn value={m.unit} onChange={(v) => patch(m.id, { unit: v })} placeholder="件・%" />,
      actual: numeric ? (
        <NumIn value={m.actual} placeholder="未入力" onChange={(v) => patch(m.id, { actual: v })} />
      ) : (
        <div className="mt-1 flex gap-1">
          {([1, 0] as const).map((v) => (
            <button
              key={v}
              className={`h-10 flex-1 rounded-lg border px-2 text-sm font-bold sm:h-9 ${m.actual === v ? (v ? 'border-accent bg-accent-soft text-accent-ink' : 'border-bad bg-bad-soft text-bad') : 'border-line-strong text-muted'}`}
              onClick={() => patch(m.id, { actual: m.actual === v ? null : v })}
            >
              {v ? '● 達成' : '× 未達'}
            </button>
          ))}
        </div>
      ),
      result: (
        <>
          <Mark result={judge(m)} />
          {numeric && m.target == null && <div className="text-[10px] text-warn">目標なし</div>}
        </>
      ),
      actions: (
        <div className="flex justify-end gap-0.5">
          <IconButton label="上へ" disabled={k === 0} onClick={() => move(k, -1)}><ArrowUp className="size-4" /></IconButton>
          <IconButton label="下へ" disabled={k === list.length - 1} onClick={() => move(k, 1)}><ArrowDown className="size-4" /></IconButton>
          <IconButton label="削除" danger onClick={() => setList(list.filter((x) => x.id !== m.id))}><Trash2 className="size-4" /></IconButton>
        </div>
      ),
    };
  };
  const wide = useWide();

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
                className={`rounded-lg px-3 py-1.5 text-sm font-bold ${month === i ? 'bg-accent text-white' : 'bg-surface-2 text-ink-2 hover:bg-line'}`}
                onClick={() => setMonth(i)}
              >
                {label(i)}
                <span className="ml-1 text-[10px] font-normal opacity-80">{n ? `${t.achieved}/${n}` : '未作成'}</span>
              </button>
            );
          })}
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <button className={btnSecondary} disabled={!prev.length} onClick={() => fill(cloneMissions(prev), '前月の項目')}>
            <Copy className="size-4" /> 前月（{month > 0 ? label(month - 1) : '—'}）の項目をコピー
          </button>
          <button className={btnSecondary} disabled={!rules.missionTemplate.length} onClick={() => fill(cloneMissions(rules.missionTemplate), 'テンプレート')}>
            <FileDown className="size-4" /> テンプレートを読み込む
          </button>
          <button className="text-sm text-accent-ink hover:underline" onClick={goSettings}>
            テンプレートを編集 →
          </button>
        </div>

        {list.length === 0 ? (
          <p className="rounded-lg bg-surface-2 p-4 text-sm text-muted">
            {label(month)}のミッションはまだありません。その月に出たミッションを「項目を追加」で入れるか、前月やテンプレートから読み込んで書き換えてください。
          </p>
        ) : !wide ? (
          <div className="space-y-3">
            {list.map((m, k) => {
              const f = fields(m, k);
              return (
                <div key={m.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-start gap-2">
                    <Labeled label="ミッション" className="flex-1">{f.name}</Labeled>
                    <div className="pt-5">{f.result}</div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Labeled label="判定の仕方" className="col-span-2">{f.kind}</Labeled>
                    {m.kind !== 'check' && (
                      <>
                        <Labeled label="目標">{f.target}</Labeled>
                        <Labeled label="単位">{f.unit}</Labeled>
                      </>
                    )}
                    <Labeled label={m.kind === 'check' ? '結果' : '実数'} className="col-span-2">{f.actual}</Labeled>
                  </div>
                  <div className="mt-2 flex justify-end">{f.actions}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="p-1">ミッション</th>
                  <th className="p-1 w-48">判定の仕方</th>
                  <th className="p-1 w-32">目標</th>
                  <th className="p-1 w-16">単位</th>
                  <th className="p-1 w-44">実数</th>
                  <th className="p-1 w-14 text-center">判定</th>
                  <th className="p-1 w-24" />
                </tr>
              </thead>
              <tbody>
                {list.map((m, k) => {
                  const f = fields(m, k);
                  return (
                    <tr key={m.id} className="border-t border-line hover:bg-surface-2/60">
                      <td className="p-1">{f.name}</td>
                      <td className="p-1">{f.kind}</td>
                      <td className="p-1">{f.target}</td>
                      <td className="p-1">{f.unit}</td>
                      <td className="p-1">{f.actual}</td>
                      <td className="p-1 text-center">{f.result}</td>
                      <td className="p-1">{f.actions}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <button
          className={`mt-4 ${btnPrimary}`}
          onClick={() => setList([...list, { id: crypto.randomUUID(), name: '', kind: 'gte', target: null, unit: '', actual: null }])}
        >
          <Plus className="size-4" /> 項目を追加
        </button>
      </Card>

      <Card title="半年のミッション達成状況">
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <table className="w-full text-[13px] sm:text-sm">
            <thead className="text-xs text-muted">
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
                  <tr key={i} className={`cursor-pointer border-t border-line hover:bg-surface-2 ${month === i ? 'bg-accent-soft/60' : ''}`} onClick={() => setMonth(i)}>
                    <td className="p-1 font-bold">{label(i)}</td>
                    <td className="p-1 text-right tabular-nums">{ms.length || <span className="text-muted">未作成</span>}</td>
                    <td className="p-1 text-right tabular-nums text-accent-ink">{t.achieved}</td>
                    <td className="p-1 text-right tabular-nums text-bad">{t.failed}</td>
                    <td className="p-1 text-right tabular-nums text-muted">{t.missing}</td>
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
          <label className="block text-xs text-muted">
            賞与倍率を手入力（空欄なら自動）
            <NumIn value={inputs.bonusRateOverride} placeholder={`${rate.rate}`} onChange={(v) => setInput('bonusRateOverride', v)} />
          </label>
        </div>
        <p className="mt-2 text-sm">
          賞与倍率 <span className="text-lg font-bold text-accent-ink">{rate.rate}%</span>
          <span className="ml-2 text-xs text-muted">
            ＝ 6ヶ月分の全ミッションのうち{POLICY_TEXT[rules.missingPolicy]}達成率を出し、{rules.roundingUnit > 0 ? `${rules.roundingUnit}%単位に四捨五入` : '四捨五入せず'} − 反省文 × {rules.reflectionPenalty}%
            {rate.missing > 0 && `（未入力 ${rate.missing}項目）`}
          </span>
        </p>
      </Card>
    </>
  );
}

function Mark({ result }: { result: boolean | null }) {
  if (result == null) return <span className="inline-grid size-7 place-items-center rounded-full bg-surface-2 text-faint">−</span>;
  return result ? (
    <span className="inline-grid size-7 place-items-center rounded-full bg-accent-soft font-bold text-accent-ink">●</span>
  ) : (
    <span className="inline-grid size-7 place-items-center rounded-full bg-bad-soft font-bold text-bad">×</span>
  );
}
