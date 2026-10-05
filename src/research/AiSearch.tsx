import { useState, type ReactNode } from 'react';
import { Download, KeyRound, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { toCsv } from './csv';
import type { Company } from './model';
import type { Query, Recommendation } from './recommend';
import {
  describeAiError,
  gatherCandidates,
  loadApiKey,
  planSegments,
  rankCandidates,
  saveApiKey,
  type AiResult,
  type Candidate,
} from './ai';

export interface AiNote {
  fit: number | null;
  reason: string;
  approach: string;
  segment: string;
}

type Stage = 'idle' | 'planning' | 'ranking' | 'done';

/** AI で探す機能の状態（入力欄と結果表示で共有する） */
export function useAiSearch(companies: Company[], filters: Query, industryNames: string[]) {
  const [description, setDescription] = useState('');
  const [apiKey, setApiKeyState] = useState(loadApiKey);
  const [rank, setRank] = useState(true);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<AiResult | null>(null);

  const setApiKey = (key: string) => {
    setApiKeyState(key);
    saveApiKey(key.trim());
  };

  async function run() {
    const key = apiKey.trim();
    if (!description.trim() || !key) return;
    setError('');
    setResult(null);
    let partial = false;
    try {
      setStage('planning');
      const plan = await planSegments(key, description.trim(), industryNames.slice(0, 300));
      const candidates = gatherCandidates(companies, plan, filters);
      if (!candidates.length || !rank) {
        setResult({ plan, candidates, picks: null });
        setStage('done');
        return;
      }
      setResult({ plan, candidates, picks: null });
      partial = true;
      setStage('ranking');
      const picks = await rankCandidates(key, description.trim(), plan, candidates);
      setResult({ plan, candidates, picks });
      setStage('done');
    } catch (e) {
      setError(describeAiError(e));
      // 並べ替えだけ失敗したときは、集めた候補をそのまま表示しておく
      setStage(partial ? 'done' : 'idle');
    }
  }

  return { description, setDescription, apiKey, setApiKey, rank, setRank, stage, error, result, run };
}

export type AiSearchState = ReturnType<typeof useAiSearch>;

const EXAMPLE =
  '中小企業向けに、採用サイトの制作と求人広告の運用代行を行っています。応募が集まらない会社の採用活動を、原稿作成から面接日程の調整まで丸ごと支援できます。';

export function AiInput({ ai }: { ai: AiSearchState }) {
  const busy = ai.stage === 'planning' || ai.stage === 'ranking';
  const [showKey, setShowKey] = useState(!ai.apiKey);
  return (
    <div>
      <label className="text-sm font-bold text-slate-700" htmlFor="ai-desc">
        紹介したい企業の事業内容・サービス内容
      </label>
      <textarea
        id="ai-desc"
        value={ai.description}
        onChange={(e) => ai.setDescription(e.target.value)}
        rows={4}
        placeholder={`例：${EXAMPLE}`}
        className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm leading-relaxed outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
      />
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        <button onClick={() => ai.setDescription(EXAMPLE)} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-violet-50 hover:text-violet-700">
          入力例を入れる
        </button>
        <span className="text-slate-400">誰に・何を・どんな課題を解決するかを書くと精度が上がります</span>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        {showKey || !ai.apiKey ? (
          <label className="block">
            <span className="flex items-center gap-1 font-semibold text-slate-700">
              <KeyRound className="h-3.5 w-3.5" />
              Claude の APIキー
            </span>
            <input
              type="password"
              value={ai.apiKey}
              onChange={(e) => ai.setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              autoComplete="off"
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-2 font-mono text-sm"
            />
            <span className="mt-1 block text-slate-500">
              このブラウザにだけ保存され、Anthropic（Claude の提供元）への送信にだけ使います。キーは
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-violet-700 underline">
                Anthropic Console
              </a>
              で発行できます。
            </span>
          </label>
        ) : (
          <p className="flex items-center gap-2">
            <KeyRound className="h-3.5 w-3.5" />
            APIキー設定済み
            <button onClick={() => setShowKey(true)} className="text-violet-700 underline">
              変更
            </button>
            <button onClick={() => ai.setApiKey('')} className="text-slate-500 underline">
              削除
            </button>
          </p>
        )}
        <label className="mt-2 flex cursor-pointer items-start gap-2 text-slate-700">
          <input type="checkbox" checked={ai.rank} onChange={(e) => ai.setRank(e.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-600" />
          <span>
            候補企業をAIに相性順で並べてもらう
            <span className="block text-slate-500">候補の業種・事業内容・都道府県・従業員数だけを送ります（企業名・代表者名・連絡先・住所は送りません）</span>
          </span>
        </label>
      </div>

      <button
        onClick={ai.run}
        disabled={busy || !ai.description.trim() || !ai.apiKey.trim()}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 font-bold text-white shadow hover:bg-violet-700 disabled:opacity-40 sm:w-auto sm:px-6"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
        {ai.stage === 'planning' ? '紹介先の業界を考えています…' : ai.stage === 'ranking' ? '候補を相性順に並べています…' : 'AIで紹介先を探す'}
      </button>
      {ai.error && <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">{ai.error}</p>}
    </div>
  );
}

function noteFor(c: Candidate, pick?: { fit: number; reason: string; approach: string }): AiNote {
  return pick
    ? { fit: pick.fit, reason: pick.reason, approach: pick.approach, segment: c.segment.label }
    : { fit: null, reason: c.segment.why, approach: '', segment: c.segment.label };
}

export function AiResults({
  ai,
  renderCard,
}: {
  ai: AiSearchState;
  renderCard: (rec: Recommendation, rank: number, note: AiNote) => ReactNode;
}) {
  const r = ai.result;
  if (!r) {
    return (
      <section className="rounded-2xl border border-dashed border-violet-200 bg-white p-6 text-sm leading-relaxed text-slate-600">
        <p className="flex items-center gap-1.5 font-bold text-violet-700">
          <Sparkles className="h-4 w-4" />
          AIで紹介先を探す
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>紹介したい企業の事業内容から、AIが「紹介すると喜ばれそうな業界」を考えます</li>
          <li>その業界の企業を、アイドマの受注先からこのブラウザ内で探します（地域・取引状況・担当者の絞り込みも反映）</li>
          <li>AIが候補を相性順に並べ、紹介する理由と切り出し方を書きます</li>
        </ol>
        <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          AIに送るのは、入力した事業内容と、候補企業の業種・事業内容などだけです。企業名・代表者名・連絡先・住所は送りません。1回の検索で APIの利用料（数十円程度）がかかります。
        </p>
      </section>
    );
  }

  const list = r.picks
    ? r.picks.map((p) => ({ c: p.candidate, note: noteFor(p.candidate, p) }))
    : r.candidates.map((c) => ({ c, note: noteFor(c) }));

  function exportCsv() {
    const header = ['順位', '相性', '紹介先の業界', '企業名', '代表者役職', '代表者名', '電話番号', 'メール', 'HP', '都道府県', '住所', '業種', '事業内容', 'AIの理由', '切り出し方'];
    const rows = list.map(({ c, note }, i) => {
      const co = c.rec.company;
      return [
        i + 1,
        note.fit ?? '',
        note.segment,
        co.name,
        co.repTitle,
        co.repName,
        co.phone,
        co.email,
        co.hp,
        co.prefecture,
        co.address,
        co.industry,
        [co.products, co.summary].filter(Boolean).join(' / '),
        note.reason,
        note.approach,
      ];
    });
    const blob = new Blob([toCsv(header, rows)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `AI紹介先候補_${r!.plan.summary.slice(0, 20)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
        <p className="flex items-center gap-1.5 text-xs font-bold text-violet-700">
          <Sparkles className="h-3.5 w-3.5" />
          AIの見立て
        </p>
        <p className="mt-1 text-sm text-slate-800">{r.plan.summary}</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {r.plan.segments.map((s) => (
            <li key={s.label} className="rounded-xl bg-white p-3 text-xs">
              <p className="font-bold text-slate-800">
                {s.label}
                <span className="ml-1 font-normal text-slate-400">（{r.candidates.filter((c) => c.segment === s).length}社）</span>
              </p>
              <p className="mt-0.5 leading-relaxed text-slate-600">{s.why}</p>
              <p className="mt-1 text-slate-400">検索語：{s.keywords.join('・')}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-slate-600">
          {ai.stage === 'ranking' ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-4 w-4 animate-spin" />
              候補 {r.candidates.length} 社をAIが相性順に並べています…
            </span>
          ) : r.picks ? (
            <>
              候補 {r.candidates.length} 社から、AIが <b className="text-lg text-slate-900">{r.picks.length}</b> 社を選びました
            </>
          ) : (
            <>
              <b className="text-lg text-slate-900">{r.candidates.length}</b> 社の候補が見つかりました
            </>
          )}
        </p>
        <button onClick={exportCsv} disabled={!list.length} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40">
          <Download className="h-3.5 w-3.5" />
          CSV出力
        </button>
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          条件に合う受注先が見つかりませんでした。地域・取引状況・担当者の絞り込みをゆるめるか、事業内容を書き足して試してください。
        </p>
      ) : (
        list.map(({ c, note }, i) => <div key={c.rec.company.key}>{renderCard(c.rec, i + 1, note)}</div>)
      )}
    </section>
  );
}
