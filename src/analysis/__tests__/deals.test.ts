import { describe, expect, it } from 'vitest';
import { EMPTY, applyFilters, byMonth, countBy, crossTab, dateOf, dealRows, describeDeals, emptyFilters, parseDate, refDateCol, stageCols, stageFunnel, sumOf } from '../deals';
import { parseGrid, toTable } from '../table';

const TEXT = [
  'アポ日\t現在\t企業名\t属性\tアポチャネル\t提案商材\t金額\tメモ',
  '2026/9/3\t提案済\tA社\t新規\t紹介\t営業代行\t1,000,000\t社長が前向き',
  '2026/9/20\t受注\tB社\t既存\tIS\t営業代行\t2,000,000\t',
  '2026/10/1\t受注\tC社\t新規\t紹介\tセミナー\t500,000\t',
  '2026/10/5\t失注\tD社\t新規\t電話\t営業代行\t0\t予算なし',
  '2026/10/9\t\tE社\t既存\t紹介\tセミナー\t800,000\t',
].join('\n');
const t = toTable(parseGrid(TEXT), false);
const cols = describeDeals(t);
const idx = (name: string) => t.header.indexOf(name);

describe('deals', () => {
  it('parses Japanese dates', () => {
    expect(parseDate('2026/10/24')).toBe(new Date(2026, 9, 24).getTime());
    expect(parseDate('2026年1月5日(月)')).toBe(new Date(2026, 0, 5).getTime());
    expect(parseDate('10/24', 2025)).toBe(new Date(2025, 9, 24).getTime());
    expect(parseDate('提案済')).toBeNull();
  });

  it('puts the requested columns first and detects column kinds', () => {
    expect(cols.slice(0, 4).map((c) => c.name)).toEqual(['現在', '属性', 'アポチャネル', '提案商材']);
    const kind = Object.fromEntries(cols.map((c) => [c.name, c.kind]));
    expect(kind).toMatchObject({ アポ日: 'date', 金額: 'number', 企業名: 'text', メモ: 'text', 現在: 'category' });
  });

  it('filters by several columns, a date range and a keyword', () => {
    const f = { ...emptyFilters(idx('アポ日')), cats: { [idx('属性')]: ['新規'], [idx('アポチャネル')]: ['紹介', '電話'] } };
    expect(applyFilters(t.rows, f).map((r) => r[2])).toEqual(['A社', 'C社', 'D社']);
    expect(applyFilters(t.rows, { ...f, from: '2026-10-01', to: '2026-10-31' }).map((r) => r[2])).toEqual(['C社', 'D社']);
    expect(applyFilters(t.rows, { ...emptyFilters(), q: '予算' }).map((r) => r[2])).toEqual(['D社']);
    // 空欄も選べる
    expect(applyFilters(t.rows, { ...emptyFilters(), cats: { [idx('現在')]: [EMPTY] } }).map((r) => r[2])).toEqual(['E社']);
    // except を渡すとその列の条件だけ外す（選択肢の件数用）
    expect(applyFilters(t.rows, f, idx('アポチャネル'))).toHaveLength(3);
  });

  it('counts, cross-tabulates and sums', () => {
    expect(countBy(t.rows, idx('現在'), idx('金額'))).toEqual([
      { value: '受注', count: 2, amount: 2_500_000 },
      { value: '提案済', count: 1, amount: 1_000_000 },
      { value: '失注', count: 1, amount: 0 },
      { value: EMPTY, count: 1, amount: 800_000 },
    ]);
    const x = crossTab(t.rows, idx('アポチャネル'), idx('提案商材'));
    expect(x.rows).toEqual(['紹介', 'IS', '電話']);
    expect(x.cols).toEqual(['営業代行', 'セミナー']);
    expect(x.cells).toEqual([
      [1, 2],
      [1, 0],
      [1, 0],
    ]);
    expect(sumOf(t.rows, idx('金額'))).toBe(4_300_000);
    expect(byMonth(t.rows, idx('アポ日')).map((b) => [b.value, b.count])).toEqual([
      ['2026-09', 2],
      ['2026-10', 3],
    ]);
  });
});

describe('yomi sheet columns', () => {
  const TEXT2 = [
    '現在\t情報更新日\t属性\tアポチャネル\t提案商材\t金額合計\t企業名\t"新規\n実施\n日時"\t"提案\n実施\n日時"\t"ヨミ\n実施\n日時"\t"受注\n日時"',
    'キャンセル\t2025/07/11\t新規\t紹介\tSP\t¥1,950,000\tA社\t\t\t\t',
    '受注\t2026/01/16\t新規\t紹介\tSP\t¥1,950,000\tB社\t12/08\t12/20\t01/10\t01/16',
    'FB\t2026/10/20\tフォロー\tIS\tCM\t¥2,250,000\tC社\t10/01\t\t\t',
    'FC\t2026/10/22\t新規\tIS\tSP\t¥0\tD社\t10/22\t10/22\t\t',
    '\t\t\t\t\t¥0\t\t\t\t\t',
  ].join('\n');
  const t2 = toTable(parseGrid(TEXT2), false);
  const c2 = describeDeals(t2);

  it('drops formula-only rows and reads year-less dates against the update date', () => {
    const rows = dealRows(t2, c2);
    expect(rows).toHaveLength(4);
    const ref = refDateCol(t2, c2);
    expect(t2.header[ref]).toBe('情報更新日');
    const visit = t2.header.findIndex((h) => h.startsWith('新規'));
    // 12/08 は更新日 2026/01/16 に近い 2025年
    expect(dateOf(rows[1], visit, ref)).toBe(new Date(2025, 11, 8).getTime());
    expect(byMonth(rows, visit, -1, ref).map((b) => b.value)).toEqual(['2025-12', '2026-10']);
  });

  it('counts how far each deal got by channel', () => {
    const rows = dealRows(t2, c2);
    const stages = stageCols(c2);
    expect(stages.map((s) => s.label)).toEqual(['新規実施', '提案実施', 'ヨミ実施', '受注']);
    const f = stageFunnel(rows, stages, t2.header.indexOf('アポチャネル'), t2.header.indexOf('金額合計'));
    expect(f.map((r) => [r.value, r.total, ...r.reached, r.wonAmount])).toEqual([
      ['全体', 4, 3, 2, 1, 1, 1_950_000],
      ['紹介', 2, 1, 1, 1, 1, 1_950_000],
      ['IS', 2, 2, 1, 0, 0, 0],
    ]);
  });
});
