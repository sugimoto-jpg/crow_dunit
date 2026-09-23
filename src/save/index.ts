import { SaveManager } from './SaveManager';
import { gameBridge } from './gameBridge';
import { probe, type StorageAdapter } from './adapters/types';
import { timed, withTimeout } from './adapters/timeout';
import { LocalStorageAdapter } from './adapters/localStorage';
import { IndexedDbAdapter } from './adapters/indexedDb';
import { CapacitorPreferencesAdapter, nativePreferences } from './adapters/capacitorPreferences';
import { MemoryAdapter } from './adapters/memory';

export { SLOT_COUNT, type BootResult, type SaveStatus, type SlotInfo, type Toast } from './SaveManager';

/**
 * 保存先を決める。各保存先は「書いて読めるか」を時間制限つきで確認し、使えるものだけ使う。
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
  const results = await Promise.all(candidates.map((c) => probe(c, 2000)));
  candidates.forEach((c, i) => results[i] && ok.push(c));
  if (!ok.includes(ls)) ls = null;
  if (ok.length === 0) return { stores: [new MemoryAdapter()], ls: null };
  return { stores: ok.map((s) => timed(s, 3000)), ls };
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
  return new SaveManager({ stores, bridge: gameBridge, legacy: legacyReader(), emergency: ls, persisted: null });
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
    // 永続化の依頼は起動後にバックグラウンドで行う（結果はセーブ状態に表示）
    void requestPersist().then((v) => m.setPersisted(v));
    return m;
  })();
  return booting;
}

/** バックグラウンド移行・ページを閉じる・アプリ一時停止で保存 */
function installLifecycle(m: SaveManager) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') m.flushOnHide();
    else m.onVisible();
  });
  window.addEventListener('pagehide', () => m.flushOnHide());
  // Capacitor の App プラグインがあれば、ネイティブの一時停止/復帰も拾う
  const app = (globalThis as { Capacitor?: { Plugins?: { App?: { addListener(e: string, cb: () => void): unknown } } } }).Capacitor?.Plugins?.App;
  try {
    app?.addListener('pause', () => m.flushOnHide());
    app?.addListener('resume', () => m.onVisible());
  } catch {
    /* 無ければ Web のイベントのみ */
  }
}
