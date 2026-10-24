import { parseCsv } from '../research/csv';

/** ファネル上の役割（上から順に並ぶ）。revenue の手前の段は「件数→金額」なので転換率ではなく単価になる */
export type Role = 'list' | 'activity' | 'contact' | 'appointment' | 'meeting' | 'proposal' | 'proposalVisit' | 'yomi' | 'yomiVisit' | 'deal' | 'revenue';

export const ROLES: { id: Role; label: string }[] = [
  { id: 'list', label: 'リスト・対象数' },
  { id: 'activity', label: '行動量（架電・送信など）' },
  { id: 'contact', label: '接続・反応' },
  { id: 'appointment', label: 'アポ獲得' },
  { id: 'meeting', label: '商談・面談実施' },
  { id: 'proposal', label: '提案・見積' },
  { id: 'proposalVisit', label: '提案訪問' },
  { id: 'yomi', label: 'ヨミ取得' },
  { id: 'yomiVisit', label: 'ヨミ訪問' },
  { id: 'deal', label: '受注・成約' },
  { id: 'revenue', label: '売上・金額' },
];
export const ROLE_RANK: Record<Role, number> = Object.fromEntries(ROLES.map((r, i) => [r.id, i])) as Record<Role, number>;

const norm = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, '');

/** 上から順に判定する（「受注金額」は売上、「商談設定」はアポのように、より具体的なものを先に置く。「獲得」はアポにもリードにも付くので使わない） */
const ROLE_WORDS: [Role, RegExp][] = [
  ['revenue', /売上|売り上げ|金額|粗利|利益|mrr|arr|入金|revenue|成約額|受注額|契約額/],
  // アイドマのヨミ表の段階（当日アポ → 新規 → 提案取得 → 提案訪問 → ヨミ取得 → ヨミ訪問 → 受注）
  ['proposalVisit', /提案訪問/],
  ['yomiVisit', /ヨミ訪問/],
  ['yomi', /ヨミ/],
  ['meeting', /^新規(訪問)?(数|件数|結果)?$/],
  ['appointment', /アポ|appo|商談設定|面談設定|日程調整|予約/],
  ['deal', /受注|成約|契約|クロージング|決定|申込|申し込み|購入|入会|deal|won/],
  ['proposal', /提案|見積|プレゼン/],
  ['meeting', /商談|面談|訪問|打ち合わせ|打合せ|mtg|ミーティング|来店|来場|meeting/],
  ['contact', /接続|通話|着電|コンタクト|対話|キーマン|返信|反応|開封|資料請求|問い合わせ|問合せ|リード|lead|contact/],
  ['activity', /架電|コール|call|発信|送信|配信|dm|メール|フォーム|アプローチ|行動|飛び込み|投稿|送付/],
  ['list', /リスト|対象|母数|ターゲット|list/],
];
const NOT_STAGE = /率|%|割合|cvr|単価|コスト|費用|cpa|cpo|広告費|平均|日数|時間/;
const TARGET_WORD = /目標|計画|予算|予定|target|goal|plan|ノルマ/;
const ACTUAL_WORD = /実績|actual|結果/;
const TOTAL_LABEL = /^(合計|総計|計|小計|累計|平均|total|sum|avg|average)$|合計|総計|total/;

export function guessRole(name: string): Role | null {
  const n = norm(name);
  if (!n || NOT_STAGE.test(n)) return null;
  for (const [role, re] of ROLE_WORDS) if (re.test(n)) return role;
  return null;
}

export const isTargetLabel = (s: string) => TARGET_WORD.test(norm(s));
export const isTotalLabel = (s: string) => !isTargetLabel(s) && TOTAL_LABEL.test(norm(s));
export const isRateName = (s: string) => /率|%|割合|cvr/.test(norm(s));

/** 「1,234」「¥12万」「45%」「△300」「１２３件」などを数値にする（読めなければ null） */
export function toNumber(raw: string): number | null {
  let s = raw.normalize('NFKC').trim().replace(/[,\s¥$円件人社回本個名]/g, '');
  if (!s || s === '-') return null;
  let sign = 1;
  if (/^[△▲]/.test(s)) {
    sign = -1;
    s = s.slice(1);
  }
  let mul = 1;
  if (s.endsWith('%')) {
    mul = 0.01;
    s = s.slice(0, -1);
  } else if (s.endsWith('億')) {
    mul = 1e8;
    s = s.slice(0, -1);
  } else if (s.endsWith('万')) {
    mul = 1e4;
    s = s.slice(0, -1);
  } else if (s.endsWith('千')) {
    mul = 1e3;
    s = s.slice(0, -1);
  }
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  return sign * Number(s) * mul;
}

/** スプレッドシートからのコピー（タブ区切り）でも CSV でも読む */
export function parseGrid(text: string): string[][] {
  const sep = text.split(/\r?\n/, 20).some((l) => l.includes('\t')) ? '\t' : ',';
  return parseCsv(text, sep).map((r) => r.map((c) => c.trim()));
}

export interface Table {
  header: string[];
  rows: string[][];
}

function transposeGrid(g: string[][]): string[][] {
  const w = Math.max(0, ...g.map((r) => r.length));
  return Array.from({ length: w }, (_, c) => g.map((r) => r[c] ?? ''));
}

function clean(g: string[][]): string[][] {
  const w = Math.max(0, ...g.map((r) => r.length));
  const rows = g.map((r) => Array.from({ length: w }, (_, i) => r[i] ?? '')).filter((r) => r.some((c) => c !== ''));
  const keep = Array.from({ length: w }, (_, c) => rows.some((r) => r[c] !== ''));
  return rows.map((r) => r.filter((_, c) => keep[c]));
}

/** 見出し行：上から10行のうち、埋まっているセルが十分にあり、その下に数値が続く最初の行（表の上のタイトル行を飛ばす） */
function headerIndex(g: string[][]): number {
  const filled = g.map((r) => r.filter((c) => c !== '').length);
  const max = Math.max(0, ...filled.slice(0, 10));
  for (let i = 0; i < Math.min(10, g.length - 1); i++) {
    if (filled[i] >= 2 && filled[i] >= max * 0.6 && g.slice(i + 1).some((r) => r.some((c) => toNumber(c) !== null))) return i;
  }
  return 0;
}

const roleHits = (cells: string[]) => cells.filter((c) => guessRole(c)).length;

/** 指標が縦（1列目）に並んでいる表かどうか。例：行＝架電数・アポ数…、列＝4月・5月… */
export function looksTransposed(grid: string[][]): boolean {
  const g = clean(grid);
  if (!g.length) return false;
  const h = g[headerIndex(g)];
  return roleHits(g.map((r) => r[0])) > roleHits(h);
}

export function toTable(grid: string[][], transpose: boolean): Table {
  let g = clean(grid);
  if (transpose) g = clean(transposeGrid(g));
  if (!g.length) return { header: [], rows: [] };
  const h = headerIndex(g);
  const header = g[h].map((c, i) => c || (i === 0 ? '項目' : `列${i + 1}`));
  return { header, rows: g.slice(h + 1) };
}

export interface ColumnInfo {
  index: number;
  name: string;
  numeric: boolean;
  role: Role | null;
  /** 目標列のとき、対応する実績列の index（例：「アポ目標」→「アポ数」） */
  targetOf: number | null;
}

const baseName = (s: string) => norm(s).replace(TARGET_WORD, '').replace(ACTUAL_WORD, '').replace(/[()（）【】\[\]・_\-:：数]/g, '');

export function describeColumns(t: Table): ColumnInfo[] {
  const cols: ColumnInfo[] = t.header.map((name, index) => {
    const cells = t.rows.map((r) => r[index]).filter((c) => c);
    const nums = cells.filter((c) => toNumber(c) !== null).length;
    const numeric = cells.length > 0 && nums >= cells.length * 0.6;
    return { index, name, numeric, role: numeric && !isTargetLabel(name) ? guessRole(name) : null, targetOf: null };
  });
  for (const c of cols) {
    if (!c.numeric || !isTargetLabel(c.name)) continue;
    const base = baseName(c.name);
    const actual = cols.find((a) => a !== c && a.numeric && !isTargetLabel(a.name) && base && baseName(a.name) === base);
    if (actual) c.targetOf = actual.index;
  }
  return cols;
}

/** 実績列の役割の初期値。同じ役割は最初の列だけに付ける */
export function defaultRoles(cols: ColumnInfo[]): Record<string, Role> {
  const used = new Set<Role>();
  const roles: Record<string, Role> = {};
  for (const c of cols) {
    if (c.role && !used.has(c.role)) {
      used.add(c.role);
      roles[c.name] = c.role;
    }
  }
  return roles;
}

export function looksLikeTime(labels: string[]): boolean {
  if (labels.length < 2) return false;
  const hit = labels.filter((l) => /\d+\s*(月|週|日|年|q)|^\d{4}[/\-.]\d{1,2}|^\d{1,2}[/\-.]\d{1,2}|^(w|q)\d|上期|下期|期$/i.test(l.normalize('NFKC')));
  return hit.length >= labels.length * 0.6;
}

export interface Group {
  label: string;
  /** 列 index → 合計値 */
  values: Record<number, number>;
  /** 実績列 index → 目標値（目標列から） */
  targets: Record<number, number>;
}

export interface Grouped {
  groups: Group[];
  /** 「目標」「計画」行の値（実績列 index → 値） */
  targetRow: Record<number, number> | null;
}

/** label 列の値ごとに数値を合計する。合計行は除き、目標行は別に取っておく */
export function groupRows(t: Table, cols: ColumnInfo[], labelCol: number, filter?: { col: number; value: string }): Grouped {
  const map = new Map<string, Group>();
  let targetRow: Record<number, number> | null = null;
  for (const r of t.rows) {
    if (filter && filter.col >= 0 && filter.value && r[filter.col] !== filter.value) continue;
    const label = r[labelCol] ?? '';
    if (!label && labelCol >= 0 && !r.some((c, i) => i !== labelCol && toNumber(c) !== null)) continue;
    if (isTotalLabel(label)) continue;
    if (isTargetLabel(label)) {
      targetRow ??= {};
      for (const c of cols) {
        const v = c.numeric ? toNumber(r[c.index] ?? '') : null;
        if (v !== null) targetRow[c.index] = (targetRow[c.index] ?? 0) + v;
      }
      continue;
    }
    const key = label || '（名前なし）';
    let g = map.get(key);
    if (!g) map.set(key, (g = { label: key, values: {}, targets: {} }));
    for (const c of cols) {
      if (!c.numeric) continue;
      const v = toNumber(r[c.index] ?? '');
      if (v === null) continue;
      if (c.targetOf !== null) g.targets[c.targetOf] = (g.targets[c.targetOf] ?? 0) + v;
      else g.values[c.index] = (g.values[c.index] ?? 0) + v;
    }
  }
  return { groups: [...map.values()], targetRow };
}

export function sumGroups(groups: Group[], label = '全体'): Group {
  const total: Group = { label, values: {}, targets: {} };
  for (const g of groups) {
    for (const [k, v] of Object.entries(g.values)) total.values[+k] = (total.values[+k] ?? 0) + v;
    for (const [k, v] of Object.entries(g.targets)) total.targets[+k] = (total.targets[+k] ?? 0) + v;
  }
  return total;
}
