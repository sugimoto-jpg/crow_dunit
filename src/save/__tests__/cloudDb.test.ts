import { describe, expect, it } from 'vitest';
import { CloudDbAdapter, docIdOf, type CloudCollection, type CloudDocSnap } from '../adapters/cloudDb';
import { SaveManager } from '../SaveManager';
import { MemoryAdapter } from '../adapters/memory';
import { emptySaveData, type SaveData } from '../schema';
import type { GameBridge } from '../SaveManager';

/** db capability の偽物（サーバー上のドキュメントを Map で持つ） */
function fakeCollection() {
  const docs = new Map<string, Record<string, unknown>>();
  const log: string[] = [];
  let fail = false;
  const snap = (id: string): CloudDocSnap => ({ id, exists: docs.has(id), data: () => docs.get(id) });
  const col: CloudCollection = {
    doc: (id) => ({
      get: async () => snap(id),
      set: async (d) => {
        if (fail) throw new Error('unavailable');
        log.push(`set ${id}`);
        docs.set(id, d);
      },
      delete: async () => {
        if (fail) throw new Error('unavailable');
        log.push(`delete ${id}`);
        docs.delete(id);
      },
    }),
    limit: () => ({ get: async () => ({ docs: [...docs.keys()].map(snap) }) }),
  };
  return { col, docs, log, setFail: (f: boolean) => (fail = f) };
}

function bridge(): GameBridge & { data: SaveData } {
  const b = {
    data: emptySaveData(),
    getData: () => structuredClone(b.data),
    apply: (d: SaveData) => void (b.data = structuredClone(d)),
    reset: () => void (b.data = emptySaveData()),
    subscribe: () => () => {},
  };
  return b as unknown as GameBridge & { data: SaveData };
}

describe('CloudDbAdapter', () => {
  it('まとめて送り、tmp のように書いてすぐ消したキーは送らない', async () => {
    const f = fakeCollection();
    const a = new CloudDbAdapter(f.col, 10_000, () => false);
    await a.set('aq:auto:tmp', 'x');
    await a.set('aq:auto:current', 'A');
    await a.remove('aq:auto:tmp');
    expect(await a.get('aq:auto:current')).toBe('A');
    expect(f.log).toEqual([]);
    await a.flush();
    expect(f.log).toEqual(['set aq:auto:current']);
    expect(a.hasPending).toBe(false);
  });

  it('次回の起動で読み込める（別の端末・ブラウザの保存領域が空でも）', async () => {
    const f = fakeCollection();
    const a = new CloudDbAdapter(f.col, 10_000, () => false);
    await a.set('aq:slot:1:current', 'S1');
    await a.flush();
    const b = new CloudDbAdapter(f.col);
    await b.load();
    expect(await b.get('aq:slot:1:current')).toBe('S1');
  });

  it('送信に失敗したら再送待ちにし、エラーを知らせる', async () => {
    const f = fakeCollection();
    const errors: (string | null)[] = [];
    const a = new CloudDbAdapter(f.col, 10_000, () => false);
    a.onError = (m) => errors.push(m);
    f.setFail(true);
    await a.set('k', 'v');
    await a.flush();
    expect(a.hasPending).toBe(true);
    expect(errors).toEqual(['unavailable']);
    f.setFail(false);
    await a.flush();
    expect(a.hasPending).toBe(false);
    expect(errors).toEqual(['unavailable', null]);
    expect(f.docs.get('k')?.v).toBe('v');
  });

  it('ドキュメントIDに使えない文字を逃がす', () => {
    expect(docIdOf('aq:slot:1:current')).toBe('aq:slot:1:current');
    expect(docIdOf('a/b c')).not.toMatch(/[/ ]/);
  });

  it('SaveManager：クラウドのみに残った進行を新しい端末で読み込む', async () => {
    const f = fakeCollection();
    const cloud1 = new CloudDbAdapter(f.col, 10_000, () => false);
    const b1 = bridge();
    const m1 = new SaveManager({ stores: [cloud1, new MemoryAdapter(true)], bridge: b1, channelName: null, commit: async () => (await cloud1.flush(), !cloud1.hasPending) });
    await m1.init();
    b1.data.player.exp = 321;
    b1.data.player.name = 'たろう';
    await m1.saveNow('manual', { announce: true });
    expect(f.docs.has('aq:auto:current')).toBe(true);
    m1.dispose();

    // ブラウザの保存領域が消えた状態（新しいメモリ）で開き直す
    const cloud2 = new CloudDbAdapter(f.col, 10_000, () => false);
    await cloud2.load();
    const b2 = bridge();
    const m2 = new SaveManager({ stores: [cloud2, new MemoryAdapter(true)], bridge: b2, channelName: null });
    const boot = await m2.init();
    expect(boot.kind).toBe('loaded');
    expect(b2.data.player.exp).toBe(321);
    expect(b2.data.player.name).toBe('たろう');
    m2.dispose();
  });
});
