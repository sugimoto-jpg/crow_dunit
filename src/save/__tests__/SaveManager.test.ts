import { afterEach, describe, expect, it, vi } from 'vitest';
import { SaveManager, KEYS, type GameBridge } from '../SaveManager';
import { MemoryAdapter } from '../adapters/memory';
import { emptySaveData, openEnvelope, sealEnvelope, SAVE_VERSION, type SaveData } from '../schema';
import { migrateToLatest } from '../migrations';

// ------------------------------------------------------------
// テスト用のゲーム状態（本物の zustand の代わり）
// ------------------------------------------------------------
function makeGame() {
  let data: SaveData = emptySaveData();
  let listener: ((reason: string, delay: number) => void) | null = null;
  const bridge: GameBridge = {
    getData: () => {
      const { stats: _s, ...rest } = structuredClone(data);
      void _s;
      return rest;
    },
    apply: (d) => (data = structuredClone(d)),
    reset: () => (data = emptySaveData()),
    subscribe: (fn) => {
      listener = fn;
      return () => (listener = null);
    },
  };
  return {
    bridge,
    get: () => data,
    /** ゲーム内で値が変わった（自動セーブの依頼が飛ぶ） */
    change(fn: (d: SaveData) => void, delay = 150) {
      fn(data);
      listener?.('state', delay);
    },
  };
}

const managers: SaveManager[] = [];

function setup(stores = [new MemoryAdapter(true), new MemoryAdapter(true)], legacy: Record<string, string> = {}) {
  const game = makeGame();
  const m = new SaveManager({ stores, bridge: game.bridge, legacy: { get: (k) => legacy[k] ?? null }, channelName: null });
  managers.push(m);
  return { m, game, stores };
}

/** 同じ保存領域で「アプリを再起動」する */
async function restart(stores: MemoryAdapter[], legacy: Record<string, string> = {}) {
  const r = setup(stores, legacy);
  const boot = await r.m.init();
  return { ...r, boot };
}

afterEach(() => {
  vi.useRealTimers();
  managers.forEach((m) => m.dispose());
  managers.length = 0;
});

describe('SaveManager 基本', () => {
  it('初回起動 → セーブ → 再起動でロードできる', async () => {
    const { m, game, stores } = setup();
    const boot = await m.init();
    expect(boot.kind).toBe('first_launch');
    game.change((d) => {
      d.player.name = 'けんすけ';
      d.player.exp = 260;
      d.player.gold = 777;
      d.flags.onboarded = true;
      d.progress.questRecords['it-ses'] = { clears: 1, bestTurns: 3, perfect: true };
      d.location.tab = 'guild';
    });
    expect(await m.saveNow('test')).toBe(true);

    const r = await restart(stores);
    expect(r.boot.kind).toBe('loaded');
    expect(r.game.get().player).toMatchObject({ name: 'けんすけ', exp: 260, gold: 777 });
    expect(r.game.get().progress.questRecords['it-ses'].perfect).toBe(true);
    expect(r.game.get().location.tab).toBe('guild');
  });

  it('複数回セーブすると revision が増え、backup に1つ前が残る', async () => {
    const { m, game, stores } = setup();
    await m.init();
    for (let i = 1; i <= 3; i++) {
      game.change((d) => (d.player.gold = i * 100));
      await m.saveNow('test');
    }
    const cur = openEnvelope(await stores[0].get(`${KEYS.auto}:current`));
    const bak = openEnvelope(await stores[0].get(`${KEYS.auto}:backup`));
    expect(cur.ok && cur.envelope.revision).toBe(3);
    expect(bak.ok && (bak.envelope.data as SaveData).player.gold).toBe(200);
    expect(await stores[0].get(`${KEYS.auto}:tmp`)).toBeNull();
  });

  it('連続した変更はまとめて1回だけ保存する（重くしない）', async () => {
    vi.useFakeTimers();
    const { m, game, stores } = setup();
    await m.init();
    const spy = vi.spyOn(stores[0], 'set');
    for (let i = 0; i < 20; i++) game.change((d) => (d.player.gold += 1), 800);
    expect(spy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(900);
    await m.saveNow('flush-check'); // キューが空になるまで待つ
    const currentWrites = spy.mock.calls.filter(([k]) => k === `${KEYS.auto}:current`).length;
    expect(currentWrites).toBe(2); // 自動1回 + 確認用1回
  });

  it('セーブ直後にロードしても最新が読める', async () => {
    const { m, game, stores } = setup();
    await m.init();
    game.change((d) => (d.player.exp = 999));
    await m.saveNow('test');
    const r = await restart(stores);
    expect(r.game.get().player.exp).toBe(999);
  });
});

describe('破損・消失からの復旧', () => {
  it('current が壊れていたら backup から復旧し、正常な状態へ書き直す', async () => {
    const { m, game, stores } = setup();
    await m.init();
    game.change((d) => (d.player.gold = 100));
    await m.saveNow('a');
    game.change((d) => (d.player.gold = 200));
    await m.saveNow('b');
    for (const s of stores) await s.set(`${KEYS.auto}:current`, '{"saveVersion":2,"checksum":"xx","data":{"player":'); // 途中で切れた
    const r = await restart(stores);
    expect(r.boot.kind).toBe('recovered_from_backup');
    expect(r.game.get().player.gold).toBe(100);
    expect(r.m.getStatus().toasts.some((t) => t.text.includes('バックアップから復旧'))).toBe(true);
    expect(openEnvelope(await stores[0].get(`${KEYS.auto}:current`)).ok).toBe(true);
  });

  it('チェックサム不一致（中身の改変・欠損）を破損として検出する', async () => {
    const { m, game, stores } = setup();
    await m.init();
    game.change((d) => (d.player.gold = 100));
    await m.saveNow('a');
    game.change((d) => (d.player.gold = 200));
    await m.saveNow('b');
    const text = (await stores[0].get(`${KEYS.auto}:current`))!.replace('"gold":200', '"gold":999999');
    for (const s of stores) await s.set(`${KEYS.auto}:current`, text);
    const r = await restart(stores);
    expect(r.boot.kind).toBe('recovered_from_backup');
    expect(r.game.get().player.gold).toBe(100);
  });

  it('主保存先が丸ごと消えてもミラーから復旧する', async () => {
    const { m, game, stores } = setup();
    await m.init();
    game.change((d) => (d.player.exp = 450));
    await m.saveNow('a');
    stores[0].map.clear();
    const r = await restart(stores);
    expect(r.boot.kind).toBe('recovered_from_backup');
    expect(r.game.get().player.exp).toBe(450);
  });

  it('書き込み途中で落ちた（tmp だけ残った）場合も current を正しく読む', async () => {
    const { m, game, stores } = setup();
    await m.init();
    game.change((d) => (d.player.exp = 100));
    await m.saveNow('a');
    for (const s of stores) await s.set(`${KEYS.auto}:tmp`, '{"broken');
    const r = await restart(stores);
    expect(r.boot.kind).toBe('loaded');
    expect(r.game.get().player.exp).toBe(100);
  });

  it('current も backup も壊れていたら「破損」と判定し、勝手に初期化・上書きしない', async () => {
    const { m, game, stores } = setup();
    await m.init();
    game.change((d) => (d.player.exp = 100));
    await m.saveNow('a');
    await m.saveNow('b');
    for (const s of stores) {
      await s.set(`${KEYS.auto}:current`, 'garbage');
      await s.set(`${KEYS.auto}:backup`, 'garbage');
    }
    const r = await restart(stores);
    expect(r.boot.kind).toBe('corrupted');
    expect(r.m.getStatus().phase).toBe('needs-decision');
    r.game.change((d) => (d.player.exp = 1)); // 判断前の変更は保存されない
    await r.m.saveNow('should-not-save');
    expect(await stores[0].get(`${KEYS.auto}:current`)).toBe('garbage');
    // 利用者が「新しく始める」を選んだら保存が再開する
    await r.m.startNewAfterProblem();
    expect(r.m.getStatus().phase).toBe('ready');
    expect(openEnvelope(await stores[0].get(`${KEYS.auto}:current`)).ok).toBe(true);
  });

  it('以前セーブした記録（meta）があるのにデータが無い → データ消失と判定', async () => {
    const { m, stores } = setup();
    await m.init();
    await m.saveNow('a');
    for (const s of stores) for (const g of ['current', 'backup', 'tmp']) await s.remove(`${KEYS.auto}:${g}`);
    const r = await restart(stores);
    expect(r.boot.kind).toBe('data_missing');
    expect(r.m.getStatus().phase).toBe('needs-decision');
  });

  it('冒険の書（手動セーブ）から再開できる', async () => {
    const { m, game, stores } = setup();
    await m.init();
    game.change((d) => (d.player.exp = 700));
    await m.saveSlot(2);
    for (const s of stores) for (const g of ['current', 'backup']) await s.set(`${KEYS.auto}:${g}`, 'garbage');
    const r = await restart(stores);
    expect(r.boot.kind).toBe('corrupted');
    expect(r.boot.hasSlots).toBe(true);
    await r.m.loadSlot(2);
    expect(r.m.getStatus().phase).toBe('ready');
    expect(r.game.get().player.exp).toBe(700);
  });
});

describe('Migration', () => {
  const legacyState = {
    gender: 'female',
    playerName: 'セリナ',
    exp: 760,
    gold: 420,
    jobId: 'paladin',
    completedLectures: ['lec-opening', 'lec-hearing'],
    questRecords: { 'it-ses': { clears: 2, bestTurns: 3, perfect: true } },
    soundOn: false,
    bgmOn: true,
    tab: 'hero',
    guildIndustry: 'finance',
    onboarded: true,
  };

  it('旧・自動保存（zustand v0）を v2 へ移行し、元データを退避する', async () => {
    const stores = [new MemoryAdapter(true), new MemoryAdapter(true)];
    const legacy = {
      [KEYS.legacyAuto]: JSON.stringify({ state: legacyState, version: 0 }),
      [KEYS.legacySlots]: JSON.stringify([{ savedAt: 1700000000000, snapshot: { ...legacyState, gold: 1 } }, null, null]),
    };
    const r = await restart(stores, legacy);
    expect(r.boot.kind).toBe('migrated_legacy');
    const d = r.game.get();
    expect(d.player).toMatchObject({ name: 'セリナ', gender: 'female', jobId: 'paladin', exp: 760, gold: 420 });
    expect(d.progress.masteredTerms).toEqual([]); // 旧版に無かった項目は既定値
    expect(d.settings).toEqual({ soundOn: false, bgmOn: true });
    expect(d.location).toEqual({ tab: 'hero', guildIndustry: 'finance' });
    expect(await stores[0].get(KEYS.legacyBackup)).toBe(legacy[KEYS.legacyAuto]);
    const env = openEnvelope(await stores[0].get(`${KEYS.auto}:current`));
    expect(env.ok && env.envelope.saveVersion).toBe(SAVE_VERSION);
    // 旧・冒険の書も移行される
    const slots = await r.m.listSlots();
    expect(slots[0]?.data.player.gold).toBe(1);
    // 2回目の起動は新形式から普通に読む
    const r2 = await restart(stores, legacy);
    expect(r2.boot.kind).toBe('loaded');
  });

  it('新形式のデータが壊れても、古い旧データへ黙って巻き戻さない', async () => {
    const stores = [new MemoryAdapter(true)];
    const legacy = { [KEYS.legacyAuto]: JSON.stringify({ state: legacyState, version: 0 }) };
    const r = await restart(stores, legacy); // 旧形式から移行
    r.game.change((d) => (d.player.exp = 5000));
    await r.m.saveNow('progress');
    for (const g of ['current', 'backup']) await stores[0].set(`${KEYS.auto}:${g}`, 'garbage');
    const r2 = await restart(stores, legacy);
    expect(r2.boot.kind).toBe('corrupted');
    expect(r2.game.get().player.exp).not.toBe(760);
  });

  it('古い saveVersion の封筒も読み込み時に移行される', () => {
    const text = sealEnvelope(emptySaveData(), 1, 'x');
    const env = JSON.parse(text);
    env.saveVersion = 1;
    env.data = { ...legacyState };
    const m = migrateToLatest(1, env.data);
    expect(m.ok && m.data.player.exp).toBe(760);
    expect(m.ok && m.migrated).toBe(true);
  });

  it('アプリより新しい saveVersion は読み込みを拒否する（壊さない）', () => {
    expect(migrateToLatest(SAVE_VERSION + 1, {}).ok).toBe(false);
  });

  it('不正な値は安全な値に丸める（存在しない職業 → 村人）', () => {
    const m = migrateToLatest(0, { ...legacyState, jobId: 'nope', gold: 'abc' });
    expect(m.ok && m.data.player.jobId).toBe('villager');
    expect(m.ok && m.data.player.gold).toBe(0);
  });
});

describe('新規ゲーム・保存失敗・複数タブ・保存コード', () => {
  it('既存ゲームから新規ゲーム：直前の記録を pre-reset に残す', async () => {
    const { m, game, stores } = setup();
    await m.init();
    game.change((d) => (d.player.exp = 999));
    await m.saveNow('a');
    await m.newGame();
    expect(game.get().player.exp).toBe(0);
    const pre = openEnvelope(await stores[0].get(KEYS.preReset));
    expect(pre.ok && (pre.envelope.data as SaveData).player.exp).toBe(999);
    const r = await restart(stores);
    expect(r.game.get().player.exp).toBe(0);
  });

  it('主保存先の書き込みが失敗してもミラーに保存でき、再起動で読める', async () => {
    const stores = [new MemoryAdapter(true), new MemoryAdapter(true)];
    const { m, game } = setup(stores);
    await m.init();
    stores[0].failOn = () => true;
    game.change((d) => (d.player.gold = 555));
    expect(await m.saveNow('a')).toBe(true);
    stores[0].failOn = null;
    const r = await restart(stores);
    expect(r.game.get().player.gold).toBe(555);
  });

  it('全ての保存先に書けなければ失敗を返し、通知を出す', async () => {
    const stores = [new MemoryAdapter(true)];
    const { m, game } = setup(stores);
    await m.init();
    stores[0].failOn = () => true;
    game.change((d) => (d.player.gold = 1));
    expect(await m.saveNow('a')).toBe(false);
    expect(m.getStatus().lastError).toBeTruthy();
    expect(m.getStatus().toasts.some((t) => t.kind === 'error' && t.text.includes('セーブに失敗'))).toBe(true);
  });

  it('別のタブが新しい進行を保存したら、古いタブは上書きせず停止する', async () => {
    const stores = [new MemoryAdapter(true)];
    const a = setup(stores);
    await a.m.init();
    await a.m.saveNow('a1');
    const b = setup(stores);
    await b.m.init(); // 同じデータを別タブで開く
    b.game.change((d) => (d.player.exp = 500));
    await b.m.saveNow('b1'); // タブBが進める
    a.game.change((d) => (d.player.exp = 1)); // 古いタブAが操作
    expect(await a.m.saveNow('a2')).toBe(false);
    expect(a.m.getStatus().conflict).toBe(true);
    const r = await restart(stores);
    expect(r.game.get().player.exp).toBe(500);
  });

  it('保存コードで書き出し→別の端末で復元できる。壊れたコードは拒否', async () => {
    const src = setup();
    await src.m.init();
    src.game.change((d) => {
      d.player.name = 'ケンタ';
      d.player.exp = 1234;
    });
    const code = src.m.exportCode();
    expect(code.startsWith('AQS1:')).toBe(true);

    const dst = setup([new MemoryAdapter(true)]);
    await dst.m.init();
    expect((await dst.m.importCode(code.slice(0, -8))).ok).toBe(false);
    expect((await dst.m.importCode(code)).ok).toBe(true);
    expect(dst.game.get().player).toMatchObject({ name: 'ケンタ', exp: 1234 });
  });

  it('保存領域が使えない（メモリのみ）場合は「保存されない」と判定・通知する', async () => {
    const game = makeGame();
    const mem = new MemoryAdapter(false);
    const m = new SaveManager({ stores: [mem], bridge: game.bridge, channelName: null });
    managers.push(m);
    const boot = await m.init();
    expect(boot.kind).toBe('storage_unavailable');
    expect(m.getStatus().toasts.some((t) => t.text.includes('保存されません'))).toBe(true);
  });
});
