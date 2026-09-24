import type { StorageAdapter } from './types';

/** IndexedDB。Web版の主な保存先（localStorage より容量が大きく、消されにくい） */
export class IndexedDbAdapter implements StorageAdapter {
  readonly id = 'indexeddb' as const;
  readonly label = 'ブラウザ（IndexedDB）';
  readonly durable = true;
  private dbp: Promise<IDBDatabase> | null = null;
  constructor(private dbName = 'aidma-sales-quest', private store = 'kv') {}

  private db(): Promise<IDBDatabase> {
    if (!this.dbp) {
      this.dbp = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB が使えません'));
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(this.store)) req.result.createObjectStore(this.store);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB を開けません'));
        req.onblocked = () => reject(new Error('IndexedDB がブロックされています'));
      });
      this.dbp.catch(() => (this.dbp = null));
    }
    return this.dbp;
  }

  private async tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.db();
    return new Promise<T>((resolve, reject) => {
      const t = db.transaction(this.store, mode);
      const req = fn(t.objectStore(this.store));
      let result: T;
      req.onsuccess = () => (result = req.result);
      // 書き込みはトランザクション完了（ディスク反映）まで待つ
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error ?? req.error ?? new Error('IndexedDB エラー'));
      t.onabort = () => reject(t.error ?? new Error('IndexedDB の処理が中断されました'));
    });
  }

  async get(key: string) {
    const v = await this.tx('readonly', (s) => s.get(key) as IDBRequest<unknown>);
    return typeof v === 'string' ? v : null;
  }
  async set(key: string, value: string) {
    await this.tx('readwrite', (s) => s.put(value, key));
  }
  async remove(key: string) {
    await this.tx('readwrite', (s) => s.delete(key));
  }
  async keys() {
    const ks = await this.tx('readonly', (s) => s.getAllKeys());
    return ks.filter((k): k is string => typeof k === 'string');
  }
}
