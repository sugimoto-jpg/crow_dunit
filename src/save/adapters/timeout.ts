import type { StorageAdapter } from './types';

/** Promise に時間制限を付ける（応答が無い保存領域でゲーム全体が止まらないように） */
export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} が応答しません（${ms / 1000}秒）`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** 保存先の全操作に時間制限を付けたラッパー */
export function timed(inner: StorageAdapter, ms = 3000): StorageAdapter {
  return {
    id: inner.id,
    label: inner.label,
    durable: inner.durable,
    get: (k) => withTimeout(inner.get(k), ms, inner.label),
    set: (k, v) => withTimeout(inner.set(k, v), ms, inner.label),
    remove: (k) => withTimeout(inner.remove(k), ms, inner.label),
    keys: () => withTimeout(inner.keys(), ms, inner.label),
  };
}
