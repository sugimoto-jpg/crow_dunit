import type { Gender, JobId } from './types';

// ============================================================
// 2Dスプライト（添付のキャラクターシートから切り出し）
// ============================================================

const files = import.meta.glob('../assets/sprites/*.webp', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;

function url(name: string): string {
  const key = `../assets/sprites/${name}.webp`;
  const u = files[key];
  if (!u) throw new Error(`sprite not found: ${name}`);
  return u;
}

export interface SpriteInfo {
  src: string;
  /** ステージ上の高さ（ワールド単位） */
  height: number;
  /** 元画像で顔が向いている方向。バトルでは自キャラ=右向き、モンスター=左向きに揃える */
  facing: 'front' | 'left' | 'right';
  /** 宙に浮いて上下する（飛行系） */
  floating?: boolean;
}

const hero = (name: string, facing: SpriteInfo['facing'] = 'front'): SpriteInfo => ({ src: url(name), height: 1.95, facing });

export const HERO_SPRITES: Record<JobId, Record<Gender, SpriteInfo>> = {
  villager: { male: hero('villager_m'), female: hero('villager_f') },
  warrior: { male: hero('warrior_m'), female: hero('warrior_f') },
  archer: { male: hero('archer_m'), female: hero('archer_f', 'left') },
  mage: { male: hero('mage_m', 'right'), female: hero('mage_f') },
  paladin: { male: hero('paladin_m'), female: hero('paladin_f') },
  dragonKnight: { male: hero('dragonKnight_m'), female: hero('dragonKnight_f') },
  hero: { male: hero('hero_m'), female: hero('hero_f') },
};

const mon = (name: string, height: number, facing: SpriteInfo['facing'] = 'front', floating = false): SpriteInfo => ({
  src: url(`m_${name}`),
  height,
  facing,
  floating,
});

/** クエストID → モンスターのスプライト */
export const MONSTER_SPRITES: Record<string, SpriteInfo> = {
  'it-ses': mon('skeleton', 1.75),
  'it-saas': mon('bee', 1.3, 'right', true),
  'it-web': mon('slime', 0.85),
  'it-ai': mon('dragon', 2.7, 'right'),
  'svc-shigyo': mon('kobold', 1.35, 'right'),
  'svc-consul': mon('treant', 2.2),
  'svc-hr': mon('goblin', 1.45),
  'mfg-parts': mon('guardian', 2.35),
  'con-sub': mon('hydra', 2.35),
  'trd-machine': mon('rat', 1.0, 'right'),
  'log-truck': mon('goblinLord', 2.2),
  'log-carbon': mon('demonKing', 2.45),
  'fin-payment': mon('wolf', 1.4, 'right'),
  'fin-insurance': mon('trueDemonKing', 2.7),
};

export const FALLBACK_MONSTER = mon('slime', 0.85);

export function monsterSprite(questId: string): SpriteInfo {
  return MONSTER_SPRITES[questId] ?? FALLBACK_MONSTER;
}
