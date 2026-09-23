// ============================================================
// 営業偏差値：アイドマ学園での学習量から算出する
//  - 虎の巻（講義）の習得 35%
//  - 業界用語の習得       55%
//  - 用語テストの正答率    10%（5問以上回答してから反映）
// ============================================================

export const HENSACHI_MIN = 38;
export const HENSACHI_MAX = 78;

export interface HensachiInput {
  lectures: number;
  totalLectures: number;
  mastered: number;
  totalTerms: number;
  answered: number;
  correct: number;
}

export function computeHensachi(i: HensachiInput): number {
  const lec = i.totalLectures ? i.lectures / i.totalLectures : 0;
  const term = i.totalTerms ? i.mastered / i.totalTerms : 0;
  const acc = i.answered >= 5 ? i.correct / i.answered : 0;
  const learn = lec * 0.35 + term * 0.55 + acc * 0.1;
  return Math.round((HENSACHI_MIN + learn * (HENSACHI_MAX - HENSACHI_MIN)) * 10) / 10;
}

export function hensachiRank(h: number): { label: string; color: string } {
  if (h >= 72) return { label: '伝説の営業博士', color: '#f472b6' };
  if (h >= 66) return { label: '最難関レベル', color: '#fb923c' };
  if (h >= 60) return { label: '難関レベル', color: '#facc15' };
  if (h >= 54) return { label: '上位レベル', color: '#4ade80' };
  if (h >= 48) return { label: '標準レベル', color: '#60a5fa' };
  return { label: '見習いレベル', color: '#a5b4fc' };
}
