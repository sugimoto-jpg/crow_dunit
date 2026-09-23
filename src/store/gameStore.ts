import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Gender, JobId } from '../data/types';
import { JOBS, JOB_ORDER } from '../data/jobs';
import { basePlayerHp, levelFromExp } from '../data/levels';

export type Tab = 'academy' | 'guild' | 'hero';

export interface QuestRecord {
  clears: number;
  bestTurns: number;
  perfect: boolean;
}

export interface LevelUpEvent {
  from: number;
  to: number;
  newJobs: JobId[];
}

export interface RewardResult {
  exp: number;
  gold: number;
  levelUp: LevelUpEvent | null;
}

interface GameState {
  // ---- 永続化される進行データ ----
  gender: Gender;
  exp: number;
  gold: number;
  jobId: JobId;
  completedLectures: string[];
  questRecords: Record<string, QuestRecord>;
  soundOn: boolean;
  bgmOn: boolean;
  tab: Tab;
  guildIndustry: string;
  onboarded: boolean;

  // ---- 一時的なUI状態 ----
  activeQuestId: string | null;
  levelUpEvent: LevelUpEvent | null;
  jobModalOpen: boolean;
  /** 講義リーダー表示中はレベルアップ演出を保留する */
  lectureOpen: boolean;

  // ---- actions ----
  setTab: (tab: Tab) => void;
  setGender: (g: Gender) => void;
  setGuildIndustry: (id: string) => void;
  finishOnboarding: () => void;
  gainReward: (exp: number, gold: number) => RewardResult;
  spendGold: (amount: number) => boolean;
  completeLecture: (id: string, exp: number, gold: number) => RewardResult | null;
  recordQuestClear: (questId: string, turns: number, perfect: boolean) => void;
  changeJob: (id: JobId) => void;
  toggleSound: () => void;
  toggleBgm: () => void;
  startQuest: (id: string) => void;
  exitQuest: () => void;
  dismissLevelUp: () => void;
  setJobModalOpen: (open: boolean) => void;
  setLectureOpen: (open: boolean) => void;
  resetAll: () => void;
}

const initialProgress = {
  gender: 'male' as Gender,
  exp: 0,
  gold: 100,
  jobId: 'villager' as JobId,
  completedLectures: [] as string[],
  questRecords: {} as Record<string, QuestRecord>,
  soundOn: true,
  bgmOn: false,
  tab: 'academy' as Tab,
  guildIndustry: 'it',
  onboarded: false,
};

export function jobsUnlockedAt(level: number): JobId[] {
  return JOB_ORDER.filter((id) => JOBS[id].requiredLevel <= level);
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...initialProgress,
      activeQuestId: null,
      levelUpEvent: null,
      jobModalOpen: false,
      lectureOpen: false,

      setTab: (tab) => set({ tab }),
      setGender: (gender) => set({ gender }),
      setGuildIndustry: (guildIndustry) => set({ guildIndustry }),
      finishOnboarding: () => set({ onboarded: true }),

      gainReward: (exp, gold) => {
        const before = levelFromExp(get().exp);
        const nextExp = get().exp + exp;
        const after = levelFromExp(nextExp);
        let levelUp: LevelUpEvent | null = null;
        if (after > before) {
          const newJobs = JOB_ORDER.filter(
            (id) => JOBS[id].requiredLevel > before && JOBS[id].requiredLevel <= after,
          );
          levelUp = { from: before, to: after, newJobs };
        }
        set((s) => ({
          exp: nextExp,
          gold: s.gold + gold,
          levelUpEvent: levelUp ?? s.levelUpEvent,
        }));
        return { exp, gold, levelUp };
      },

      spendGold: (amount) => {
        if (get().gold < amount) return false;
        set((s) => ({ gold: s.gold - amount }));
        return true;
      },

      completeLecture: (id, exp, gold) => {
        if (get().completedLectures.includes(id)) return null;
        set((s) => ({ completedLectures: [...s.completedLectures, id] }));
        return get().gainReward(exp, gold);
      },

      recordQuestClear: (questId, turns, perfect) =>
        set((s) => {
          const prev = s.questRecords[questId];
          return {
            questRecords: {
              ...s.questRecords,
              [questId]: {
                clears: (prev?.clears ?? 0) + 1,
                bestTurns: prev ? Math.min(prev.bestTurns, turns) : turns,
                perfect: (prev?.perfect ?? false) || perfect,
              },
            },
          };
        }),

      changeJob: (id) => {
        const level = levelFromExp(get().exp);
        if (JOBS[id].requiredLevel > level) return;
        set({ jobId: id });
      },

      toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
      toggleBgm: () => set((s) => ({ bgmOn: !s.bgmOn })),
      startQuest: (id) => set({ activeQuestId: id }),
      exitQuest: () => set({ activeQuestId: null }),
      dismissLevelUp: () => set({ levelUpEvent: null }),
      setJobModalOpen: (jobModalOpen) => set({ jobModalOpen }),
      setLectureOpen: (lectureOpen) => set({ lectureOpen }),
      resetAll: () => set({ ...initialProgress, activeQuestId: null, levelUpEvent: null, jobModalOpen: false }),
    }),
    {
      name: 'aidma-sales-quest-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        gender: s.gender,
        exp: s.exp,
        gold: s.gold,
        jobId: s.jobId,
        completedLectures: s.completedLectures,
        questRecords: s.questRecords,
        soundOn: s.soundOn,
        bgmOn: s.bgmOn,
        tab: s.tab,
        guildIndustry: s.guildIndustry,
        onboarded: s.onboarded,
      }),
    },
  ),
);

// ---- 派生値のセレクタ ----
export const useLevel = () => useGame((s) => levelFromExp(s.exp));

export function maxHpFor(level: number, jobId: JobId): number {
  return basePlayerHp(level) + JOBS[jobId].perks.hpBonus;
}
