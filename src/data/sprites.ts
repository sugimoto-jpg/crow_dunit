import type { Gender, JobId } from './types';
import { FRAME_META } from './spriteFrames.gen';

// ============================================================
// 2Dスプライト（添付のキャラクターシートから切り出し）
// 各キャラクターは「構え(hold)・振りかぶり(windup)・振り下ろし(strike)」の3コマ
// ============================================================

const files = import.meta.glob('../assets/sprites/*.webp', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;

export type FrameName = 'hold' | 'windup' | 'strike';

export interface SpriteFrame {
  src: string;
  /** 元シート上の幅・高さ・左上座標（px）。コマ間の位置合わせに使う */
  w: number;
  h: number;
  ox: number;
  oy: number;
  /** 足元中心の相対x（0〜1） */
  ax: number;
}

export interface SpriteInfo {
  frames: Record<FrameName, SpriteFrame>;
  /** 構えコマの高さをステージ上で何ユニットにするか */
  height: number;
  /** 元画像で顔が向いている方向。バトルでは自キャラ=右向き、モンスター=左向きに揃える */
  facing: 'front' | 'left' | 'right';
  /** 宙に浮いて上下する（飛行系） */
  floating?: boolean;
  /** 一覧・アイコン用の画像（構えコマ） */
  src: string;
}

function frame(no: number, name: FrameName): SpriteFrame {
  const key = `${no}_${name}`;
  const src = files[`../assets/sprites/c${key}.webp`];
  const m = FRAME_META[key];
  if (!src || !m) throw new Error(`sprite frame not found: ${key}`);
  return { src, w: m[0], h: m[1], ox: m[2], oy: m[3], ax: m[4] };
}

function sprite(no: number, height: number, facing: SpriteInfo['facing'] = 'front', floating = false): SpriteInfo {
  const frames = { hold: frame(no, 'hold'), windup: frame(no, 'windup'), strike: frame(no, 'strike') };
  return { frames, height, facing, floating, src: frames.hold.src };
}

const HERO_H = 2.0;

/** 職業 × 男女 → キャラクターシートの番号 */
export const HERO_SPRITES: Record<JobId, Record<Gender, SpriteInfo>> = {
  villager: { male: sprite(1, HERO_H), female: sprite(2, HERO_H) },
  warrior: { male: sprite(16, HERO_H), female: sprite(17, HERO_H) },
  archer: { male: sprite(5, HERO_H), female: sprite(29, HERO_H) },
  mage: { male: sprite(27, HERO_H), female: sprite(26, HERO_H) },
  paladin: { male: sprite(9, HERO_H), female: sprite(10, HERO_H) },
  dragonKnight: { male: sprite(11, HERO_H), female: sprite(24, HERO_H) },
  hero: { male: sprite(14, HERO_H), female: sprite(15, HERO_H) },
};

/** クエストID → モンスター */
export const MONSTER_SPRITES: Record<string, SpriteInfo> = {
  'it-ses': sprite(42, 1.8),
  'it-saas': sprite(39, 1.3, 'right', true),
  'it-web': sprite(35, 0.8),
  'it-ai': sprite(46, 2.6, 'right'),
  'svc-shigyo': sprite(41, 1.4, 'right'),
  'svc-consul': sprite(40, 2.2),
  'svc-hr': sprite(37, 1.5, 'right'),
  'mfg-parts': sprite(44, 2.3),
  'con-sub': sprite(45, 2.3),
  'trd-machine': sprite(36, 1.0, 'right'),
  'log-truck': sprite(43, 2.2),
  'log-carbon': sprite(47, 2.4),
  'fin-payment': sprite(38, 1.35, 'right'),
  'fin-insurance': sprite(48, 2.6),
};

export const FALLBACK_MONSTER = MONSTER_SPRITES['it-web'];

export function monsterSprite(questId: string): SpriteInfo {
  return MONSTER_SPRITES[questId] ?? FALLBACK_MONSTER;
}
