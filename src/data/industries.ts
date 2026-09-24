import type { Difficulty, Industry, IndustryId } from './types';

export const INDUSTRIES: Industry[] = [
  { id: 'it', name: 'IT・Web・通信', shortName: 'IT', color: '#38bdf8', description: 'SES・SIer、SaaS、Web制作、AI開発。技術はあるのに「届ける力」が足りない魔物が棲む。' },
  { id: 'service', name: 'サービス・BtoB専門職', shortName: '士業', color: '#a78bfa', description: '士業・コンサル・人材紹介。紹介と人脈頼みで案件の波に揺れる魔物たち。' },
  { id: 'manufacturing', name: '製造・ものづくり', shortName: '製造', color: '#f59e0b', description: '部品加工・FA機器。系列と既存取引の呪縛から抜け出せない職人ゴーレム。' },
  { id: 'construction', name: '建設・不動産', shortName: '建設', color: '#fb923c', description: '設備工事・ゼネコン。多重下請けのマージン地獄に囚われた現場の魔物。' },
  { id: 'trading', name: '商社・流通', shortName: '商社', color: '#34d399', description: '機械資材専門商社。ルート営業に疲弊し、新商材を持て余す魔物。' },
  { id: 'logistics', name: '物流・インフラ・環境', shortName: '物流', color: '#22d3ee', description: '運送・脱炭素。2024年問題とScope3の嵐が吹き荒れる荒野。' },
  { id: 'finance', name: '金融・保険', shortName: '金融', color: '#facc15', description: 'BtoB決済・法人保険。相見積と価格競争の沼に沈む魔王級の強敵。' },
];

export const INDUSTRY_MAP = Object.fromEntries(INDUSTRIES.map((i) => [i.id, i])) as Record<IndustryId, Industry>;

export interface DifficultyInfo {
  label: string;
  stars: number;
  color: string;
  monsterHp: number;
  /** 誤答時に受けるダメージ（軽減前） */
  damage: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyInfo> = {
  beginner: { label: '初級', stars: 1, color: '#4ade80', monsterHp: 300, damage: 20 },
  intermediate: { label: '中級', stars: 2, color: '#60a5fa', monsterHp: 520, damage: 28 },
  advanced: { label: '上級', stars: 3, color: '#f472b6', monsterHp: 800, damage: 36 },
  maou: { label: '魔王級', stars: 4, color: '#f43f5e', monsterHp: 1200, damage: 46 },
};

export const PHASE_NAMES = {
  1: '業界動向フック',
  2: '深掘りヒアリング',
  3: '解決価値提案',
} as const;

export const PHASE_DESCRIPTIONS = {
  1: '現状を全肯定し、業界の時事トレンドで課題意識をフックせよ',
  2: '真のボトルネックに寄り添い、理想状態への合意を取り付けよ',
  3: '虎の巻の伴走型内製化で、商談合意をもぎ取れ',
} as const;
