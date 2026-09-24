import type { Gender, JobId } from '../data/types';
import { JOBS } from '../data/jobs';
import { checksum } from './checksum';

// ============================================================
// セーブデータの形式（saveVersion 2）
//  - 保存するのは「ゲームの永続データ」だけ。戦闘中の途中経過やモーダル等のUI状態は含めない
//  - 形が変わるときは SAVE_VERSION を上げ、migrations.ts に変換を追加する
// ============================================================

export const SAVE_VERSION = 2;
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

export type TabId = 'academy' | 'guild' | 'hero';

export interface QuestRecordData {
  clears: number;
  bestTurns: number;
  perfect: boolean;
}

export interface SaveData {
  player: {
    name: string;
    gender: Gender;
    jobId: JobId;
    /** レベル・最大HPは exp と職業から算出するため保存しない */
    exp: number;
    gold: number;
  };
  progress: {
    completedLectures: string[];
    masteredTerms: string[];
    glossaryStats: { answered: number; correct: number };
    /** クエスト（討伐）達成状況。ボス（魔王級）撃破状況もここに含まれる */
    questRecords: Record<string, QuestRecordData>;
  };
  flags: {
    /** 名前入力（初回イベント）を終えたか */
    onboarded: boolean;
  };
  /** 現在地：開いている画面とギルドで選択中の業界 */
  location: { tab: TabId; guildIndustry: string };
  settings: { soundOn: boolean; bgmOn: boolean };
  stats: { playTimeSec: number };
}

/** 保存領域に書き込む封筒（メタ情報 + データ） */
export interface SaveEnvelope {
  saveVersion: number;
  /** 保存のたびに増える通し番号。複数タブ間の新旧判定に使う */
  revision: number;
  savedAt: number;
  appVersion: string;
  reason: string;
  checksum: string;
  data: unknown;
}

export function emptySaveData(): SaveData {
  return {
    player: { name: '', gender: 'male', jobId: 'villager', exp: 0, gold: 100 },
    progress: { completedLectures: [], masteredTerms: [], glossaryStats: { answered: 0, correct: 0 }, questRecords: {} },
    flags: { onboarded: false },
    location: { tab: 'academy', guildIndustry: 'it' },
    settings: { soundOn: true, bgmOn: false },
    stats: { playTimeSec: 0 },
  };
}

// ------------------------------------------------------------
// 検証・正規化：壊れた値は安全な値に丸め、構造が壊れていれば null
// ------------------------------------------------------------
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, def: number, min = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, v) : def);
const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def);
const strArr = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))] : []);

export function normalizeSaveData(raw: unknown): SaveData | null {
  if (!isObj(raw) || !isObj(raw.player)) return null;
  const p = raw.player;
  // exp はゲーム進行の根幹。数値でなければ「壊れている」と判定する
  if (typeof p.exp !== 'number' || !Number.isFinite(p.exp)) return null;
  const pr = isObj(raw.progress) ? raw.progress : {};
  const gs = isObj(pr.glossaryStats) ? pr.glossaryStats : {};
  const qr: Record<string, QuestRecordData> = {};
  if (isObj(pr.questRecords)) {
    for (const [id, r] of Object.entries(pr.questRecords)) {
      if (!isObj(r)) continue;
      qr[id] = { clears: num(r.clears, 1, 1), bestTurns: num(r.bestTurns, 0), perfect: bool(r.perfect, false) };
    }
  }
  const loc = isObj(raw.location) ? raw.location : {};
  const st = isObj(raw.settings) ? raw.settings : {};
  const stats = isObj(raw.stats) ? raw.stats : {};
  const flags = isObj(raw.flags) ? raw.flags : {};
  const tab = loc.tab === 'guild' || loc.tab === 'hero' ? loc.tab : 'academy';
  return {
    player: {
      name: typeof p.name === 'string' ? p.name.slice(0, 20) : '',
      gender: p.gender === 'female' ? 'female' : 'male',
      jobId: typeof p.jobId === 'string' && p.jobId in JOBS ? (p.jobId as JobId) : 'villager',
      exp: Math.max(0, p.exp),
      gold: num(p.gold, 0),
    },
    progress: {
      completedLectures: strArr(pr.completedLectures),
      masteredTerms: strArr(pr.masteredTerms),
      glossaryStats: { answered: num(gs.answered, 0), correct: num(gs.correct, 0) },
      questRecords: qr,
    },
    flags: { onboarded: bool(flags.onboarded, true) },
    location: { tab, guildIndustry: typeof loc.guildIndustry === 'string' ? loc.guildIndustry : 'it' },
    settings: { soundOn: bool(st.soundOn, true), bgmOn: bool(st.bgmOn, false) },
    stats: { playTimeSec: num(stats.playTimeSec, 0) },
  };
}

// ------------------------------------------------------------
// 封筒の作成・検証
// ------------------------------------------------------------
export function sealEnvelope(data: SaveData, revision: number, reason: string, now = Date.now()): string {
  const payload = JSON.stringify(data);
  const env = {
    saveVersion: SAVE_VERSION,
    revision,
    savedAt: now,
    appVersion: APP_VERSION,
    reason,
    checksum: checksum(payload),
    data,
  } satisfies SaveEnvelope;
  return JSON.stringify(env);
}

export type OpenResult =
  | { ok: true; envelope: SaveEnvelope }
  | { ok: false; error: 'empty' | 'parse' | 'shape' | 'checksum' };

/** 保存文字列を開いて、形式とチェックサムを検証する（データの中身の移行・正規化は別） */
export function openEnvelope(text: string | null): OpenResult {
  if (text == null || text === '') return { ok: false, error: 'empty' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'parse' };
  }
  if (!isObj(parsed) || typeof parsed.saveVersion !== 'number' || typeof parsed.checksum !== 'string' || !('data' in parsed)) {
    return { ok: false, error: 'shape' };
  }
  if (checksum(JSON.stringify(parsed.data)) !== parsed.checksum) return { ok: false, error: 'checksum' };
  return {
    ok: true,
    envelope: {
      saveVersion: parsed.saveVersion,
      revision: num(parsed.revision, 0),
      savedAt: num(parsed.savedAt, 0),
      appVersion: typeof parsed.appVersion === 'string' ? parsed.appVersion : '?',
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
      checksum: parsed.checksum,
      data: parsed.data,
    },
  };
}
