import { ROLE_RANK, type Group, type Role } from './table';

export interface FunnelCol {
  col: number;
  name: string;
  role: Role;
}

export interface Stage extends FunnelCol {
  value: number;
  target: number | null;
}

export type BenchSource = 'manual' | 'target' | 'top' | null;

export interface Step {
  from: Stage;
  to: Stage;
  /** to / from。売上の手前の段は単価 */
  rate: number | null;
  bench: number | null;
  benchSource: BenchSource;
  /** 件数→金額の段（単価） */
  isPrice: boolean;
}

export type LeverKind = 'rate' | 'volume';

export interface Lever {
  kind: LeverKind;
  /** rate のときは steps の index、volume のときは -1 */
  step: number;
  /** 改善したときの最終指標の増分（着地見込みベース） */
  uplift: number;
  /** 不足分に対する割合（目標がないときは null） */
  gapShare: number | null;
  from: number;
  to: number;
}

export interface Analysis {
  stages: Stage[];
  steps: Step[];
  final: Stage;
  goal: number | null;
  pace: number;
  forecast: number;
  gap: number | null;
  /** 今の転換率のまま目標を達成するのに必要な各段の数（着地ベース） */
  required: (number | null)[];
  levers: Lever[];
  /** 基準まで全段を上げたときの着地 */
  allLevers: number;
}

/** 役割の付いた列をファネル順に並べる */
export function funnelColumns(names: string[], roles: Record<string, Role | undefined>): FunnelCol[] {
  return names
    .map((name, col) => ({ col, name, role: roles[name] }))
    .filter((c): c is FunnelCol => !!c.role)
    .sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.col - b.col);
}

export function stagesOf(funnel: FunnelCol[], g: Group, targetRow: Record<number, number> | null): Stage[] {
  return funnel.map((f) => ({ ...f, value: g.values[f.col] ?? 0, target: g.targets[f.col] ?? targetRow?.[f.col] ?? null }));
}

export const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);

/** 上位25%の水準（線形補間）。行数が少ないときは使わない */
export function upperQuartile(xs: number[]): number | null {
  if (xs.length < 3) return null;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * 0.75;
  const lo = Math.floor(pos);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (pos - lo);
}

/** 他の行の率を基準に使うときの最低件数（段の入口の数） */
export const MIN_SAMPLE = 10;

/**
 * 各段の基準値：手入力 > 目標から逆算した転換率 > 他の行（担当者・月）の上位25%水準。
 * targets は各段の目標値、peers は比較対象の各行のステージ（自分自身を含んでよい）。
 */
export function benchmarks(targets: (number | null)[], peers: Stage[][], manual: (number | null)[]): { bench: number | null; source: BenchSource }[] {
  return targets.slice(0, -1).map((fromT, i) => {
    const toT = targets[i + 1];
    const m = manual[i];
    if (m != null && m > 0) return { bench: m, source: 'manual' };
    if (fromT && toT) return { bench: toT / fromT, source: 'target' };
    // 件数の少ない行（1件で100%など）と、100%を超える集計の揺れは基準に使わない。単価の段は金額なので上限なし
    const price = peers[0]?.[i + 1]?.role === 'revenue';
    const rates = peers
      .filter((p) => (p[i]?.value ?? 0) >= MIN_SAMPLE)
      .map((p) => ratio(p[i + 1]?.value ?? 0, p[i]?.value ?? 0))
      .filter((r): r is number => r !== null && (price || r <= 1));
    const top = upperQuartile(rates);
    return top !== null ? { bench: top, source: 'top' } : { bench: null, source: null };
  });
}

/**
 * 分析本体。pace は期間の経過割合（0〜1、月の途中なら 経過営業日/全営業日）。
 * 着地見込み＝実績/pace として、目標との差を「どの段をどこまで上げれば埋まるか」に分解する。
 */
export function analyze(stages: Stage[], bench: { bench: number | null; source: BenchSource }[], goal: number | null, pace = 1): Analysis {
  const p = pace > 0 && pace <= 1 ? pace : 1;
  const final = stages[stages.length - 1];
  const steps: Step[] = stages.slice(0, -1).map((from, i) => ({
    from,
    to: stages[i + 1],
    rate: ratio(stages[i + 1].value, from.value),
    bench: bench[i]?.bench ?? null,
    benchSource: bench[i]?.source ?? null,
    isPrice: stages[i + 1].role === 'revenue' && from.role !== 'revenue',
  }));
  const forecast = final.value / p;
  const gap = goal !== null ? goal - forecast : null;

  const required: (number | null)[] = stages.map(() => null);
  if (goal !== null) {
    required[stages.length - 1] = goal;
    for (let i = steps.length - 1; i >= 0; i--) {
      const r = steps[i].rate;
      const next = required[i + 1];
      required[i] = r && next !== null ? next / r : null;
    }
  }

  const levers: Lever[] = [];
  let all = forecast;
  steps.forEach((s, i) => {
    if (s.rate && s.bench && s.bench > s.rate) {
      levers.push({ kind: 'rate', step: i, uplift: forecast * (s.bench / s.rate - 1), gapShare: null, from: s.rate, to: s.bench });
      all *= s.bench / s.rate;
    }
  });
  const top = stages[0];
  const topNow = top.value / p;
  // 行動量：最上段に目標値があり、届いていないときだけ並べる（「行動量だけで埋めるなら」は required[0] で別に見せる）
  if (stages.length > 1 && top.target && top.target > topNow && topNow > 0)
    levers.push({ kind: 'volume', step: -1, uplift: forecast * (top.target / topNow - 1), gapShare: null, from: topNow, to: top.target });
  for (const l of levers) l.gapShare = gap !== null && gap > 0 ? l.uplift / gap : null;
  levers.sort((a, b) => b.uplift - a.uplift);

  return { stages, steps, final, goal, pace: p, forecast, gap, required, levers, allLevers: all };
}

/** その行で基準に対して最も弱い段（基準比が最も低いもの） */
export function weakestStep(a: Analysis): { step: number; score: number } | null {
  let best: { step: number; score: number } | null = null;
  a.steps.forEach((s, i) => {
    if (!s.rate || !s.bench) return;
    const score = s.rate / s.bench;
    if (score < 1 && (!best || score < best.score)) best = { step: i, score };
  });
  return best;
}

export type Status = 'good' | 'warn' | 'bad' | 'none';
export function stepStatus(s: Step): Status {
  if (s.rate === null || s.bench === null) return 'none';
  const r = s.rate / s.bench;
  return r >= 1 ? 'good' : r >= 0.9 ? 'warn' : 'bad';
}
