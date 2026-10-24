import { useState } from 'react';
import { PERIOD_MONTHS, bonusRate, emptyRecord, judge, monthLabel, monthTarget, type Inputs, type MissionDef, type Rules } from './calc';
import { Card, Field, NumIn, Stat } from './ui';

const months = Array.from({ length: PERIOD_MONTHS }, (_, i) => i);
const KIND_TEXT = { gte: '以上で達成', lte: '以下で達成', check: '●×で判定' } as const;
const POLICY_TEXT = { exclude: '未入力のマスは数えずに', achieved: '未入力のマスは達成とみなして', failed: '未入力のマスは未達とみなして' } as const;

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

  /** ミッション m の i ヶ月目の実数・目標を書き換える */
  const patch = (m: MissionDef, i: number, field: 'actual' | 'target', v: number | null) => {
    const rec = inputs.records[m.id] ?? emptyRecord();
    setInput('records', { ...inputs.records, [m.id]: { ...rec, [field]: months.map((j) => (j === i ? v : rec[field][j] ?? null)) } });
  };

  return (
    <>
      <Card
        title="月のミッション入力"
        aside={
          <button className="text-sm font-bold text-emerald-700 hover:underline" onClick={goSettings}>
            項目・目標を設定で変える →
          </button>
        }
      >
        <div className="mb-4 flex flex-wrap gap-1">
          {months.map((i) => {
            const done = rules.missions.filter((m) => judge(m, inputs.records[m.id], i) != null).length;
            return (
              <button
                key={i}
                className={`rounded-lg px-3 py-1.5 text-sm font-bold ${month === i ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                onClick={() => setMonth(i)}
              >
                {label(i)}
                <span className="ml-1 text-[10px] font-normal opacity-80">{done}/{rules.missions.length}</span>
              </button>
            );
          })}
        </div>

        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="p-1">ミッション</th>
                <th className="p-1 w-36">目標</th>
                <th className="p-1 w-40">実数</th>
                <th className="p-1 w-20 text-center">判定</th>
              </tr>
            </thead>
            <tbody>
              {rules.missions.map((m) => {
                const rec = inputs.records[m.id];
                const result = judge(m, rec, month);
                return (
                  <tr key={m.id} className="border-t border-slate-100">
                    <td className="p-1">
                      {m.name}
                      <div className="text-[10px] text-slate-400">{KIND_TEXT[m.kind]}</div>
                    </td>
                    <td className="p-1">
                      {m.kind === 'check' ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <NumIn value={rec?.target[month] ?? null} placeholder={m.target == null ? '目標を入力' : String(m.target)} onChange={(v) => patch(m, month, 'target', v)} />
                          <span className="text-xs text-slate-500">{m.unit}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-1">
                      {m.kind === 'check' ? (
                        <div className="flex gap-1">
                          {([1, 0] as const).map((v) => (
                            <button
                              key={v}
                              className={`flex-1 rounded-md border px-2 py-1 text-sm font-bold ${rec?.actual[month] === v ? (v ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-rose-400 bg-rose-50 text-rose-600') : 'border-slate-300 text-slate-400'}`}
                              onClick={() => patch(m, month, 'actual', rec?.actual[month] === v ? null : v)}
                            >
                              {v ? '● 達成' : '× 未達'}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <NumIn value={rec?.actual[month] ?? null} placeholder="未入力" onChange={(v) => patch(m, month, 'actual', v)} />
                          <span className="text-xs text-slate-500">{m.unit}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-1 text-center">
                      <Mark result={result} />
                      {result == null && m.kind !== 'check' && monthTarget(m, rec, month) == null && <div className="text-[10px] text-amber-600">目標なし</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="ミッション達成状況">
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="p-1 text-left">ミッション</th>
                {months.map((i) => <th key={i} className="p-1 w-14 text-center">{label(i)}</th>)}
              </tr>
            </thead>
            <tbody>
              {rules.missions.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="p-1">{m.name}</td>
                  {months.map((i) => (
                    <td key={i} className="p-1 text-center">
                      <button onClick={() => setMonth(i)} aria-label={`${m.name} ${label(i)}`}>
                        <Mark result={judge(m, inputs.records[m.id], i)} />
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
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
            ＝ {POLICY_TEXT[rules.missingPolicy]}達成率を出し、{rules.roundingUnit > 0 ? `${rules.roundingUnit}%単位に四捨五入` : '四捨五入せず'} − 反省文 × {rules.reflectionPenalty}%
            {rate.missing > 0 && `（未入力 ${rate.missing}マス）`}
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
