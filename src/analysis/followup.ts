import { EMPTY, dateOf, type DealCol } from './deals';
import { toNumber } from './table';

/**
 * 案件一覧から「今動くべき案件」を出す：
 * ・滞留アラート … 進行中なのに次回日程がない・過ぎている・更新が止まっている案件
 * ・クロスセル候補 … 受注済みの会社のうち、その後の追加提案がなく、進行中の案件もない会社
 */

const norm = (s: string) => s.normalize('NFKC').replace(/\s+/g, '');

export interface DealFields {
  company: number;
  status: number;
  next: number;
  update: number;
  attr: number;
  product: number;
  channel: number;
  won: number;
  months: number;
  note: number;
  person: number;
  role: number;
  support: number;
}

/** 列名から役割の列を探す（見つからなければ -1） */
export function detectFields(cols: DealCol[]): DealFields {
  const find = (re: RegExp, kind?: DealCol['kind']) => cols.find((c) => re.test(norm(c.name)) && (!kind || c.kind === kind))?.index ?? -1;
  const notes = cols.filter((c) => /フォロー理由|コメント|メモ|備考/.test(norm(c.name)));
  return {
    company: find(/企業名|会社名|社名|顧客名/),
    status: find(/^現在$|ステータス|状況/),
    next: find(/次回/),
    update: find(/更新日/),
    attr: find(/^属性$/),
    product: find(/提案商材|商材|商品/),
    channel: find(/アポチャネル|チャネル/),
    won: find(/受注.*日/),
    months: find(/^月$|契約月数|契約期間/, 'number'),
    // 理由やメモは最後の列ほど新しい運用のことが多い
    note: notes[notes.length - 1]?.index ?? -1,
    person: find(/先方名前|担当者名|先方/),
    role: find(/役職/),
    support: find(/支援担当/),
  };
}

/** 終わった案件の「現在」 */
const CLOSED = /キャンセル|受注|失注|不要|辞退|^ng$|クローズ|完了|解約|見送り|対象外/i;

/** 「現在」の値のうち、進行中として扱うものの初期値 */
export function defaultOpenStatuses(values: string[]): string[] {
  return values.filter((v) => v && v !== EMPTY && !CLOSED.test(norm(v)));
}

const DAY = 86_400_000;

export type StaleReason = 'overdue' | 'noNext' | 'idle';
export const STALE_LABEL: Record<StaleReason, string> = { overdue: '次回日程が過ぎている', noNext: '次回日程なし', idle: '更新が止まっている' };

export interface StaleItem {
  row: string[];
  reasons: StaleReason[];
  next: number | null;
  updated: number | null;
  /** 最終更新からの日数 */
  idleDays: number | null;
  /** 次回日程を過ぎた日数 */
  overdueDays: number | null;
}

export interface StaleOptions {
  /** 何日更新がなければ「止まっている」とするか */
  idleDays: number;
  /** 最終更新がこの日数より古い案件は対象外（もう動いていない案件を除く）。null ならすべて */
  withinDays: number | null;
}

export function staleDeals(rows: string[][], f: DealFields, open: string[], today: number, o: StaleOptions): StaleItem[] {
  if (f.status < 0) return [];
  const items: StaleItem[] = [];
  for (const row of rows) {
    if (!open.includes(row[f.status] || EMPTY)) continue;
    const updated = f.update >= 0 ? dateOf(row, f.update) : null;
    const idleDays = updated !== null ? Math.floor((today - updated) / DAY) : null;
    if (o.withinDays !== null && idleDays !== null && idleDays > o.withinDays) continue;
    const next = f.next >= 0 ? dateOf(row, f.next, f.update) : null;
    const reasons: StaleReason[] = [];
    if (f.next >= 0 && next === null) reasons.push('noNext');
    if (next !== null && next < today) reasons.push('overdue');
    if (idleDays !== null && idleDays >= o.idleDays) reasons.push('idle');
    if (reasons.length) items.push({ row, reasons, next, updated, idleDays, overdueDays: next !== null && next < today ? Math.floor((today - next) / DAY) : null });
  }
  // 最近まで動いていた案件ほど取り戻しやすいので、更新が新しい順
  return items.sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0));
}

/** 会社名の表記ゆれ（法人格・空白）をそろえる */
export function companyKey(name: string): string {
  return norm(name).replace(/株式会社|有限会社|合同会社|一般社団法人|\(株\)|\(有\)/g, '');
}

const CROSS = /クロス|アップ/;

export interface Account {
  name: string;
  rows: string[][];
  winCount: number;
  wonAmount: number;
  /** 受注した商材（重複なし） */
  products: string[];
  lastWin: number | null;
  /** 最後の受注に「月」（契約月数）を足した日。2か月以上の契約だけ */
  contractEnd: number | null;
  /** 最後に情報が更新された日 */
  lastTouch: number | null;
  /** 最後の受注より後に起きた、クロスセル・アップセルの案件数 */
  crossAfter: number;
  openDeals: number;
  /** まだ受注していない商材のうち、クロスセルでよく売れているもの */
  suggest: string[];
  latest: string[];
}

const addMonths = (t: number, m: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth() + m, d.getDate()).getTime();
};

export function accounts(rows: string[][], f: DealFields, open: string[], amountCol: number): Account[] {
  if (f.company < 0) return [];
  const isWin = (r: string[]) => (f.won >= 0 && (r[f.won] ?? '').trim() !== '') || (f.status >= 0 && norm(r[f.status] ?? '') === '受注');
  const when = (r: string[]) => (f.won >= 0 ? dateOf(r, f.won, f.update) : null) ?? (f.update >= 0 ? dateOf(r, f.update) : null);
  const product = (r: string[]) => (f.product >= 0 ? (r[f.product] ?? '').trim() : '');

  // クロスセル・アップセルで売れている商材の順位（なければ受注全体）
  const wins = rows.filter(isWin);
  const crossWins = wins.filter((r) => f.attr >= 0 && CROSS.test(r[f.attr] ?? ''));
  const rank = new Map<string, number>();
  for (const r of crossWins.length ? crossWins : wins) if (product(r)) rank.set(product(r), (rank.get(product(r)) ?? 0) + 1);
  const popular = [...rank.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);

  const groups = new Map<string, string[][]>();
  for (const r of rows) {
    const name = (r[f.company] ?? '').trim();
    if (!name) continue;
    const k = companyKey(name);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  const out: Account[] = [];
  for (const rs of groups.values()) {
    const ws = rs.filter(isWin);
    if (!ws.length) continue;
    const dated = ws.map((r) => ({ r, t: when(r) })).sort((a, b) => (b.t ?? 0) - (a.t ?? 0));
    const last = dated[0];
    const months = f.months >= 0 ? toNumber(last.r[f.months] ?? '') : null;
    const products = [...new Set(ws.map(product).filter(Boolean))];
    const touches = rs.map((r) => (f.update >= 0 ? dateOf(r, f.update) : null)).filter((t): t is number => t !== null);
    const crossAfter = rs.filter((r) => {
      if (r === last.r || f.attr < 0 || !CROSS.test(r[f.attr] ?? '')) return false;
      const t = f.update >= 0 ? dateOf(r, f.update) : null;
      return last.t !== null && t !== null && t > last.t;
    }).length;
    const latest = [...rs].sort((a, b) => (f.update >= 0 ? (dateOf(b, f.update) ?? 0) - (dateOf(a, f.update) ?? 0) : 0))[0];
    out.push({
      name: (last.r[f.company] ?? '').trim(),
      rows: rs,
      winCount: ws.length,
      wonAmount: ws.reduce((s, r) => s + (amountCol >= 0 ? (toNumber(r[amountCol] ?? '') ?? 0) : 0), 0),
      products,
      lastWin: last.t,
      contractEnd: last.t !== null && months !== null && months >= 2 ? addMonths(last.t, months) : null,
      lastTouch: touches.length ? Math.max(...touches) : null,
      crossAfter,
      openDeals: f.status >= 0 ? rs.filter((r) => open.includes(r[f.status] || EMPTY)).length : 0,
      suggest: popular.filter((p) => !products.includes(p)).slice(0, 3),
      latest,
    });
  }
  return out;
}

export type AccountSort = 'contract' | 'amount' | 'touch';

export function sortAccounts(list: Account[], by: AccountSort, today: number): Account[] {
  const s = [...list];
  if (by === 'amount') return s.sort((a, b) => b.wonAmount - a.wonAmount);
  if (by === 'touch') return s.sort((a, b) => (a.lastTouch ?? 0) - (b.lastTouch ?? 0));
  // 契約終了がこれから近い順 → 終了済み（新しい順）→ 契約月数なし
  const key = (a: Account) => (a.contractEnd === null ? [2, 0] : a.contractEnd >= today ? [0, a.contractEnd] : [1, -a.contractEnd]);
  return s.sort((a, b) => {
    const x = key(a);
    const y = key(b);
    return x[0] - y[0] || x[1] - y[1];
  });
}
