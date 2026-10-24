import { toNumber, type Table } from './table';

/**
 * 案件一覧（1行＝1案件）を、列の値でフィルターして件数・金額を数えるためのロジック。
 * 列の種類は中身から推定する：選択肢の少ない文字列＝分類、数値、日付、自由記述。
 */

export type ColKind = 'category' | 'number' | 'date' | 'text';

export interface DealCol {
  index: number;
  name: string;
  kind: ColKind;
  /** 分類列の値（多い順） */
  values: string[];
}

export const EMPTY = '（空欄）';

/** ご指定の列はどんな中身でも分類として最初に並べる */
export const PRIORITY = ['現在', '属性', 'アポチャネル', '提案商材'];

const norm = (s: string) => s.normalize('NFKC').replace(/\s+/g, '');

/** 「2026/10/24」「2026-10-24」「2026年10月24日」「10/24」を日付（ローカル時刻の0時、ミリ秒）にする。年がなければ thisYear */
export function parseDate(raw: string, thisYear = new Date().getFullYear()): number | null {
  const s = norm(raw).replace(/\(.\)|（.）/g, '');
  let m = s.match(/^(\d{4})[/\-.年](\d{1,2})[/\-.月](\d{1,2})日?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  m = s.match(/^(\d{1,2})[/月](\d{1,2})日?$/);
  if (m) return new Date(thisYear, +m[1] - 1, +m[2]).getTime();
  return null;
}

/** 選択肢が少なくても絞り込みボタンにしない列（企業名やメモなど。キーワード検索で探す） */
const TEXT_NAME = /企業|会社|社名|法人|顧客名|メモ|備考|url|住所|電話|tel|メール|mail|コメント|詳細|内容|経緯/;

export const isMoneyName = (name: string) => /金額|売上|粗利|単価|予算|費用|円|¥|価格|額/.test(norm(name));

export function describeDeals(t: Table): DealCol[] {
  const cols = t.header.map((name, index): DealCol => {
    const cells = t.rows.map((r) => r[index] ?? '').filter((c) => c !== '');
    const n = cells.length;
    const counts = new Map<string, number>();
    for (const c of cells) counts.set(c, (counts.get(c) ?? 0) + 1);
    const values = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
    const priority = PRIORITY.includes(norm(name));
    let kind: ColKind;
    if (priority) kind = 'category';
    else if (n && cells.filter((c) => parseDate(c) !== null).length >= n * 0.6) kind = 'date';
    else if (n && cells.filter((c) => toNumber(c) !== null).length >= n * 0.6) kind = 'number';
    else if (TEXT_NAME.test(norm(name).toLowerCase())) kind = 'text';
    else if (n && values.length <= 60 && (values.length <= 15 || values.length <= n * 0.5)) kind = 'category';
    else kind = 'text';
    return { index, name, kind, values };
  });
  // 指定の列 → それ以外の分類列 の順にしておくと、画面の並びがそのまま使える
  const rank = (c: DealCol) => {
    const p = PRIORITY.indexOf(norm(c.name));
    return p >= 0 ? p : PRIORITY.length + c.index;
  };
  return cols.sort((a, b) => rank(a) - rank(b));
}

/** 年の入った日付列（「情報更新日」を優先）。年なしの日付（07/09 など）の年を決める手がかりにする */
export function refDateCol(t: Table, cols: DealCol[]): number {
  const full = cols.filter((c) => c.kind === 'date' && t.rows.some((r) => /^\d{4}/.test(norm(r[c.index] ?? ''))));
  return (full.find((c) => /更新日/.test(c.name)) ?? full[0])?.index ?? -1;
}

/** 行の日付。年がなければ、同じ行の基準日にいちばん近い年（前年・同年・翌年）にする */
export function dateOf(r: string[], col: number, ref = -1): number | null {
  const v = r[col] ?? '';
  if (/^\d{4}/.test(norm(v)) || ref < 0) return parseDate(v);
  const base = parseDate(r[ref] ?? '');
  if (base === null) return parseDate(v);
  const y = new Date(base).getFullYear();
  const cands = [y - 1, y, y + 1].map((yy) => parseDate(v, yy)).filter((d): d is number => d !== null);
  return cands.length ? cands.reduce((a, b) => (Math.abs(a - base) <= Math.abs(b - base) ? a : b)) : null;
}

/** 1行＝1案件として数える行。主要な列（現在・属性…・企業名）がすべて空の行は、数式だけが入った空行として除く */
export function dealRows(t: Table, cols: DealCol[]): string[][] {
  const key = cols.filter((c) => PRIORITY.includes(norm(c.name)) || /企業|会社|社名|顧客/.test(c.name)).map((c) => c.index);
  if (!key.length) return t.rows;
  return t.rows.filter((r) => key.some((i) => (r[i] ?? '').trim() !== ''));
}

export interface DealFilters {
  /** 列 index → 選んだ値（空なら絞り込まない） */
  cats: Record<number, string[]>;
  dateCol: number;
  /** YYYY-MM-DD（input[type=date] の値） */
  from: string;
  to: string;
  q: string;
}

export const emptyFilters = (dateCol = -1): DealFilters => ({ cats: {}, dateCol, from: '', to: '', q: '' });

const cell = (r: string[], i: number) => r[i] || EMPTY;

/** except に列 index を渡すと、その列の条件だけ外して数える（各選択肢の横に出す件数用） */
export function applyFilters(rows: string[][], f: DealFilters, except = -1, ref = -1): string[][] {
  const from = f.from ? parseDate(f.from) : null;
  const to = f.to ? parseDate(f.to) : null;
  const q = norm(f.q).toLowerCase();
  const cats = Object.entries(f.cats).filter(([k, v]) => +k !== except && v.length);
  return rows.filter((r) => {
    for (const [k, v] of cats) if (!v.includes(cell(r, +k))) return false;
    if (f.dateCol >= 0 && (from !== null || to !== null)) {
      const d = dateOf(r, f.dateCol, ref);
      if (d === null || (from !== null && d < from) || (to !== null && d > to)) return false;
    }
    if (q && !r.some((c) => norm(c).toLowerCase().includes(q))) return false;
    return true;
  });
}

export interface Bucket {
  value: string;
  count: number;
  amount: number;
}

/** 列の値ごとの件数と金額（件数の多い順、空欄は最後） */
export function countBy(rows: string[][], col: number, amountCol = -1): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const r of rows) {
    const value = cell(r, col);
    let b = map.get(value);
    if (!b) map.set(value, (b = { value, count: 0, amount: 0 }));
    b.count++;
    if (amountCol >= 0) b.amount += toNumber(r[amountCol] ?? '') ?? 0;
  }
  return [...map.values()].sort((a, b) => (a.value === EMPTY ? 1 : b.value === EMPTY ? -1 : b.count - a.count));
}

export interface Cross {
  rows: string[];
  cols: string[];
  /** cells[行][列] の件数 */
  cells: number[][];
}

export function crossTab(rows: string[][], a: number, b: number): Cross {
  const rs = countBy(rows, a).map((x) => x.value);
  const cs = countBy(rows, b).map((x) => x.value);
  const cells = rs.map(() => cs.map(() => 0));
  for (const r of rows) cells[rs.indexOf(cell(r, a))][cs.indexOf(cell(r, b))]++;
  return { rows: rs, cols: cs, cells };
}

export function sumOf(rows: string[][], col: number): number {
  return col < 0 ? 0 : rows.reduce((s, r) => s + (toNumber(r[col] ?? '') ?? 0), 0);
}

/** 月ごとの件数と金額（YYYY-MM の昇順） */
export function byMonth(rows: string[][], dateCol: number, amountCol = -1, ref = -1): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const r of rows) {
    const d = dateOf(r, dateCol, ref);
    if (d === null) continue;
    const dt = new Date(d);
    const value = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    let b = map.get(value);
    if (!b) map.set(value, (b = { value, count: 0, amount: 0 }));
    b.count++;
    if (amountCol >= 0) b.amount += toNumber(r[amountCol] ?? '') ?? 0;
  }
  return [...map.values()].sort((a, b) => a.value.localeCompare(b.value));
}

/** 段階の日付列（入っていればその段階まで進んだ案件） */
const STAGE_DEFS: { label: string; re: RegExp }[] = [
  { label: '新規実施', re: /新規.*実施/ },
  { label: '提案実施', re: /提案.*実施/ },
  { label: 'ヨミ実施', re: /ヨミ.*実施/ },
  { label: '受注', re: /受注.*日/ },
];

export interface StageCol {
  label: string;
  index: number;
}

export function stageCols(cols: DealCol[]): StageCol[] {
  const found = STAGE_DEFS.flatMap((d) => {
    const c = cols.find((x) => d.re.test(norm(x.name)));
    return c ? [{ label: d.label, index: c.index }] : [];
  });
  return found.length >= 2 ? found : [];
}

export interface StageRow {
  value: string;
  total: number;
  /** 各段階まで進んだ件数（stages と同じ順） */
  reached: number[];
  /** 最後の段階（受注）まで進んだ案件の金額 */
  wonAmount: number;
}

function stageRow(value: string, rows: string[][], stages: StageCol[], amountCol: number): StageRow {
  const reached = stages.map((s) => rows.filter((r) => (r[s.index] ?? '').trim() !== '').length);
  const last = stages[stages.length - 1];
  const won = rows.filter((r) => (r[last.index] ?? '').trim() !== '');
  return { value, total: rows.length, reached, wonAmount: sumOf(won, amountCol) };
}

/** 段階ごとの到達件数。先頭は全体、続けて axis の値ごと（件数の多い順） */
export function stageFunnel(rows: string[][], stages: StageCol[], axis = -1, amountCol = -1): StageRow[] {
  const out = [stageRow('全体', rows, stages, amountCol)];
  if (axis < 0) return out;
  const groups = new Map<string, string[][]>();
  for (const r of rows) {
    const k = cell(r, axis);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  for (const b of countBy(rows, axis)) out.push(stageRow(b.value, groups.get(b.value)!, stages, amountCol));
  return out;
}
