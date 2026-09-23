import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Gender, JobId } from '../data/types';
import { CHARACTER_NAMES, JOBS, JOB_ORDER } from '../data/jobs';
import { basePlayerHp, levelFromExp } from '../data/levels';
import type { SaveSnapshot } from './saveSlots';

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
  /** プレイヤーが入力した主人公名 */
  playerName: string;
  exp: number;
  gold: number;
  jobId: JobId;
  completedLectures: string[];
  questRecords: Record<string, QuestRecord>;
  /** 業界用語集で正解済みの用語ID */
  masteredTerms: string[];
  /** 用語テストの累計回答数・正解数（偏差値の正答率ボーナスに使う） */
  glossaryStats: { answered: number; correct: number };
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
  /** 冒険の書（セーブ/ロード）画面 */
  saveMenu: 'save' | 'load' | null;

  // ---- actions ----
  setTab: (tab: Tab) => void;
  setGender: (g: Gender) => void;
  setPlayerName: (name: string) => void;
  setGuildIndustry: (id: string) => void;
  finishOnboarding: () => void;
  gainReward: (exp: number, gold: number) => RewardResult;
  spendGold: (amount: number) => boolean;
  completeLecture: (id: string, exp: number, gold: number) => RewardResult | null;
  answerTerm: (id: string, correct: boolean) => RewardResult | null;
  recordQuestClear: (questId: string, turns: number, perfect: boolean) => void;
  changeJob: (id: JobId) => void;
  toggleSound: () => void;
  toggleBgm: () => void;
  startQuest: (id: string) => void;
  exitQuest: () => void;
  dismissLevelUp: () => void;
  setJobModalOpen: (open: boolean) => void;
  setLectureOpen: (open: boolean) => void;
  setSaveMenu: (mode: 'save' | 'load' | null) => void;
  takeSnapshot: () => SaveSnapshot;
  loadSnapshot: (snap: SaveSnapshot) => void;
  resetAll: () => void;
}

const initialProgress = {
  gender: 'male' as Gender,
  playerName: '',
  exp: 0,
  gold: 100,
  jobId: 'villager' as JobId,
  completedLectures: [] as string[],
  questRecords: {} as Record<string, QuestRecord>,
  masteredTerms: [] as string[],
  glossaryStats: { answered: 0, correct: 0 },
  soundOn: true,
  bgmOn: false,
  tab: 'academy' as Tab,
  guildIndustry: 'it',
  onboarded: false,
};

/** 用語テストで初めて正解したときの報酬 */
export const TERM_REWARD = { exp: 12, gold: 5 } as const;

export const NAME_MAX = 10;

/** 制御文字を除去し、前後の空白を詰めて最大文字数に丸める */
export function sanitizeName(name: string): string {
  // eslint-disable-next-line no-control-regex
  return [...name.replace(/[\u0000-\u001f\u007f]/g, '').trim()].slice(0, NAME_MAX).join('');
}

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
      saveMenu: null,

      setTab: (tab) => set({ tab }),
      setGender: (gender) => set({ gender }),
      setPlayerName: (name) => set({ playerName: sanitizeName(name) }),
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

      answerTerm: (id, correct) => {
        const s = get();
        const firstTime = correct && !s.masteredTerms.includes(id);
        set({
          glossaryStats: { answered: s.glossaryStats.answered + 1, correct: s.glossaryStats.correct + (correct ? 1 : 0) },
          masteredTerms: firstTime ? [...s.masteredTerms, id] : s.masteredTerms,
        });
        return firstTime ? get().gainReward(TERM_REWARD.exp, TERM_REWARD.gold) : null;
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
      setSaveMenu: (saveMenu) => set({ saveMenu }),
      takeSnapshot: () => {
        const s = get();
        return {
          gender: s.gender,
          playerName: s.playerName,
          exp: s.exp,
          gold: s.gold,
          jobId: s.jobId,
          completedLectures: [...s.completedLectures],
          questRecords: { ...s.questRecords },
          masteredTerms: [...s.masteredTerms],
          glossaryStats: { ...s.glossaryStats },
        };
      },
      loadSnapshot: (snap) =>
        set({
          gender: snap.gender,
          playerName: sanitizeName(snap.playerName ?? ''),
          exp: Math.max(0, snap.exp),
          gold: Math.max(0, snap.gold),
          jobId: JOBS[snap.jobId] ? snap.jobId : 'villager',
          completedLectures: [...(snap.completedLectures ?? [])],
          questRecords: { ...(snap.questRecords ?? {}) },
          masteredTerms: [...(snap.masteredTerms ?? [])],
          glossaryStats: snap.glossaryStats ? { ...snap.glossaryStats } : { answered: 0, correct: 0 },
          onboarded: true,
          tab: 'academy',
          activeQuestId: null,
          levelUpEvent: null,
          jobModalOpen: false,
          saveMenu: null,
        }),
      resetAll: () => set({ ...initialProgress, activeQuestId: null, levelUpEvent: null, jobModalOpen: false, saveMenu: null }),
    }),
    {
      name: 'aidma-sales-quest-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        gender: s.gender,
        playerName: s.playerName,
        exp: s.exp,
        gold: s.gold,
        jobId: s.jobId,
        completedLectures: s.completedLectures,
        questRecords: s.questRecords,
        masteredTerms: s.masteredTerms,
        glossaryStats: s.glossaryStats,
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

/** 表示用の主人公名（未入力の旧セーブは見た目タイプの既定名） */
export const usePlayerName = () => useGame((s) => s.playerName || CHARACTER_NAMES[s.gender]);

export function maxHpFor(level: number, jobId: JobId): number {
  return basePlayerHp(level) + JOBS[jobId].perks.hpBonus;
}
