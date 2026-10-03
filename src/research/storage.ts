import type { Company } from './model';

/** 取り込んだ企業データをこのブラウザの IndexedDB に保存する（外部には送信しない） */
const DB = 'aidma-referral-research';
const STORE = 'kv';

/** 取り込み時に作る項目を増やしたら上げる（古いデータには再取込を案内する） */
export const DATA_VERSION = 3;

export interface Dataset {
  version?: number;
  companies: Company[];
  fileName: string;
  importedAt: string;
  rowCount: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function loadDataset(): Promise<Dataset | null> {
  try {
    return (await tx<Dataset | undefined>('readonly', (s) => s.get('dataset'))) ?? null;
  } catch {
    return null;
  }
}

export async function saveDataset(d: Dataset): Promise<boolean> {
  try {
    await tx('readwrite', (s) => s.put(d, 'dataset'));
    return true;
  } catch {
    return false;
  }
}

export async function clearDataset(): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete('dataset'));
  } catch {
    /* 保存できない環境では何もしない */
  }
}
