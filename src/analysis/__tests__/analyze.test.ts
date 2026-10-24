import { describe, expect, it } from 'vitest';
import { analyze, benchmarks, funnelColumns, stagesOf, upperQuartile, weakestStep } from '../analyze';
import { defaultRoles, describeColumns, groupRows, guessRole, looksLikeTime, looksTransposed, parseGrid, sumGroups, toNumber, toTable } from '../table';

const MONTHLY = [
  '営業KPI管理表',
  '月\t架電数\t接続数\tアポ数\t商談数\t受注数\t売上\tアポ率',
  '4月\t1,000\t200\t20\t16\t4\t¥1,200,000\t2.0%',
  '5月\t1,000\t250\t30\t24\t6\t1,800,000\t3.0%',
  '6月\t1,000\t200\t40\t30\t6\t1,800,000\t4.0%',
  '合計\t3,000\t650\t90\t70\t16\t4,800,000\t',
  '目標\t3,000\t600\t120\t96\t24\t7,200,000\t',
].join('\n');

function setup(text: string) {
  const grid = parseGrid(text);
  const t = toTable(grid, looksTransposed(grid));
  const cols = describeColumns(t);
  const labelCol = cols.find((c) => !c.numeric)!.index;
  const g = groupRows(t, cols, labelCol);
  const funnel = funnelColumns(t.header, defaultRoles(cols));
  return { t, cols, g, funnel };
}

describe('table', () => {
  it('reads Japanese number formats', () => {
    expect(toNumber('1,234')).toBe(1234);
    expect(toNumber('¥12万')).toBe(120000);
    expect(toNumber('45%')).toBeCloseTo(0.45);
    expect(toNumber('△300')).toBe(-300);
    expect(toNumber('１２３件')).toBe(123);
    expect(toNumber('4月')).toBeNull();
    expect(toNumber('')).toBeNull();
  });

  it('guesses funnel roles from column names', () => {
    expect(guessRole('架電数')).toBe('activity');
    expect(guessRole('担当者接続数')).toBe('contact');
    expect(guessRole('アポ獲得数')).toBe('appointment');
    expect(guessRole('商談設定数')).toBe('appointment');
    expect(guessRole('商談数')).toBe('meeting');
    expect(guessRole('受注件数')).toBe('deal');
    expect(guessRole('受注金額')).toBe('revenue');
    expect(guessRole('アポ率')).toBeNull();
    expect(guessRole('受注単価')).toBeNull();
  });

  it('skips the title row, drops total rows and keeps the target row', () => {
    const { t, g, funnel } = setup(MONTHLY);
    expect(t.header[0]).toBe('月');
    expect(g.groups.map((x) => x.label)).toEqual(['4月', '5月', '6月']);
    expect(g.targetRow?.[5]).toBe(24);
    expect(funnel.map((f) => f.name)).toEqual(['架電数', '接続数', 'アポ数', '商談数', '受注数', '売上']);
    expect(looksLikeTime(g.groups.map((x) => x.label))).toBe(true);
  });

  it('transposes a sheet with metrics down the first column', () => {
    const grid = parseGrid('項目,4月,5月,目標\n架電数,100,200,300\nアポ数,5,8,15\n受注数,1,2,3');
    expect(looksTransposed(grid)).toBe(true);
    const t = toTable(grid, true);
    expect(t.header).toEqual(['項目', '架電数', 'アポ数', '受注数']);
    const cols = describeColumns(t);
    const g = groupRows(t, cols, 0);
    expect(g.groups.map((x) => x.label)).toEqual(['4月', '5月']);
    expect(g.targetRow).toEqual({ 1: 300, 2: 15, 3: 3 });
  });

  it('links target columns to their actual columns and aggregates by person', () => {
    const text = '担当者,月,アポ数,アポ目標,受注数,受注目標\n佐藤,4月,10,12,2,3\n佐藤,5月,14,12,3,3\n鈴木,4月,6,12,1,3';
    const t = toTable(parseGrid(text), false);
    const cols = describeColumns(t);
    expect(cols[3].targetOf).toBe(2);
    expect(cols[5].targetOf).toBe(4);
    const g = groupRows(t, cols, 0);
    expect(g.groups.map((x) => [x.label, x.values[2], x.targets[2]])).toEqual([
      ['佐藤', 24, 24],
      ['鈴木', 6, 12],
    ]);
    expect(groupRows(t, cols, 0, { col: 1, value: '4月' }).groups.map((x) => x.values[2])).toEqual([10, 6]);
  });
});

describe('analyze', () => {
  it('back-calculates required counts and ranks the levers by impact', () => {
    const { g, funnel } = setup(MONTHLY);
    const total = sumGroups(g.groups);
    const stages = stagesOf(funnel, total, g.targetRow);
    const targets = stages.map((s) => s.target);
    const bench = benchmarks(targets, g.groups.map((x) => stagesOf(funnel, x, null)), []);
    // 目標行から逆算：アポ率 120/600 = 20%
    expect(bench[1]).toEqual({ bench: 0.2, source: 'target' });
    const a = analyze(stages, bench, 7_200_000);
    expect(a.gap).toBe(2_400_000);
    // 今の率のまま：架電 3000 × 1.5 = 4500 必要
    expect(a.required[0]).toBeCloseTo(4500);
    // アポ率 90/650=13.8% → 20% が最も効く
    expect(a.levers[0]).toMatchObject({ kind: 'rate', step: 1 });
    expect(a.levers[0].uplift).toBeCloseTo(4_800_000 * (0.2 / (90 / 650) - 1));
    // 架電は目標どおりなので行動量の改善は並ばない
    expect(a.levers.some((l) => l.kind === 'volume')).toBe(false);
    const behind = analyze(stages.map((s, i) => (i === 0 ? { ...s, target: 6000 } : s)), bench, 7_200_000);
    const vol = behind.levers.find((l) => l.kind === 'volume')!;
    expect(vol).toMatchObject({ from: 3000, to: 6000 });
    expect(vol.uplift).toBeCloseTo(4_800_000);
    expect(vol.gapShare).toBeCloseTo(2);
  });

  it('uses the pace to forecast the landing', () => {
    const { g, funnel } = setup(MONTHLY);
    const stages = stagesOf(funnel, sumGroups(g.groups), null);
    const a = analyze(stages, [], 9_600_000, 0.5);
    expect(a.forecast).toBe(9_600_000);
    expect(a.gap).toBe(0);
    expect(a.levers).toEqual([]);
  });

  it('falls back to the upper quartile of the rows and finds each row’s weakest step', () => {
    expect(upperQuartile([1, 2, 3, 4, 5])).toBe(4);
    expect(upperQuartile([1, 2])).toBeNull();
    const { g, funnel } = setup(MONTHLY);
    const peers = g.groups.map((x) => stagesOf(funnel, x, null));
    const bench = benchmarks(funnel.map(() => null), peers, []);
    expect(bench[0].source).toBe('top');
    const april = analyze(peers[0], bench, null);
    expect(weakestStep(april)?.step).toBe(1);
  });

  it('prefers manual benchmarks', () => {
    const bench = benchmarks([100, 10, null], [], [0.5, null]);
    expect(bench).toEqual([
      { bench: 0.5, source: 'manual' },
      { bench: null, source: null },
    ]);
  });
});
