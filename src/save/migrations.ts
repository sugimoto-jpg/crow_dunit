import { SAVE_VERSION, normalizeSaveData, type SaveData } from './schema';

// ============================================================
// セーブデータの移行（Migration）
//   旧データ → migrations[v] を順に適用 → 最新(SAVE_VERSION) → 正規化
//
//   v0: 旧・自動保存（zustand persist の state。フラットな形）
//   v1: 旧・冒険の書（手動3枠の snapshot。フラットで設定・現在地なし）
//   v2: 現行（player / progress / flags / location / settings / stats に分割）
//
// 新しい版を追加するときは SAVE_VERSION を上げ、ここに [旧版]: 変換 を追加する。
// 変換関数は「前の版の形」を受け取り「次の版の形」を返すこと（途中で失敗したら throw）。
// ============================================================

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {});

export const MIGRATIONS: Record<number, (data: unknown) => unknown> = {
  // v0 → v1：自動保存の state を、冒険の書と同じフラット形式＋付帯情報に揃える
  0: (data) => {
    const s = obj(data);
    return {
      gender: s.gender,
      playerName: s.playerName ?? '',
      exp: s.exp,
      gold: s.gold,
      jobId: s.jobId,
      completedLectures: s.completedLectures ?? [],
      questRecords: s.questRecords ?? {},
      masteredTerms: s.masteredTerms ?? [],
      glossaryStats: s.glossaryStats ?? { answered: 0, correct: 0 },
      // v0 だけが持っていた設定・現在地・初回フラグ
      soundOn: s.soundOn,
      bgmOn: s.bgmOn,
      tab: s.tab,
      guildIndustry: s.guildIndustry,
      onboarded: s.onboarded ?? true,
    };
  },
  // v1 → v2：フラット形式を分割形式へ
  1: (data) => {
    const s = obj(data);
    return {
      player: { name: s.playerName ?? '', gender: s.gender, jobId: s.jobId, exp: s.exp, gold: s.gold },
      progress: {
        completedLectures: s.completedLectures ?? [],
        masteredTerms: s.masteredTerms ?? [],
        glossaryStats: s.glossaryStats ?? { answered: 0, correct: 0 },
        questRecords: s.questRecords ?? {},
      },
      flags: { onboarded: s.onboarded ?? true },
      location: { tab: s.tab ?? 'academy', guildIndustry: s.guildIndustry ?? 'it' },
      settings: { soundOn: s.soundOn ?? true, bgmOn: s.bgmOn ?? false },
      stats: { playTimeSec: 0 },
    };
  },
};

export type MigrateResult =
  | { ok: true; data: SaveData; from: number; migrated: boolean }
  | { ok: false; from: number; error: string };

export function migrateToLatest(version: number, data: unknown): MigrateResult {
  if (!Number.isInteger(version) || version < 0) return { ok: false, from: version, error: `不正な saveVersion: ${version}` };
  if (version > SAVE_VERSION) {
    // 新しいアプリで保存したデータを古いアプリで開いた場合。壊さないよう読み込みを拒否する
    return { ok: false, from: version, error: `このアプリより新しいセーブデータです（v${version}）` };
  }
  let cur = data;
  try {
    for (let v = version; v < SAVE_VERSION; v++) {
      const step = MIGRATIONS[v];
      if (!step) return { ok: false, from: version, error: `v${v} からの移行処理がありません` };
      cur = step(cur);
    }
  } catch (e) {
    return { ok: false, from: version, error: `移行中にエラー: ${(e as Error).message}` };
  }
  const normalized = normalizeSaveData(cur);
  if (!normalized) return { ok: false, from: version, error: '移行後のデータ形式が不正です' };
  return { ok: true, data: normalized, from: version, migrated: version !== SAVE_VERSION };
}
