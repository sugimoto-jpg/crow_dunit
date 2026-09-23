import { SaveManager } from './SaveManager';
import { gameBridge } from './gameBridge';
import { probe, type StorageAdapter } from './adapters/types';
import { LocalStorageAdapter } from './adapters/localStorage';
import { IndexedDbAdapter } from './adapters/indexedDb';
import { CapacitorPreferencesAdapter, nativePreferences } from './adapters/capacitorPreferences';
import { MemoryAdapter } from './adapters/memory';

export { SLOT_COUNT, type BootResult, type SaveStatus, type SlotInfo, type Toast } from './SaveManager';

/**
 * 保存先を決める。
 *   ネイティブ（Capacitor）: Preferences → localStorage（ミラー）
 *   Web                    : IndexedDB   → localStorage（ミラー）
 *   どれも使えない           : メモリのみ（「保存されません」と表示）
 */
async function pickStores(): Promise<{ stores: StorageAdapter[]; ls: LocalStorageAdapter | null }> {
  const candidates: StorageAdapter[] = [];
  const pref = nativePreferences();
  if (pref) candidates.push(new CapacitorPreferencesAdapter(pref));
  else candidates.push(new IndexedDbAdapter());
  const ls = new LocalStorageAdapter();
  candidates.push(ls);
  const ok: StorageAdapter[] = [];
  for (const c of candidates) if (await probe(c)) ok.push(c);
  if (ok.length === 0) return { stores: [new MemoryAdapter()], ls: null };
  return { stores: ok, ls: ok.includes(ls) ? ls : null };
}

/** ブラウザに「空き容量が少なくても消さないで」と依頼する（許可されるかはブラウザ次第） */
async function requestPersist(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

let manager: SaveManager | null = null;
let booting: Promise<SaveManager> | null = null;

export function getSaveManager(): SaveManager | null {
  return manager;
}

/** アプリ起動時に一度だけ呼ぶ */
export function bootSaveSystem(): Promise<SaveManager> {
  if (booting) return booting;
  booting = (async () => {
    const [{ stores, ls }, persisted] = await Promise.all([pickStores(), requestPersist()]);
    let legacy: { get(key: string): string | null } | null = null;
    try {
      const w = window.localStorage;
      legacy = { get: (k) => w.getItem(k) };
    } catch {
      legacy = null;
    }
    manager = new SaveManager({ stores, bridge: gameBridge, legacy, emergency: ls, persisted });
    installLifecycle(manager);
    await manager.init();
    return manager;
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
