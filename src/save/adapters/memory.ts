import type { StorageAdapter } from './types';

/** メモリのみ（どの保存先も使えない環境の最終手段。アプリを閉じると消える） */
export class MemoryAdapter implements StorageAdapter {
  readonly id = 'memory' as const;
  readonly label = 'メモリのみ（保存されません）';
  /** テストでは「永続する保存先」の代役として true にできる */
  constructor(readonly durable = false) {}
  readonly map = new Map<string, string>();
  /** テスト用：指定キーへの書き込みを失敗させる */
  failOn: ((key: string) => boolean) | null = null;
  async get(key: string) {
    return this.map.get(key) ?? null;
  }
  async set(key: string, value: string) {
    if (this.failOn?.(key)) throw new Error('書き込みに失敗しました（テスト）');
    this.map.set(key, value);
  }
  async remove(key: string) {
    this.map.delete(key);
  }
  async keys() {
    return [...this.map.keys()];
  }
}
