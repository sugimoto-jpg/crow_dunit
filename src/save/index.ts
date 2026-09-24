import { SaveManager } from './SaveManager';
import { gameBridge } from './gameBridge';
import { probe, type StorageAdapter } from './adapters/types';
import { timed, withTimeout } from './adapters/timeout';
import { LocalStorageAdapter } from './adapters/localStorage';
import { IndexedDbAdapter } from './adapters/indexedDb';
import { CapacitorPreferencesAdapter, nativePreferences } from './adapters/capacitorPreferences';
import { MemoryAdapter } from './adapters/memory';
import { CloudDbAdapter, type CloudDb } from './adapters/cloudDb';

export { SLOT_COUNT, type BootResult, type SaveStatus, type SlotInfo, type Toast } from './SaveManager';

/**
 * 保存先を決める。各保存先は「書いて読めるか」を時間制限つきで確認し、使えるものだけ使う。
 *   claude.ai で開いた場合   : クラウド（利用者ごとの非公開領域）→ 端末内の保存先（ミラー）
 *   ネイティブ（Capacitor）: Preferences → localStorage（ミラー）
 *   Web                    : IndexedDB   → localStorage（ミラー）
 *   どれも使えない           : メモリのみ（「保存されません」と表示）
 * 保存先の操作にはすべて時間制限（3秒）を付け、応答しない保存領域でゲームが止まらないようにする。
 */
async function pickStores(opts: { skipIndexedDb?: boolean } = {}): Promise<{ stores: StorageAdapter[]; ls: LocalStorageAdapter | null }> {
  const candidates: StorageAdapter[] = [];
  const pref = nativePreferences();
  if (pref) candidates.push(new CapacitorPreferencesAdapter(pref));
  else if (!opts.skipIndexedDb) candidates.push(new IndexedDbAdapter());
  let ls: LocalStorageAdapter | null = new LocalStorageAdapter();
  candidates.push(ls);
  const ok: StorageAdapter[] = [];
  const [cloud, results] = await Promise.all([connectCloud(), Promise.all(candidates.map((c) => probe(c, 2000)))]);
  candidates.forEach((c, i) => results[i] && ok.push(c));
  if (!ok.includes(ls)) ls = null;
  const local = ok.map((s) => timed(s, 3000));
  // クラウドが使えるときはそれを主保存先にする（端末内はミラー）
  if (cloud) return { stores: [cloud, ...local], ls };
  if (ok.length === 0) return { stores: [new MemoryAdapter()], ls: null };
  return { stores: local, ls };
}

type ClaudeHost = { use(name: string): Promise<unknown> };
type UserNs = { id(): Promise<string | null> };

let cloudAdapter: CloudDbAdapter | null = null;
let cloudConnecting: Promise<CloudDbAdapter | null> | null = null;
/** claude.ai の外（手元の開発サーバー・保存したファイル）ではクラウドは使わない */
let cloudNote: string | null = null;

/** クラウド保存（claude.ai アーティファクトの db）につなぐ。4秒以内につながらなければ端末内保存のみで続ける */
function connectCloud(): Promise<CloudDbAdapter | null> {
  if (cloudConnecting) return cloudConnecting;
  const host = (globalThis as { claude?: ClaudeHost }).claude;
  if (!host?.use) return (cloudConnecting = Promise.resolve(null));
  const attempt = (async () => {
    const [db, user] = (await Promise.all([host.use('db'), host.use('user')])) as [CloudDb | null, UserNs | null];
    if (!db || !user) {
      cloudNote = 'クラウド保存が使えない表示方法のため、この端末にだけ保存します。';
      return null;
    }
    const uid = await user.id();
    if (!uid) {
      cloudNote = 'ログインしていないため、クラウドには保存できません。この端末にだけ保存します。';
      return null;
    }
    const adapter = new CloudDbAdapter(db.collection(`data/users/${uid}`));
    await adapter.load();
    return adapter;
  })();
  cloudConnecting = withTimeout(attempt, 4000, 'クラウド保存')
    .catch((e) => {
      console.warn('[save] クラウド保存に接続できません', e);
      cloudNote = 'クラウド保存に接続できなかったため、この端末にだけ保存します。通信状況の良い場所で開き直してください。';
      return null;
    })
    .then((a) => (cloudAdapter = a));
  return cloudConnecting;
}

/**
 * ブラウザに「空き容量が少なくても消さないで」と依頼する（許可されるかはブラウザ次第）。
 * 埋め込み表示などで応答が返ってこない環境があるため、起動処理はこれを待たない。
 */
function requestPersist(): Promise<boolean | null> {
  const ask = (async () => {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  })();
  return withTimeout(ask, 3000, '永続化の要求').catch(() => null);
}

const AUTO_KEY = 'aq:auto';

let manager: SaveManager | null = null;
let booting: Promise<SaveManager> | null = null;

export function getSaveManager(): SaveManager | null {
  return manager;
}

function legacyReader(): { get(key: string): string | null } | null {
  try {
    const w = window.localStorage;
    return { get: (k) => w.getItem(k) };
  } catch {
    return null;
  }
}

async function createManager(opts: { skipIndexedDb?: boolean } = {}) {
  const { stores, ls } = await pickStores(opts);
  return new SaveManager({ stores, bridge: gameBridge, legacy: legacyReader(), emergency: ls, persisted: null, commit: commitCloud });
}

/** クラウドへの未送信分を送り切る（最大5秒待つ） */
async function commitCloud(): Promise<boolean> {
  const c = cloudAdapter;
  if (!c) return true;
  try {
    await withTimeout(c.flush(), 5000, 'クラウド保存');
  } catch {
    return false;
  }
  return !c.hasPending;
}

/** 起動全体の見張り時間。これを過ぎたら IndexedDB を使わずに起動し直す */
const BOOT_WATCHDOG_MS = 6000;

/** アプリ起動時に一度だけ呼ぶ。どんな環境でも必ず（遅くとも数秒で）ゲームを開始できるようにする */
export function bootSaveSystem(): Promise<SaveManager> {
  if (booting) return booting;
  booting = (async () => {
    let first: SaveManager | null = null;
    const normal = (async () => {
      first = await createManager();
      await first.init();
      return first;
    })();
    let m: SaveManager;
    try {
      m = await withTimeout(normal, BOOT_WATCHDOG_MS, '起動処理');
    } catch (e) {
      // 通常の起動が止まった／失敗した：途中のマネージャーを無効化し、localStorage（無ければメモリ）で起動し直す
      console.warn('[save] 通常起動に失敗したため予備の保存先で起動します', e);
      (first as SaveManager | null)?.cancel();
      m = await createManager({ skipIndexedDb: true });
      await withTimeout(m.init(), BOOT_WATCHDOG_MS, '予備の起動処理').catch(async () => {
        m.cancel();
        m = new SaveManager({ stores: [new MemoryAdapter()], bridge: gameBridge, legacy: null, emergency: null });
        await m.init();
      });
      m.notify('warn', '保存領域の応答が遅いため、予備の保存先で起動しました。念のため「冒険の書 → 保存コード」で控えを取ってください。');
    }
    manager = m;
    installLifecycle(m);
    if (cloudAdapter) {
      let shown = false;
      cloudAdapter.onError = (msg) => {
        if (msg && !shown) {
          shown = true;
          m.notify('error', `クラウドへの保存に失敗しました（${msg}）。通信が戻れば自動で再送します。`);
        } else if (!msg && shown) {
          shown = false;
          m.notify('success', 'クラウドへの保存が再開しました');
        }
      };
    } else if (cloudNote) {
      m.notify('warn', cloudNote);
    }
    // 永続化の依頼は起動後にバックグラウンドで行う（結果はセーブ状態に表示）
    void requestPersist().then((v) => m.setPersisted(v));
    return m;
  })();
  return booting;
}

/** バックグラウンド移行・ページを閉じる・アプリ一時停止で保存 */
function installLifecycle(m: SaveManager) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      m.flushOnHide();
      void cloudAdapter?.flush();
    } else {
      m.onVisible();
      // 他の端末で進んでいないか、クラウドの最新を取り直す（進んでいれば次のセーブ時に上書きを止める）
      void cloudAdapter?.refresh(`${AUTO_KEY}:current`).catch(() => {});
    }
  });
  window.addEventListener('pagehide', () => {
    m.flushOnHide();
    void cloudAdapter?.flush();
  });
  // Capacitor の App プラグインがあれば、ネイティブの一時停止/復帰も拾う
  const app = (globalThis as { Capacitor?: { Plugins?: { App?: { addListener(e: string, cb: () => void): unknown } } } }).Capacitor?.Plugins?.App;
  try {
    app?.addListener('pause', () => m.flushOnHide());
    app?.addListener('resume', () => m.onVisible());
  } catch {
    /* 無ければ Web のイベントのみ */
  }
}
