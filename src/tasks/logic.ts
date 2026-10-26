// ============================================================
// タスククエストのルール（画面から切り離した純粋関数）
// 数字や優先順位を考えなくていいように、期限と重さの2つだけ聞いて
// 「次に倒すモンスター」をアプリが決める。
// ============================================================

/** 追加するときに選ぶ期限（日付は聞かない） */
export type Due = 'today' | 'tomorrow' | 'week' | 'someday';
/** 重さ：スライム（サクッと）・ゴブリン（ふつう）・ドラゴン（重い） */
export type Size = 'S' | 'M' | 'L';
/** 画面に出す期限の区分 */
export type Bucket = 'over' | 'today' | 'tomorrow' | 'week' | 'later' | 'someday';

export interface Step {
  id: string;
  text: string;
  done: boolean;
}

/** どこから来たタスクか（メンバーズのメンションからなど） */
export interface TaskSource {
  kind: 'members';
  messageId: string;
  sender: string;
  url: string | null;
}

export interface Task {
  id: string;
  title: string;
  size: Size;
  /** YYYY-MM-DD（ローカル日付）。null は「いつか」 */
  dueDate: string | null;
  steps: Step[];
  /** まとめて書き出したあと、期限と重さをまだ選んでいないものは false */
  sorted: boolean;
  createdAt: string;
  doneAt: string | null;
  source?: TaskSource;
}

export interface Player {
  coins: number;
  exp: number;
  /** 日付ごとに倒した数（スタンプと連続日数に使う） */
  log: Record<string, number>;
}

export interface State {
  version: 1;
  tasks: Task[];
  player: Player;
}

export const DAILY_GOAL = 3;
export const STEP_COINS = 5;
export const FOCUS_COINS = 10;

export const SIZES: Record<Size, { name: string; label: string; coins: number }> = {
  S: { name: 'スライム', label: 'サクッと', coins: 10 },
  M: { name: 'ゴブリン', label: 'ふつう', coins: 25 },
  L: { name: 'ドラゴン', label: 'おもい', coins: 60 },
};

export const DUES: { id: Due; label: string }[] = [
  { id: 'today', label: '今日' },
  { id: 'tomorrow', label: '明日' },
  { id: 'week', label: '今週中' },
  { id: 'someday', label: 'いつか' },
];

export const BUCKET_LABEL: Record<Bucket, string> = {
  over: '期限すぎ',
  today: '今日',
  tomorrow: '明日',
  week: '今週中',
  later: '来週以降',
  someday: 'いつか',
};

/** 大きいタスクを小分けにするときの「とりあえずこれ」候補 */
export const STEP_IDEAS = ['5分だけ中身を見る', '必要なものを集める', '人に聞くことをメモ', 'たたき台を作る', '見直す', '送る・提出する'];

export const emptyState = (): State => ({ version: 1, tasks: [], player: { coins: 0, exp: 0, log: {} } });

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const pad = (n: number) => String(n).padStart(2, '0');

export function dateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return dateStr(new Date(y, m - 1, d + n));
}

function daysBetween(from: string, to: string): number {
  const [a, b] = [from, to].map((s) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86400000);
}

/** 「今週中」は金曜まで（土日に選んだら次の金曜） */
export function dueDateFor(due: Due, today: string): string | null {
  if (due === 'someday') return null;
  if (due === 'today') return today;
  if (due === 'tomorrow') return addDays(today, 1);
  const [y, m, d] = today.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  const toFri = wd <= 5 ? 5 - wd : 12 - wd;
  return addDays(today, Math.max(toFri, 1));
}

export function bucketOf(task: Pick<Task, 'dueDate'>, today: string): Bucket {
  if (!task.dueDate) return 'someday';
  const diff = daysBetween(today, task.dueDate);
  if (diff < 0) return 'over';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff <= 7) return 'week';
  return 'later';
}

/** 今の期限を選び直すときの初期値 */
export function dueOf(task: Pick<Task, 'dueDate'>, today: string): Due {
  const b = bucketOf(task, today);
  return b === 'over' || b === 'today' ? 'today' : b === 'tomorrow' ? 'tomorrow' : b === 'someday' ? 'someday' : 'week';
}

const BUCKET_RANK: Record<Bucket, number> = { over: 0, today: 1, tomorrow: 2, week: 3, later: 4, someday: 5 };
const SIZE_RANK: Record<Size, number> = { S: 0, M: 1, L: 2 };

/**
 * 倒す順番：期限が近い順。同じ期限なら「手をつけかけ」→ 軽いもの（勢いをつける）→ 古いもの。
 * 仕分け前のものは最後。
 */
export function compareTasks(a: Task, b: Task, today: string): number {
  if (a.sorted !== b.sorted) return a.sorted ? -1 : 1;
  const r = BUCKET_RANK[bucketOf(a, today)] - BUCKET_RANK[bucketOf(b, today)];
  if (r) return r;
  const sa = a.steps.some((s) => s.done) ? 0 : 1;
  const sb = b.steps.some((s) => s.done) ? 0 : 1;
  if (sa !== sb) return sa - sb;
  if (a.size !== b.size) return SIZE_RANK[a.size] - SIZE_RANK[b.size];
  return a.createdAt.localeCompare(b.createdAt);
}

export function activeTasks(tasks: Task[], today: string): Task[] {
  return tasks.filter((t) => !t.doneAt).sort((a, b) => compareTasks(a, b, today));
}

/** 次に倒すモンスター（仕分け済みの先頭） */
export function nextTask(tasks: Task[], today: string): Task | null {
  return activeTasks(tasks, today).find((t) => t.sorted) ?? null;
}

/** ステップがあれば1ステップ＝1ダメージ。ないときは一撃で倒せる */
export function hpOf(task: Task): { max: number; left: number } {
  if (!task.steps.length) return { max: 1, left: task.doneAt ? 0 : 1 };
  return { max: task.steps.length, left: task.doneAt ? 0 : task.steps.filter((s) => !s.done).length };
}

/** 倒したときのコイン（小分けにしたステップ分はステップのときに先に渡している） */
export function rewardOf(task: Task): number {
  return SIZES[task.size].coins;
}

/** 必要経験値はレベルが上がるほど少しずつ増える：Lv n → n+1 に 40 + 20n */
export function levelOf(exp: number): { level: number; into: number; need: number } {
  let level = 1;
  let rest = exp;
  while (rest >= 40 + 20 * level) {
    rest -= 40 + 20 * level;
    level++;
  }
  return { level, into: rest, need: 40 + 20 * level };
}

const TITLES = ['見習い冒険者', 'かけだし剣士', 'タスクハンター', 'しごと魔導士', '段取りナイト', 'スケジュール賢者', 'タスクの勇者', '伝説のプロ'];
export function titleOf(level: number): string {
  return TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 2))];
}

/** 今日まで（今日がまだ0なら昨日まで）続けて1体以上倒した日数 */
export function streakOf(log: Record<string, number>, today: string): number {
  let day = (log[today] ?? 0) > 0 ? today : addDays(today, -1);
  let n = 0;
  while ((log[day] ?? 0) > 0) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

function gain(p: Player, coins: number, today: string, kills: number): Player {
  const log = { ...p.log, [today]: Math.max(0, (p.log[today] ?? 0) + kills) };
  if (!log[today]) delete log[today];
  return { coins: Math.max(0, p.coins + coins), exp: Math.max(0, p.exp + coins), log };
}

export interface Result {
  state: State;
  coins: number;
  defeated: boolean;
  levelUp: boolean;
}

function finish(prev: State, state: State, coins: number, defeated: boolean): Result {
  return { state, coins, defeated, levelUp: levelOf(state.player.exp).level > levelOf(prev.player.exp).level };
}

export function defeatTask(s: State, id: string, now: Date): Result {
  const t = s.tasks.find((x) => x.id === id);
  if (!t || t.doneAt) return finish(s, s, 0, false);
  const today = dateStr(now);
  // ステップを飛ばして倒したときは、残りのステップ分も渡す
  const coins = rewardOf(t) + t.steps.filter((x) => !x.done).length * STEP_COINS;
  const tasks = s.tasks.map((x) => (x.id === id ? { ...x, doneAt: now.toISOString(), steps: x.steps.map((st) => ({ ...st, done: true })) } : x));
  return finish(s, { ...s, tasks, player: gain(s.player, coins, today, 1) }, coins, true);
}

/** ステップをチェック。最後のステップならそのまま討伐 */
export function toggleStep(s: State, id: string, stepId: string, now: Date): Result {
  const t = s.tasks.find((x) => x.id === id);
  const step = t?.steps.find((x) => x.id === stepId);
  if (!t || !step || t.doneAt) return finish(s, s, 0, false);
  const today = dateStr(now);
  const steps = t.steps.map((x) => (x.id === stepId ? { ...x, done: !x.done } : x));
  const coins = step.done ? -STEP_COINS : STEP_COINS;
  const next: State = { ...s, tasks: s.tasks.map((x) => (x.id === id ? { ...x, steps } : x)), player: gain(s.player, coins, today, 0) };
  if (!step.done && steps.every((x) => x.done)) {
    const r = defeatTask(next, id, now);
    return finish(s, r.state, coins + r.coins, true);
  }
  return finish(s, next, coins, false);
}

/** 集中タイムを最後までやりきったごほうび */
export function focusBonus(s: State, now: Date): Result {
  return finish(s, { ...s, player: gain(s.player, FOCUS_COINS, dateStr(now), 0) }, FOCUS_COINS, false);
}

export function newTask(title: string, due: Due, size: Size, today: string, now: Date, sorted = true, source?: TaskSource): Task {
  return { id: uid(), title: title.trim(), size, dueDate: dueDateFor(due, today), steps: [], sorted, createdAt: now.toISOString(), doneAt: null, ...(source ? { source } : {}) };
}

/** まとめて書き出した文章を1行1タスクにする（箇条書きの記号は取る） */
export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*・●○□■☐✓✔]|\d+[.)、．]|[（(]?\d+[)）])\s*/, '').trim())
    .filter(Boolean);
}

/** 画面のリンクに使ってよい URL（https だけ） */
export function safeUrl(u: unknown): string | null {
  return typeof u === 'string' && /^https:\/\/[^\s]+$/.test(u) ? u : null;
}

/** 保存データの読み込み（壊れていても落ちないように形を整える） */
export function normalize(raw: unknown): State {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<State>;
  const tasks = Array.isArray(r.tasks)
    ? r.tasks
        .filter((t): t is Task => !!t && typeof t.id === 'string' && typeof t.title === 'string')
        .map((t) => ({
          ...t,
          size: (['S', 'M', 'L'] as const).includes(t.size) ? t.size : 'M',
          dueDate: typeof t.dueDate === 'string' ? t.dueDate : null,
          steps: Array.isArray(t.steps) ? t.steps.filter((x) => x && typeof x.text === 'string') : [],
          sorted: t.sorted !== false,
          doneAt: t.doneAt ?? null,
          source:
            t.source && typeof t.source.messageId === 'string'
              ? { kind: 'members' as const, messageId: t.source.messageId, sender: String(t.source.sender ?? ''), url: safeUrl(t.source.url) }
              : undefined,
        }))
    : [];
  const p = (r.player ?? {}) as Partial<Player>;
  return {
    version: 1,
    tasks,
    player: { coins: Number(p.coins) || 0, exp: Number(p.exp) || 0, log: p.log && typeof p.log === 'object' ? p.log : {} },
  };
}
