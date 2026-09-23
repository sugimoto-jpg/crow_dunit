// ============================================================
// ゲーム全体で共有する型定義
// ============================================================

export type Gender = 'male' | 'female';

export type JobId =
  | 'villager'
  | 'warrior'
  | 'archer'
  | 'mage'
  | 'paladin'
  | 'dragonKnight'
  | 'hero';

export type WeaponType = 'bag' | 'sword' | 'staff' | 'bow' | 'lance' | 'holySword';

export interface JobPalette {
  /** 甲冑・胴衣のメインカラー */
  armor: string;
  /** 縁取り・金属パーツ */
  trim: string;
  /** マント */
  cape: string;
  /** インナー・ズボン */
  cloth: string;
  /** 武器のエフェクト・宝玉などのアクセント */
  accent: string;
}

export interface JobPerks {
  /** 最大HPボーナス */
  hpBonus: number;
  /** 与ダメージ倍率 (1.0 = 等倍) */
  attackRate: number;
  /** 被ダメージ軽減率 (0.0〜0.9) */
  guardRate: number;
  /** 1戦闘あたり「誤答を1つ消す」スキル回数 */
  scoutCharges: number;
  /** 顧客心理のヒントを常時表示できるか */
  insight: boolean;
}

export interface Job {
  id: JobId;
  name: string;
  /** 営業スタイル名 */
  style: string;
  requiredLevel: number;
  description: string;
  skillName: string;
  skillDescription: string;
  weapon: WeaponType;
  hasShield: boolean;
  hasCape: boolean;
  hasShoulder: boolean;
  hasWings: boolean;
  hasCrown: boolean;
  palette: JobPalette;
  perks: JobPerks;
}

// ------------------------------------------------------------
// 学園（虎の巻）
// ------------------------------------------------------------
export interface LectureSlide {
  heading: string;
  body: string[];
  /** 強調表示する虎の巻ポイント */
  point?: string;
  /** 良い例/悪い例のトーク比較 */
  example?: { good: string; bad: string };
}

export interface LectureQuiz {
  question: string;
  choices: { text: string; correct: boolean; feedback: string }[];
}

export interface Lecture {
  id: string;
  chapter: number;
  title: string;
  subtitle: string;
  icon: 'phone' | 'search' | 'gem';
  slides: LectureSlide[];
  quiz: LectureQuiz;
  rewards: { exp: number; gold: number };
}

// ------------------------------------------------------------
// ギルド / バトル
// ------------------------------------------------------------
export type IndustryId =
  | 'it'
  | 'service'
  | 'manufacturing'
  | 'construction'
  | 'trading'
  | 'logistics'
  | 'finance';

export interface Industry {
  id: IndustryId;
  name: string;
  shortName: string;
  color: string;
  description: string;
}

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'maou';

export type MonsterShape = 'slime' | 'golem' | 'demon' | 'ghost';

export type MonsterAccessory =
  | 'none'
  | 'glasses'
  | 'tie'
  | 'hardhat'
  | 'headset'
  | 'crown'
  | 'gear'
  | 'leaf'
  | 'coin'
  | 'antenna';

export interface MonsterSpec {
  /** 例: 「稼働率の亡者 セスゴーレム」 */
  name: string;
  /** 顧客のペルソナ。例: 「SES企業 営業部長」 */
  persona: string;
  shape: MonsterShape;
  /** #rrggbb */
  bodyColor: string;
  /** #rrggbb */
  accentColor: string;
  accessory: MonsterAccessory;
}

export interface BattleChoice {
  text: string;
  correct: boolean;
  /**
   * correct=true : 「なぜこの話法が刺さるのか」の教育解説
   * correct=false: 「失注リスク解説（なぜこの発言が相手を警戒させるのか）」
   */
  feedback: string;
  /** 誤答時に返ってくるモンスター（顧客）の反発セリフ */
  reaction?: string;
}

export type PhaseNumber = 1 | 2 | 3;

export interface BattlePhase {
  phase: PhaseNumber;
  /** フェーズ開始時のモンスター（顧客）の発言 */
  monsterLine: string;
  /** 顧客心理のヒント（魔法使い系の「インサイト」で表示） */
  hint: string;
  /** 必ず4つ。正解は1つだけ */
  choices: BattleChoice[];
}

export interface Quest {
  id: string;
  industry: IndustryId;
  /** 対象セクター 例: 「SES・SIer」 */
  sector: string;
  monster: MonsterSpec;
  difficulty: Difficulty;
  recommendedLevel: number;
  /** 依頼書の本文 */
  summary: string;
  /** 顧客が抱える課題タグ */
  pains: string[];
  rewards: { exp: number; gold: number };
  /** 必ず Phase1 → Phase2 → Phase3 の3つ */
  phases: [BattlePhase, BattlePhase, BattlePhase];
  /** 討伐（商談合意）時のモンスターのセリフ */
  victoryLine: string;
}
