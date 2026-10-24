import type { Role } from './table';

/** 貼り付けた表と設定をこのブラウザの localStorage に保存する（外部には送信しない） */
const KEY = 'aidma-kpi-analysis:v1';

export interface Saved {
  source: string;
  sourceName: string;
  importedAt: string;
  transpose: boolean;
  labelCol: number;
  filterCol: number;
  filterValue: string;
  roles: Record<string, Role>;
  scope: string;
  goal: string;
  bench: Record<string, string>;
  elapsed: string;
  total: string;
}

export function load(): Saved | null {
  try {
    const s = localStorage.getItem(KEY);
    return s ? (JSON.parse(s) as Saved) : null;
  } catch {
    return null;
  }
}

export function save(s: Saved): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 保存できない環境では何もしない */
  }
}
