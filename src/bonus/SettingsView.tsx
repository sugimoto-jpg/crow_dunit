import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { DEFAULT_RULES, type MissingPolicy, type MissionDef, type MissionKind, type Rules } from './calc';
import { Card, Field, IconButton, NumIn, TextIn, btnPrimary, inputCls } from './ui';

interface Props {
  rules: Rules;
  setRule: <K extends keyof Rules>(k: K, v: Rules[K]) => void;
  reset: (r: Rules) => void;
}

export function SettingsView({ rules, setRule, reset }: Props) {
  const setMission = (id: string, patch: Partial<MissionDef>) => setRule('missionTemplate', rules.missionTemplate.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const move = (k: number, d: -1 | 1) => {
    const ms = [...rules.missionTemplate];
    [ms[k], ms[k + d]] = [ms[k + d], ms[k]];
    setRule('missionTemplate', ms);
  };

  return (
    <>
      <Card title="査定期間">
        <div className="grid max-w-md grid-cols-2 gap-2">
          <select className={inputCls} value={rules.periodYear} onChange={(e) => setRule('periodYear', Number(e.target.value))} aria-label="年">
            {years(rules.periodYear).map((y) => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
          <select className={inputCls} value={rules.periodStart} onChange={(e) => setRule('periodStart', Number(e.target.value))} aria-label="上半期・下半期">
            <option value={1}>上半期（1月〜6月）</option>
            <option value={7}>下半期（7月〜12月）</option>
          </select>
        </div>
        <p className="mt-2 text-xs text-muted">受注一覧の契約期間のうち、この6ヶ月に入る月の分を入金の見込みにします。</p>
      </Card>

      <Card title="賞与の計算ルール">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="賞与対象原資の率(%)" value={rules.poolRate} onChange={(v) => setRule('poolRate', v)} />
          <Field label="マネジメント報酬(%)" value={rules.managementRate} onChange={(v) => setRule('managementRate', v)} />
          <Field label="粗利率(%・参考表示)" value={rules.grossRate} onChange={(v) => setRule('grossRate', v)} />
        </div>
        <p className="mt-2 text-xs text-muted">
          賞与対象原資 = 配分原資 × (賞与対象原資の率 − マネジメント報酬) = 配分原資 × {+(rules.poolRate - rules.managementRate).toFixed(2)}%
        </p>
      </Card>

      <Card title="賞与倍率のルール">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="四捨五入の単位(%・0で四捨五入しない)" value={rules.roundingUnit} onChange={(v) => setRule('roundingUnit', v)} />
          <Field label="反省文1枚あたりの減額(%)" value={rules.reflectionPenalty} onChange={(v) => setRule('reflectionPenalty', v)} />
          <label className="block text-xs text-muted">
            実数が未入力のミッションの扱い
            <select className={inputCls} value={rules.missingPolicy} onChange={(e) => setRule('missingPolicy', e.target.value as MissingPolicy)}>
              <option value="exclude">数えない（判定できたものだけで達成率）</option>
              <option value="achieved">達成とみなす</option>
              <option value="failed">未達とみなす</option>
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs text-muted">賞与倍率 = 達成数 ÷ マスの数 を四捨五入の単位で丸め − 反省文の枚数 × 減額。マスの数は6ヶ月分のミッションの合計です（月ごとに数が違っても大丈夫）。ミッションを作っていない月は数えません。</p>
      </Card>

      <Card title="ミッションのテンプレート">
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="p-1">項目名</th>
                <th className="p-1 w-48">判定の仕方</th>
                <th className="p-1 w-36">目標</th>
                <th className="p-1 w-20">単位</th>
                <th className="p-1 w-24" />
              </tr>
            </thead>
            <tbody>
              {rules.missionTemplate.map((m, k) => (
                <tr key={m.id} className="border-t border-line">
                  <td className="p-1"><TextIn value={m.name} onChange={(v) => setMission(m.id, { name: v })} /></td>
                  <td className="p-1">
                    <select className={inputCls} value={m.kind} onChange={(e) => setMission(m.id, { kind: e.target.value as MissionKind })}>
                      <option value="gte">実数が目標以上</option>
                      <option value="lte">実数が目標以下</option>
                      <option value="check">●×を手で付ける</option>
                    </select>
                  </td>
                  <td className="p-1">
                    {m.kind === 'check' ? <span className="text-xs text-muted">—</span> : <NumIn value={m.target} placeholder="月ごとに入力" onChange={(v) => setMission(m.id, { target: v })} />}
                  </td>
                  <td className="p-1">{m.kind !== 'check' && <TextIn value={m.unit} onChange={(v) => setMission(m.id, { unit: v })} placeholder="件・%・円" />}</td>
                  <td className="p-1">
                    <div className="flex justify-end gap-0.5 text-muted">
                      <IconButton label="上へ" disabled={k === 0} onClick={() => move(k, -1)}><ArrowUp className="size-4" /></IconButton>
                      <IconButton label="下へ" disabled={k === rules.missionTemplate.length - 1} onClick={() => move(k, 1)}><ArrowDown className="size-4" /></IconButton>
                      <IconButton label="削除" danger onClick={() => confirm(`「${m.name}」を削除しますか？`) && setRule('missionTemplate', rules.missionTemplate.filter((x) => x.id !== m.id))}>
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
          className={`mt-4 ${btnPrimary}`}
          onClick={() => setRule('missionTemplate', [...rules.missionTemplate, { id: crypto.randomUUID(), name: '', kind: 'gte', target: null, unit: '' }])}
        >
          <Plus className="size-4" /> 項目を追加
        </button>
        <p className="mt-2 text-xs text-muted">ミッションは毎月変わるので、ここはひな形です。ミッション表で「テンプレートを読み込む」と、その月にこの項目が入り、月ごとに項目・目標を書き換えられます。</p>
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
          className={`mt-4 ${btnPrimary}`}
          onClick={() => setRule('addonNames', [...rules.addonNames, ''])}
        >
          <Plus className="size-4" /> 商材を追加
        </button>
        <p className="mt-2 text-xs text-muted">ここに並べた商材ごとに、予測画面で半年分の入金額を入れられます。</p>
      </Card>

      <button
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-bad"
        onClick={() => confirm('設定を初期値に戻しますか？（受注やミッションの記録は消えません）') && reset(DEFAULT_RULES)}
      >
        <RotateCcw className="size-4" /> 設定を初期値に戻す
      </button>
    </>
  );
}

/** 選べる年（今年の前後と、いま選んでいる年） */
function years(current: number): number[] {
  const now = new Date().getFullYear();
  const ys = new Set([current, ...Array.from({ length: 6 }, (_, k) => now - 3 + k)]);
  return [...ys].sort((a, b) => a - b);
}
