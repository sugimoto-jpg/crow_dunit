import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Download, FileUp, Filter, ListFilter, Search, Table2, Trash2, X } from 'lucide-react';
import { Welcome } from './Loader';
import {
  EMPTY,
  PRIORITY,
  applyFilters,
  byMonth,
  countBy,
  crossTab,
  dateOf,
  dealRows,
  describeDeals,
  emptyFilters,
  isMoneyName,
  refDateCol,
  stageCols,
  stageFunnel,
  sumOf,
  type DealCol,
  type DealFilters,
  type StageCol,
} from './deals';
import { fmt, pct } from './format';
import { CrossSellView, StaleView, statusValuesOf, type FollowupSettings } from './FollowupViews';
import { defaultOpenStatuses, detectFields } from './followup';
import { Card, Tile, downloadCsv, select } from './parts';
import { loadJson, removeKey, saveJson } from './storage';
import { parseGrid, toTable } from './table';

const KEY = 'aidma-kpi-analysis:deals:v1';
const ROW_PAGE = 100;

interface DealsSaved {
  source: string;
  sourceName: string;
  importedAt: string;
  filters: DealFilters;
  axis: number;
  axis2: number;
  amountCol: number;
  view?: View;
  followup?: FollowupSettings;
}

type View = 'summary' | 'stale' | 'cross';
const VIEWS: [View, string][] = [
  ['summary', '集計'],
  ['stale', '滞留アラート'],
  ['cross', 'クロスセル候補'],
];

/** 架空の案件一覧（サンプル） */
function sample(): string {
  // 毎回同じ内容になるよう、固定の種から擬似乱数を作る
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const status = ['アポ', 'アポ', '訪問済', '提案済', '提案済', 'ヨミA', 'ヨミB', 'ヨミC', '受注', '失注', '失注'];
  const attr = ['新規', '新規', '既存', 'クロスセル'];
  const channel = ['自アポ', 'IS', 'IS', '紹介', '紹介', '交流会', '電話'];
  const product = ['営業代行', '営業代行', 'セミナー集客', 'Web広告', '採用支援'];
  const staff = ['杉本', '佐藤', '鈴木'];
  const lines = ['アポ日\t現在\t企業名\t担当\t属性\tアポチャネル\t提案商材\t金額'];
  for (let i = 0; i < 60; i++) {
    const d = new Date(2026, 6, 1 + Math.floor(rand() * 115));
    lines.push(
      [
        `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`,
        pick(status),
        `サンプル商事${i + 1}`,
        pick(staff),
        pick(attr),
        pick(channel),
        pick(product),
        String((5 + Math.floor(rand() * 30)) * 100000),
      ].join('\t'),
    );
  }
  return lines.join('\n');
}

function validate(text: string): string | null {
  const t = toTable(parseGrid(text), false);
  if (t.rows.length < 1) return '案件の行が見つかりませんでした。見出し行ごと範囲を選んでください。';
  return describeDeals(t).some((c) => c.kind === 'category') ? null : '絞り込みに使える列（現在・属性など）が見つかりませんでした。';
}

function newSaved(source: string, sourceName: string): DealsSaved {
  const t = toTable(parseGrid(source), false);
  const cols = describeDeals(t);
  const cats = cols.filter((c) => c.kind === 'category');
  const money = cols.find((c) => c.kind === 'number' && isMoneyName(c.name)) ?? cols.find((c) => c.kind === 'number');
  return {
    source,
    sourceName,
    importedAt: new Date().toLocaleString('ja-JP'),
    // 期間の絞り込みは、必ず入っている「情報更新日」などの年付きの日付を初期値にする
    filters: emptyFilters(refDateCol(t, cols) >= 0 ? refDateCol(t, cols) : (cols.find((c) => c.kind === 'date')?.index ?? -1)),
    axis: cats[0]?.index ?? -1,
    axis2: -1,
    amountCol: money?.index ?? -1,
  };
}

export function DealsApp() {
  const [data, setData] = useState<DealsSaved | null>(() => loadJson<DealsSaved>(KEY));
  const [stored, setStored] = useState(true);
  useEffect(() => {
    if (data) setStored(saveJson(KEY, data));
  }, [data]);

  if (!data) {
    return (
      <Welcome
        onLoad={(t, n) => setData(newSaved(t, n))}
        validate={validate}
        sample={sample()}
        sampleLabel="サンプルの案件一覧で試してみる"
        placeholder={'アポ日\t現在\t企業名\t担当\t属性\tアポチャネル\t提案商材\t金額\n2026/10/1\t提案済\t○○株式会社\t杉本\t新規\t紹介\t営業代行\t1800000\n…'}
        intro={
          <>
            <ListFilter className="mx-auto h-12 w-12 text-indigo-500" />
            <h2 className="mt-3 text-xl font-bold">案件一覧を、現在・属性・チャネル・商材で絞り込んで数える</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              ヨミ表の案件一覧を読み込むと、列ごとに絞り込みボタンを作り、
              <br className="hidden sm:inline" />
              件数・金額・内訳・クロス集計・月ごとの推移をその場で出します。
            </p>
          </>
        }
        help={
          <>
            <h3 className="font-bold text-slate-800">読み込める表の形</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>1行目が見出し、2行目から1行＝1案件の一覧（ヨミ表のタブを、見出し行ごとコピーして貼り付け）。</li>
              <li>「{PRIORITY.join('」「')}」の列は必ず絞り込みに並べます。ほかの列も、選択肢の少ない列は自動で絞り込みに加えます。</li>
              <li>日付の列があれば期間で絞り込め、金額の列があれば合計を出します。</li>
            </ul>
          </>
        }
      />
    );
  }

  return (
    <>
      {!stored && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          このブラウザでは保存できなかったため、ページを閉じると再度読み込みが必要です。
        </p>
      )}
      <Deals
        data={data}
        onChange={(patch) => setData({ ...data, ...patch })}
        onReplace={() => setData(null)}
        onClear={() => {
          if (!confirm('このブラウザに保存した案件一覧を削除します。よろしいですか？')) return;
          removeKey(KEY);
          setData(null);
        }}
      />
    </>
  );
}

function Deals({ data, onChange, onReplace, onClear }: { data: DealsSaved; onChange: (p: Partial<DealsSaved>) => void; onReplace: () => void; onClear: () => void }) {
  const table = useMemo(() => toTable(parseGrid(data.source), false), [data.source]);
  const cols = useMemo(() => describeDeals(table), [table]);
  const cats = cols.filter((c) => c.kind === 'category');
  const dates = cols.filter((c) => c.kind === 'date');
  const nums = cols.filter((c) => c.kind === 'number');
  const f = data.filters;
  const all = useMemo(() => dealRows(table, cols), [table, cols]);
  const ref = useMemo(() => refDateCol(table, cols), [table, cols]);
  const stages = useMemo(() => stageCols(cols), [cols]);
  const rows = useMemo(() => applyFilters(all, f, -1, ref), [all, f, ref]);
  const view = data.view ?? 'summary';
  const fields = useMemo(() => detectFields(cols), [cols]);
  const statusValues = useMemo(() => statusValuesOf(all, fields.status), [all, fields.status]);
  const fu = data.followup ?? {};
  const open = useMemo(() => fu.openStatuses ?? defaultOpenStatuses(statusValues), [fu.openStatuses, statusValues]);
  const setFu = (p: FollowupSettings) => onChange({ followup: { ...fu, ...p } });
  const setF = (p: Partial<DealFilters>) => onChange({ filters: { ...f, ...p } });
  const active = Object.values(f.cats).some((v) => v.length) || !!f.from || !!f.to || !!f.q;

  function toggle(col: number, value: string) {
    const cur = f.cats[col] ?? [];
    setF({ cats: { ...f.cats, [col]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] } });
  }

  const total = sumOf(rows, data.amountCol);
  const amountName = cols.find((c) => c.index === data.amountCol)?.name;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="min-w-0 flex-1 truncate">
          {data.sourceName}（{all.length.toLocaleString()}件）・{data.importedAt} 取込
        </span>
        <button onClick={onReplace} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100">
          <FileUp className="h-3.5 w-3.5" />
          別の一覧
        </button>
        <button onClick={onClear} className="rounded-lg p-2 hover:bg-slate-100" title="保存データを削除">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-200/60 p-1">
        {VIEWS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => onChange({ view: id })}
            className={`flex-1 rounded-lg px-2 py-2 text-xs font-bold sm:text-sm ${view === id ? 'bg-white text-indigo-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {view !== 'cross' && (
        <Card
          title="絞り込み"
          icon={<Filter className="h-5 w-5 text-indigo-600" />}
          right={
            active && (
              <button onClick={() => setF({ cats: {}, from: '', to: '', q: '' })} className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline">
                <X className="h-3.5 w-3.5" />
                すべて解除
              </button>
            )
          }
        >
          <div className="space-y-3">
            {cats.slice(0, 6).map((c) => (
              <FacetRow key={c.index} col={c} rows={all} refCol={ref} filters={f} onToggle={toggle} onClear={() => setF({ cats: { ...f.cats, [c.index]: [] } })} />
            ))}
            {cats.length > 6 && (
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-semibold text-slate-600">
                  <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                  その他の絞り込み（{cats.slice(6).map((c) => c.name).join('・')}）
                </summary>
                <div className="mt-3 space-y-3">
                  {cats.slice(6).map((c) => (
                    <FacetRow key={c.index} col={c} rows={all} refCol={ref} filters={f} onToggle={toggle} onClear={() => setF({ cats: { ...f.cats, [c.index]: [] } })} />
                  ))}
                </div>
              </details>
            )}
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-sm">
              {dates.length > 0 && (
                <>
                  <select className={select} value={f.dateCol} onChange={(e) => setF({ dateCol: +e.target.value })}>
                    {dates.map((c) => (
                      <option key={c.index} value={c.index}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <input type="date" className={select} value={f.from} onChange={(e) => setF({ from: e.target.value })} />
                  〜
                  <input type="date" className={select} value={f.to} onChange={(e) => setF({ to: e.target.value })} />
                  <QuickRanges onPick={(from, to) => setF({ from, to })} />
                </>
              )}
              <label className="ml-auto flex min-w-[200px] flex-1 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 sm:flex-none">
                <Search className="h-4 w-4 text-slate-400" />
                <input value={f.q} onChange={(e) => setF({ q: e.target.value })} placeholder="キーワード（企業名など）" className="w-full py-1.5 text-sm outline-none" />
              </label>
            </div>
          </div>
        </Card>

      )}

      {view === 'stale' && (
        <StaleView rows={rows} f={fields} open={open} statusValues={statusValues} amountCol={data.amountCol} settings={fu} onSettings={setFu} fileName={data.sourceName} />
      )}
      {view === 'cross' && (
        <CrossSellView rows={all} f={fields} open={open} statusValues={statusValues} amountCol={data.amountCol} settings={fu} onSettings={setFu} fileName={data.sourceName} />
      )}
      {view === 'summary' && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="該当件数" value={`${rows.length.toLocaleString()}件`} note={`全${all.length.toLocaleString()}件中 ${pct(all.length ? rows.length / all.length : null)}`} />
            <Tile label={`${amountName ?? '金額'}の合計`} value={data.amountCol >= 0 ? fmt(total) : '—'} />
            <Tile label="1件あたり" value={data.amountCol >= 0 && rows.length ? fmt(total / rows.length) : '—'} />
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs text-slate-500">合計する列</p>
              <select className={`${select} mt-1 w-full`} value={data.amountCol} onChange={(e) => onChange({ amountCol: +e.target.value })}>
                <option value={-1}>なし</option>
                {nums.map((c) => (
                  <option key={c.index} value={c.index}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Breakdown data={data} onChange={onChange} cats={cats} rows={rows} onPick={toggle} />
          {stages.length > 0 && <Stages rows={rows} stages={stages} axis={cats.some((c) => c.index === data.axis) ? data.axis : (cats[0]?.index ?? -1)} axisName={cols.find((c) => c.index === data.axis)?.name ?? ''} amountCol={data.amountCol} />}
          {f.dateCol >= 0 && <Monthly rows={rows} dateCol={f.dateCol} refCol={ref} amountCol={data.amountCol} dateName={cols.find((c) => c.index === f.dateCol)?.name ?? ''} />}
          <RowsTable header={table.header} cols={cols} rows={rows} refCol={ref} fileName={data.sourceName} />
        </>
      )}
    </div>
  );
}

/** 1列分の絞り込みボタン。件数は「この列以外の条件」で数える */
function FacetRow({
  col,
  rows,
  refCol,
  filters,
  onToggle,
  onClear,
}: {
  col: DealCol;
  rows: string[][];
  refCol: number;
  filters: DealFilters;
  onToggle: (col: number, v: string) => void;
  onClear: () => void;
}) {
  const [all, setAll] = useState(false);
  const counts = useMemo(() => countBy(applyFilters(rows, filters, col.index, refCol), col.index), [rows, filters, col.index, refCol]);
  const selected = filters.cats[col.index] ?? [];
  const count = new Map(counts.map((b) => [b.value, b.count]));
  // 選択中の値は、他の条件で0件になっても消さない
  const values = [...counts.map((b) => b.value), ...selected.filter((v) => !count.has(v))];
  const shown = all ? values : values.slice(0, 12);
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start">
      <div className="flex w-32 shrink-0 items-center gap-1 pt-1 text-sm font-bold">
        <span className="truncate" title={col.name}>
          {col.name}
        </span>
        {selected.length > 0 && (
          <button onClick={onClear} className="text-slate-400 hover:text-rose-600" title="この列の絞り込みを解除">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((v) => {
          const on = selected.includes(v);
          const n = count.get(v) ?? 0;
          return (
            <button
              key={v}
              onClick={() => onToggle(col.index, v)}
              className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'border-indigo-600 bg-indigo-600 font-bold text-white' : n ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100' : 'border-slate-200 bg-white text-slate-300'}`}
            >
              {v}
              <span className={`ml-1 tabular-nums ${on ? 'text-indigo-100' : 'text-slate-400'}`}>{n}</span>
            </button>
          );
        })}
        {values.length > 12 && (
          <button onClick={() => setAll(!all)} className="px-2 py-1 text-xs font-semibold text-indigo-600 hover:underline">
            {all ? '閉じる' : `ほか${values.length - 12}件`}
          </button>
        )}
      </div>
    </div>
  );
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function QuickRanges({ onPick }: { onPick: (from: string, to: string) => void }) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const ranges: [string, Date, Date][] = [
    ['今月', new Date(y, m, 1), new Date(y, m + 1, 0)],
    ['先月', new Date(y, m - 1, 1), new Date(y, m, 0)],
    ['直近3か月', new Date(y, m - 2, 1), new Date(y, m + 1, 0)],
  ];
  return (
    <span className="flex gap-1">
      {ranges.map(([label, a, b]) => (
        <button key={label} onClick={() => onPick(iso(a), iso(b))} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">
          {label}
        </button>
      ))}
      <button onClick={() => onPick('', '')} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">
        全期間
      </button>
    </span>
  );
}

function Breakdown({ data, onChange, cats, rows, onPick }: { data: DealsSaved; onChange: (p: Partial<DealsSaved>) => void; cats: DealCol[]; rows: string[][]; onPick: (col: number, v: string) => void }) {
  const axis = cats.some((c) => c.index === data.axis) ? data.axis : (cats[0]?.index ?? -1);
  const axis2 = cats.some((c) => c.index === data.axis2) && data.axis2 !== axis ? data.axis2 : -1;
  const buckets = useMemo(() => (axis >= 0 ? countBy(rows, axis, data.amountCol) : []), [rows, axis, data.amountCol]);
  const cross = useMemo(() => (axis >= 0 && axis2 >= 0 ? crossTab(rows, axis, axis2) : null), [rows, axis, axis2]);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const name = (i: number) => cats.find((c) => c.index === i)?.name ?? '';
  if (axis < 0) return null;
  return (
    <Card
      title="内訳"
      icon={<Table2 className="h-5 w-5 text-indigo-600" />}
      right={
        <span className="flex flex-wrap items-center gap-2 text-sm">
          <select className={select} value={axis} onChange={(e) => onChange({ axis: +e.target.value })}>
            {cats.map((c) => (
              <option key={c.index} value={c.index}>
                {c.name}別
              </option>
            ))}
          </select>
          ×
          <select className={select} value={axis2} onChange={(e) => onChange({ axis2: +e.target.value })}>
            <option value={-1}>クロス集計なし</option>
            {cats
              .filter((c) => c.index !== axis)
              .map((c) => (
                <option key={c.index} value={c.index}>
                  {c.name}
                </option>
              ))}
          </select>
        </span>
      }
    >
      {!cross ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs whitespace-nowrap text-slate-500">
                <th className="py-2 pr-3">{name(axis)}</th>
                <th className="py-2 pr-3 text-right">件数</th>
                <th className="w-1/3 py-2 pr-3">構成比</th>
                {data.amountCol >= 0 && <th className="py-2 pr-3 text-right">金額</th>}
                {data.amountCol >= 0 && <th className="py-2 text-right">1件あたり</th>}
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.value} onClick={() => onPick(axis, b.value)} className="cursor-pointer border-b border-slate-100 hover:bg-indigo-50" title="クリックでこの値に絞り込む">
                  <td className="py-2 pr-3 font-semibold whitespace-nowrap">{b.value}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{b.count.toLocaleString()}</td>
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-2">
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <span className="block h-full rounded-full bg-indigo-600" style={{ width: `${(b.count / max) * 100}%` }} />
                      </span>
                      <span className="w-12 text-right text-xs tabular-nums text-slate-500">{pct(rows.length ? b.count / rows.length : null)}</span>
                    </span>
                  </td>
                  {data.amountCol >= 0 && <td className="py-2 pr-3 text-right tabular-nums">{fmt(b.amount)}</td>}
                  {data.amountCol >= 0 && <td className="py-2 text-right tabular-nums">{fmt(b.count ? b.amount / b.count : null)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">行をクリックすると、その値で絞り込みます。</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs whitespace-nowrap text-slate-500">
                <th className="py-2 pr-3 text-left">
                  {name(axis)} ＼ {name(axis2)}
                </th>
                {cross.cols.map((c) => (
                  <th key={c} className="px-2 py-2 text-right">
                    {c}
                  </th>
                ))}
                <th className="px-2 py-2 text-right">計</th>
              </tr>
            </thead>
            <tbody>
              {cross.rows.map((r, i) => {
                const sum = cross.cells[i].reduce((a, b) => a + b, 0);
                const cmax = Math.max(1, ...cross.cells.flat());
                return (
                  <tr key={r} className="border-b border-slate-100">
                    <td className="py-1.5 pr-3 font-semibold whitespace-nowrap">{r}</td>
                    {cross.cells[i].map((n, j) => (
                      <td key={cross.cols[j]} className="px-2 py-1.5 text-right tabular-nums" style={n ? { background: `rgba(79, 70, 229, ${0.08 + (n / cmax) * 0.5})` } : undefined}>
                        {n || ''}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right font-bold tabular-nums">{sum}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Monthly({ rows, dateCol, refCol, amountCol, dateName }: { rows: string[][]; dateCol: number; refCol: number; amountCol: number; dateName: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const months = useMemo(() => byMonth(rows, dateCol, amountCol, refCol), [rows, dateCol, amountCol, refCol]);
  if (months.length < 2) return null;
  const W = 640;
  const H = 160;
  const pad = { t: 10, b: 24 };
  const max = Math.max(1, ...months.map((m) => m.count));
  const bw = W / months.length;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const h = hover !== null ? months[hover] : null;
  return (
    <Card title={`${dateName}の月ごとの件数`} icon={<Table2 className="h-5 w-5 text-indigo-600" />}>
      <p className="mb-1 h-4 text-xs text-slate-600">
        {h ? `${h.value}：${h.count}件${amountCol >= 0 ? ` / ${fmt(h.amount)}` : ''}` : '棒にカーソルを合わせると数字を表示します'}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="月ごとの件数" onMouseLeave={() => setHover(null)}>
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="#cbd5e1" />
        {months.map((m, i) => {
          const inner = Math.max(4, Math.min(40, bw - 8));
          const bx = i * bw + (bw - inner) / 2;
          return (
            <g key={m.value} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
              <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
              <path d={`M${bx},${y(0)} V${y(m.count) + 4} q0,-4 4,-4 h${inner - 8} q4,0 4,4 V${y(0)} Z`} fill={hover === null || hover === i ? '#4f46e5' : '#a5b4fc'} />
              <text x={i * bw + bw / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#64748b">
                {m.value.slice(2).replace('-', '/')}
              </text>
            </g>
          );
        })}
      </svg>
    </Card>
  );
}

/** 段階の日付が入っているかで、どこまで進んだかを数える（チャネル別・商材別の受注率） */
function Stages({ rows, stages, axis, axisName, amountCol }: { rows: string[][]; stages: StageCol[]; axis: number; axisName: string; amountCol: number }) {
  const [all, setAll] = useState(false);
  const data = useMemo(() => stageFunnel(rows, stages, axis, amountCol), [rows, stages, axis, amountCol]);
  const total = data[0];
  const overall = (r: (typeof data)[number]) => (r.total ? r.reached[r.reached.length - 1] / r.total : null);
  const rate = (r: (typeof data)[number], i: number) => {
    const prev = i === 0 ? r.total : r.reached[i - 1];
    return prev ? r.reached[i] / prev : null;
  };
  // 全体と比べて2割以上低い／高い率に色を付ける（10件未満は判定しない）
  const tone = (v: number | null, base: number | null, n: number) =>
    v === null || base === null || !base || n < 10 ? '' : v < base * 0.8 ? 'font-bold text-rose-600' : v > base * 1.2 ? 'font-bold text-emerald-700' : '';
  const shown = all ? data : data.slice(0, 13);
  return (
    <Card title={`段階ごとの到達と受注率（${axisName}別）`} icon={<Table2 className="h-5 w-5 text-indigo-600" />}>
      <p className="mb-2 text-xs text-slate-500">
        「{stages.map((s) => s.label).join('」「')}」の日付が入っている案件を、その段階まで進んだ案件として数えます。率は1つ前の段階からの割合、軸は上の「内訳」で選んだ列です。
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs whitespace-nowrap text-slate-500">
              <th className="py-2 pr-3">{axisName}</th>
              <th className="py-2 pr-3 text-right">件数</th>
              {stages.map((s) => (
                <th key={s.index} className="py-2 pr-3 text-right">
                  {s.label}
                </th>
              ))}
              <th className="py-2 pr-3 text-right">件数→{stages[stages.length - 1].label}</th>
              {amountCol >= 0 && <th className="py-2 text-right">{stages[stages.length - 1].label}金額</th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, k) => (
              <tr key={r.value} className={`border-b border-slate-100 ${k === 0 ? 'bg-slate-50 font-bold' : ''}`}>
                <td className="py-1.5 pr-3 whitespace-nowrap">{r.value}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{r.total.toLocaleString()}</td>
                {stages.map((s, i) => {
                  const cls = k ? tone(rate(r, i), rate(total, i), i ? r.reached[i - 1] : r.total) : '';
                  return (
                    <td key={s.index} className="py-1.5 pr-3 text-right whitespace-nowrap tabular-nums">
                      {r.reached[i].toLocaleString()}
                      <span className={`ml-1 text-xs ${cls || 'text-slate-500'}`}>{pct(rate(r, i))}</span>
                    </td>
                  );
                })}
                <td className={`py-1.5 pr-3 text-right tabular-nums ${k ? tone(overall(r), overall(total), r.total) : ''}`}>{pct(overall(r))}</td>
                {amountCol >= 0 && <td className="py-1.5 text-right tabular-nums">{fmt(r.wonAmount)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > 13 && (
        <button onClick={() => setAll(!all)} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">
          {all ? '閉じる' : `ほか${data.length - 13}件を表示`}
        </button>
      )}
      <p className="mt-2 text-xs text-slate-500">赤字＝全体より2割以上低い、緑＝2割以上高い（10件未満は色を付けません）。</p>
    </Card>
  );
}

function RowsTable({ header, cols, rows, refCol, fileName }: { header: string[]; cols: DealCol[]; rows: string[][]; refCol: number; fileName: string }) {
  const [limit, setLimit] = useState(ROW_PAGE);
  const [sort, setSort] = useState<{ col: number; desc: boolean } | null>(null);
  const kind = (i: number) => cols.find((c) => c.index === i)?.kind;
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const k = kind(sort.col);
    const key = (r: string[]) => {
      const v = r[sort.col] ?? '';
      if (k === 'date') return dateOf(r, sort.col, refCol) ?? -Infinity;
      if (k === 'number') return Number(v.normalize('NFKC').replace(/[^\d.-]/g, '')) || 0;
      return v;
    };
    return [...rows].sort((a, b) => {
      const x = key(a);
      const y = key(b);
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ja');
      return sort.desc ? -c : c;
    });
  }, [rows, sort, refCol]);

  const download = () => downloadCsv(`${fileName.replace(/\.[^.]+$/, '')}_絞り込み.csv`, header, sorted);

  return (
    <Card
      title={`該当する案件（${rows.length.toLocaleString()}件）`}
      icon={<ListFilter className="h-5 w-5 text-indigo-600" />}
      right={
        <button onClick={download} disabled={!rows.length} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40">
          <Download className="h-3.5 w-3.5" />
          CSV
        </button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs whitespace-nowrap text-slate-500">
              {header.map((h, i) => (
                <th key={i} className="cursor-pointer py-2 pr-3 hover:text-slate-800" onClick={() => setSort(sort?.col === i ? { col: i, desc: !sort.desc } : { col: i, desc: false })}>
                  {h}
                  {sort?.col === i ? (sort.desc ? ' ▼' : ' ▲') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, limit).map((r, k) => (
              <tr key={k} className="border-b border-slate-100">
                {header.map((_, i) => (
                  <td key={i} className={`max-w-[16rem] truncate py-1.5 pr-3 ${kind(i) === 'number' ? 'text-right tabular-nums' : ''}`} title={r[i]}>
                    {r[i] || (kind(i) === 'category' ? <span className="text-slate-300">{EMPTY}</span> : '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > limit && (
        <button onClick={() => setLimit(limit + ROW_PAGE)} className="mt-3 w-full rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          さらに表示（残り{(sorted.length - limit).toLocaleString()}件）
        </button>
      )}
      <p className="mt-2 text-xs text-slate-500">見出しをクリックすると並べ替えます。CSV は今の絞り込み・並び順で出力します。</p>
    </Card>
  );
}
