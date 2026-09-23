import type { Gender, JobId } from '../data/types';
import type { QuestRecord } from './gameStore';

// ============================================================
// 冒険の書（手動セーブスロット）
// 端末のブラウザ（localStorage）に保存。自動保存とは別に、任意の時点の記録を残せる。
// ============================================================

export const SLOT_COUNT = 3;
const KEY = 'aidma-sales-quest-slots-v1';

export interface SaveSnapshot {
  gender: Gender;
  playerName: string;
  exp: number;
  gold: number;
  jobId: JobId;
  completedLectures: string[];
  questRecords: Record<string, QuestRecord>;
  /** 旧バージョンのセーブには無い */
  masteredTerms?: string[];
  glossaryStats?: { answered: number; correct: number };
}

export interface SaveSlot {
  savedAt: number;
  snapshot: SaveSnapshot;
}

function isSlot(v: unknown): v is SaveSlot {
  if (!v || typeof v !== 'object') return false;
  const s = v as Partial<SaveSlot>;
  return typeof s.savedAt === 'number' && !!s.snapshot && typeof s.snapshot.exp === 'number' && typeof s.snapshot.jobId === 'string';
}

export function readSlots(): (SaveSlot | null)[] {
  const empty = Array.from({ length: SLOT_COUNT }, () => null);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const arr = JSON.parse(raw) as unknown[];
    return empty.map((_, i) => (isSlot(arr?.[i]) ? (arr[i] as SaveSlot) : null));
  } catch {
    return empty;
  }
}

function writeAll(slots: (SaveSlot | null)[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(slots));
    return true;
  } catch {
    return false;
  }
}

export function writeSlot(index: number, snapshot: SaveSnapshot): boolean {
  const slots = readSlots();
  slots[index] = { savedAt: Date.now(), snapshot: structuredClone(snapshot) };
  return writeAll(slots);
}

export function deleteSlot(index: number): boolean {
  const slots = readSlots();
  slots[index] = null;
  return writeAll(slots);
}

export function hasAnySlot(): boolean {
  return readSlots().some(Boolean);
}
