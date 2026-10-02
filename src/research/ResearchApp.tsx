import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  Download,
  ExternalLink,
  FileUp,
  Globe,
  Handshake,
  Lightbulb,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { csvToRecords, toCsv } from './csv';
import { CATEGORIES, CATEGORY_BY_ID, type CategoryId } from './industries';
import { buildCompanies, type Company } from './model';
import { recommend, targetCategories, type Query, type Reason, type Recommendation } from './recommend';
import { clearDataset, loadDataset, saveDataset, type Dataset } from './storage';

const PREFECTURES = '北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(' ');
const EXAMPLES = ['建設', '飲食', '介護', '不動産', '製造', '税理士', 'IT', '美容'];
const PAGE = 30;

/** Excel で保存した Shift_JIS の CSV にも対応する */
async function readText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('shift_jis').decode(buf);
  }
}

export function ResearchApp() {
  const [data, setData] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    loadDataset().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  async function importFile(file: File) {
    setError('');
    setLoading(true);
    try {
      const records = csvToRecords(await readText(file));
      if (!records.length || !('企業名' in records[0])) throw new Error('「企業名」列が見つかりません。受注一覧の CSV を選んでください。');
      const d: Dataset = {
        companies: buildCompanies(records),
        fileName: file.name,
        importedAt: new Date().toLocaleString('ja-JP'),
        rowCount: records.length,
      };
      setData(d);
      setSaved(await saveDataset(d));
    } catch (e) {
      setError((e as Error).message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function reset() {
    if (!confirm('このブラウザに保存した受注データを削除します。よろしいですか？')) return;
    await clearDataset();
    setData(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Handshake className="h-6 w-6 shrink-0 text-indigo-600" />
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold sm:text-lg">紹介先リサーチ</h1>
            {data && (
              <p className="truncate text-xs text-slate-500">
                {data.fileName}（{data.rowCount.toLocaleString()}件の受注 / {data.companies.length.toLocaleString()}社）・{data.importedAt} 取込
              </p>
            )}
          </div>
          {data && (
            <>
              <FilePicker onFile={importFile} compact />
              <button onClick={reset} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="保存データを削除">
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {error && <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {!saved && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            このブラウザでは保存できなかったため、ページを閉じると再度 CSV の読み込みが必要です。
          </p>
        )}
        {loading ? (
          <p className="py-20 text-center text-slate-500">読み込み中…</p>
        ) : data ? (
          <Finder companies={data.companies} />
        ) : (
          <Welcome onFile={importFile} />
        )}
      </main>
    </div>
  );
}

function FilePicker({ onFile, compact }: { onFile: (f: File) => void; compact?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
      <button
        onClick={() => ref.current?.click()}
        className={
          compact
            ? 'flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100'
            : 'flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white shadow hover:bg-indigo-700'
        }
      >
        <FileUp className={compact ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
        {compact ? '再取込' : '受注一覧 CSV を選ぶ'}
      </button>
    </>
  );
}

function Welcome({ onFile }: { onFile: (f: File) => void }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
      className={`mx-auto mt-6 max-w-2xl rounded-2xl border-2 border-dashed p-8 text-center ${over ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white'}`}
    >
      <Handshake className="mx-auto h-12 w-12 text-indigo-500" />
      <h2 className="mt-3 text-xl font-bold">アイドマの受注先から、紹介先を探す</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        受注一覧の CSV を読み込むと、繋がりたい業界を入力するだけで
        <br className="hidden sm:inline" />
        おすすめの企業と「なぜおすすめか」を表示します。
      </p>
      <div className="mt-6 flex justify-center">
        <FilePicker onFile={onFile} />
      </div>
      <p className="mt-3 text-xs text-slate-500">ここに CSV をドラッグ＆ドロップしても読み込めます（UTF-8 / Shift_JIS）</p>
      <p className="mt-6 flex items-start justify-center gap-1.5 text-left text-xs text-slate-500">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        データはこのブラウザの中だけで処理・保存され、外部のサーバーには送信されません。
      </p>
    </div>
  );
}

function Finder({ companies }: { companies: Company[] }) {
  const [query, setQuery] = useState<Query>({
    text: '',
    categories: [],
    prefecture: '',
    status: 'current',
    includeHubs: true,
    requireContact: false,
  });
  const [view, setView] = useState<'all' | 'direct' | 'hub'>('all');
  const [limit, setLimit] = useState(PAGE);
  const deferred = useDeferredValue(query);

  const industries = useMemo(() => {
    const count = new Map<string, number>();
    companies.forEach((c) => c.industry && c.industry !== 'その他' && count.set(c.industry, (count.get(c.industry) ?? 0) + 1));
    return [...count.entries()].sort((a, b) => b[1] - a[1]);
  }, [companies]);

  const results = useMemo(() => recommend(companies, deferred), [companies, deferred]);
  const shown = results.filter((r) => view === 'all' || r.type === view);
  const targets = targetCategories(deferred);
  const update = (patch: Partial<Query>) => {
    setQuery((q) => ({ ...q, ...patch }));
    setLimit(PAGE);
  };
  const toggleCat = (id: CategoryId) =>
    update({ categories: query.categories.includes(id) ? query.categories.filter((c) => c !== id) : [...query.categories, id] });

  function exportCsv() {
    const header = ['順位', 'おすすめ度', '区分', '企業名', '代表者役職', '代表者名', '電話番号', 'メール', 'HP', '都道府県', '住所', '業種', '事業内容', '従業員数', '支援状況', '社内担当', 'おすすめ理由'];
    const rows = shown.map((r, i) => {
      const c = r.company;
      return [
        i + 1,
        r.score,
        r.type === 'direct' ? '該当業界' : '橋渡し役',
        c.name,
        c.repTitle,
        c.repName,
        c.phone,
        c.email,
        c.hp,
        c.prefecture,
        c.address,
        c.industry,
        [c.products, c.summary].filter(Boolean).join(' / '),
        c.employees ?? '',
        c.orders[0]?.status ?? '',
        c.orders[0]?.owner ?? '',
        r.reasons.map((x) => x.text).join(' / '),
      ];
    });
    const blob = new Blob([toCsv(header, rows)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `紹介先候補_${(query.text || targets.map((t) => CATEGORY_BY_ID[t].label).join('_') || 'all').slice(0, 30)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const hasQuery = !!(deferred.text.trim() || deferred.categories.length);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <label className="text-sm font-bold text-slate-700" htmlFor="q">
          繋がりたい業界・キーワード
        </label>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="q"
            list="industry-list"
            value={query.text}
            onChange={(e) => update({ text: e.target.value })}
            placeholder="例：建設　飲食店　介護施設　税理士（スペース区切りで複数可）"
            className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
          <datalist id="industry-list">
            {industries.map(([name, n]) => (
              <option key={name} value={name}>
                {n}社
              </option>
            ))}
          </datalist>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500">入力例：</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => update({ text: ex })} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">
              {ex}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm font-bold text-slate-700">業界から選ぶ</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const on = query.categories.includes(c.id);
            const implied = !on && targets.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCat(c.id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  on ? 'border-indigo-600 bg-indigo-600 text-white' : implied ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-slate-600">
            地域
            <select value={query.prefecture} onChange={(e) => update({ prefecture: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm">
              <option value="">全国</option>
              {PREFECTURES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            取引状況
            <select value={query.status} onChange={(e) => update({ status: e.target.value as Query['status'] })} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm">
              <option value="current">解約先を除く（おすすめ）</option>
              <option value="active">現在支援中の企業のみ</option>
              <option value="all">すべて</option>
            </select>
          </label>
          <div className="flex flex-col justify-end gap-1.5 text-sm">
            <Toggle checked={query.includeHubs} onChange={(v) => update({ includeHubs: v })} label="橋渡し役の企業も探す" />
            <Toggle checked={query.requireContact} onChange={(v) => update({ requireContact: v })} label="連絡先がある企業のみ" />
          </div>
        </div>
      </section>

      {!hasQuery ? (
        <Overview companies={companies} industries={industries} onPick={(t) => update({ text: t })} onCategory={(id) => update({ categories: [id] })} />
      ) : (
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="mr-auto text-sm text-slate-600">
              <b className="text-lg text-slate-900">{results.length.toLocaleString()}</b> 社が見つかりました
              {targets.length > 0 && <span className="ml-1 text-xs text-slate-500">（対象業界：{targets.map((t) => CATEGORY_BY_ID[t].label).join('・')}）</span>}
            </p>
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold">
              {(
                [
                  ['all', 'すべて', results.length],
                  ['direct', '該当業界の企業', results.filter((r) => r.type === 'direct').length],
                  ['hub', '橋渡し役', results.filter((r) => r.type === 'hub').length],
                ] as const
              ).map(([id, label, n]) => (
                <button key={id} onClick={() => setView(id)} className={`rounded-md px-2.5 py-1.5 ${view === id ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}>
                  {label} {n.toLocaleString()}
                </button>
              ))}
            </div>
            <button onClick={exportCsv} disabled={!shown.length} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40">
              <Download className="h-3.5 w-3.5" />
              CSV出力
            </button>
          </div>

          {shown.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              条件に合う企業が見つかりませんでした。キーワードを変えるか、業界チップや「橋渡し役」を試してください。
            </p>
          ) : (
            <div className="space-y-3">
              {shown.slice(0, limit).map((r, i) => (
                <ResultCard key={r.company.key} rec={r} rank={i + 1} />
              ))}
              {shown.length > limit && (
                <button onClick={() => setLimit((l) => l + PAGE)} className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">
                  さらに表示（残り {(shown.length - limit).toLocaleString()} 社）
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
      {label}
    </label>
  );
}

function Overview({
  companies,
  industries,
  onPick,
  onCategory,
}: {
  companies: Company[];
  industries: [string, number][];
  onPick: (t: string) => void;
  onCategory: (id: CategoryId) => void;
}) {
  const byCat = useMemo(() => {
    const m = new Map<CategoryId, number>();
    companies.forEach((c) => c.categories.forEach((cat) => m.set(cat, (m.get(cat) ?? 0) + 1)));
    return CATEGORIES.map((c) => [c, m.get(c.id) ?? 0] as const).sort((a, b) => b[1] - a[1]);
  }, [companies]);
  const max = byCat[0]?.[1] || 1;
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold">業界別の受注先数</h3>
        <ul className="mt-3 space-y-1.5">
          {byCat.map(([c, n]) => (
            <li key={c.id}>
              <button onClick={() => onCategory(c.id)} className="group flex w-full items-center gap-2 text-left text-xs">
                <span className="w-32 shrink-0 truncate text-slate-600 group-hover:text-indigo-700">{c.label}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-indigo-500" style={{ width: `${(n / max) * 100}%` }} />
                </span>
                <span className="w-14 text-right tabular-nums text-slate-500">{n.toLocaleString()}社</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold">受注の多い業種</h3>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {industries.slice(0, 40).map(([name, n]) => (
            <button key={name} onClick={() => onPick(name)} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700">
              {name} <span className="text-slate-400">{n}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          業種名やキーワードを入力すると、その業界の企業（該当業界）と、その業界とつながりを持つ企業（橋渡し役）をおすすめ順に表示します。
        </p>
      </div>
    </section>
  );
}

const REASON_STYLE: Record<Reason['kind'], { icon: ReactNode; cls: string }> = {
  match: { icon: <Sparkles className="h-3.5 w-3.5" />, cls: 'text-indigo-700' },
  hub: { icon: <Handshake className="h-3.5 w-3.5" />, cls: 'text-teal-700' },
  relation: { icon: <Users className="h-3.5 w-3.5" />, cls: 'text-slate-700' },
  contact: { icon: <Phone className="h-3.5 w-3.5" />, cls: 'text-slate-600' },
  caution: { icon: <AlertTriangle className="h-3.5 w-3.5" />, cls: 'text-amber-700' },
};

function stars(score: number) {
  const n = score >= 110 ? 5 : score >= 85 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : 1;
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function ResultCard({ rec, rank }: { rec: Recommendation; rank: number }) {
  const [open, setOpen] = useState(false);
  const c = rec.company;
  const latest = c.orders[0];
  const business = [c.products, c.summary].filter(Boolean);
  const google = `https://www.google.com/search?q=${encodeURIComponent(`${c.name} ${c.prefecture}`)}`;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{rank}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-base font-bold text-slate-900">{c.name}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${rec.type === 'direct' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'}`}>
              {rec.type === 'direct' ? '該当業界' : '橋渡し役'}
            </span>
            {latest && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{latest.status}</span>}
            <span className="ml-auto text-sm tracking-tight text-amber-500" title={`スコア ${rec.score}`}>
              {stars(rec.score)}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {c.industry || '業種未登録'}
            {c.employees ? ` ・ 従業員${c.employees.toLocaleString()}名` : ''}
          </p>

          <div className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
            <Info icon={<User className="h-4 w-4" />}>{c.repName ? `${c.repTitle} ${c.repName}` : '代表者 未登録'}</Info>
            <Info icon={<Phone className="h-4 w-4" />}>
              {c.phone ? (
                <a href={`tel:${c.phone}`} className="text-indigo-700 hover:underline">
                  {c.phone}
                </a>
              ) : (
                '電話番号 未登録'
              )}
            </Info>
            <Info icon={<Mail className="h-4 w-4" />}>
              {c.email ? (
                <a href={`mailto:${c.email}`} className="break-all text-indigo-700 hover:underline">
                  {c.email}
                </a>
              ) : (
                'メール 未登録'
              )}
            </Info>
            <Info icon={<Globe className="h-4 w-4" />}>
              {c.hp ? (
                <a href={c.hp} target="_blank" rel="noreferrer" className="break-all text-indigo-700 hover:underline">
                  {c.hp.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              ) : (
                <a href={google} target="_blank" rel="noreferrer" className="text-slate-500 hover:underline">
                  HP 未登録（Google で検索）
                </a>
              )}
            </Info>
            <Info icon={<MapPin className="h-4 w-4" />} wide>
              {c.address || '住所 未登録'}
            </Info>
          </div>

          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
            <p className="flex items-center gap-1 text-xs font-bold text-slate-500">
              <Building2 className="h-3.5 w-3.5" />
              事業内容
            </p>
            <p className="mt-1 leading-relaxed text-slate-700">{business.length ? business.join(' ／ ') : c.industry || '登録なし'}</p>
          </div>

          <div className="mt-3">
            <p className="text-xs font-bold text-slate-500">おすすめの理由</p>
            <ul className="mt-1 space-y-1">
              {rec.reasons.map((r, i) => (
                <li key={i} className={`flex items-start gap-1.5 text-sm ${REASON_STYLE[r.kind].cls}`}>
                  <span className="mt-1 shrink-0">{REASON_STYLE[r.kind].icon}</span>
                  <span>{r.text}</span>
                </li>
              ))}
            </ul>
            {rec.tip && (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {rec.tip}
              </p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900">
              <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
              取引履歴・受注メモ（{c.orders.length}件）
            </button>
            <span className="ml-auto flex gap-3">
              <a href={google} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-slate-500 hover:text-indigo-700">
                <ExternalLink className="h-3.5 w-3.5" />
                Google検索
              </a>
              {c.corpNo && (
                <a
                  href={`https://www.houjin-bangou.nta.go.jp/henkorireki-johoto.html?selHouzinNo=${c.corpNo}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-slate-500 hover:text-indigo-700"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  法人番号
                </a>
              )}
            </span>
          </div>
          {open && (
            <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
              <table className="w-full">
                <tbody>
                  {c.orders.map((o, i) => (
                    <tr key={i} className="border-b border-slate-50 last:border-0">
                      <td className="py-1 pr-2 tabular-nums">{o.date || '日付なし'}</td>
                      <td className="py-1 pr-2">{o.service}</td>
                      <td className="py-1 pr-2">{o.status}</td>
                      <td className="hidden py-1 pr-2 sm:table-cell">{o.owner}</td>
                      <td className="py-1 text-right tabular-nums">{o.amount ? `${o.amount.toLocaleString()}円` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {c.mobile && c.mobile !== c.phone && <p>携帯：{c.mobile}</p>}
              {c.note && <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-2 leading-relaxed">{c.note}</p>}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function Info({ icon, children, wide }: { icon: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <p className={`flex min-w-0 items-start gap-1.5 text-slate-700 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="mt-0.5 shrink-0 text-slate-400">{icon}</span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}
