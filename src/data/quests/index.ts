import type { Quest } from '../types';
import { itQuests } from './it';
import { serviceQuests } from './service';
import { manufacturingQuests } from './manufacturing';
import { constructionQuests } from './construction';
import { tradingQuests } from './trading';
import { logisticsQuests } from './logistics';
import { financeQuests } from './finance';

export const QUESTS: Quest[] = [
  ...itQuests,
  ...serviceQuests,
  ...manufacturingQuests,
  ...constructionQuests,
  ...tradingQuests,
  ...logisticsQuests,
  ...financeQuests,
];

export const QUEST_MAP: Record<string, Quest> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

/** 推奨レベル-1 以上で受注可能 */
export function isQuestUnlocked(quest: Quest, level: number): boolean {
  return level >= Math.max(2, quest.recommendedLevel - 1);
}
