import { migrateToLatest } from './migrations';
import { emptySaveData, normalizeSaveData, openEnvelope, sealEnvelope, SAVE_VERSION, type SaveData, type SaveEnvelope } from './schema';
import type { StorageAdapter } from './adapters/types';

// ============================================================
// SaveManager：保存処理の集約先
//
//  ■ 書き込み（各スロット：current / backup / tmp の3世代）
//     1. tmp に書く → 2. 読み戻して一致を確認 → 3. 正常な current を backup へ退避
//     → 4. current に書く → 5. tmp を消す
//     どの時点で落ちても current か backup のどちらかは必ず正常に残る。
//  ■ 読み込み
//     全保存先 × (current, backup, tmp) を検証し、正常なものの中で revision が最大のものを採用。
//     current 以外から採用した場合は「バックアップから復旧」として通知し、正常な状態へ書き直す。
//  ■ 保存先
//     stores[0] が主保存先、残りはミラー（ベストエフォートで同じ内容を書く）。
//  ■ 起動判定
//     初回起動 / 読み込み成功 / バックアップ復旧 / 旧形式から移行 / 破損 / データ消失 / 保存領域なし
// ============================================================

export type BootKind =
  | 'first_launch'
  | 'loaded'
  | 'recovered_from_backup'
  | 'migrated_legacy'
  | 'corrupted'
  | 'data_missing'
  | 'storage_unavailable';

export interface BootResult {
  kind: BootKind;
  /** 利用者向けの説明 */
  message: string;
  /** 冒険の書（手動セーブ）が1つ以上あるか */
  hasSlots: boolean;
  /** 読み込んだデータの版（移行した場合は元の版） */
  fromVersion?: number;
}

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info' | 'warn';
  text: string;
  sticky?: boolean;
}

export interface SaveStatus {
  phase: 'booting' | 'needs-decision' | 'ready';
  boot: BootResult | null;
  /** 使用中の保存先（主 → ミラー） */
  backends: string[];
  /** アプリを閉じても残る保存先があるか */
  durable: boolean;
  /** ブラウザに「消されにくい保存」を許可されたか（Web のみ。null=不明） */
  persisted: boolean | null;
  saving: boolean;
  lastSavedAt: number | null;
  lastError: string | null;
  saveCount: number;
  revision: number;
  /** 別のタブで新しい進行が保存された（このタブでは保存を止める） */
  conflict: boolean;
  toasts: Toast[];
}

export interface SlotInfo {
  index: number;
  savedAt: number;
  data: SaveData;
  /** backup から読めた（current が壊れていた） */
  recovered: boolean;
}

/** ゲーム状態との接点（ゲームのロジックには手を入れず、ここだけで受け渡す） */
export interface GameBridge {
  /** 現在の永続データ（stats は SaveManager が付け足す） */
  getData(): Omit<SaveData, 'stats'>;
  apply(data: SaveData): void;
  reset(): void;
  /** 永続データが変わったら呼ぶ。delayMs 後にまとめて保存 */
  subscribe(onChange: (reason: string, delayMs: number) => void): () => void;
}

interface Meta {
  installId: string;
  firstLaunchAt: number;
  lastSaveAt: number;
  saveCount: number;
  lastRevision: number;
}

interface Candidate {
  env: SaveEnvelope;
  data: SaveData;
  fromVersion: number;
  migrated: boolean;
  storeIndex: number;
  gen: Gen;
}

type Gen = 'current' | 'backup' | 'tmp';
const GENS: Gen[] = ['current', 'backup', 'tmp'];

export const KEYS = {
  auto: 'aq:auto',
  slot: (i: number) => `aq:slot:${i}`,
  meta: 'aq:meta',
  preReset: 'aq:pre-reset',
  legacyAuto: 'aidma-sales-quest-v1',
  legacySlots: 'aidma-sales-quest-slots-v1',
  legacyBackup: 'aq:legacy-backup',
} as const;

export const SLOT_COUNT = 3;
const CODE_PREFIX = 'AQS1:';

export interface SaveManagerOptions {
  stores: StorageAdapter[];
  bridge: GameBridge;
  /** 旧形式（v0/v1）の読み込み元。Web では window.localStorage */
  legacy?: { get(key: string): string | null } | null;
  /** 同期で書ける緊急保存先（ページを閉じる瞬間用） */
  emergency?: { getSync(key: string): string | null; setSync(key: string, value: string): void } | null;
  now?: () => number;
  /** 起動時に保存領域の永続化を要求した結果 */
  persisted?: boolean | null;
  /** 複数タブ間の通知に使う BroadcastChannel 名（null で無効） */
  channelName?: string | null;
  /** 手動セーブの完了時に、遅れて送る保存先（クラウド）への送信を待つ。false=まだ届いていない */
  commit?: (() => Promise<boolean>) | null;
}

export class SaveManager {
  private stores: StorageAdapter[];
  private bridge: GameBridge;
  private legacy: SaveManagerOptions['legacy'];
  private emergency: SaveManagerOptions['emergency'];
  private now: () => number;
  private status: SaveStatus;
  private listeners = new Set<() => void>();
  private chain: Promise<unknown> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingReason: string | null = null;
  private dirty = false;
  private meta: Meta | null = null;
  private playTimeBase = 0;
  private visibleSince: number | null = null;
  private unsubBridge: (() => void) | null = null;
  private channel: BroadcastChannel | null = null;
  private toastSeq = 0;
  private readonly tabId = Math.random().toString(36).slice(2);
  private channelName: string | null;
  private commit: (() => Promise<boolean>) | null;
  /** 起動が間に合わず別のマネージャーに切り替えた（以後、何もしない） */
  private cancelled = false;

  constructor(opts: SaveManagerOptions) {
    this.stores = opts.stores;
    this.bridge = opts.bridge;
    this.legacy = opts.legacy ?? null;
    this.emergency = opts.emergency ?? null;
    this.now = opts.now ?? Date.now;
    this.commit = opts.commit ?? null;
    this.channelName = opts.channelName === undefined ? 'aidma-sales-quest-save' : opts.channelName;
    const durable = this.stores.some((s) => s.durable);
    this.status = {
      phase: 'booting',
      boot: null,
      backends: this.stores.map((s) => s.label),
      durable,
      persisted: opts.persisted ?? null,
      saving: false,
      lastSavedAt: null,
      lastError: null,
      saveCount: 0,
      revision: 0,
      conflict: false,
      toasts: [],
    };
  }

  // ------------------------------------------------------------
  // 状態の購読（React からは useSyncExternalStore で読む）
  // ------------------------------------------------------------
  getStatus = () => this.status;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private patch(p: Partial<SaveStatus>) {
    if (this.cancelled) return;
    this.status = { ...this.status, ...p };
    this.listeners.forEach((l) => l());
  }
  notify(kind: Toast['kind'], text: string, sticky = false) {
    const t: Toast = { id: ++this.toastSeq, kind, text, sticky };
    this.patch({ toasts: [...this.status.toasts.slice(-3), t] });
    if (!sticky) setTimeout(() => this.dismiss(t.id), kind === 'error' ? 6000 : 2600);
  }
  dismiss(id: number) {
    this.patch({ toasts: this.status.toasts.filter((t) => t.id !== id) });
  }

  // ------------------------------------------------------------
  // 起動
  // ------------------------------------------------------------
  async init(): Promise<BootResult> {
    this.meta = await this.readMeta();
    const hasSlots = await this.hasAnySlot();
    const res = await this.readBest(KEYS.auto);
    let boot: BootResult;

    if (res.best) {
      const b = res.best;
      this.applyData(b.data);
      this.patch({ revision: Math.max(b.env.revision, this.meta?.lastRevision ?? 0) });
      // クラウドが主保存先のときは、端末内ミラーの方が新しくても（送信前に閉じた等）正常な読み込みとみなす
      const primaryOk = b.gen === 'current' && (b.storeIndex === 0 || this.stores[0]?.id === 'cloud');
      if (!primaryOk) {
        boot = { kind: 'recovered_from_backup', message: 'セーブデータの一部が読めなかったため、バックアップから復旧しました。', hasSlots, fromVersion: b.fromVersion };
      } else {
        boot = { kind: 'loaded', message: '前回の続きから再開しました。', hasSlots, fromVersion: b.fromVersion };
      }
      this.finishBoot(boot);
      if (!primaryOk || b.migrated) await this.saveNow(b.migrated ? 'migration' : 'recovery');
      if (!primaryOk) this.notify('warn', 'バックアップから復旧しました');
    } else {
      // 旧形式からの移行は「新形式で一度も保存していない端末」に限る。
      // 新形式のデータが壊れたときに古い旧データへ黙って巻き戻さないため。
      const neverSavedInNewFormat = !this.meta || this.meta.saveCount === 0;
      const legacy = neverSavedInNewFormat && !res.corruptSeen ? this.readLegacy() : { data: null, raw: null, corrupt: false };
      if (legacy.data) {
        this.applyData(legacy.data);
        boot = { kind: 'migrated_legacy', message: '以前の形式のセーブデータを新しい形式へ移行しました。', hasSlots, fromVersion: 0 };
        this.finishBoot(boot);
        await this.writeAll(KEYS.legacyBackup, legacy.raw ?? '', { raw: true });
        await this.saveNow('migration');
      } else if (res.corruptSeen || legacy.corrupt) {
        boot = {
          kind: 'corrupted',
          message: 'セーブデータが壊れていて、バックアップからも復旧できませんでした。冒険の書・保存コードから再開するか、新しく始めてください。',
          hasSlots,
        };
        this.patch({ phase: 'needs-decision', boot });
      } else if (this.meta && this.meta.saveCount > 0) {
        boot = {
          kind: 'data_missing',
          message: 'この端末には以前のプレイ記録がありますが、セーブデータが見つかりません。冒険の書・保存コードから再開するか、新しく始めてください。',
          hasSlots,
        };
        this.patch({ phase: 'needs-decision', boot });
      } else if (!this.status.durable) {
        boot = { kind: 'storage_unavailable', message: 'この環境では保存領域が使えないため、進行は保存されません。', hasSlots };
        if (!this.cancelled) this.bridge.reset();
        this.finishBoot(boot);
      } else {
        boot = { kind: 'first_launch', message: 'ようこそ！', hasSlots };
        if (!this.cancelled) this.bridge.reset();
        this.finishBoot(boot);
      }
    }

    await this.migrateLegacySlots();
    if (!this.status.durable) this.notify('warn', 'この環境では進行が保存されません。保存コードで控えを取ってください。', true);
    return boot;
  }

  private finishBoot(boot: BootResult) {
    if (this.cancelled) return;
    this.visibleSince = this.now();
    this.patch({ phase: 'ready', boot, saveCount: this.meta?.saveCount ?? 0, lastSavedAt: this.meta?.lastSaveAt || null });
    this.startWatching();
  }

  /** 破損・消失時の選択：新しく始める */
  async startNewAfterProblem() {
    this.bridge.reset();
    this.playTimeBase = 0;
    this.finishBoot({ ...(this.status.boot as BootResult), kind: 'first_launch', message: '新しく始めました。' });
    await this.saveNow('new_game');
  }

  // ------------------------------------------------------------
  // 自動セーブ
  // ------------------------------------------------------------
  private startWatching() {
    if (this.unsubBridge) return;
    this.unsubBridge = this.bridge.subscribe((reason, delay) => this.requestSave(reason, delay));
    if (this.channelName && typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(this.channelName);
        this.channel.onmessage = (e: MessageEvent<{ tab: string; revision: number }>) => {
          if (e.data?.tab !== this.tabId && e.data?.revision > this.status.revision) this.enterConflict();
        };
      } catch {
        this.channel = null;
      }
    }
  }

  /** 状態変化をまとめて保存（連続した変更は delayMs の間にまとめて1回） */
  requestSave(reason: string, delayMs = 800) {
    if (this.status.phase !== 'ready' || this.status.conflict) return;
    this.dirty = true;
    this.pendingReason = reason;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.saveNow(this.pendingReason ?? reason);
    }, delayMs);
  }

  /** 今すぐ保存（重要イベント用）。成功で true */
  saveNow(reason: string, opts: { announce?: boolean } = {}): Promise<boolean> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const run = () => this.doSave(reason, opts);
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => undefined);
    return p;
  }

  private currentData(): SaveData {
    return { ...this.bridge.getData(), stats: { playTimeSec: this.playTimeSec() } };
  }

  playTimeSec() {
    const live = this.visibleSince != null ? (this.now() - this.visibleSince) / 1000 : 0;
    return Math.floor(this.playTimeBase + Math.max(0, live));
  }

  private async doSave(reason: string, opts: { announce?: boolean }): Promise<boolean> {
    if (this.cancelled || this.status.phase !== 'ready') return false;
    if (this.status.conflict) {
      if (opts.announce) this.notify('error', '別のタブで進行が更新されたため、このタブではセーブできません。再読み込みしてください。');
      return false;
    }
    // 別のタブが新しい進行を保存していないか（主保存先の revision を確認）
    const latest = await this.peekRevision(KEYS.auto);
    if (latest > this.status.revision) {
      this.enterConflict();
      return false;
    }
    this.patch({ saving: true });
    const revision = this.status.revision + 1;
    const text = sealEnvelope(this.currentData(), revision, reason, this.now());
    const ok = await this.writeAll(KEYS.auto, text);
    if (ok) {
      this.dirty = false;
      await this.bumpMeta(revision);
      this.channel?.postMessage({ tab: this.tabId, revision });
      this.patch({ saving: false, lastError: null, revision, lastSavedAt: this.now(), saveCount: this.meta?.saveCount ?? 0 });
      if (opts.announce) await this.announceSaved('セーブしました');
    } else {
      this.patch({ saving: false });
      this.notify('error', `セーブに失敗しました（${this.status.lastError ?? '保存領域に書き込めません'}）。保存コードで控えを取ってください。`);
    }
    return ok;
  }

  /** 手動セーブの完了通知。クラウドへの送信が済むまで待ち、届かなければその旨を伝える */
  private async announceSaved(text: string) {
    let synced = true;
    try {
      synced = this.commit ? await this.commit() : true;
    } catch {
      synced = false;
    }
    if (synced) this.notify('success', text);
    else this.notify('warn', `${text}（この端末に保存済み。クラウドへは通信が戻り次第送ります）`);
  }

  /** ページを閉じる/バックグラウンドへ移る瞬間：同期で書ける保存先へ緊急保存し、非同期保存も走らせる */
  flushOnHide() {
    this.accumulatePlayTime();
    if (this.status.phase !== 'ready' || this.status.conflict) return;
    const needs = this.dirty || this.timer != null;
    if (!needs) return;
    if (this.emergency) {
      try {
        const revision = this.status.revision + 1;
        const text = sealEnvelope(this.currentData(), revision, 'emergency', this.now());
        const cur = this.emergency.getSync(`${KEYS.auto}:current`);
        if (cur && openEnvelope(cur).ok) this.emergency.setSync(`${KEYS.auto}:backup`, cur);
        this.emergency.setSync(`${KEYS.auto}:current`, text);
        // 自分の書き込みを「別タブの新しい保存」と誤判定しないよう通し番号を進める
        this.patch({ revision });
      } catch {
        /* 非同期保存に任せる */
      }
    }
    void this.saveNow('background');
  }

  onVisible() {
    if (this.visibleSince == null) this.visibleSince = this.now();
  }
  private accumulatePlayTime() {
    if (this.visibleSince != null) {
      this.playTimeBase += Math.max(0, (this.now() - this.visibleSince) / 1000);
      this.visibleSince = null;
    }
  }

  private enterConflict() {
    if (this.status.conflict) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.patch({ conflict: true });
    this.notify('warn', '別のタブ（または画面）で進行が保存されました。上書きを防ぐため、このタブのセーブを停止しました。再読み込みしてください。', true);
  }

  // ------------------------------------------------------------
  // 新規ゲーム・ロード・冒険の書
  // ------------------------------------------------------------
  /** 新規ゲーム。直前の自動セーブは aq:pre-reset に1世代残す */
  async newGame() {
    await this.chain;
    const cur = await this.readBest(KEYS.auto);
    if (cur.best) await this.writeAll(KEYS.preReset, JSON.stringify(cur.best.env), { raw: true });
    this.bridge.reset();
    this.playTimeBase = 0;
    this.visibleSince = this.now();
    await this.saveNow('new_game');
  }

  async hasAnySlot(): Promise<boolean> {
    for (let i = 1; i <= SLOT_COUNT; i++) if ((await this.readBest(KEYS.slot(i))).best) return true;
    return false;
  }

  async listSlots(): Promise<(SlotInfo | null)[]> {
    const out: (SlotInfo | null)[] = [];
    for (let i = 1; i <= SLOT_COUNT; i++) {
      const r = await this.readBest(KEYS.slot(i));
      out.push(r.best ? { index: i, savedAt: r.best.env.savedAt, data: r.best.data, recovered: !(r.best.storeIndex === 0 && r.best.gen === 'current') } : null);
    }
    return out;
  }

  async saveSlot(i: number): Promise<boolean> {
    await this.chain;
    const prev = await this.readBest(KEYS.slot(i));
    const text = sealEnvelope(this.currentData(), (prev.best?.env.revision ?? 0) + 1, 'manual', this.now());
    const ok = await this.writeAll(KEYS.slot(i), text);
    if (ok) {
      await this.saveNow('manual');
      await this.announceSaved(`冒険の書${i}にセーブしました`);
    } else this.notify('error', `冒険の書${i}へのセーブに失敗しました（${this.status.lastError ?? '保存領域に書き込めません'}）`);
    return ok;
  }

  async loadSlot(i: number): Promise<boolean> {
    const r = await this.readBest(KEYS.slot(i));
    if (!r.best) {
      this.notify('error', `冒険の書${i}を読み込めませんでした`);
      return false;
    }
    await this.chain;
    this.applyData(r.best.data);
    if (this.status.phase !== 'ready') this.finishBoot({ ...(this.status.boot as BootResult), kind: 'loaded', message: '冒険の書から再開しました。' });
    await this.saveNow('load_slot');
    this.notify('success', `冒険の書${i}から再開しました`);
    return true;
  }

  async deleteSlot(i: number) {
    const base = KEYS.slot(i);
    const r = await this.readBest(base);
    // 誤操作に備え、消す直前の内容を :deleted に残す
    if (r.best) await this.writeAll(`${base}:deleted`, JSON.stringify(r.best.env), { raw: true });
    for (const s of this.stores) {
      for (const g of GENS) await s.remove(`${base}:${g}`).catch(() => undefined);
    }
  }

  // ------------------------------------------------------------
  // 保存コード（端末・アプリ間の引き継ぎ、保存領域が使えない環境の控え）
  // ------------------------------------------------------------
  exportCode(): string {
    const text = sealEnvelope(this.currentData(), this.status.revision, 'export', this.now());
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return CODE_PREFIX + btoa(bin);
  }

  async importCode(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const trimmed = code.trim().replace(/\s+/g, '');
    if (!trimmed.startsWith(CODE_PREFIX)) return { ok: false, error: '保存コードの形式が正しくありません' };
    let text: string;
    try {
      const bin = atob(trimmed.slice(CODE_PREFIX.length));
      text = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    } catch {
      return { ok: false, error: '保存コードを読み取れませんでした（途中で切れていませんか？）' };
    }
    const opened = openEnvelope(text);
    if (!opened.ok) return { ok: false, error: '保存コードが壊れています（コピー漏れ・改変の可能性）' };
    const m = migrateToLatest(opened.envelope.saveVersion, opened.envelope.data);
    if (!m.ok) return { ok: false, error: m.error };
    await this.chain;
    this.applyData(m.data);
    if (this.status.phase !== 'ready') this.finishBoot({ ...(this.status.boot as BootResult), kind: 'loaded', message: '保存コードから復元しました。' });
    await this.saveNow('import_code');
    this.notify('success', '保存コードから復元しました');
    return { ok: true };
  }

  // ------------------------------------------------------------
  // 低レベル処理
  // ------------------------------------------------------------
  private applyData(data: SaveData) {
    if (this.cancelled) return;
    this.playTimeBase = data.stats.playTimeSec;
    this.bridge.apply(data);
  }

  /** 全保存先へ書き込む。主保存先が失敗したら次の保存先を主として扱う。1つでも成功すれば true */
  private async writeAll(base: string, text: string, opts: { raw?: boolean } = {}): Promise<boolean> {
    let okCount = 0;
    let lastErr: string | null = null;
    for (const s of this.stores) {
      try {
        if (opts.raw) await s.set(base, text);
        else await this.writeGenerations(s, base, text);
        okCount++;
      } catch (e) {
        lastErr = `${s.label}: ${(e as Error).message || e}`;
      }
    }
    if (okCount === 0) this.patch({ lastError: lastErr });
    return okCount > 0;
  }

  private async writeGenerations(s: StorageAdapter, base: string, text: string) {
    await s.set(`${base}:tmp`, text);
    const back = await s.get(`${base}:tmp`);
    if (back !== text) throw new Error('書き込み後の検証に失敗しました');
    const cur = await s.get(`${base}:current`);
    if (cur && openEnvelope(cur).ok) await s.set(`${base}:backup`, cur);
    await s.set(`${base}:current`, text);
    await s.remove(`${base}:tmp`);
  }

  /** 全保存先 × 3世代から、正常で最も新しいものを選ぶ */
  async readBest(base: string): Promise<{ best: Candidate | null; corruptSeen: boolean }> {
    let best: Candidate | null = null;
    let corruptSeen = false;
    for (let si = 0; si < this.stores.length; si++) {
      for (const gen of GENS) {
        let text: string | null = null;
        try {
          text = await this.stores[si].get(`${base}:${gen}`);
        } catch {
          continue;
        }
        if (text == null) continue;
        const opened = openEnvelope(text);
        if (!opened.ok) {
          // tmp は書き込み途中で残っただけの可能性があるので「破損」とは数えない
          if (gen !== 'tmp') corruptSeen = true;
          continue;
        }
        const m = migrateToLatest(opened.envelope.saveVersion, opened.envelope.data);
        if (!m.ok) {
          if (gen !== 'tmp') corruptSeen = true;
          continue;
        }
        const c: Candidate = { env: opened.envelope, data: m.data, fromVersion: m.from, migrated: m.migrated, storeIndex: si, gen };
        if (!best || c.env.revision > best.env.revision) best = c;
      }
    }
    return { best, corruptSeen };
  }

  private async peekRevision(base: string): Promise<number> {
    const s = this.stores[0];
    if (!s) return 0;
    try {
      const o = openEnvelope(await s.get(`${base}:current`));
      return o.ok ? o.envelope.revision : 0;
    } catch {
      return 0;
    }
  }

  private readLegacy(): { data: SaveData | null; raw: string | null; corrupt: boolean } {
    if (!this.legacy) return { data: null, raw: null, corrupt: false };
    let raw: string | null = null;
    try {
      raw = this.legacy.get(KEYS.legacyAuto);
    } catch {
      return { data: null, raw: null, corrupt: false };
    }
    if (!raw) return { data: null, raw: null, corrupt: false };
    try {
      const parsed = JSON.parse(raw) as { state?: unknown; version?: number };
      const m = migrateToLatest(0, parsed.state);
      return m.ok ? { data: m.data, raw, corrupt: false } : { data: null, raw, corrupt: true };
    } catch {
      return { data: null, raw, corrupt: true };
    }
  }

  /** 旧・冒険の書（3枠の配列）を新しいスロットへ移す。新スロットが空の枠だけ */
  private async migrateLegacySlots() {
    if (!this.legacy) return;
    let raw: string | null = null;
    try {
      raw = this.legacy.get(KEYS.legacySlots);
    } catch {
      return;
    }
    if (!raw) return;
    let arr: unknown;
    try {
      arr = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(arr)) return;
    for (let i = 0; i < Math.min(arr.length, SLOT_COUNT); i++) {
      const entry = arr[i] as { savedAt?: number; snapshot?: unknown } | null;
      if (!entry?.snapshot) continue;
      if ((await this.readBest(KEYS.slot(i + 1))).best) continue;
      const m = migrateToLatest(1, entry.snapshot);
      if (!m.ok) continue;
      await this.writeAll(KEYS.slot(i + 1), sealEnvelope(m.data, 1, 'migration', entry.savedAt ?? this.now()));
    }
  }

  private async readMeta(): Promise<Meta | null> {
    let best: Meta | null = null;
    for (const s of this.stores) {
      try {
        const t = await s.get(KEYS.meta);
        if (!t) continue;
        const m = JSON.parse(t) as Meta;
        if (typeof m.saveCount === 'number' && (!best || m.saveCount > best.saveCount)) best = m;
      } catch {
        /* 次の保存先 */
      }
    }
    return best;
  }

  private async bumpMeta(revision: number) {
    const now = this.now();
    const m: Meta = this.meta ?? { installId: Math.random().toString(36).slice(2), firstLaunchAt: now, lastSaveAt: 0, saveCount: 0, lastRevision: 0 };
    this.meta = { ...m, lastSaveAt: now, saveCount: m.saveCount + 1, lastRevision: revision };
    const text = JSON.stringify(this.meta);
    for (const s of this.stores) await s.set(KEYS.meta, text).catch(() => undefined);
  }

  /** 起動が遅すぎて見切った場合：以後はゲーム状態にも保存領域にも触れない */
  cancel() {
    this.cancelled = true;
    this.dispose();
  }

  /** 「消されにくい保存」の許可状況を後から反映する */
  setPersisted(v: boolean | null) {
    this.patch({ persisted: v });
  }

  /** 監視を止める（テスト・画面の破棄用） */
  dispose() {
    if (this.timer) clearTimeout(this.timer);
    this.unsubBridge?.();
    this.unsubBridge = null;
    this.channel?.close();
    this.channel = null;
  }

  /** テスト・診断用 */
  debugSnapshot() {
    return { saveVersion: SAVE_VERSION, meta: this.meta, status: this.status, data: this.currentData(), empty: emptySaveData() };
  }
}

export { normalizeSaveData };
