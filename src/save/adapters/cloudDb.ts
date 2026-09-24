import type { StorageAdapter } from './types';

/**
 * claude.ai アーティファクトのサーバー側データベース（db capability）を使う保存先。
 * 利用者ごとの非公開領域 data/users/<id>/ に「キー = ドキュメント」で保存する。
 * ブラウザの保存領域が消える環境（アプリ内ブラウザ・埋め込み表示）でも、同じリンクを開けば続きから遊べる。
 *
 *  - 起動時に自分のドキュメントを一括で読み込み、以後の読み込みは手元の写し（キャッシュ）から返す。
 *  - 書き込みは手元の写しへ即座に反映し、サーバーへは短い間隔でまとめて送る（通信回数を抑える）。
 *    画面が隠れた（アプリを閉じる・切り替える）ときは待たずに送る。
 *  - 同じドキュメントへの書き込みは1つずつ順番に行う。
 */

/** db capability のうち、ここで使う部分だけ */
export interface CloudDocSnap {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
export interface CloudDocRef {
  get(): Promise<CloudDocSnap>;
  set(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
}
export interface CloudCollection {
  doc(id: string): CloudDocRef;
  limit(n: number): { get(): Promise<{ docs: CloudDocSnap[] }> };
}
export interface CloudDb {
  collection(path: string): CloudCollection;
}

type Pending = { kind: 'set'; value: string } | { kind: 'remove' };

/** ドキュメントIDに使えない文字を逃がす（キーは英数字と : だけなので通常は変わらない） */
export function docIdOf(key: string): string {
  return key.replace(/[^A-Za-z0-9_\-.~:@]/g, (c) => '+' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}
function keyOf(id: string): string {
  return id.replace(/\+([0-9a-f]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

export class CloudDbAdapter implements StorageAdapter {
  readonly id = 'cloud' as const;
  readonly label = 'クラウド（Claude）';
  readonly durable = true;
  private cache = new Map<string, string>();
  /** サーバーに存在するドキュメント */
  private remote = new Set<string>();
  private pending = new Map<string, Pending>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing: Promise<void> | null = null;
  private failures = 0;
  /** 送信に失敗したとき・回復したときに呼ばれる */
  onError: ((message: string | null) => void) | null = null;

  constructor(
    private readonly col: CloudCollection,
    private readonly delayMs = 800,
    private readonly isHidden: () => boolean = () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  ) {}

  /** 自分のドキュメントをすべて読み込む（起動時に1回） */
  async load(): Promise<void> {
    const snap = await this.col.limit(500).get();
    for (const d of snap.docs) {
      if (!d.exists) continue;
      const v = d.data()?.v;
      if (typeof v !== 'string') continue;
      const key = keyOf(d.id);
      this.cache.set(key, v);
      this.remote.add(key);
    }
  }

  /** サーバーの最新内容で手元の写しを更新する（他の端末での進行を検知するため）。未送信の変更があるキーは触らない */
  async refresh(key: string): Promise<void> {
    if (this.pending.has(key)) return;
    const s = await this.col.doc(docIdOf(key)).get();
    if (this.pending.has(key)) return;
    const v = s.exists ? s.data()?.v : undefined;
    if (typeof v === 'string') {
      this.cache.set(key, v);
      this.remote.add(key);
    } else {
      this.cache.delete(key);
      this.remote.delete(key);
    }
  }

  async get(key: string) {
    return this.cache.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.cache.set(key, value);
    this.pending.set(key, { kind: 'set', value });
    this.schedule();
  }
  async remove(key: string) {
    this.cache.delete(key);
    this.pending.set(key, { kind: 'remove' });
    this.schedule();
  }
  async keys() {
    return [...this.cache.keys()];
  }

  /** 未送信の変更があるか */
  get hasPending() {
    return this.pending.size > 0 || this.flushing != null;
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    const delay = this.isHidden() ? 0 : this.failures > 0 ? Math.min(30000, this.delayMs * 2 ** this.failures) : this.delayMs;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, delay);
  }

  /** 未送信の変更をすべて送る */
  flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.flushing) return this.flushing.then(() => (this.pending.size ? this.flush() : undefined));
    if (this.pending.size === 0) return Promise.resolve();
    this.flushing = this.send().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async send() {
    const batch = [...this.pending.entries()];
    this.pending.clear();
    let error: string | null = null;
    for (const [key, op] of batch) {
      try {
        const ref = this.col.doc(docIdOf(key));
        if (op.kind === 'set') {
          await ref.set({ v: op.value, at: Date.now() });
          this.remote.add(key);
        } else if (this.remote.has(key)) {
          await ref.delete();
          this.remote.delete(key);
        }
      } catch (e) {
        error = (e as { message?: string })?.message || String(e);
        // 後から同じキーに新しい変更が入っていなければ、再送の対象に戻す
        if (!this.pending.has(key)) this.pending.set(key, op);
      }
    }
    if (error) {
      this.failures = Math.min(this.failures + 1, 6);
      this.onError?.(error);
    } else if (this.failures > 0) {
      this.failures = 0;
      this.onError?.(null);
    }
    if (this.pending.size) this.schedule();
  }
}
