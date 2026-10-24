import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ClipboardCopy,
  ClipboardPaste,
  FileUp,
  Link2,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { analyze, benchmarks, funnelColumns, stagesOf, stepStatus, weakestStep, type Analysis, type Lever, type Status, type Step } from './analyze';
import { playFor, stepLabel, volumePlay, type Play } from './playbook';
import { clear, load, save, type Saved } from './storage';
import {
  ROLES,
  defaultRoles,
  describeColumns,
  groupRows,
  looksLikeTime,
  looksTransposed,
  parseGrid,
  sumGroups,
  toNumber,
  toTable,
  type Role,
} from './table';

const ALL = '__all__';

const SAMPLE = [
  '月\t架電数\t接続数\tアポ数\t商談数\t受注数\t売上',
  '4月\t1,800\t420\t48\t40\t8\t2,400,000',
  '5月\t1,950\t430\t52\t41\t9\t2,610,000',
  '6月\t1,700\t360\t38\t33\t7\t2,030,000',
  '7月\t2,100\t470\t45\t36\t6\t1,860,000',
  '8月\t1,600\t330\t34\t29\t6\t1,740,000',
  '9月\t2,000\t440\t41\t31\t5\t1,550,000',
  '目標\t12,000\t2,700\t324\t270\t54\t16,200,000',
].join('\n');

/** Excel で保存した Shift_JIS の CSV にも対応する */
async function readText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('shift_jis').decode(buf);
  }
}

/** Google スプレッドシートの URL から、そのシートの CSV を取り出す（「リンクを知っている全員」が閲覧できる場合のみ） */
async function fetchSheet(url: string): Promise<string> {
  const id = url.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1];
  if (!id) throw new Error('Google スプレッドシートの URL ではないようです（https://docs.google.com/spreadsheets/d/… の形）。');
  const gid = url.match(/[#&?]gid=(\d+)/)?.[1] ?? '0';
  let res: Response;
  try {
    res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`);
  } catch {
    throw new Error('シートを読み込めませんでした。共有設定が「リンクを知っている全員（閲覧者）」になっているか確認するか、範囲をコピーして貼り付けてください。');
  }
  const text = await res.text();
  if (!res.ok || /^\s*</.test(text)) throw new Error('シートが非公開のため読み込めません。範囲をコピーして「貼り付け」から読み込んでください。');
  return text;
}

export const fmt = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return '—';
  return Math.abs(n) >= 100 ? Math.round(n).toLocaleString('ja-JP') : (Math.round(n * 10) / 10).toLocaleString('ja-JP');
};
const pct = (r: number | null | undefined) => (r == null || !Number.isFinite(r) ? '—' : `${(r * 100).toFixed(r < 0.1 ? 2 : 1)}%`);
const rateText = (s: Pick<Step, 'isPrice'>, r: number | null | undefined) => (s.isPrice ? fmt(r) : pct(r));
const benchKey = (s: Step) => `${s.from.name}→${s.to.name}`;

function newSaved(source: string, sourceName: string): Saved {
  const grid = parseGrid(source);
  const transpose = looksTransposed(grid);
  const t = toTable(grid, transpose);
  const cols = describeColumns(t);
  const labelCol = cols.find((c) => !c.numeric)?.index ?? 0;
  return {
    source,
    sourceName,
    importedAt: new Date().toLocaleString('ja-JP'),
    transpose,
    labelCol,
    filterCol: -1,
    filterValue: '',
    roles: defaultRoles(cols),
    scope: ALL,
    goal: '',
    bench: {},
    elapsed: '',
    total: '',
  };
}

export function AnalysisApp() {
  const [data, setData] = useState<Saved | null>(() => load());
  const [stored, setStored] = useState(true);

  useEffect(() => {
    if (data) setStored(save(data));
  }, [data]);

  function reset() {
    if (!confirm('このブラウザに保存した表と設定を削除します。よろしいですか？')) return;
    clear();
    setData(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <BarChart3 className="h-6 w-6 shrink-0 text-indigo-600" />
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold sm:text-lg">数字分析・改善ナビ</h1>
            {data && (
              <p className="truncate text-xs text-slate-500">
                {data.sourceName}・{data.importedAt} 取込
              </p>
            )}
          </div>
          {data && (
            <>
              <button
                onClick={() => setData(null)}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                <FileUp className="h-3.5 w-3.5" />
                別の表
              </button>
              <button onClick={reset} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="保存データを削除">
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {!stored && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            このブラウザでは保存できなかったため、ページを閉じると再度読み込みが必要です。
          </p>
        )}
        {data ? <Workspace data={data} onChange={(patch) => setData({ ...data, ...patch })} /> : <Welcome onLoad={(text, name) => setData(newSaved(text, name))} />}
      </main>
    </div>
  );
}

/* ───────────────────────── 取り込み ───────────────────────── */

function Welcome({ onLoad }: { onLoad: (text: string, name: string) => void }) {
  const [tab, setTab] = useState<'paste' | 'file' | 'url'>('paste');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  function accept(t: string, name: string) {
    const grid = parseGrid(t);
    const table = toTable(grid, looksTransposed(grid));
    if (!describeColumns(table).some((c) => c.numeric)) {
      setError('数値の列が見つかりませんでした。見出し行と数字を含む範囲を選んでください。');
      return;
    }
    onLoad(t, name);
  }

  async function run(job: () => Promise<void>) {
    setError('');
    setBusy(true);
    try {
      await job();
    } catch (e) {
      setError((e as Error).message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const tabs: [typeof tab, string, ReactNode][] = [
    ['paste', '貼り付け', <ClipboardPaste key="p" className="h-4 w-4" />],
    ['file', 'CSV ファイル', <FileUp key="f" className="h-4 w-4" />],
    ['url', 'シートの URL', <Link2 key="u" className="h-4 w-4" />],
  ];

  return (
    <div className="mx-auto mt-2 max-w-3xl">
      <div className="text-center">
        <BarChart3 className="mx-auto h-12 w-12 text-indigo-500" />
        <h2 className="mt-3 text-xl font-bold">スプレッドシートの数字から「どこを直せば目標に届くか」を出す</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          架電数 → アポ数 → 商談数 → 受注数 → 売上 のような数字を読み込むと、
          <br className="hidden sm:inline" />
          転換率・目標からの逆算・ボトルネック・改善アクションを自動で出します。
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {tabs.map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold sm:text-sm ${tab === id ? 'bg-white text-indigo-700 shadow' : 'text-slate-500'}`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {tab === 'paste' && (
          <div className="mt-4">
            <p className="text-sm text-slate-600">スプレッドシートで見出し行ごと範囲を選んでコピー（Ctrl+C / ⌘+C）し、下に貼り付けてください。</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={'月\t架電数\tアポ数\t商談数\t受注数\t売上\n4月\t1800\t48\t40\t8\t2400000\n…\n目標\t…'}
              className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs focus:border-indigo-500 focus:outline-none"
            />
            <button
              disabled={!text.trim()}
              onClick={() => accept(text, '貼り付けた表')}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-40"
            >
              分析する
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {tab === 'file' && (
          <div className="mt-4 text-center">
            <p className="text-sm text-slate-600">スプレッドシートの「ファイル → ダウンロード → CSV」で保存したファイルを選びます（UTF-8 / Shift_JIS）。</p>
            <input
              ref={file}
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) run(async () => accept(await readText(f), f.name));
              }}
            />
            <button
              onClick={() => file.current?.click()}
              className="mx-auto mt-3 flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white shadow hover:bg-indigo-700"
            >
              <FileUp className="h-5 w-5" />
              CSV を選ぶ
            </button>
          </div>
        )}

        {tab === 'url' && (
          <div className="mt-4">
            <p className="text-sm text-slate-600">
              Google スプレッドシートの URL（分析したいシートを開いた状態のもの）を貼り付けます。共有が「リンクを知っている全員」になっているシートだけ読めます。
              社外秘の数字は「貼り付け」をおすすめします。
            </p>
            <div className="mt-2 flex gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=0"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
              <button
                disabled={!url.trim() || busy}
                onClick={() => run(async () => accept(await fetchSheet(url.trim()), 'Google スプレッドシート'))}
                className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                {busy ? '読込中…' : '読み込む'}
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

        <div className="mt-5 border-t border-slate-100 pt-4 text-center">
          <button onClick={() => onLoad(SAMPLE, 'サンプルデータ')} className="text-sm font-semibold text-indigo-600 hover:underline">
            サンプルの数字で試してみる
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-600 sm:p-6">
        <h3 className="font-bold text-slate-800">読み込める表の形</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>1行目が見出し（架電数・接続数・アポ数・商談数・受注数・売上 など）、2行目から月・週・担当者ごとの数字。</li>
          <li>指標が縦、月が横に並んだ表も自動で入れ替えて読みます。</li>
          <li>「目標」「計画」「予算」の行、または「アポ目標」のような列があれば目標として使います。「合計」行は自動で除きます。</li>
          <li>「担当者」と「月」の両方の列がある表は、どちらの単位で比べるか・どの値で絞り込むかを選べます。</li>
        </ul>
        <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          数字はこのブラウザの中だけで計算・保存され、外部のサーバーには送信されません（URL 読み込み時の Google への取得を除く）。
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────── 分析画面 ───────────────────────── */

function Workspace({ data, onChange }: { data: Saved; onChange: (patch: Partial<Saved>) => void }) {
  const table = useMemo(() => toTable(parseGrid(data.source), data.transpose), [data.source, data.transpose]);
  const cols = useMemo(() => describeColumns(table), [table]);
  const textCols = cols.filter((c) => !c.numeric);
  const labelCol = cols[data.labelCol] && !cols[data.labelCol].numeric ? data.labelCol : (textCols[0]?.index ?? -1);
  const filterValues = useMemo(
    () => (data.filterCol >= 0 ? [...new Set(table.rows.map((r) => r[data.filterCol]).filter(Boolean))] : []),
    [table, data.filterCol],
  );
  const { groups, targetRow } = useMemo(
    () => groupRows(table, cols, labelCol, { col: data.filterCol, value: data.filterValue }),
    [table, cols, labelCol, data.filterCol, data.filterValue],
  );
  const funnel = useMemo(() => funnelColumns(table.header, data.roles), [table.header, data.roles]);
  const isTime = looksLikeTime(groups.map((g) => g.label));
  const scopeGroup = data.scope === ALL ? null : groups.find((g) => g.label === data.scope) ?? null;

  const result = useMemo(() => {
    if (funnel.length < 2) return null;
    const total = sumGroups(groups);
    const g = scopeGroup ?? total;
    // 目標行は「全体」の目標として使う。転換率の目標は割合なので、担当者・月ごとの分析でも基準に使える
    const stages = stagesOf(funnel, g, scopeGroup ? null : targetRow);
    const rateTargets = funnel.map((f) => g.targets[f.col] ?? targetRow?.[f.col] ?? null);
    const peers = groups.map((x) => stagesOf(funnel, x, null));
    const steps0 = stages.slice(0, -1);
    const manual = steps0.map((s, i) => {
      const raw = data.bench[`${s.name}→${stages[i + 1].name}`];
      if (!raw) return null;
      const v = toNumber(raw);
      if (v === null) return null;
      const price = stages[i + 1].role === 'revenue';
      return price || raw.includes('%') ? v : v / 100;
    });
    const bench = benchmarks(rateTargets, peers, manual);
    const autoGoal = stages[stages.length - 1].target;
    const goal = data.goal ? toNumber(data.goal) : autoGoal;
    const e = toNumber(data.elapsed);
    const t = toNumber(data.total);
    const pace = e && t && e < t ? e / t : 1;
    const a = analyze(stages, bench, goal, pace);
    const autoBench = benchmarks(rateTargets, peers, []);
    const perGroup = groups.map((x) => {
      const ga = analyze(stagesOf(funnel, x, null), bench, x.targets[funnel[funnel.length - 1].col] ?? null);
      return { group: x, a: ga, weak: weakestStep(ga) };
    });
    return { a, autoGoal, autoBench, perGroup };
  }, [funnel, groups, scopeGroup, targetRow, data.bench, data.goal, data.elapsed, data.total]);

  function setRole(name: string, role: Role | '') {
    const roles = { ...data.roles };
    for (const k of Object.keys(roles)) if (role && roles[k] === role) delete roles[k];
    if (role) roles[name] = role;
    else delete roles[name];
    onChange({ roles, bench: {} });
  }

  return (
    <div className="space-y-5">
      <Setup
        open={funnel.length < 2}
        data={data}
        onChange={onChange}
        cols={cols}
        labelCol={labelCol}
        filterValues={filterValues}
        setRole={setRole}
        rowCount={groups.length}
        hasTargetRow={!!targetRow}
      />

      {!result ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          「データの読み取り設定」で、少なくとも2つの列に役割（例：架電数＝行動量、受注数＝受注）を付けてください。
        </p>
      ) : (
        <>
          <ScopeBar groups={groups.map((g) => g.label)} scope={scopeGroup ? data.scope : ALL} onScope={(scope) => onChange({ scope, goal: '' })} />
          <GoalInputs data={data} onChange={onChange} a={result.a} autoGoal={result.autoGoal} />
          <Summary a={result.a} />
          <Priorities a={result.a} />
          <FunnelTable a={result.a} autoBench={result.autoBench} data={data} onChange={onChange} />
          {result.perGroup.length >= 2 && <Compare rows={result.perGroup} isTime={isTime} finalName={result.a.final.name} />}
          <Report a={result.a} scope={scopeGroup?.label ?? '全体'} perGroup={result.perGroup} />
        </>
      )}
    </div>
  );
}

function Card({ title, icon, children, right }: { title: string; icon?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="flex-1 font-bold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Setup(props: {
  open: boolean;
  data: Saved;
  onChange: (p: Partial<Saved>) => void;
  cols: ReturnType<typeof describeColumns>;
  labelCol: number;
  filterValues: string[];
  setRole: (name: string, role: Role | '') => void;
  rowCount: number;
  hasTargetRow: boolean;
}) {
  const { data, onChange, cols, labelCol, filterValues, setRole } = props;
  const textCols = cols.filter((c) => !c.numeric);
  const select = 'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm';
  return (
    <details open={props.open} className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-bold sm:px-5">
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        データの読み取り設定
        <span className="text-xs font-normal text-slate-500">
          {props.rowCount}行{props.hasTargetRow ? '・目標行あり' : ''}・役割 {Object.keys(data.roles).length}列
        </span>
      </summary>
      <div className="space-y-4 border-t border-slate-100 p-4 text-sm sm:px-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.transpose}
              onChange={(e) => {
                const transpose = e.target.checked;
                const cs = describeColumns(toTable(parseGrid(data.source), transpose));
                onChange({ transpose, roles: defaultRoles(cs), labelCol: cs.find((c) => !c.numeric)?.index ?? 0, filterCol: -1, filterValue: '', scope: ALL, bench: {} });
              }}
            />
            縦横を入れ替える（指標が縦に並ぶ表）
          </label>
          {textCols.length > 0 && (
            <label className="flex items-center gap-2">
              比べる単位
              <select className={select} value={labelCol} onChange={(e) => onChange({ labelCol: +e.target.value, scope: ALL })}>
                {textCols.map((c) => (
                  <option key={c.index} value={c.index}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {textCols.length > 1 && (
            <label className="flex items-center gap-2">
              絞り込み
              <select className={select} value={data.filterCol} onChange={(e) => onChange({ filterCol: +e.target.value, filterValue: '', scope: ALL })}>
                <option value={-1}>なし</option>
                {textCols
                  .filter((c) => c.index !== labelCol)
                  .map((c) => (
                    <option key={c.index} value={c.index}>
                      {c.name}
                    </option>
                  ))}
              </select>
              {data.filterCol >= 0 && (
                <select className={select} value={data.filterValue} onChange={(e) => onChange({ filterValue: e.target.value, scope: ALL })}>
                  <option value="">すべて</option>
                  {filterValues.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              )}
            </label>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs text-slate-500">各列の役割（上から順にファネルになります。目標列は自動で実績列にひも付きます）</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cols
              .filter((c) => c.numeric)
              .map((c) => (
                <div key={c.index} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate font-semibold" title={c.name}>
                    {c.name}
                  </span>
                  {c.targetOf !== null ? (
                    <span className="text-xs text-slate-500">「{cols[c.targetOf].name}」の目標</span>
                  ) : (
                    <select className={select} value={data.roles[c.name] ?? ''} onChange={(e) => setRole(c.name, e.target.value as Role | '')}>
                      <option value="">使わない</option>
                      {ROLES.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>
    </details>
  );
}

function ScopeBar({ groups, scope, onScope }: { groups: string[]; scope: string; onScope: (s: string) => void }) {
  if (groups.length < 2) return null;
  const chip = (id: string, label: string) => (
    <button
      key={id}
      onClick={() => onScope(id)}
      className={`shrink-0 rounded-full border px-3 py-1 text-sm ${scope === id ? 'border-indigo-600 bg-indigo-600 font-bold text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'}`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {chip(ALL, '全体（合計）')}
      {groups.map((g) => chip(g, g))}
    </div>
  );
}

function GoalInputs({ data, onChange, a, autoGoal }: { data: Saved; onChange: (p: Partial<Saved>) => void; a: Analysis; autoGoal: number | null }) {
  const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none';
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3 sm:p-5">
      <label className="text-sm">
        <span className="font-semibold">目標の{a.final.name}</span>
        <input className={`${input} mt-1`} value={data.goal} placeholder={autoGoal != null ? `${fmt(autoGoal)}（表の目標）` : '例：16,200,000'} onChange={(e) => onChange({ goal: e.target.value })} />
      </label>
      <label className="text-sm">
        <span className="font-semibold">経過した営業日</span>
        <input className={`${input} mt-1`} inputMode="numeric" value={data.elapsed} placeholder="期間の途中なら入力（例：12）" onChange={(e) => onChange({ elapsed: e.target.value })} />
      </label>
      <label className="text-sm">
        <span className="font-semibold">期間の営業日</span>
        <input className={`${input} mt-1`} inputMode="numeric" value={data.total} placeholder="例：20" onChange={(e) => onChange({ total: e.target.value })} />
      </label>
    </div>
  );
}

function Summary({ a }: { a: Analysis }) {
  const ach = a.goal ? a.forecast / a.goal : null;
  const ok = a.gap !== null && a.gap <= 0;
  const tiles: [string, string, string?][] = [
    [`${a.final.name}（実績）`, fmt(a.final.value)],
    ...(a.pace < 1 ? ([['着地見込み', fmt(a.forecast), `経過 ${Math.round(a.pace * 100)}% のペースで最後まで進んだ場合`]] as [string, string, string][]) : []),
    ['目標', fmt(a.goal)],
    ['達成率', pct(ach), a.pace < 1 ? '着地見込みベース' : undefined],
    [ok ? '超過' : '不足', a.gap === null ? '—' : fmt(Math.abs(a.gap))],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {tiles.map(([label, value, note]) => (
        <div key={label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
          {note && <p className="mt-0.5 text-[11px] text-slate-400">{note}</p>}
        </div>
      ))}
      {ach !== null && (
        <div className="col-span-2 sm:col-span-5">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className={`h-full rounded-full ${ok ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${Math.min(100, ach * 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

function leverTitle(a: Analysis, l: Lever): string {
  if (l.kind === 'volume') return `${a.stages[0].name}を ${fmt(l.from)} → ${fmt(l.to)} に増やす`;
  const s = a.steps[l.step];
  return `${stepLabel(s.from.role, s.to.role, s.to.name)}を ${rateText(s, l.from)} → ${rateText(s, l.to)} に上げる`;
}

function leverPlay(a: Analysis, l: Lever): Play {
  if (l.kind === 'volume') return volumePlay();
  const s = a.steps[l.step];
  return playFor(s.from.role, s.to.role);
}

const SOURCE_TEXT = { manual: '入力した基準', target: '目標から逆算した率', top: '上位25%の行の水準' } as const;

function leverWhy(a: Analysis, l: Lever): string {
  if (l.kind === 'volume') return `${a.stages[0].name}を目標 ${fmt(l.to)} まで増やした場合`;
  const s = a.steps[l.step];
  return `${s.from.name}→${s.to.name}の比率を${s.benchSource ? SOURCE_TEXT[s.benchSource] : '基準'}まで上げた場合`;
}

function Priorities({ a }: { a: Analysis }) {
  const [open, setOpen] = useState(0);
  const ok = a.gap !== null && a.gap <= 0;
  if (!a.levers.length) {
    return (
      <Card title="改善ポイント" icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}>
        <p className="text-sm text-slate-600">
          {ok ? '目標を達成できる見込みです。' : ''}どの段も基準を下回っていません。基準（下の表の「基準」列）を目標値や理想の数字に変えると、伸ばしどころを出せます。
        </p>
        <VolumeOnly a={a} />
      </Card>
    );
  }
  const rates = a.levers.filter((l) => l.kind === 'rate');
  return (
    <Card title="目標達成のための改善ポイント（効果の大きい順）" icon={<Target className="h-5 w-5 text-indigo-600" />}>
      {a.gap !== null && a.gap > 0 && rates.length > 0 && (
        <p className="mb-3 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900">
          不足は <b>{fmt(a.gap)}</b>。基準に届いていない率をすべて基準まで上げると着地は <b>{fmt(a.allLevers)}</b>（
          {a.allLevers >= (a.goal ?? 0) ? '目標達成' : `あと ${fmt((a.goal ?? 0) - a.allLevers)} 不足 → 行動量も増やす必要があります`}）。
        </p>
      )}
      <VolumeOnly a={a} />
      <ol className="space-y-2">
        {a.levers.map((l, i) => {
          const play = leverPlay(a, l);
          const isOpen = open === i;
          return (
            <li key={`${l.kind}${l.step}`} className={`rounded-xl border ${i === 0 ? 'border-indigo-300' : 'border-slate-200'}`}>
              <button onClick={() => setOpen(isOpen ? -1 : i)} className="flex w-full items-start gap-3 p-3 text-left">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${i === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{leverTitle(a, l)}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{leverWhy(a, l)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-bold tabular-nums text-indigo-700">+{fmt(l.uplift)}</span>
                  {l.gapShare !== null && <span className="block text-[11px] text-slate-500">不足の {Math.round(Math.min(l.gapShare, 9.99) * 100)}%</span>}
                </span>
                <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && <PlayView play={play} />}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/** 率を変えずに最上段の行動量だけで不足を埋める場合の数 */
function VolumeOnly({ a }: { a: Analysis }) {
  const need = a.required[0];
  const now = a.stages[0].value / a.pace;
  if (a.gap === null || a.gap <= 0 || need === null || need <= now) return null;
  return (
    <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
      参考：率を変えずに<b>{a.stages[0].name}だけ</b>で埋めるなら {fmt(now)} → <b>{fmt(need)}</b>（+{fmt(need - now)}、{Math.round((need / now - 1) * 100)}%増）が必要です
      {a.pace < 1 ? '（期間全体での数）' : ''}。
    </p>
  );
}

function PlayView({ play }: { play: Play }) {
  return (
    <div className="grid gap-3 border-t border-slate-100 p-3 text-sm sm:grid-cols-2">
      <div>
        <p className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-500">
          <AlertTriangle className="h-3.5 w-3.5" />
          {play.metric}が低いときに疑うこと
        </p>
        <ul className="list-disc space-y-1 pl-5 text-slate-600">
          {play.causes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          効果の確認：<b className="text-slate-700">{play.check}</b>を週次で見る
        </p>
      </div>
      <div>
        <p className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-500">
          <Sparkles className="h-3.5 w-3.5" />
          改善アクション
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          {play.actions.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

const STATUS: Record<Status, { icon: ReactNode; label: string; cls: string }> = {
  good: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: '基準以上', cls: 'bg-emerald-50 text-emerald-700' },
  warn: { icon: <AlertTriangle className="h-3.5 w-3.5" />, label: 'やや低い', cls: 'bg-amber-50 text-amber-700' },
  bad: { icon: <XCircle className="h-3.5 w-3.5" />, label: '要改善', cls: 'bg-rose-50 text-rose-700' },
  none: { icon: null, label: '基準なし', cls: 'bg-slate-100 text-slate-500' },
};

function StatusBadge({ s }: { s: Status }) {
  const v = STATUS[s];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${v.cls}`}>
      {v.icon}
      {v.label}
    </span>
  );
}

function FunnelTable({ a, autoBench, data, onChange }: { a: Analysis; autoBench: { bench: number | null }[]; data: Saved; onChange: (p: Partial<Saved>) => void }) {
  return (
    <Card title="ファネルと目標からの逆算" icon={<BarChart3 className="h-5 w-5 text-indigo-600" />}>
      <p className="mb-3 text-xs text-slate-500">
        「必要数」は今の転換率のまま目標を達成するのに必要な数です。「基準」は空欄なら自動（目標から逆算した率 → 上位25%の行の水準）で、数字を入れると上書きできます。
      </p>
      <div className="space-y-1">
        {a.stages.map((st, i) => {
          const req = a.required[i];
          const now = st.value / a.pace;
          const short = req !== null ? req - now : null;
          const s = a.steps[i];
          return (
            <div key={st.col}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-slate-50 px-3 py-2.5">
                <span className="w-28 shrink-0 font-bold">{st.name}</span>
                <span className="text-sm">
                  実績 <b className="tabular-nums">{fmt(st.value)}</b>
                  {a.pace < 1 && <span className="text-xs text-slate-500">（着地 {fmt(now)}）</span>}
                </span>
                {st.target !== null && <span className="text-sm text-slate-500">目標 {fmt(st.target)}</span>}
                {req !== null && (
                  <span className="text-sm text-slate-500">
                    必要数 <b className="tabular-nums text-slate-700">{fmt(req)}</b>
                    {short !== null && short > 0 && <span className="ml-1 font-semibold text-rose-600">（あと {fmt(short)}）</span>}
                  </span>
                )}
              </div>
              {s && (
                <div className="ml-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-dashed border-slate-200 py-2 pl-4 text-sm">
                  <span className="text-slate-500">{stepLabel(s.from.role, s.to.role, s.to.name)}</span>
                  <b className="tabular-nums">{rateText(s, s.rate)}</b>
                  <span className="flex items-center gap-1 text-slate-500">
                    基準
                    <input
                      className="w-24 rounded border border-slate-300 px-2 py-0.5 text-sm"
                      value={data.bench[benchKey(s)] ?? ''}
                      placeholder={autoBench[i]?.bench != null ? rateText(s, autoBench[i].bench) : s.isPrice ? '例：300000' : '例：12%'}
                      onChange={(e) => onChange({ bench: { ...data.bench, [benchKey(s)]: e.target.value } })}
                    />
                  </span>
                  <StatusBadge s={stepStatus(s)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

type GroupRow = { group: { label: string }; a: Analysis; weak: { step: number; score: number } | null };

function Compare({ rows, isTime, finalName }: { rows: GroupRow[]; isTime: boolean; finalName: string }) {
  const steps = rows[0].a.steps;
  return (
    <Card title={isTime ? '推移' : '行ごとの比較'} icon={<TrendingUp className="h-5 w-5 text-indigo-600" />}>
      <Bars rows={rows} finalName={finalName} />
      {isTime && <Trend rows={rows} />}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs whitespace-nowrap text-slate-500">
              <th className="py-2 pr-3">{isTime ? '期間' : '名前'}</th>
              {rows[0].a.stages.map((s) => (
                <th key={s.col} className="py-2 pr-3 text-right">
                  {s.name}
                </th>
              ))}
              {steps.map((s) => (
                <th key={benchKey(s)} className="py-2 pr-3 text-right">
                  {stepLabel(s.from.role, s.to.role, s.to.name)}
                </th>
              ))}
              <th className="py-2">一番の課題</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ group, a, weak }) => (
              <tr key={group.label} className="border-b border-slate-100">
                <td className="whitespace-nowrap py-2 pr-3 font-semibold">{group.label}</td>
                {a.stages.map((s) => (
                  <td key={s.col} className="py-2 pr-3 text-right tabular-nums">
                    {fmt(s.value)}
                  </td>
                ))}
                {a.steps.map((s) => {
                  const st = stepStatus(s);
                  return (
                    <td key={benchKey(s)} className={`py-2 pr-3 text-right tabular-nums ${st === 'bad' ? 'font-bold text-rose-600' : st === 'good' ? 'text-emerald-700' : ''}`}>
                      {rateText(s, s.rate)}
                    </td>
                  );
                })}
                <td className="py-2 text-xs">{weak ? stepLabel(a.steps[weak.step].from.role, a.steps[weak.step].to.role, a.steps[weak.step].to.name) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">赤字＝基準の90%未満、緑＝基準以上。「一番の課題」は基準に対して最も低い率です。</p>
    </Card>
  );
}

/** 最終指標の行ごとの棒グラフ（目標がある行は目標線を重ねる） */
function Bars({ rows, finalName }: { rows: GroupRow[]; finalName: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const vals = rows.map((r) => r.a.final.value);
  const goals = rows.map((r) => r.a.goal);
  const max = Math.max(1, ...vals, ...goals.map((g) => g ?? 0));
  const W = 640;
  const H = 180;
  const pad = { l: 8, r: 8, t: 12, b: 28 };
  const bw = (W - pad.l - pad.r) / rows.length;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const h = hover !== null ? rows[hover] : null;
  return (
    <div>
      <p className="mb-1 text-xs text-slate-500">
        {finalName}
        {goals.some((g) => g !== null) && '（横線は目標）'}
        {h && (
          <span className="ml-2 font-semibold text-slate-700">
            {h.group.label}：{fmt(h.a.final.value)}
            {h.a.goal !== null && ` / 目標 ${fmt(h.a.goal)}`}
          </span>
        )}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${finalName}の行ごとの棒グラフ`} onMouseLeave={() => setHover(null)}>
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="#cbd5e1" />
        {rows.map((r, i) => {
          const x = pad.l + i * bw;
          const v = r.a.final.value;
          const inner = Math.max(4, Math.min(48, bw - 8));
          const bx = x + (bw - inner) / 2;
          return (
            <g key={r.group.label} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
              <rect x={x} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              <path
                d={`M${bx},${y(0)} V${y(v) + 4} q0,-4 4,-4 h${inner - 8} q4,0 4,4 V${y(0)} Z`}
                fill={hover === null || hover === i ? '#4f46e5' : '#a5b4fc'}
              />
              {r.a.goal !== null && <line x1={bx - 3} x2={bx + inner + 3} y1={y(r.a.goal)} y2={y(r.a.goal)} stroke="#0f172a" strokeWidth={2} />}
              <text x={x + bw / 2} y={H - 10} textAnchor="middle" fontSize={11} fill="#64748b">
                {r.group.label.length > 6 ? `${r.group.label.slice(0, 6)}…` : r.group.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** 直近の行と、それより前の平均との比較（期間の表のとき） */
function Trend({ rows }: { rows: GroupRow[] }) {
  const last = rows[rows.length - 1].a;
  const prev = rows.slice(0, -1).map((r) => r.a);
  const items = last.steps.map((s, i) => {
    const before = prev.map((p) => p.steps[i].rate).filter((r): r is number => r !== null);
    const avg = before.length ? before.reduce((x, y) => x + y, 0) / before.length : null;
    const diff = s.rate !== null && avg ? s.rate / avg - 1 : null;
    return { s, avg, diff };
  });
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-3">
      {items.map(({ s, avg, diff }) => (
        <div key={benchKey(s)} className="rounded-xl bg-slate-50 p-3 text-sm">
          <p className="text-xs text-slate-500">
            {stepLabel(s.from.role, s.to.role, s.to.name)}（{rows[rows.length - 1].group.label} vs それ以前の平均）
          </p>
          <p className="mt-1 flex items-center gap-1.5">
            <b className="tabular-nums">{rateText(s, s.rate)}</b>
            <span className="text-xs text-slate-500">平均 {rateText(s, avg)}</span>
            {diff !== null && Math.abs(diff) >= 0.05 && (
              <span className={`ml-auto inline-flex items-center gap-0.5 text-xs font-semibold ${diff < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                {diff < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                {diff > 0 ? '+' : ''}
                {Math.round(diff * 100)}%
              </span>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}

/** 共有用のテキスト（チャットやメールに貼って相談できる形） */
export function buildReport(a: Analysis, scope: string, perGroup: GroupRow[]): string {
  const lines: string[] = [`【数字分析レポート】対象：${scope}`];
  lines.push(`${a.final.name}：実績 ${fmt(a.final.value)}${a.pace < 1 ? `（着地見込み ${fmt(a.forecast)}）` : ''} / 目標 ${fmt(a.goal)}${a.gap !== null ? ` / ${a.gap > 0 ? '不足' : '超過'} ${fmt(Math.abs(a.gap))}` : ''}`);
  lines.push('', '■ ファネル');
  a.stages.forEach((st, i) => {
    lines.push(`・${st.name}：${fmt(st.value)}${a.required[i] !== null ? `（必要数 ${fmt(a.required[i])}）` : ''}`);
    const s = a.steps[i];
    if (s) lines.push(`   ↓ ${stepLabel(s.from.role, s.to.role, s.to.name)} ${rateText(s, s.rate)}（基準 ${rateText(s, s.bench)}・${STATUS[stepStatus(s)].label}）`);
  });
  if (a.levers.length) {
    lines.push('', '■ 改善ポイント（効果の大きい順）');
    a.levers.slice(0, 3).forEach((l, i) => {
      const play = leverPlay(a, l);
      lines.push(`${i + 1}. ${leverTitle(a, l)} → +${fmt(l.uplift)}${l.gapShare !== null ? `（不足の${Math.round(l.gapShare * 100)}%）` : ''}`);
      play.actions.slice(0, 3).forEach((x) => lines.push(`   - ${x}`));
    });
  }
  const weak = perGroup.filter((g) => g.weak);
  if (weak.length) {
    lines.push('', '■ 行ごとの一番の課題');
    weak.forEach((g) => {
      const s = g.a.steps[g.weak!.step];
      lines.push(`・${g.group.label}：${stepLabel(s.from.role, s.to.role, s.to.name)} ${rateText(s, s.rate)}（基準比 ${Math.round(g.weak!.score * 100)}%）`);
    });
  }
  return lines.join('\n');
}

function Report({ a, scope, perGroup }: { a: Analysis; scope: string; perGroup: GroupRow[] }) {
  const text = buildReport(a, scope, perGroup);
  const [copied, setCopied] = useState(false);
  return (
    <Card
      title="共有用レポート"
      icon={<ClipboardCopy className="h-5 w-5 text-indigo-600" />}
      right={
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* クリップボードが使えない環境では下の欄から手でコピーしてもらう */
            }
          }}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
        >
          {copied ? 'コピーしました' : 'コピー'}
        </button>
      }
    >
      <p className="mb-2 text-xs text-slate-500">会議資料・チャット・Claude への相談にそのまま貼り付けられます。</p>
      <textarea readOnly value={text} rows={10} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs" />
    </Card>
  );
}
