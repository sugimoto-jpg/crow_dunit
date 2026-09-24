/**
 * セーブデータの保存先。環境ごとに差し替える（Web: IndexedDB / localStorage、ネイティブ: Capacitor Preferences）。
 * 失敗は例外で知らせる（握りつぶさない）。値はすべて文字列。
 */
export interface StorageAdapter {
  readonly id: 'cloud' | 'preferences' | 'indexeddb' | 'localstorage' | 'memory';
  /** 表示用の名前 */
  readonly label: string;
  /** アプリを閉じても残る保存先か（memory は false） */
  readonly durable: boolean;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/** 書き込み→読み戻し→削除ができるか確認する */
export async function probe(adapter: StorageAdapter, timeoutMs = 2000): Promise<boolean> {
  const key = '__aq_probe__';
  const value = String(Date.now());
  const run = async () => {
    await adapter.set(key, value);
    const back = await adapter.get(key);
    await adapter.remove(key);
    return back === value;
  };
  try {
    return await Promise.race([run(), new Promise<boolean>((r) => setTimeout(() => r(false), timeoutMs))]);
  } catch {
    return false;
  }
}
