import { describe, expect, it } from 'vitest';
import {
  SIZES,
  STEP_COINS,
  activeTasks,
  bucketOf,
  defeatTask,
  dueDateFor,
  emptyState,
  levelOf,
  newTask,
  nextTask,
  normalize,
  splitLines,
  streakOf,
  toggleStep,
  type State,
} from '../logic';

const NOW = new Date(2026, 9, 26, 10); // 2026-10-26 月曜
const TODAY = '2026-10-26';

const withTasks = (...tasks: ReturnType<typeof newTask>[]): State => ({ ...emptyState(), tasks });

describe('期限', () => {
  it('今日・明日・今週中（金曜まで）・いつか', () => {
    expect(dueDateFor('today', TODAY)).toBe(TODAY);
    expect(dueDateFor('tomorrow', TODAY)).toBe('2026-10-27');
    expect(dueDateFor('week', TODAY)).toBe('2026-10-30');
    expect(dueDateFor('week', '2026-10-31')).toBe('2026-11-06'); // 土曜なら次の金曜
    expect(dueDateFor('week', '2026-10-30')).toBe('2026-10-31'); // 金曜は翌日まで
    expect(dueDateFor('someday', TODAY)).toBeNull();
  });
  it('区分は日付から毎日数え直す', () => {
    expect(bucketOf({ dueDate: '2026-10-25' }, TODAY)).toBe('over');
    expect(bucketOf({ dueDate: TODAY }, TODAY)).toBe('today');
    expect(bucketOf({ dueDate: '2026-10-27' }, TODAY)).toBe('tomorrow');
    expect(bucketOf({ dueDate: '2026-11-02' }, TODAY)).toBe('week');
    expect(bucketOf({ dueDate: '2026-11-20' }, TODAY)).toBe('later');
    expect(bucketOf({ dueDate: null }, TODAY)).toBe('someday');
  });
});

describe('倒す順番', () => {
  it('期限が近い順、同じ期限なら手をつけかけ → 軽いもの、仕分け前は最後', () => {
    const big = newTask('重い今日', 'today', 'L', TODAY, NOW);
    const small = newTask('軽い今日', 'today', 'S', TODAY, NOW);
    const late = { ...newTask('きのうまで', 'today', 'L', TODAY, NOW), dueDate: '2026-10-20' };
    const someday = newTask('いつか', 'someday', 'S', TODAY, NOW);
    const raw = newTask('未仕分け', 'today', 'S', TODAY, NOW, false);
    const s = withTasks(raw, someday, big, small, late);
    expect(activeTasks(s.tasks, TODAY).map((t) => t.title)).toEqual(['きのうまで', '軽い今日', '重い今日', 'いつか', '未仕分け']);

    const started = { ...big, steps: [{ id: 'a', text: 'x', done: true }, { id: 'b', text: 'y', done: false }] };
    expect(nextTask([small, started], TODAY)?.title).toBe('重い今日');
    expect(nextTask([raw], TODAY)).toBeNull();
  });
});

describe('ごほうび', () => {
  it('倒すと重さに応じたコインと今日のスタンプ', () => {
    const t = newTask('a', 'today', 'M', TODAY, NOW);
    const r = defeatTask(withTasks(t), t.id, NOW);
    expect(r.defeated).toBe(true);
    expect(r.coins).toBe(SIZES.M.coins);
    expect(r.state.player.log[TODAY]).toBe(1);
    expect(r.state.tasks[0].doneAt).not.toBeNull();
    // 2回倒しても増えない
    expect(defeatTask(r.state, t.id, NOW).coins).toBe(0);
  });

  it('ステップごとにコイン、最後のステップで討伐。合計はステップを飛ばしても同じ', () => {
    const t = { ...newTask('a', 'today', 'L', TODAY, NOW), steps: [{ id: '1', text: 'x', done: false }, { id: '2', text: 'y', done: false }] };
    const r1 = toggleStep(withTasks(t), t.id, '1', NOW);
    expect(r1.coins).toBe(STEP_COINS);
    expect(r1.defeated).toBe(false);
    const r2 = toggleStep(r1.state, t.id, '2', NOW);
    expect(r2.defeated).toBe(true);
    expect(r2.state.player.coins).toBe(SIZES.L.coins + 2 * STEP_COINS);
    expect(defeatTask(withTasks(t), t.id, NOW).state.player.coins).toBe(SIZES.L.coins + 2 * STEP_COINS);
  });

  it('チェックを外すとコインを戻す', () => {
    const t = { ...newTask('a', 'today', 'S', TODAY, NOW), steps: [{ id: '1', text: 'x', done: false }, { id: '2', text: 'y', done: false }] };
    const on = toggleStep(withTasks(t), t.id, '1', NOW).state;
    expect(toggleStep(on, t.id, '1', NOW).state.player.coins).toBe(0);
  });

  it('レベルは少しずつ上がりにくくなる', () => {
    expect(levelOf(0)).toEqual({ level: 1, into: 0, need: 60 });
    expect(levelOf(59).level).toBe(1);
    expect(levelOf(60)).toEqual({ level: 2, into: 0, need: 80 });
    expect(levelOf(140).level).toBe(3);
  });

  it('連続日数：今日まだでも昨日まで続いていれば数える', () => {
    expect(streakOf({ '2026-10-24': 1, '2026-10-25': 2 }, TODAY)).toBe(2);
    expect(streakOf({ '2026-10-24': 1, '2026-10-25': 2, [TODAY]: 1 }, TODAY)).toBe(3);
    expect(streakOf({ '2026-10-23': 1 }, TODAY)).toBe(0);
  });
});

describe('まとめて書き出し・保存データ', () => {
  it('1行1タスク、箇条書きの記号は取る', () => {
    expect(splitLines('・見積もり\n- 資料\n\n1. 電話\n（2）経費精算\n  メール  ')).toEqual(['見積もり', '資料', '電話', '経費精算', 'メール']);
  });
  it('壊れたデータでも落ちない', () => {
    expect(normalize(null)).toEqual(emptyState());
    const s = normalize({ tasks: [{ id: 'x', title: 't', size: 'XL' }, { nope: 1 }], player: { coins: '5' } });
    expect(s.tasks).toHaveLength(1);
    expect(s.tasks[0]).toMatchObject({ size: 'M', dueDate: null, steps: [], sorted: true, doneAt: null });
    expect(s.player).toEqual({ coins: 5, exp: 0, log: {} });
  });
});
