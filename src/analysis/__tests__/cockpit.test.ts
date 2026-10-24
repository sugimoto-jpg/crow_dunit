import { describe, expect, it } from 'vitest';
import { parseCockpit, promotions, yomiTotals } from '../cockpit';
import { defaultRoles, describeColumns, guessRole, parseGrid, toTable } from '../table';

// ヨミ表（コックピット）の形を模した架空のデータ
const HEAD = ['', '期間', '', '当日アポ', '新規', '新規訪問率', '提案取得', '提案率', '提案\n訪問', '提案訪問率', 'ヨミ取得', 'ヨミ取得率', 'ヨミ訪問', '受注', 'ヨミ\n受注率', '受注金額', '単価'];
const row = (label: string, from: string, to: string, v: number[]) => [label, from, to, String(v[0]), String(v[1]), '', String(v[2]), '', String(v[3]), '', String(v[4]), '', String(v[5]), String(v[6]), '', `¥${v[7].toLocaleString()}`, ''];
const pad = (r: string[], extra: string[] = []) => [...r, '', ...extra];
const SHEET = [
  pad(Array(17).fill(''), ['杉本']),
  pad(HEAD, ['月次ミッション', '¥30,000,000']),
  pad(row('全体', '2026/07/27', '2026/10/23', [100, 80, 60, 40, 30, 20, 10, 15_000_000])),
  pad(row('当月全体', '2026/10/24', '2026/11/20', [10, 8, 6, 4, 3, 2, 1, 1_500_000]), ['ヨミ', '%', '売上合計', '計上']),
  pad(row('紹介', '2026/07/27', '2026/10/23', [40, 35, 30, 20, 15, 10, 6, 9_000_000]), ['受注＋ヨミ', '', '¥5,000,000', '¥1,200,000']),
  pad(row('当月実績', '2026/10/24', '2026/11/20', [5, 4, 3, 2, 1, 1, 0, 0]), ['受注', '100%', '¥0', '¥0']),
  pad(Array(17).fill(''), ['A', '97%', '¥0', '¥0']),
  pad(Array(17).fill(''), ['B', '74%', '¥1,000,000', '¥740,000']),
  pad(Array(17).fill(''), ['C', '27%', '¥0', '¥0']),
  pad(Array(17).fill(''), ['前', '18%', '¥4,000,000', '¥720,000']),
  pad(Array(17).fill(''), ['ヨミ合計', '', '¥5,000,000', '¥1,460,000']),
  pad(['当日', ...HEAD.slice(1)]),
  pad(row('紹介', '2026/10/24', '2026/10/24', [1, 1, 0, 0, 0, 0, 0, 0])),
].map((r) => r.map((c) => (/[\t\n"]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join('\t'));

describe('cockpit', () => {
  const c = parseCockpit(parseGrid(SHEET.join('\n')))!;

  it('flattens the blocks into one table with sections', () => {
    expect(c.sections).toEqual(['表1 7/27〜10/23', '表1 10/24〜11/20', '当日 10/24']);
    expect(c.grid[0]).toEqual(['区分', '名前', '期間', '当日アポ', '新規', '提案取得', '提案訪問', 'ヨミ取得', 'ヨミ訪問', '受注', '受注金額']);
    // 「当月全体」「当月実績」は直前の行の当月分として扱う
    expect(c.grid.slice(1).map((r) => `${r[0]}:${r[1]}`)).toEqual(['表1 7/27〜10/23:全体', '表1 10/24〜11/20:全体', '表1 7/27〜10/23:紹介', '表1 10/24〜11/20:紹介', '当日 10/24:紹介']);
    expect(c.mission).toBe(30_000_000);
  });

  it('orders the Aidma funnel stages', () => {
    const cols = describeColumns(toTable(c.grid, false));
    expect(Object.entries(defaultRoles(cols))).toEqual([
      ['当日アポ', 'appointment'],
      ['新規', 'meeting'],
      ['提案取得', 'proposal'],
      ['提案訪問', 'proposalVisit'],
      ['ヨミ取得', 'yomi'],
      ['ヨミ訪問', 'yomiVisit'],
      ['受注', 'deal'],
      ['受注金額', 'revenue'],
    ]);
    expect(guessRole('有効ヨミ取得率')).toBeNull();
  });

  it('reads the yomi summary and ranks promotions', () => {
    expect(c.yomi.map((r) => r.label)).toEqual(['受注+ヨミ', '受注', 'A', 'B', 'C', '前', 'ヨミ合計']);
    expect(yomiTotals(c.yomi)).toEqual({ amount: 5_000_000, weighted: 1_460_000 });
    const p = promotions(c.yomi);
    expect(p.map((x) => `${x.from.label}->${x.to.label}`)).toEqual(['前->C', 'B->A']);
    expect(p[0].uplift).toBeCloseTo(4_000_000 * (0.27 - 0.18));
  });

  it('returns null for an ordinary table', () => {
    expect(parseCockpit(parseGrid('月\tアポ数\t受注数\n4月\t10\t2'))).toBeNull();
  });
});
