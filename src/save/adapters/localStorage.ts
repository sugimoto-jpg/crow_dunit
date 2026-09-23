import type { StorageAdapter } from './types';

/** localStorage。同期で書けるので、ページを閉じる瞬間の緊急保存にも使う */
export class LocalStorageAdapter implements StorageAdapter {
  readonly id = 'localstorage' as const;
  readonly label = 'ブラウザ（localStorage）';
  readonly durable = true;
  constructor(private prefix = '') {}

  private get ls(): Storage {
    return window.localStorage;
  }
  async get(key: string) {
    return this.getSync(key);
  }
  async set(key: string, value: string) {
    this.setSync(key, value);
  }
  async remove(key: string) {
    this.ls.removeItem(this.prefix + key);
  }
  async keys() {
    const out: string[] = [];
    for (let i = 0; i < this.ls.length; i++) {
      const k = this.ls.key(i);
      if (k && k.startsWith(this.prefix)) out.push(k.slice(this.prefix.length));
    }
    return out;
  }
  getSync(key: string): string | null {
    return this.ls.getItem(this.prefix + key);
  }
  setSync(key: string, value: string) {
    this.ls.setItem(this.prefix + key, value);
  }
}
