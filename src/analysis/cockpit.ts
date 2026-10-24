import { toNumber } from './table';

/**
 * アイドマの「ヨミ表（コックピット）」シートの読み取り。
 * 1枚のシートに「期間・当日アポ・新規・…・受注金額・単価」の表が何ブロックも並び、右側にヨミ（ランク・確度・金額・計上）の集計がある形。
 * 実績のブロックは「区分・名前・期間・指標…」の1枚の表にまとめ、ヨミは別に取り出す。
 */

export interface YomiRow {
  label: string;
  /** 確度（0〜1） */
  prob: number | null;
  amount: number;
  /** 計上見込み（金額 × 確度） */
  weighted: number;
  /** 「ヨミ合計」「受注＋ヨミ」などの小計行 */
  subtotal: boolean;
}

export interface Cockpit {
  grid: string[][];
  sections: string[];
  /** 月次ミッション（目標金額） */
  mission: number | null;
  yomi: YomiRow[];
}

const n = (s: string | undefined) => (s ?? '').normalize('NFKC').replace(/\s+/g, '');
const shortDate = (s: string) => n(s).replace(/^\d{4}[/-]/, '').replace(/^0/, '').replace(/\/0/, '/');

function isHeader(r: string[]): boolean {
  const c = r.map(n);
  return c.includes('期間') && c.some((x) => x.includes('アポ')) && c.includes('受注金額');
}

export function parseCockpit(g: string[][]): Cockpit | null {
  const headerRows = g.flatMap((r, i) => (isHeader(r) ? [i] : []));
  if (!headerRows.length) return null;
  const head = g[headerRows[0]].map(n);
  const periodCol = head.indexOf('期間');
  const last = head.indexOf('単価') > periodCol ? head.indexOf('単価') : head.indexOf('受注金額');
  // 件数と金額の列だけ使う（率と単価は表の中で計算し直す）
  const metrics: number[] = [];
  for (let c = periodCol + 1; c <= last; c++) if (head[c] && !/率|単価/.test(head[c])) metrics.push(c);

  const rows: string[][] = [];
  const sections: string[] = [];
  headerRows.forEach((hi, k) => {
    const block = n(g[hi][0]) || `表${k + 1}`;
    let prev: { label: string; period: string } | null = null;
    for (let i = hi + 1; i < g.length && !isHeader(g[i]); i++) {
      const r = g[i];
      let label = n(r[0]);
      if (!label) break;
      const start = r[periodCol] ?? '';
      const end = r[periodCol + 1] ?? '';
      const period = `${start}〜${end}`;
      // 「当月実績」「当月全体」は直前の行の当月分
      if (/^当月/.test(label) && prev && prev.period !== period) label = prev.label;
      else prev = { label, period };
      const section = `${block} ${start && start === end ? shortDate(start) : `${shortDate(start)}〜${shortDate(end)}`}`;
      if (!sections.includes(section)) sections.push(section);
      rows.push([section, label, period, ...metrics.map((c) => r[c] ?? '')]);
    }
  });
  const grid = [['区分', '名前', '期間', ...metrics.map((c) => head[c])], ...rows];
  return { grid, sections, mission: findMission(g), yomi: findYomi(g) };
}

function findMission(g: string[][]): number | null {
  for (const r of g) {
    const c = r.findIndex((x) => n(x) === '月次ミッション');
    if (c < 0) continue;
    for (const x of r.slice(c + 1, c + 4)) {
      const v = toNumber(x);
      if (v !== null && v > 0) return v;
    }
  }
  return null;
}

/** 見出しが「ヨミ / % / 売上合計 / 計上」の最初の集計を読む */
function findYomi(g: string[][]): YomiRow[] {
  for (let r = 0; r < g.length; r++) {
    const c = g[r].findIndex((x, j) => n(x) === 'ヨミ' && n(g[r][j + 1]) === '%' && n(g[r][j + 2]).includes('売上'));
    if (c < 0) continue;
    const out: YomiRow[] = [];
    let blanks = 0;
    for (let i = r + 1; i < Math.min(g.length, r + 30); i++) {
      const label = n(g[i][c]);
      if (!label) {
        if (++blanks >= 4) break;
        continue;
      }
      blanks = 0;
      if (label === 'ヨミ') break;
      const amount = toNumber(g[i][c + 2] ?? '');
      if (amount === null) continue;
      const prob = toNumber(g[i][c + 1] ?? '');
      out.push({ label, prob, amount, weighted: toNumber(g[i][c + 3] ?? '') ?? amount * (prob ?? 0), subtotal: /合計|[+＋]/.test(label) });
    }
    return out;
  }
  return [];
}

export interface Promotion {
  from: YomiRow;
  to: YomiRow;
  /** 1ランク上げたときの計上見込みの増分 */
  uplift: number;
}

/** ランクの順番（低い → 高い）。R は位置づけが表ごとに違うので引き上げの対象にしない */
const RANK_ORDER = ['前', 'C', 'B', 'A'];

/** 同じ系統（ヨミ / YF / L）の中で、1つ上のランク（前→C→B→A）に引き上げたときの計上見込みの増分。大きい順 */
export function promotions(rows: YomiRow[]): Promotion[] {
  const split = (l: string) => {
    const m = l.match(/^(.*?)(前|A|B|C)$/);
    return m ? { family: m[1], rank: RANK_ORDER.indexOf(m[2]) } : null;
  };
  const ranks = rows.filter((r) => !r.subtotal && r.prob !== null);
  return ranks
    .flatMap((from) => {
      const f = split(from.label);
      if (!f || from.amount <= 0 || f.rank >= RANK_ORDER.length - 1) return [];
      const to = ranks.find((r) => r.label === f.family + RANK_ORDER[f.rank + 1]);
      return to && to.prob! > from.prob! ? [{ from, to, uplift: from.amount * (to.prob! - from.prob!) }] : [];
    })
    .sort((a, b) => b.uplift - a.uplift);
}

export function yomiTotals(rows: YomiRow[]): { amount: number; weighted: number } {
  const items = rows.filter((r) => !r.subtotal);
  return { amount: items.reduce((s, r) => s + r.amount, 0), weighted: items.reduce((s, r) => s + r.weighted, 0) };
}
