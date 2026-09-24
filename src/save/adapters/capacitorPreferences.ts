import type { StorageAdapter } from './types';

/**
 * Capacitor Preferences（iOS: UserDefaults / Android: SharedPreferences）。
 * ネイティブアプリとして包んだときの主な保存先。
 * npm 依存を持たず、実行時に window.Capacitor の Preferences プラグインがあれば使う。
 * （ネイティブ化の際に `npm i @capacitor/core @capacitor/preferences` と `npx cap sync` を行う）
 */
interface PreferencesPlugin {
  configure(o: { group: string }): Promise<void>;
  get(o: { key: string }): Promise<{ value: string | null }>;
  set(o: { key: string; value: string }): Promise<void>;
  remove(o: { key: string }): Promise<void>;
  keys(): Promise<{ keys: string[] }>;
}
interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  Plugins?: { Preferences?: PreferencesPlugin };
}

export function nativePreferences(): PreferencesPlugin | null {
  const cap = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.Preferences ?? null;
}

export class CapacitorPreferencesAdapter implements StorageAdapter {
  readonly id = 'preferences' as const;
  readonly label = '端末（ネイティブ保存領域）';
  readonly durable = true;
  private ready: Promise<void>;
  constructor(private plugin: PreferencesPlugin, group = 'AidmaSalesQuest') {
    this.ready = plugin.configure({ group }).catch(() => undefined);
  }
  async get(key: string) {
    await this.ready;
    return (await this.plugin.get({ key })).value;
  }
  async set(key: string, value: string) {
    await this.ready;
    await this.plugin.set({ key, value });
  }
  async remove(key: string) {
    await this.ready;
    await this.plugin.remove({ key });
  }
  async keys() {
    await this.ready;
    return (await this.plugin.keys()).keys;
  }
}
