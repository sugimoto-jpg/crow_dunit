/** 各レベルに到達するのに必要な累計EXP（index = level - 1） */
export const LEVEL_TABLE = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200] as const;
export const MAX_LEVEL = LEVEL_TABLE.length;

/** ギルド（討伐依頼）が解放されるレベル */
export const GUILD_UNLOCK_LEVEL = 2;

export function levelFromExp(exp: number): number {
  let lv = 1;
  for (let i = 0; i < LEVEL_TABLE.length; i++) {
    if (exp >= LEVEL_TABLE[i]) lv = i + 1;
  }
  return lv;
}

export function levelProgress(exp: number) {
  const lv = levelFromExp(exp);
  if (lv >= MAX_LEVEL) return { level: lv, current: 1, needed: 1, ratio: 1, isMax: true };
  const base = LEVEL_TABLE[lv - 1];
  const next = LEVEL_TABLE[lv];
  return { level: lv, current: exp - base, needed: next - base, ratio: (exp - base) / (next - base), isMax: false };
}

export function basePlayerHp(level: number): number {
  return 100 + (level - 1) * 15;
}
