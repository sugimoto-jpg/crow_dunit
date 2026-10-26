import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Bell, Check, ChevronRight, Coins, ExternalLink, Flame, MailCheck, Plus, Sparkles, Swords, Timer, Trash2, Undo2, Wand2, X } from 'lucide-react';
import { setSfxEnabled, sfx, unlockAudio } from '../audio/sfx';
import {
  BUCKET_LABEL,
  DAILY_GOAL,
  DUES,
  SIZES,
  STEP_COINS,
  STEP_IDEAS,
  activeTasks,
  bucketOf,
  dateStr,
  defeatTask,
  dueDateFor,
  dueOf,
  focusBonus,
  hpOf,
  levelOf,
  newTask,
  safeUrl,
  nextTask,
  splitLines,
  streakOf,
  titleOf,
  toggleStep,
  uid,
  type Bucket,
  type Due,
  type Result,
  type Size,
  type State,
  type Task,
  type TaskSource,
} from './logic';
import { LinkError, fetchMessages, loadLink, markRead, parseLinkCode, saveLink, suggestTitle, type MembersLink, type MembersMessage } from './members';
import { load, onExternalChange, save } from './storage';

const CHEERS = ['ナイス！', 'いいね！', 'その調子！', 'さすが！', 'えらい！', 'かっこいい！', 'やったね！'];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

// ------------------------------------------------------------
// モンスター（SVG）：重さで形と色、期限すぎで少しおこり顔
// ------------------------------------------------------------
const COLORS: Record<Size, [string, string]> = {
  S: ['#7dd3a8', '#4fb889'],
  M: ['#b49cf5', '#8b6ee8'],
  L: ['#ff9bb3', '#f0628a'],
};

function Monster({ size, angry = false, px = 64, className = '' }: { size: Size; angry?: boolean; px?: number; className?: string }) {
  const [fill, shade] = COLORS[size];
  return (
    <svg viewBox="0 0 100 100" width={px} height={px} className={className} aria-hidden>
      {size === 'L' && (
        <>
          <path d="M14 46 L2 30 L22 36 Z" fill={shade} />
          <path d="M86 46 L98 30 L78 36 Z" fill={shade} />
          <path d="M34 22 L38 6 L46 20 Z" fill="#ffd166" />
          <path d="M66 22 L62 6 L54 20 Z" fill="#ffd166" />
        </>
      )}
      {size === 'M' && (
        <>
          <path d="M30 26 L24 10 L40 20 Z" fill={shade} />
          <path d="M70 26 L76 10 L60 20 Z" fill={shade} />
        </>
      )}
      <path
        d={size === 'S' ? 'M10 86 C10 50 28 30 50 30 C72 30 90 50 90 86 Z' : 'M14 88 C10 52 26 18 50 18 C74 18 90 52 86 88 Z'}
        fill={fill}
      />
      <path d={size === 'S' ? 'M10 86 L90 86 L88 92 L12 92 Z' : 'M14 88 L86 88 L84 93 L16 93 Z'} fill={shade} />
      <ellipse cx="34" cy={size === 'S' ? 46 : 38} rx="9" ry="6" fill="#fff" opacity="0.35" />
      {angry ? (
        <>
          <path d="M30 52 L44 57" stroke="#3b2a4a" strokeWidth="4" strokeLinecap="round" />
          <path d="M70 52 L56 57" stroke="#3b2a4a" strokeWidth="4" strokeLinecap="round" />
        </>
      ) : null}
      <circle cx="38" cy="62" r="6" fill="#3b2a4a" />
      <circle cx="62" cy="62" r="6" fill="#3b2a4a" />
      <circle cx="40" cy="60" r="2" fill="#fff" />
      <circle cx="64" cy="60" r="2" fill="#fff" />
      <circle cx="28" cy="72" r="5" fill="#ff7fa8" opacity="0.45" />
      <circle cx="72" cy="72" r="5" fill="#ff7fa8" opacity="0.45" />
      {angry ? (
        <path d="M42 78 Q50 72 58 78" stroke="#3b2a4a" strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M43 74 Q50 80 57 74" stroke="#3b2a4a" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
    </svg>
  );
}

function Hearts({ task, small = false }: { task: Task; small?: boolean }) {
  const { max, left } = hpOf(task);
  if (max === 1) return null;
  const shown = Math.min(max, 10);
  return (
    <span className={`inline-flex flex-wrap gap-0.5 ${small ? 'text-[10px]' : 'text-sm'}`} aria-label={`のこり ${left}/${max}`}>
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className={i < Math.ceil((left / max) * shown) ? '' : 'opacity-25 grayscale'}>
          ❤️
        </span>
      ))}
    </span>
  );
}

const BUCKET_STYLE: Record<Bucket, string> = {
  over: 'bg-rose-100 text-rose-600',
  today: 'bg-amber-100 text-amber-700',
  tomorrow: 'bg-sky-100 text-sky-700',
  week: 'bg-violet-100 text-violet-700',
  later: 'bg-slate-100 text-slate-600',
  someday: 'bg-slate-100 text-slate-500',
};

function DueChip({ bucket }: { bucket: Bucket }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${BUCKET_STYLE[bucket]}`}>{BUCKET_LABEL[bucket]}</span>;
}

// ------------------------------------------------------------
// 演出：紙吹雪・浮かぶコイン
// ------------------------------------------------------------
interface Fx {
  id: string;
  coins: number;
  big: boolean;
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        i,
        left: Math.random() * 100,
        color: ['#ff7fa8', '#ffd166', '#7dd3a8', '#b49cf5', '#7cc4ff'][i % 5],
        style: {
          '--dx': `${(Math.random() - 0.5) * 160}px`,
          '--rot': `${Math.random() * 720 - 360}deg`,
          '--dur': `${1.4 + Math.random() * 1.2}s`,
          animationDelay: `${Math.random() * 0.3}s`,
        } as CSSProperties,
      })),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p) => (
        <span key={p.i} className="tq-confetti absolute -top-4 h-3 w-2 rounded-sm" style={{ left: `${p.left}%`, background: p.color, ...p.style }} />
      ))}
    </div>
  );
}

// ------------------------------------------------------------
// 下から出るシート
// ------------------------------------------------------------
function Sheet({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/30 sm:items-center" onClick={onClose}>
      <div
        className="tq-sheet max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold text-slate-700">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100" aria-label="閉じる">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ChoiceRow<T extends string>({ options, value, onChange }: { options: { id: T; label: ReactNode }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`flex-1 rounded-2xl border-2 px-2 py-2.5 text-sm font-bold transition ${
            value === o.id ? 'border-pink-400 bg-pink-50 text-pink-600' : 'border-slate-200 bg-white text-slate-600 hover:border-pink-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const SIZE_OPTIONS = (['S', 'M', 'L'] as const).map((id) => ({
  id,
  label: (
    <span className="flex flex-col items-center gap-0.5">
      <Monster size={id} px={id === 'S' ? 30 : id === 'M' ? 36 : 42} />
      <span>{SIZES[id].label}</span>
    </span>
  ),
}));

// ------------------------------------------------------------
// 本体
// ------------------------------------------------------------
export function TaskApp() {
  const [state, setState] = useState<State>(load);
  const [now, setNow] = useState(() => new Date());
  const today = dateStr(now);
  const [fx, setFx] = useState<Fx | null>(null);
  const [hitId, setHitId] = useState<string | null>(null);
  const [poofId, setPoofId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; undo?: State } | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [sheet, setSheet] = useState<null | 'add' | 'sort' | 'members' | { detail: string } | { focus: string }>(null);
  // メンバーズ連携（メンションベル経由）
  const [link, setLink] = useState<MembersLink | null>(loadLink);
  const [messages, setMessages] = useState<MembersMessage[]>([]);
  const [membersError, setMembersError] = useState('');
  const [draft, setDraft] = useState<{ title: string; source: TaskSource } | null>(null);
  const [sound, setSound] = useState(() => {
    try {
      return localStorage.getItem('aidma-task-quest-sound') !== 'off';
    } catch {
      return true;
    }
  });
  const [saveFailed, setSaveFailed] = useState(false);
  const skipSave = useRef(false);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    setSaveFailed(!save(state));
  }, [state]);
  useEffect(
    () =>
      onExternalChange((s) => {
        skipSave.current = true;
        setState(s);
      }),
    [],
  );
  // 日付が変わったら「今日」を更新する
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    setSfxEnabled(sound);
    try {
      localStorage.setItem('aidma-task-quest-sound', sound ? 'on' : 'off');
    } catch {
      /* 保存できなくても続ける */
    }
  }, [sound]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // メンバーズのメンションを読む：開いたとき・画面に戻ったとき・1分ごと（画面が見えている間だけ）
  async function refreshMembers(l = link) {
    if (!l) return;
    try {
      setMessages(await fetchMessages(l));
      setMembersError('');
    } catch (e) {
      setMembersError(e instanceof Error ? e.message : '読み込めませんでした。');
      if (e instanceof LinkError && e.revoked) setMessages([]);
    }
  }
  useEffect(() => {
    if (!link) return;
    void refreshMembers(link);
    const t = setInterval(() => document.visibilityState === 'visible' && void refreshMembers(link), 60_000);
    const onVis = () => document.visibilityState === 'visible' && void refreshMembers(link);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [link]);
  const unread = messages.filter((m) => !m.readAt);

  async function readMessages(ids: string[]) {
    if (!link || !ids.length) return;
    const at = new Date().toISOString();
    setMessages((ms) => ms.map((m) => (ids.includes(m.id) ? { ...m, readAt: m.readAt ?? at } : m)));
    try {
      await markRead(link, ids);
    } catch (e) {
      setMembersError(e instanceof Error ? e.message : '既読にできませんでした。');
      void refreshMembers();
    }
  }

  const active = useMemo(() => activeTasks(state.tasks, today), [state.tasks, today]);
  const unsorted = active.filter((t) => !t.sorted);
  const next = nextTask(state.tasks, today);
  const rest = active.filter((t) => t.sorted && t.id !== next?.id);
  const doneToday = state.tasks.filter((t) => t.doneAt && dateStr(new Date(t.doneAt)) === today);
  const killsToday = state.player.log[today] ?? 0;
  const lv = levelOf(state.player.exp);
  const streak = streakOf(state.player.log, today);

  function update(fn: (s: State) => State) {
    setState((s) => fn(s));
  }

  function apply(prev: State, r: Result, id: string) {
    if (r.coins <= 0 && !r.defeated) {
      setState(r.state);
      return;
    }
    setFx({ id: uid(), coins: r.coins, big: r.defeated });
    if (r.defeated) {
      sfx.victory();
      setPoofId(id);
      setTimeout(() => {
        setPoofId(null);
        setState(r.state);
        const kills = r.state.player.log[today] ?? 0;
        setToast({ text: kills === DAILY_GOAL ? '今日の目標クリア！🎉 あとはゆっくりでOK' : pick(CHEERS) + ' モンスターをたおした！', undo: prev });
        if (r.levelUp) {
          setTimeout(() => {
            sfx.levelUp();
            setLevelUp(levelOf(r.state.player.exp).level);
          }, 500);
        }
      }, 600);
    } else {
      sfx.slash();
      setHitId(id);
      setTimeout(() => setHitId(null), 450);
      setState(r.state);
    }
    setTimeout(() => setFx(null), 2600);
  }

  function defeat(id: string) {
    if (poofId) return;
    unlockAudio();
    apply(state, defeatTask(state, id, new Date()), id);
  }

  function step(id: string, stepId: string) {
    if (poofId) return;
    unlockAudio();
    const t = state.tasks.find((x) => x.id === id);
    const wasDone = t?.steps.find((s) => s.id === stepId)?.done;
    const r = toggleStep(state, id, stepId, new Date());
    if (wasDone) {
      setState(r.state);
      return;
    }
    apply(state, r, id);
  }

  function patchTask(id: string, patch: Partial<Task>) {
    update((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  }

  function removeTask(id: string) {
    const prev = state;
    update((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
    setToast({ text: 'モンスターをにがしました（やらなくていいことは、やらない！）', undo: prev });
    sfx.cancel();
  }

  const detail = sheet && typeof sheet === 'object' && 'detail' in sheet ? state.tasks.find((t) => t.id === sheet.detail) : undefined;
  const focus = sheet && typeof sheet === 'object' && 'focus' in sheet ? state.tasks.find((t) => t.id === sheet.focus) : undefined;

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-28 text-slate-700">
      {/* ヘッダー：レベル・コイン・今日の星 */}
      <header className="rounded-3xl bg-gradient-to-br from-pink-400 to-violet-400 p-4 text-white shadow-lg shadow-pink-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold opacity-90">タスククエスト</div>
            <div className="text-lg font-extrabold">
              Lv.{lv.level} {titleOf(lv.level)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-white/25 px-3 py-1 text-sm font-extrabold">
              <Coins size={16} /> {state.player.coins}
            </span>
            <button
              onClick={() => {
                sfx.select();
                setSheet('members');
                void refreshMembers();
              }}
              className="relative rounded-full bg-white/25 p-1.5"
              aria-label={unread.length ? `メンバーズの未読 ${unread.length}件` : 'メンバーズ'}
            >
              <Bell size={18} />
              {unread.length > 0 && (
                <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-yellow-300 px-1 text-[11px] font-extrabold text-pink-700">
                  {unread.length > 99 ? '99+' : unread.length}
                </span>
              )}
            </button>
            <button onClick={() => setSound((v) => !v)} className="rounded-full bg-white/25 px-2 py-1 text-sm" aria-label={sound ? '音を消す' : '音を出す'}>
              {sound ? '🔊' : '🔇'}
            </button>
          </div>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/30" title="つぎのレベルまで">
          <div className="h-full rounded-full bg-yellow-300 transition-all duration-700" style={{ width: `${(lv.into / lv.need) * 100}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between text-sm font-bold">
          <span className="flex items-center gap-1">
            今日の目標
            {Array.from({ length: DAILY_GOAL }, (_, i) => (
              <span key={i} className={`text-lg ${i < killsToday ? '' : 'opacity-35 grayscale'}`}>
                ⭐
              </span>
            ))}
            {killsToday > DAILY_GOAL && <span className="text-xs">+{killsToday - DAILY_GOAL}</span>}
          </span>
          {streak > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-white/25 px-2 py-0.5 text-xs">
              <Flame size={14} /> {streak}日れんぞく
            </span>
          )}
        </div>
      </header>

      {saveFailed && <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs text-amber-700">このブラウザでは保存できません（プライベートモードなど）。閉じると消えてしまいます。</p>}

      {/* メンバーズの未読 */}
      {unread.length > 0 && (
        <button
          onClick={() => setSheet('members')}
          className="mt-4 flex w-full items-center justify-between gap-2 rounded-2xl bg-sky-50 px-4 py-3 text-left ring-2 ring-sky-200"
        >
          <span className="min-w-0 text-sm font-bold text-sky-800">
            📨 メンバーズから {unread.length}件
            <span className="block truncate text-xs font-normal text-sky-700">
              {unread[0].senderName}さん：{unread[0].body.replace(/@\S+/g, '').replace(/\s+/g, ' ').trim()}
            </span>
          </span>
          <span className="flex shrink-0 items-center text-sm font-extrabold text-sky-600">
            見る <ChevronRight size={18} />
          </span>
        </button>
      )}

      {/* 仕分けまち */}
      {unsorted.length > 0 && (
        <button
          onClick={() => setSheet('sort')}
          className="mt-4 flex w-full items-center justify-between rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50 px-4 py-3 text-left"
        >
          <span className="text-sm font-bold text-violet-700">🧺 仕分けまちのモンスター {unsorted.length}体</span>
          <span className="flex shrink-0 items-center text-sm font-extrabold text-violet-600">
            仕分ける <ChevronRight size={18} />
          </span>
        </button>
      )}

      {/* 次に倒すモンスター */}
      <section className="mt-4">
        <h2 className="mb-2 flex items-center gap-1 text-sm font-extrabold text-pink-500">
          <Swords size={16} /> つぎのあいて
        </h2>
        {next ? (
          <NextCard
            task={next}
            today={today}
            hit={hitId === next.id}
            poof={poofId === next.id}
            fx={fx}
            onDefeat={() => defeat(next.id)}
            onStep={(sid) => step(next.id, sid)}
            onOpen={() => setSheet({ detail: next.id })}
            onFocus={() => {
              unlockAudio();
              sfx.confirm();
              setSheet({ focus: next.id });
            }}
          />
        ) : (
          <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
            <div className="text-4xl">🌸</div>
            <p className="mt-2 font-bold">{unsorted.length ? '仕分けがおわると、ここに出てくるよ' : state.tasks.length ? 'モンスターは全部たおしました！' : 'まだモンスターがいません'}</p>
            <p className="mt-1 text-sm text-slate-500">
              {unsorted.length
                ? '上の「仕分ける」から、いつまでにやるかを選んでね。'
                : state.tasks.length
                  ? 'おつかれさま。今日はゆっくりしよう。'
                  : '下の「＋」から、やることを書き出してみよう。頭の中が少し軽くなるよ。'}
            </p>
          </div>
        )}
      </section>

      {/* そのほか */}
      {rest.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-extrabold text-slate-500">まっているモンスター（上から順にやればOK）</h2>
          <ul className="space-y-2">
            {rest.map((t) => (
              <li key={t.id} className={`flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ${poofId === t.id ? 'tq-poof' : ''}`}>
                <button onClick={() => setSheet({ detail: t.id })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <Monster size={t.size} px={40} angry={bucketOf(t, today) === 'over'} className={hitId === t.id ? 'tq-hit' : ''} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{t.title}</span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <DueChip bucket={bucketOf(t, today)} />
                      <Hearts task={t} small />
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => defeat(t.id)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-pink-200 text-pink-400 hover:bg-pink-50"
                  aria-label="たおした"
                >
                  <Check size={20} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 今日たおした */}
      {doneToday.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-extrabold text-emerald-600">今日たおしたモンスター 🏆</h2>
          <ul className="flex flex-wrap gap-2">
            {doneToday.map((t) => (
              <li key={t.id} className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                <Check size={14} /> {t.title}
              </li>
            ))}
          </ul>
        </section>
      )}

      <WeekStamps log={state.player.log} today={today} />

      {/* 追加ボタン */}
      <button
        onClick={() => {
          unlockAudio();
          sfx.select();
          setSheet('add');
        }}
        className="fixed right-[max(1.25rem,calc(50%-14rem+1.25rem))] bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-30 flex items-center gap-1 rounded-full bg-pink-500 px-5 py-4 font-extrabold text-white shadow-lg shadow-pink-300 active:scale-95"
      >
        <Plus size={22} /> やることを追加
      </button>

      {fx?.big && <Confetti key={fx.id} />}

      {toast && (
        <div className="tq-pop fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-slate-800 px-4 py-3 text-sm text-white shadow-lg">
          <span>{toast.text}</span>
          {toast.undo && (
            <button
              onClick={() => {
                setState(toast.undo!);
                setToast(null);
              }}
              className="flex shrink-0 items-center gap-1 font-bold text-pink-300"
            >
              <Undo2 size={16} /> もどす
            </button>
          )}
        </div>
      )}

      {levelUp && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-6" onClick={() => setLevelUp(null)}>
          <div className="tq-pop w-full max-w-xs rounded-3xl bg-white p-6 text-center shadow-xl">
            <div className="text-5xl">🎊</div>
            <div className="mt-2 text-sm font-bold text-pink-500">レベルアップ！</div>
            <div className="text-3xl font-extrabold">Lv.{levelUp}</div>
            <div className="mt-1 font-bold text-violet-600">「{titleOf(levelUp)}」</div>
            <p className="mt-3 text-sm text-slate-500">コツコツ続けてるの、ほんとうにすごい。</p>
            <button className="mt-4 w-full rounded-2xl bg-pink-500 py-3 font-bold text-white">やったー！</button>
          </div>
        </div>
      )}

      {sheet === 'add' && (
        <AddSheet
          draft={draft}
          onClose={() => {
            setSheet(draft ? 'members' : null);
            setDraft(null);
          }}
          onAdd={(tasks) => {
            update((s) => ({ ...s, tasks: [...s.tasks, ...tasks] }));
            sfx.confirm();
            if (draft) {
              void readMessages([draft.source.messageId]);
              setToast({ text: 'メンションをモンスターにしました！' });
            }
            setDraft(null);
            setSheet(tasks.some((t) => !t.sorted) ? 'sort' : null);
          }}
          today={today}
        />
      )}
      {sheet === 'members' && (
        <MembersSheet
          link={link}
          messages={messages}
          error={membersError}
          taskOf={(id) => state.tasks.find((t) => t.source?.messageId === id)}
          onClose={() => setSheet(null)}
          onLink={(l) => {
            saveLink(l);
            setLink(l);
            setMembersError('');
            if (!l) setMessages([]);
          }}
          onRefresh={() => void refreshMembers()}
          onRead={(ids) => void readMessages(ids)}
          onMakeTask={(m) => {
            sfx.select();
            setDraft({ title: suggestTitle(m), source: { kind: 'members', messageId: m.id, sender: m.senderName, url: safeUrl(m.url) } });
            setSheet('add');
          }}
        />
      )}
      {sheet === 'sort' && (
        <SortSheet
          tasks={unsorted}
          onClose={() => setSheet(null)}
          onSort={(id, due, size) => {
            sfx.select();
            patchTask(id, { dueDate: dueDateFor(due, today), size, sorted: true });
          }}
          onRemove={removeTask}
        />
      )}
      {detail && (
        <DetailSheet
          task={detail}
          today={today}
          onClose={() => setSheet(null)}
          onPatch={(p) => patchTask(detail.id, p)}
          onStep={(sid) => step(detail.id, sid)}
          onDefeat={() => {
            setSheet(null);
            defeat(detail.id);
          }}
          onRemove={() => {
            setSheet(null);
            removeTask(detail.id);
          }}
        />
      )}
      {focus && (
        <FocusSheet
          task={focus}
          onClose={() => setSheet(null)}
          onFinish={(defeated, fullTime) => {
            setSheet(null);
            const r = fullTime ? focusBonus(state, new Date()) : { state, coins: 0 };
            if (defeated) {
              const d = defeatTask(r.state, focus.id, new Date());
              apply(state, { ...d, coins: d.coins + r.coins, levelUp: levelOf(d.state.player.exp).level > lv.level }, focus.id);
            } else {
              sfx.coin();
              setState(r.state);
              setToast({ text: `集中おつかれさま！ +${r.coins}コイン` });
            }
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// つぎのあいて（大きいカード）
// ------------------------------------------------------------
function NextCard(props: {
  task: Task;
  today: string;
  hit: boolean;
  poof: boolean;
  fx: Fx | null;
  onDefeat: () => void;
  onStep: (id: string) => void;
  onOpen: () => void;
  onFocus: () => void;
}) {
  const { task, today } = props;
  const bucket = bucketOf(task, today);
  const nextStep = task.steps.find((s) => !s.done);
  const big = task.size !== 'S' && !task.steps.length;
  return (
    <div className="relative overflow-hidden rounded-3xl bg-white p-5 shadow-md shadow-pink-100">
      <div className="relative mx-auto grid h-36 w-36 place-items-center">
        <div className="absolute bottom-2 h-4 w-24 rounded-full bg-slate-200/70 blur-[1px]" />
        <div className={props.poof ? 'tq-poof' : props.hit ? 'tq-hit' : 'tq-bob'}>
          <Monster size={task.size} px={task.size === 'S' ? 104 : task.size === 'M' ? 120 : 136} angry={bucket === 'over'} />
        </div>
        {props.fx && (
          <span key={props.fx.id} className="tq-float absolute top-2 left-1/2 flex items-center gap-1 text-2xl font-extrabold text-amber-500 drop-shadow">
            <Coins size={22} /> +{props.fx.coins}
          </span>
        )}
      </div>
      <div className="mt-2 text-center">
        <div className="flex items-center justify-center gap-2">
          <DueChip bucket={bucket} />
          <span className="text-xs text-slate-400">{SIZES[task.size].name}</span>
        </div>
        <button onClick={props.onOpen} className="mt-1 text-xl font-extrabold break-all">
          {task.title}
        </button>
        <div className="mt-1">
          <Hearts task={task} />
        </div>
        {bucket === 'over' && <p className="mt-1 text-xs text-rose-500">期限すぎてるけど大丈夫。今からやれば、それでOK！</p>}
      </div>

      {nextStep ? (
        <div className="mt-4 rounded-2xl bg-pink-50 p-3">
          <div className="text-xs font-bold text-pink-500">まずはここだけ 👉</div>
          <div className="mt-1 flex items-center gap-3">
            <span className="flex-1 font-bold">{nextStep.text}</span>
            <button onClick={() => props.onStep(nextStep.id)} className="rounded-xl bg-pink-500 px-4 py-2 text-sm font-extrabold text-white active:scale-95">
              できた！
            </button>
          </div>
        </div>
      ) : (
        <button onClick={props.onDefeat} className="mt-4 w-full rounded-2xl bg-pink-500 py-3.5 text-lg font-extrabold text-white shadow-md shadow-pink-200 active:scale-95">
          ⚔️ たおした！（おわった）
        </button>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={props.onFocus} className="flex items-center justify-center gap-1 rounded-2xl bg-violet-50 py-2.5 text-sm font-bold text-violet-600">
          <Timer size={16} /> 15分だけやる
        </button>
        <button onClick={props.onOpen} className="flex items-center justify-center gap-1 rounded-2xl bg-sky-50 py-2.5 text-sm font-bold text-sky-600">
          <Wand2 size={16} /> {task.steps.length ? 'ステップを見る' : '小分けにする'}
        </button>
      </div>
      {big && <p className="mt-2 text-center text-xs text-slate-400">💡 大きいモンスターは「小分け」にすると、少しずつ削れて気がラク</p>}
    </div>
  );
}

// ------------------------------------------------------------
// 今週のスタンプ
// ------------------------------------------------------------
function WeekStamps({ log, today }: { log: Record<string, number>; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() - 6 + i);
    const key = dateStr(d);
    return { key, label: '日月火水木金土'[d.getDay()], n: log[key] ?? 0 };
  });
  return (
    <section className="mt-6 rounded-3xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-extrabold text-slate-500">この1週間のスタンプ</h2>
      <div className="grid grid-cols-7 gap-1 text-center">
        {days.map((d) => (
          <div key={d.key}>
            <div className={`text-[11px] font-bold ${d.key === today ? 'text-pink-500' : 'text-slate-400'}`}>{d.label}</div>
            <div
              className={`mx-auto mt-1 grid h-10 w-10 place-items-center rounded-full text-lg ${
                d.n >= DAILY_GOAL ? 'bg-amber-100' : d.n > 0 ? 'bg-pink-50' : 'border-2 border-dashed border-slate-200'
              }`}
            >
              {d.n >= DAILY_GOAL ? '👑' : d.n > 0 ? '🌸' : ''}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">🌸 1体以上たおした日　👑 目標（{DAILY_GOAL}体）クリアの日</p>
    </section>
  );
}

// ------------------------------------------------------------
// 追加：1つずつ / まとめて書き出す
// ------------------------------------------------------------
function AddSheet({ onClose, onAdd, today, draft }: { onClose: () => void; onAdd: (t: Task[]) => void; today: string; draft: { title: string; source: TaskSource } | null }) {
  const [mode, setMode] = useState<'one' | 'dump'>('one');
  const [title, setTitle] = useState(draft?.title ?? '');
  const [due, setDue] = useState<Due>('today');
  const [size, setSize] = useState<Size>('S');
  const [dump, setDump] = useState('');
  const lines = splitLines(dump);
  return (
    <Sheet title={draft ? 'メンションをモンスターにする' : 'モンスターを追加'} onClose={onClose}>
      <div className={`mb-4 grid-cols-2 rounded-2xl bg-slate-100 p-1 text-sm font-bold ${draft ? 'hidden' : 'grid'}`}>
        {(
          [
            ['one', '1つずつ'],
            ['dump', 'まとめて書き出す'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} onClick={() => setMode(id)} className={`rounded-xl py-2 ${mode === id ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>
      {mode === 'one' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            onAdd([newTask(title, due, size, today, new Date(), true, draft?.source)]);
          }}
          className="space-y-4"
        >
          {draft && <p className="rounded-2xl bg-sky-50 p-3 text-xs text-sky-800">{draft.source.sender}さんからのメンションです。やることがわかるように、名前を書きかえてもOK。</p>}
          <label className="block">
            <span className="text-sm font-bold">なにをする？</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：〇〇さんにメールを返す"
              className="mt-1 w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-base outline-none focus:border-pink-300"
            />
          </label>
          <div>
            <span className="text-sm font-bold">いつまで？</span>
            <div className="mt-1">
              <ChoiceRow options={DUES} value={due} onChange={setDue} />
            </div>
          </div>
          <div>
            <span className="text-sm font-bold">どれくらい大変そう？（なんとなくでOK）</span>
            <div className="mt-1">
              <ChoiceRow options={SIZE_OPTIONS} value={size} onChange={setSize} />
            </div>
          </div>
          <button disabled={!title.trim()} className="w-full rounded-2xl bg-pink-500 py-3.5 font-extrabold text-white disabled:opacity-40">
            追加する
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">頭の中にあることを、思いつくまま1行ずつ書き出してね。順番も大きさも気にしなくてOK。仕分けはあとで一緒にやろう。</p>
          <textarea
            autoFocus
            value={dump}
            onChange={(e) => setDump(e.target.value)}
            rows={7}
            placeholder={'見積もりの修正\n会議の資料\n経費精算\n〇〇さんに電話'}
            className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-base outline-none focus:border-pink-300"
          />
          <button
            disabled={!lines.length}
            onClick={() => onAdd(lines.map((l) => newTask(l, 'week', 'M', today, new Date(), false)))}
            className="w-full rounded-2xl bg-pink-500 py-3.5 font-extrabold text-white disabled:opacity-40"
          >
            {lines.length ? `${lines.length}体を仕分けにすすむ` : '書き出してね'}
          </button>
        </div>
      )}
    </Sheet>
  );
}

// ------------------------------------------------------------
// 仕分け：1枚ずつ「いつまで？」「大きさは？」を聞くだけ
// ------------------------------------------------------------
function SortSheet({ tasks, onClose, onSort, onRemove }: { tasks: Task[]; onClose: () => void; onSort: (id: string, due: Due, size: Size) => void; onRemove: (id: string) => void }) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const [due, setDue] = useState<Due | null>(null);
  const queue = tasks.filter((t) => !skipped.includes(t.id));
  const t = queue[0];
  useEffect(() => {
    if (!t) onClose();
  }, [t, onClose]);
  if (!t) return null;
  return (
    <Sheet title={`仕分けタイム（のこり${queue.length}体）`} onClose={onClose}>
      <div key={t.id} className="tq-pop text-center">
        <Monster size="M" px={72} className="mx-auto" />
        <div className="mt-2 text-xl font-extrabold break-all">{t.title}</div>
      </div>
      <div className="mt-5 space-y-4">
        <div>
          <span className="text-sm font-bold">① いつまでにやる？</span>
          <div className="mt-1">
            <ChoiceRow options={DUES} value={due} onChange={setDue} />
          </div>
        </div>
        <div className={due ? '' : 'pointer-events-none opacity-40'}>
          <span className="text-sm font-bold">② どれくらい大変そう？</span>
          <div className="mt-1">
            <ChoiceRow
              options={SIZE_OPTIONS}
              value={null}
              onChange={(size) => {
                onSort(t.id, due!, size);
                setDue(null);
              }}
            />
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-between text-sm">
        <button onClick={() => onRemove(t.id)} className="font-bold text-slate-400">
          やらなくていい
        </button>
        <button
          onClick={() => {
            setSkipped((s) => [...s, t.id]);
            setDue(null);
          }}
          className="font-bold text-slate-400"
        >
          あとで決める →
        </button>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------
// くわしく：名前・期限・大きさ・ステップ
// ------------------------------------------------------------
function DetailSheet(props: {
  task: Task;
  today: string;
  onClose: () => void;
  onPatch: (p: Partial<Task>) => void;
  onStep: (id: string) => void;
  onDefeat: () => void;
  onRemove: () => void;
}) {
  const { task, today, onPatch } = props;
  const [text, setText] = useState('');
  const addStep = (s: string) => {
    if (!s.trim()) return;
    onPatch({ steps: [...task.steps, { id: uid(), text: s.trim(), done: false }] });
    setText('');
  };
  return (
    <Sheet title={<span className="flex items-center gap-2"><Monster size={task.size} px={32} /> モンスターの情報</span>} onClose={props.onClose}>
      <div className="space-y-4">
        <input
          value={task.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          onBlur={(e) => !e.target.value.trim() && onPatch({ title: '（名前なし）' })}
          className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-base font-bold outline-none focus:border-pink-300"
        />
        <div>
          <span className="text-sm font-bold">いつまで？</span>
          <div className="mt-1">
            <ChoiceRow options={DUES} value={dueOf(task, today)} onChange={(d) => onPatch({ dueDate: dueDateFor(d, today) })} />
          </div>
        </div>
        <div>
          <span className="text-sm font-bold">大きさ</span>
          <div className="mt-1">
            <ChoiceRow options={SIZE_OPTIONS} value={task.size} onChange={(size) => onPatch({ size })} />
          </div>
        </div>

        <div className="rounded-2xl bg-sky-50 p-3">
          <div className="flex items-center gap-1 text-sm font-extrabold text-sky-700">
            <Sparkles size={16} /> 小分けにする（1つできるたびに +{STEP_COINS}コイン）
          </div>
          {task.steps.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {task.steps.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <button
                    onClick={() => props.onStep(s.id)}
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${s.done ? 'border-emerald-400 bg-emerald-400 text-white' : 'border-sky-300 bg-white'}`}
                    aria-label={s.done ? 'もどす' : 'できた'}
                  >
                    {s.done && <Check size={16} />}
                  </button>
                  <span className={`flex-1 text-sm ${s.done ? 'text-slate-400 line-through' : 'font-bold'}`}>{s.text}</span>
                  <button onClick={() => onPatch({ steps: task.steps.filter((x) => x.id !== s.id) })} className="p-1 text-slate-300" aria-label="ステップを消す">
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addStep(text);
            }}
            className="mt-2 flex gap-2"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="小さな一歩を書く"
              className="min-w-0 flex-1 rounded-xl border-2 border-sky-200 bg-white px-3 py-2 text-base outline-none focus:border-sky-400"
            />
            <button className="rounded-xl bg-sky-500 px-3 font-bold text-white" aria-label="ステップを追加">
              <Plus size={18} />
            </button>
          </form>
          <div className="mt-2 text-[11px] font-bold text-sky-600">思いつかないときは、タップで追加 👇</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {STEP_IDEAS.filter((i) => !task.steps.some((s) => s.text === i)).map((i) => (
              <button key={i} onClick={() => addStep(i)} className="rounded-full border border-sky-200 bg-white px-2.5 py-1 text-xs text-sky-700">
                + {i}
              </button>
            ))}
          </div>
        </div>

        {task.source && (
          <p className="flex items-center justify-between gap-2 rounded-2xl bg-sky-50 p-3 text-xs text-sky-800">
            <span>📨 {task.source.sender}さんからのメンバーズのメンション</span>
            {task.source.url && (
              <a href={task.source.url} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 font-bold text-sky-600">
                開く <ExternalLink size={14} />
              </a>
            )}
          </p>
        )}
        <button onClick={props.onDefeat} className="w-full rounded-2xl bg-pink-500 py-3.5 font-extrabold text-white">
          ⚔️ たおした！（おわった）
        </button>
        <button onClick={props.onRemove} className="flex w-full items-center justify-center gap-1 py-1 text-sm font-bold text-slate-400">
          <Trash2 size={14} /> にがす（やらなくていいことにする）
        </button>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------
// メンバーズ：メンションベルが受け取ったメンションを見る・タスクにする
// ------------------------------------------------------------
const timeOf = (iso: string) => {
  const d = new Date(iso);
  const same = dateStr(d) === dateStr(new Date());
  return new Intl.DateTimeFormat('ja-JP', same ? { hour: '2-digit', minute: '2-digit' } : { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
};

function MembersSheet(props: {
  link: MembersLink | null;
  messages: MembersMessage[];
  error: string;
  taskOf: (messageId: string) => Task | undefined;
  onClose: () => void;
  onLink: (l: MembersLink | null) => void;
  onRefresh: () => void;
  onRead: (ids: string[]) => void;
  onMakeTask: (m: MembersMessage) => void;
}) {
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [showRead, setShowRead] = useState(false);
  const unread = props.messages.filter((m) => !m.readAt);
  const shown = showRead ? props.messages : unread;

  if (!props.link) {
    return (
      <Sheet title="📨 メンバーズ連携" onClose={props.onClose}>
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">メンバーズで自分あて・ALLのメンションが届いたら、ここで確認して、そのままモンスター（タスク）にできます。</p>
          <ol className="list-decimal space-y-1 rounded-2xl bg-sky-50 p-3 pl-7 text-xs text-sky-900">
            <li>メンションベルを開いて「⚙️ 通知と連携の設定」→「タスククエストとの連携」</li>
            <li>「連携コードを発行する」→「連携コードをコピー」</li>
            <li>下に貼りつけて「連携する」</li>
          </ol>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={3}
            placeholder="TQ1. から始まる連携コード"
            className="w-full rounded-2xl border-2 border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-sky-300"
          />
          {codeError && <p className="text-xs text-rose-600">{codeError}</p>}
          <button
            disabled={!code.trim()}
            onClick={() => {
              const l = parseLinkCode(code);
              if (!l) return setCodeError('連携コードの形がちがうみたい。メンションベルでコピーしたものを、そのまま貼ってね。');
              sfx.confirm();
              props.onLink(l);
            }}
            className="w-full rounded-2xl bg-sky-500 py-3 font-extrabold text-white disabled:opacity-40"
          >
            連携する
          </button>
          <p className="text-[11px] text-slate-400">連携コードはこのブラウザの中だけに保存します。ほかの人には教えないでね。</p>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="📨 メンバーズのメンション" onClose={props.onClose}>
      {props.error && (
        <div className="mb-3 rounded-2xl bg-amber-50 p-3 text-xs text-amber-800">
          {props.error}
          <button onClick={props.onRefresh} className="ml-2 font-bold underline">
            もう一度
          </button>
        </div>
      )}
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="font-bold text-slate-500">{unread.length ? `未読 ${unread.length}件` : '未読はありません ✨'}</span>
        <span className="flex gap-3">
          <button onClick={() => setShowRead((v) => !v)} className="font-bold text-sky-600">
            {showRead ? '未読だけ' : '既読も見る'}
          </button>
          {unread.length > 1 && (
            <button onClick={() => props.onRead(unread.map((m) => m.id))} className="font-bold text-slate-400">
              全部既読
            </button>
          )}
        </span>
      </div>
      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">{props.messages.length ? 'ぜんぶ確認ずみ！' : 'まだメンションは届いていません'}</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((m) => {
            const task = props.taskOf(m.id);
            const url = safeUrl(m.url);
            return (
              <li key={m.id} className={`rounded-2xl p-3 ring-1 ${m.readAt ? 'bg-white ring-slate-100' : 'bg-sky-50/60 ring-sky-200'}`}>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-bold ${m.mention === 'me' ? 'bg-pink-100 text-pink-600' : 'bg-slate-100 text-slate-500'}`}>{m.mention === 'me' ? '自分あて' : 'ALL'}</span>
                  <span className="min-w-0 flex-1 truncate font-bold">{m.senderName}さん</span>
                  <span className="shrink-0 text-slate-400">{timeOf(m.sentAt)}</span>
                </div>
                {m.chatName && <div className="mt-1 truncate text-[11px] text-slate-400">{m.chatName}</div>}
                <p className="mt-1 line-clamp-4 text-sm break-all whitespace-pre-wrap">{m.body || '（ファイルが届きました）'}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {task ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">{task.doneAt ? '✓ たおしたよ' : '⚔️ モンスターになってるよ'}</span>
                  ) : (
                    <button onClick={() => props.onMakeTask(m)} className="rounded-full bg-pink-500 px-3 py-1.5 text-xs font-extrabold text-white">
                      ⚔️ タスクにする
                    </button>
                  )}
                  {!m.readAt && (
                    <button onClick={() => props.onRead([m.id])} className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                      <MailCheck size={14} /> 既読にする
                    </button>
                  )}
                  {url && (
                    <a href={url} target="_blank" rel="noreferrer" onClick={() => !m.readAt && props.onRead([m.id])} className="flex items-center gap-1 px-1 text-xs font-bold text-sky-600">
                      メンバーズで開く <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4 flex justify-between text-[11px] text-slate-400">
        <span>1分ごとに新しいメンションを確認します</span>
        <button
          onClick={() => {
            props.onLink(null);
            props.onClose();
          }}
          className="underline"
        >
          このブラウザの連携をやめる
        </button>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------
// 集中バトル：15分（または5分）だけ、このモンスターに向き合う
// ------------------------------------------------------------
function FocusSheet({ task, onClose, onFinish }: { task: Task; onClose: () => void; onFinish: (defeated: boolean, fullTime: boolean) => void }) {
  const [minutes, setMinutes] = useState<number | null>(null);
  const [endAt, setEndAt] = useState(0);
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!minutes) return;
    const tick = () => setLeft(Math.max(0, endAt - Date.now()));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [minutes, endAt]);
  const done = !!minutes && left === 0;
  useEffect(() => {
    if (done) sfx.levelUp();
  }, [done]);

  const total = (minutes ?? 15) * 60_000;
  const ratio = minutes ? left / total : 1;
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);
  return (
    <Sheet title="集中バトル" onClose={onClose}>
      <div className="text-center">
        <div className="relative mx-auto h-48 w-48">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#fce7f3" strokeWidth="7" />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#ec4899"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 45}
              strokeDashoffset={2 * Math.PI * 45 * (1 - ratio)}
              className="transition-[stroke-dashoffset] duration-300"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className={done ? 'tq-pop' : 'tq-bob'}>
              <Monster size={task.size} px={96} />
            </div>
          </div>
        </div>
        <div className="mt-2 font-extrabold break-all">{task.title}</div>
        {!minutes ? (
          <>
            <p className="mt-3 text-sm text-slate-500">全部やろうとしなくてOK。時間がくるまで、これだけに集中してみよう。</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[5, 15].map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    sfx.confirm();
                    setMinutes(m);
                    setEndAt(Date.now() + m * 60_000);
                  }}
                  className={`rounded-2xl py-3.5 font-extrabold ${m === 15 ? 'bg-pink-500 text-white' : 'bg-pink-50 text-pink-600'}`}
                >
                  {m === 5 ? '5分だけ' : '15分やる'}
                </button>
              ))}
            </div>
          </>
        ) : done ? (
          <>
            <p className="mt-3 font-bold text-pink-500">時間だよ！よくがんばったね ✨</p>
            <div className="mt-4 grid gap-2">
              <button onClick={() => onFinish(true, true)} className="rounded-2xl bg-pink-500 py-3.5 font-extrabold text-white">
                ⚔️ たおせた！
              </button>
              <button onClick={() => onFinish(false, true)} className="rounded-2xl bg-violet-50 py-3 font-bold text-violet-600">
                まだ途中（コインだけもらう）
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-2 text-4xl font-extrabold text-pink-500 tabular-nums">
              {mm}:{String(ss).padStart(2, '0')}
            </div>
            <div className="mt-4 grid gap-2">
              <button onClick={() => onFinish(true, false)} className="rounded-2xl bg-pink-500 py-3 font-extrabold text-white">
                もう終わった！
              </button>
              <button onClick={onClose} className="py-2 text-sm font-bold text-slate-400">
                ここまでにする（それでもえらい）
              </button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
