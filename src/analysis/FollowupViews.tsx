import { useMemo, useState } from 'react';
import { AlertTriangle, Building2, CalendarClock, Download } from 'lucide-react';
import { EMPTY, countBy } from './deals';
import { STALE_LABEL, accounts, sortAccounts, staleDeals, type AccountSort, type DealFields, type StaleReason } from './followup';
import { fmt } from './format';
import { Card, Tile, downloadCsv, fmtDate, select, todayStart } from './parts';
import { toNumber } from './table';

const PAGE = 100;
const DAY = 86_400_000;

export interface FollowupSettings {
  /** 進行中として扱う「現在」の値（未設定なら自動） */
  openStatuses?: string[];
  idleDays?: number;
  /** null＝すべて */
  withinDays?: number | null;
  excludeOpen?: boolean;
  excludeCrossed?: boolean;
  accountSort?: AccountSort;
}

const cellOf = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');

const REASON_STYLE: Record<StaleReason, string> = {
  overdue: 'bg-rose-50 text-rose-700',
  noNext: 'bg-amber-50 text-amber-800',
  idle: 'bg-slate-100 text-slate-600',
};

/** 進行中の「現在」をボタンで選ぶ（滞留アラートとクロスセル候補で共通） */
export function OpenStatusPicker({ values, open, onChange }: { values: string[]; open: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-col gap-1.5 text-sm sm:flex-row sm:items-start">
      <span className="w-40 shrink-0 pt-1 font-bold">進行中とみなす「現在」</span>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => {
          const on = open.includes(v);
          return (
            <button
              key={v}
              onClick={() => onChange(on ? open.filter((x) => x !== v) : [...open, v])}
              className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'border-indigo-600 bg-indigo-600 font-bold text-white' : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-100'}`}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StaleView({
  rows,
  f,
  open,
  statusValues,
  amountCol,
  settings,
  onSettings,
  fileName,
}: {
  rows: string[][];
  f: DealFields;
  open: string[];
  statusValues: string[];
  amountCol: number;
  settings: FollowupSettings;
  onSettings: (p: FollowupSettings) => void;
  fileName: string;
}) {
  const [limit, setLimit] = useState(PAGE);
  const [only, setOnly] = useState<StaleReason | null>(null);
  const idleDays = settings.idleDays ?? 30;
  const withinDays = settings.withinDays === undefined ? 90 : settings.withinDays;
  const today = todayStart();
  const items = useMemo(() => staleDeals(rows, f, open, today, { idleDays, withinDays }), [rows, f, open, today, idleDays, withinDays]);
  const shown = only ? items.filter((x) => x.reasons.includes(only)) : items;
  const count = (r: StaleReason) => items.filter((x) => x.reasons.includes(r)).length;
  const byStatus = countBy(
    shown.map((x) => x.row),
    f.status,
  );


  if (f.status < 0) return <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">「現在」（ステータス）の列が見つからないため、滞留アラートを出せません。</p>;

  const head = ['理由', '現在', '企業名', '次回日程', '最終更新', '更新からの日数', '属性', 'アポチャネル', '提案商材', '金額', '先方', 'フォロー理由'];
  const line = (x: (typeof items)[number]) => [
    x.reasons.map((r) => STALE_LABEL[r]).join('・'),
    cellOf(x.row, f.status),
    cellOf(x.row, f.company),
    x.next !== null ? fmtDate(x.next) : '',
    fmtDate(x.updated),
    x.idleDays ?? '',
    cellOf(x.row, f.attr),
    cellOf(x.row, f.channel),
    cellOf(x.row, f.product),
    amountCol >= 0 ? (toNumber(x.row[amountCol] ?? '') ?? '') : '',
    [cellOf(x.row, f.role), cellOf(x.row, f.person)].filter(Boolean).join(' '),
    cellOf(x.row, f.note),
  ];

  return (
    <div className="space-y-5">
      <Card title="滞留アラートの条件" icon={<CalendarClock className="h-5 w-5 text-indigo-600" />}>
        <div className="space-y-3">
          <OpenStatusPicker values={statusValues} open={open} onChange={(v) => onSettings({ openStatuses: v })} />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              更新が
              <select className={select} value={idleDays} onChange={(e) => onSettings({ idleDays: +e.target.value })}>
                {[7, 14, 30, 60].map((d) => (
                  <option key={d} value={d}>
                    {d}日
                  </option>
                ))}
              </select>
              以上ない案件を「止まっている」とする
            </label>
            <label className="flex items-center gap-2">
              対象
              <select className={select} value={withinDays ?? -1} onChange={(e) => onSettings({ withinDays: +e.target.value < 0 ? null : +e.target.value })}>
                {[30, 90, 180, 365].map((d) => (
                  <option key={d} value={d}>
                    最終更新が{d}日以内
                  </option>
                ))}
                <option value={-1}>すべて</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-slate-500">
            最終更新が古すぎる案件は、もう動いていない可能性が高いため初期設定では除いています。上の「絞り込み」（属性・チャネルなど）もここに効きます。
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button onClick={() => setOnly(null)} className={`text-left ${only === null ? 'ring-2 ring-indigo-500' : ''} rounded-2xl`}>
          <Tile label="要対応の案件" value={`${items.length.toLocaleString()}件`} note="クリックで全件表示" />
        </button>
        {(['overdue', 'noNext', 'idle'] as StaleReason[]).map((r) => (
          <button key={r} onClick={() => setOnly(only === r ? null : r)} className={`text-left ${only === r ? 'ring-2 ring-indigo-500' : ''} rounded-2xl`}>
            <Tile label={r === 'idle' ? `${idleDays}日以上更新なし` : STALE_LABEL[r]} value={`${count(r).toLocaleString()}件`} note="クリックで絞り込み" />
          </button>
        ))}
      </div>

      <Card
        title={`要対応の案件（${shown.length.toLocaleString()}件・更新が新しい順）`}
        icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
        right={
          <button
            onClick={() => downloadCsv(`${fileName.replace(/\.[^.]+$/, '')}_滞留アラート.csv`, head, shown.map(line))}
            disabled={!shown.length}
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
        }
      >
        {byStatus.length > 0 && (
          <p className="mb-3 flex flex-wrap gap-1.5 text-xs">
            {byStatus.map((b) => (
              <span key={b.value} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                {b.value} {b.count}
              </span>
            ))}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs whitespace-nowrap text-slate-500">
                <th className="py-2 pr-3">理由</th>
                <th className="py-2 pr-3">現在</th>
                <th className="py-2 pr-3">企業名</th>
                <th className="py-2 pr-3">次回日程</th>
                <th className="py-2 pr-3">最終更新</th>
                <th className="py-2 pr-3">属性 / チャネル / 商材</th>
                <th className="py-2 pr-3 text-right">金額</th>
                <th className="py-2 pr-3">先方</th>
                <th className="py-2">フォロー理由</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, limit).map((x, k) => (
                <tr key={k} className="border-b border-slate-100 align-top">
                  <td className="py-1.5 pr-3">
                    <span className="flex flex-col gap-0.5">
                      {x.reasons.map((r) => (
                        <span key={r} className={`rounded px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${REASON_STYLE[r]}`}>
                          {STALE_LABEL[r]}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 font-bold whitespace-nowrap">{cellOf(x.row, f.status) || EMPTY}</td>
                  <td className="max-w-[14rem] truncate py-1.5 pr-3" title={cellOf(x.row, f.company)}>
                    {cellOf(x.row, f.company)}
                  </td>
                  <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">
                    {x.next !== null ? fmtDate(x.next) : <span className="text-slate-300">なし</span>}
                    {x.overdueDays !== null && <span className="block text-[11px] text-rose-600">{x.overdueDays}日経過</span>}
                  </td>
                  <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">
                    {fmtDate(x.updated)}
                    {x.idleDays !== null && <span className="block text-[11px] text-slate-500">{x.idleDays}日前</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-xs whitespace-nowrap text-slate-600">{[cellOf(x.row, f.attr), cellOf(x.row, f.channel), cellOf(x.row, f.product)].filter(Boolean).join(' / ')}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{amountCol >= 0 ? fmt(toNumber(x.row[amountCol] ?? '')) : ''}</td>
                  <td className="py-1.5 pr-3 text-xs whitespace-nowrap">{[cellOf(x.row, f.role), cellOf(x.row, f.person)].filter(Boolean).join(' ')}</td>
                  <td className="max-w-[18rem] truncate py-1.5 text-xs text-slate-600" title={cellOf(x.row, f.note)}>
                    {cellOf(x.row, f.note)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shown.length > limit && (
          <button onClick={() => setLimit(limit + PAGE)} className="mt-3 w-full rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            さらに表示（残り{(shown.length - limit).toLocaleString()}件）
          </button>
        )}
        <p className="mt-2 text-xs text-slate-500">
          対応のしかた：日程が過ぎている案件は今日中に連絡して次回日程を入れ直し、日程なしの案件は次のアクションと期日を決めてヨミ表の「次回日程」に入力します。
        </p>
      </Card>
    </div>
  );
}

export function CrossSellView({
  rows,
  f,
  open,
  statusValues,
  amountCol,
  settings,
  onSettings,
  fileName,
}: {
  rows: string[][];
  f: DealFields;
  open: string[];
  statusValues: string[];
  amountCol: number;
  settings: FollowupSettings;
  onSettings: (p: FollowupSettings) => void;
  fileName: string;
}) {
  const [limit, setLimit] = useState(PAGE);
  const today = todayStart();
  const excludeOpen = settings.excludeOpen ?? true;
  const excludeCrossed = settings.excludeCrossed ?? true;
  const sort = settings.accountSort ?? 'contract';
  const list = useMemo(() => accounts(rows, f, open, amountCol), [rows, f, open, amountCol]);
  const cands = useMemo(
    () => sortAccounts(list.filter((a) => (!excludeOpen || a.openDeals === 0) && (!excludeCrossed || a.crossAfter === 0)), sort, today),
    [list, excludeOpen, excludeCrossed, sort, today],
  );
  const soon = cands.filter((a) => a.contractEnd !== null && a.contractEnd >= today && a.contractEnd - today <= 90 * DAY).length;
  const ended = cands.filter((a) => a.contractEnd !== null && a.contractEnd < today).length;

  if (f.company < 0) return <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">「企業名」の列が見つからないため、会社ごとにまとめられません。</p>;

  const endBadge = (t: number | null) => {
    if (t === null) return <span className="text-slate-300">—</span>;
    const days = Math.round((t - today) / DAY);
    const cls = days < 0 ? 'bg-slate-100 text-slate-600' : days <= 90 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700';
    return (
      <span className="whitespace-nowrap">
        {fmtDate(t)}
        <span className={`ml-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>{days < 0 ? `${-days}日前に終了` : `あと${days}日`}</span>
      </span>
    );
  };

  const head = ['企業名', '受注回数', '受注商材', '受注金額合計', '最終受注日', '契約終了見込み', '最終接触', '受注後の追加提案', '進行中の案件', '提案候補', '支援担当', '先方'];
  const line = (a: (typeof cands)[number]) => [
    a.name,
    a.winCount,
    a.products.join('・'),
    a.wonAmount,
    fmtDate(a.lastWin),
    fmtDate(a.contractEnd),
    fmtDate(a.lastTouch),
    a.crossAfter,
    a.openDeals,
    a.suggest.join('・'),
    cellOf(a.latest, f.support),
    [cellOf(a.latest, f.role), cellOf(a.latest, f.person)].filter(Boolean).join(' '),
  ];

  return (
    <div className="space-y-5">
      <Card title="クロスセル候補の条件" icon={<Building2 className="h-5 w-5 text-indigo-600" />}>
        <div className="space-y-3 text-sm">
          <OpenStatusPicker values={statusValues} open={open} onChange={(v) => onSettings({ openStatuses: v })} />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={excludeOpen} onChange={(e) => onSettings({ excludeOpen: e.target.checked })} />
              進行中の案件がある会社を除く
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={excludeCrossed} onChange={(e) => onSettings({ excludeCrossed: e.target.checked })} />
              最後の受注のあとに、クロスセル・アップセルの案件がある会社を除く
            </label>
            <label className="flex items-center gap-2">
              並び順
              <select className={select} value={sort} onChange={(e) => onSettings({ accountSort: e.target.value as AccountSort })}>
                <option value="contract">契約終了が近い順</option>
                <option value="amount">受注金額が大きい順</option>
                <option value="touch">最終接触が古い順</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-slate-500">
            受注日時の入った案件（または「現在」が受注）がある会社を、企業名ごとにまとめます（「株式会社」などの違いは同じ会社として扱います）。契約終了見込みは、最後の受注日に「月」（契約月数）を足した日です。この一覧は上の「絞り込み」に関係なく、全案件から作ります。
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="受注した会社" value={`${list.length.toLocaleString()}社`} />
        <Tile label="クロスセル候補" value={`${cands.length.toLocaleString()}社`} />
        <Tile label="契約終了まで90日以内" value={`${soon.toLocaleString()}社`} note="更新・アップセルの提案時期" />
        <Tile label="契約終了済み" value={`${ended.toLocaleString()}社`} note="再提案の候補" />
      </div>

      <Card
        title={`クロスセル候補（${cands.length.toLocaleString()}社）`}
        icon={<Building2 className="h-5 w-5 text-indigo-600" />}
        right={
          <button
            onClick={() => downloadCsv(`${fileName.replace(/\.[^.]+$/, '')}_クロスセル候補.csv`, head, cands.map(line))}
            disabled={!cands.length}
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs whitespace-nowrap text-slate-500">
                <th className="py-2 pr-3">企業名</th>
                <th className="py-2 pr-3">受注した商材</th>
                <th className="py-2 pr-3 text-right">受注金額</th>
                <th className="py-2 pr-3">最終受注</th>
                <th className="py-2 pr-3">契約終了見込み</th>
                <th className="py-2 pr-3">最終接触</th>
                <th className="py-2 pr-3">提案候補の商材</th>
                <th className="py-2 pr-3">支援担当</th>
                <th className="py-2">先方</th>
              </tr>
            </thead>
            <tbody>
              {cands.slice(0, limit).map((a) => (
                <tr key={a.name + a.lastWin} className="border-b border-slate-100 align-top">
                  <td className="max-w-[14rem] py-1.5 pr-3">
                    <span className="block truncate font-semibold" title={a.name}>
                      {a.name}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      受注{a.winCount}回{a.openDeals ? `・進行中${a.openDeals}件` : ''}
                      {a.crossAfter ? `・受注後の追加提案${a.crossAfter}件` : ''}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-xs">{a.products.join('・') || '—'}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{amountCol >= 0 ? fmt(a.wonAmount) : ''}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">{fmtDate(a.lastWin)}</td>
                  <td className="py-1.5 pr-3 text-xs tabular-nums">{endBadge(a.contractEnd)}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">{fmtDate(a.lastTouch)}</td>
                  <td className="py-1.5 pr-3">
                    <span className="flex flex-wrap gap-1">
                      {a.suggest.map((p) => (
                        <span key={p} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                          {p}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-xs whitespace-nowrap">{cellOf(a.latest, f.support)}</td>
                  <td className="py-1.5 text-xs whitespace-nowrap">{[cellOf(a.latest, f.role), cellOf(a.latest, f.person)].filter(Boolean).join(' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cands.length > limit && (
          <button onClick={() => setLimit(limit + PAGE)} className="mt-3 w-full rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            さらに表示（残り{(cands.length - limit).toLocaleString()}社）
          </button>
        )}
        <p className="mt-2 text-xs text-slate-500">
          「提案候補の商材」は、クロスセル・アップセルで受注の多い商材のうち、その会社がまだ受注していないものです。契約終了の90日前から、更新と追加提案をセットで持ちかけるのがおすすめです。
        </p>
      </Card>
    </div>
  );
}

/** 「現在」の値（多い順） */
export function statusValuesOf(rows: string[][], col: number): string[] {
  return col < 0 ? [] : countBy(rows, col).map((b) => b.value);
}
