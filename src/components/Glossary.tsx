import { useEffect, useMemo, useRef, useState } from 'react';
import { BookA, CheckCircle2, ChevronRight, Coins, GraduationCap, Library, Lock, Sparkles, X } from 'lucide-react';
import { GLOSSARY, GLOSSARY_CATEGORIES } from '../data/glossary';
import { LECTURES } from '../data/lectures';
import type { GlossaryCategoryId, GlossaryTerm } from '../data/types';
import { computeHensachi, hensachiRank, HENSACHI_MAX, HENSACHI_MIN } from '../data/hensachi';
import { TERM_REWARD, useGame } from '../store/gameStore';
import { Bar, PixelTitle } from './ui';
import { sfx } from '../audio/sfx';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 現在の営業偏差値 */
export function useHensachi(): number {
  const lectures = useGame((s) => s.completedLectures.length);
  const mastered = useGame((s) => s.masteredTerms.length);
  const answered = useGame((s) => s.glossaryStats.answered);
  const correct = useGame((s) => s.glossaryStats.correct);
  return computeHensachi({ lectures, totalLectures: LECTURES.length, mastered, totalTerms: GLOSSARY.length, answered, correct });
}

/** 学園バナー用：偏差値メーター */
export function HensachiMeter() {
  const h = useHensachi();
  const rank = hensachiRank(h);
  return (
    <div className="rounded-xl bg-black/30 p-3 ring-1 ring-white/10">
      <div className="flex items-end gap-3">
        <div>
          <div className="text-[11px] font-bold text-indigo-200">営業偏差値</div>
          <div className="font-pixel text-4xl leading-none tabular-nums" style={{ color: rank.color }}>
            {h.toFixed(1)}
          </div>
        </div>
        <div className="pb-0.5">
          <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-night-950" style={{ background: rank.color }}>
            {rank.label}
          </span>
        </div>
      </div>
      <Bar value={h - HENSACHI_MIN} max={HENSACHI_MAX - HENSACHI_MIN} color={`linear-gradient(90deg,#60a5fa,${rank.color})`} className="mt-2" />
      <p className="mt-1.5 text-[11px] leading-relaxed text-indigo-200/80">
        虎の巻の習得・業界用語の習得・用語テストの正答率で上がります（最大{HENSACHI_MAX}）。
      </p>
    </div>
  );
}

/** 学園に置く「業界用語集」セクション */
export function GlossarySection() {
  const mastered = useGame((s) => s.masteredTerms);
  const [quiz, setQuiz] = useState<GlossaryCategoryId | null>(null);
  const [book, setBook] = useState<GlossaryCategoryId | null>(null);
  const total = GLOSSARY.length;

  return (
    <section className="mt-6">
      <div className="flex items-end justify-between gap-2">
        <div className="flex items-center gap-2">
          <Library className="h-5 w-5 text-gold-300" />
          <PixelTitle className="text-lg text-gold-300">業界用語集</PixelTitle>
        </div>
        <span className="text-xs tabular-nums text-indigo-200">
          習得 {mastered.length}/{total}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-indigo-200/90">
        4択の用語テストに初めて正解すると <b className="text-sky-300">+{TERM_REWARD.exp} EXP</b>・<b className="text-gold-300">+{TERM_REWARD.gold} G</b>。
        正解した用語は図鑑で意味と使いどころを読み返せます。
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {GLOSSARY_CATEGORIES.map((c) => {
          const terms = GLOSSARY.filter((t) => t.category === c.id);
          const done = terms.filter((t) => mastered.includes(t.id)).length;
          const complete = done === terms.length && terms.length > 0;
          return (
            <div key={c.id} className="rpg-window p-3">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black">{c.name}</div>
                  <div className="truncate text-[11px] text-indigo-200/80">{c.description}</div>
                </div>
                {complete ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" aria-label="全問習得" />
                ) : (
                  <span className="shrink-0 text-xs tabular-nums text-indigo-200">
                    {done}/{terms.length}
                  </span>
                )}
              </div>
              <Bar value={done} max={terms.length} color="linear-gradient(90deg,#34d399,#a7f3d0)" height="h-1.5" className="mt-2" />
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={() => {
                    sfx.confirm();
                    setQuiz(c.id);
                  }}
                  className="flex flex-[1.4] items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 py-2 text-xs font-bold"
                >
                  <GraduationCap className="h-4 w-4" /> 用語テスト
                </button>
                <button
                  onClick={() => {
                    sfx.select();
                    setBook(c.id);
                  }}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/10 py-2 text-xs font-bold"
                >
                  <BookA className="h-4 w-4" /> 図鑑
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {quiz && <GlossaryQuiz category={quiz} onClose={() => setQuiz(null)} />}
      {book && <GlossaryBook category={book} onClose={() => setBook(null)} />}
    </section>
  );
}

// ============================================================
// 用語テスト
// ============================================================
function GlossaryQuiz({ category, onClose }: { category: GlossaryCategoryId; onClose: () => void }) {
  const answerTerm = useGame((s) => s.answerTerm);
  const setLectureOpen = useGame((s) => s.setLectureOpen);
  const hensachi = useHensachi();
  const cat = GLOSSARY_CATEGORIES.find((c) => c.id === category)!;

  // 未習得の用語を先に、その後に習得済みを出題する（最大6問）
  const [questions] = useState(() => {
    const m = useGame.getState().masteredTerms;
    const terms = GLOSSARY.filter((t) => t.category === category);
    const fresh = shuffle(terms.filter((t) => !m.includes(t.id)));
    const known = shuffle(terms.filter((t) => m.includes(t.id)));
    return [...fresh, ...known].slice(0, 6).map((t) => ({
      term: t,
      options: shuffle([
        { text: t.meaning, correct: true },
        ...t.distractors.map((d) => ({ text: d, correct: false })),
      ]),
    }));
  });
  const [startHensachi] = useState(hensachi);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [earned, setEarned] = useState({ exp: 0, gold: 0, levelUp: false, newTerms: 0 });
  const [done, setDone] = useState(false);

  // テスト中はレベルアップ演出を保留（終了後に表示）
  useEffect(() => {
    setLectureOpen(true);
    return () => setLectureOpen(false);
  }, [setLectureOpen]);

  const q = questions[idx];
  const feedbackRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // 次の問題に進んだら先頭へ
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [idx, done]);
  // 回答したら解説と「次へ」ボタンまで自動でスクロール
  useEffect(() => {
    if (picked !== null) feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [picked]);

  const answer = (i: number) => {
    if (picked !== null || !q) return;
    setPicked(i);
    const ok = q.options[i].correct;
    const res = answerTerm(q.term.id, ok);
    if (ok) {
      setScore((s) => s + 1);
      sfx.critical();
      if (res) {
        setTimeout(() => sfx.coin(), 350);
        setEarned((e) => ({ exp: e.exp + res.exp, gold: e.gold + res.gold, levelUp: e.levelUp || !!res.levelUp, newTerms: e.newTerms + 1 }));
      }
    } else {
      sfx.hurt();
    }
  };

  const next = () => {
    sfx.page();
    setPicked(null);
    if (idx + 1 >= questions.length) {
      setDone(true);
      sfx.victory();
    } else setIdx(idx + 1);
  };

  const close = () => {
    sfx.cancel();
    onClose();
  };

  return (
    <div className="bg-sky fixed inset-0 z-40 flex flex-col">
      <div className="safe-top safe-x border-b border-white/10 bg-night-900/90">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2">
          <button onClick={close} className="grid h-9 w-9 place-items-center rounded-full bg-black/40 ring-1 ring-white/20" aria-label="閉じる">
            <X className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="font-pixel text-[11px] text-gold-300">用語テスト</div>
            <div className="truncate text-sm font-bold">{cat.name}</div>
          </div>
          {!done && (
            <span className="font-pixel text-xs tabular-nums text-indigo-200">
              {idx + 1}/{questions.length}
            </span>
          )}
        </div>
        <div className="mx-auto flex max-w-3xl gap-1 px-3 pb-2">
          {questions.map((_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${done || i < idx ? 'bg-gold-400' : i === idx ? 'bg-gold-400/60' : 'bg-white/15'}`} />
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="safe-x flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto max-w-3xl px-4 py-5">
          {!done && q && (
            <div key={idx} className="anim-slide-up">
              <p className="text-xs font-bold text-indigo-200">次の用語の意味として正しいものは？</p>
              <div className="rpg-window-gold mt-2 px-4 py-3 text-center">
                <div className="font-pixel text-2xl text-gold-300">{q.term.term}</div>
                {/* 読み・訳語は答えのヒントになるので回答後に表示 */}
                {q.term.reading && picked !== null && <div className="mt-0.5 text-xs text-amber-100/80">{q.term.reading}</div>}
              </div>
              <div className="mt-4 grid gap-2">
                {q.options.map((o, i) => {
                  const state = picked === null ? 'none' : o.correct ? 'ok' : picked === i ? 'ng' : 'dim';
                  return (
                    <button
                      key={i}
                      disabled={picked !== null}
                      onClick={() => answer(i)}
                      className={`flex items-start gap-2 rounded-xl border-2 p-3 text-left text-sm leading-relaxed transition-colors ${
                        state === 'ok'
                          ? 'border-emerald-300 bg-emerald-700/40'
                          : state === 'ng'
                            ? 'anim-shake border-rose-400 bg-rose-900/40'
                            : state === 'dim'
                              ? 'border-white/10 bg-night-800/60 text-white/50'
                              : 'border-white/20 bg-night-800/80 hover:border-gold-400'
                      }`}
                    >
                      <span className="font-pixel grid h-6 w-6 shrink-0 place-items-center rounded bg-gold-400 text-xs text-night-950">{'ABCD'[i]}</span>
                      <span>{o.text}</span>
                    </button>
                  );
                })}
              </div>
              {picked !== null && (
                <div ref={feedbackRef} className="anim-pop mt-4 scroll-mb-4">
                  <div
                    className={`rounded-xl p-3 text-sm leading-relaxed ${
                      q.options[picked].correct ? 'bg-emerald-900/50 text-emerald-50' : 'bg-rose-900/50 text-rose-50'
                    }`}
                  >
                    <div className="mb-1 font-bold">{q.options[picked].correct ? '正解！' : `不正解… 正解は「${q.term.meaning}」`}</div>
                    <div className="text-[13px] opacity-95">{q.term.detail}</div>
                  </div>
                  <button onClick={next} className="mt-3 w-full rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 py-3 text-sm font-bold">
                    {idx + 1 >= questions.length ? '結果を見る' : '次の問題へ'}
                  </button>
                </div>
              )}
            </div>
          )}

          {done && (
            <div className="rpg-window-gold anim-pop p-5 text-center">
              <div className="font-pixel text-2xl text-shine">テスト終了！</div>
              <div className="mt-2 text-lg font-black">
                {score} / {questions.length} 問正解
              </div>
              <div className="mt-3 rounded-lg bg-black/30 p-3">
                <div className="text-xs text-amber-100">営業偏差値</div>
                <div className="font-pixel text-3xl tabular-nums text-gold-300">
                  {startHensachi.toFixed(1)} → {hensachi.toFixed(1)}
                </div>
                {hensachi > startHensachi && <div className="text-sm font-bold text-emerald-300">+{(hensachi - startHensachi).toFixed(1)} UP!</div>}
              </div>
              {earned.newTerms > 0 ? (
                <div className="mt-3 flex justify-center gap-4 text-sm font-bold">
                  <span className="text-emerald-300">新たに習得 {earned.newTerms}語</span>
                  <span className="flex items-center gap-1 text-sky-300">
                    <Sparkles className="h-4 w-4" />+{earned.exp} EXP
                  </span>
                  <span className="flex items-center gap-1 text-gold-300">
                    <Coins className="h-4 w-4" />+{earned.gold} G
                  </span>
                </div>
              ) : (
                <p className="mt-3 text-xs text-amber-100/80">復習完了（EXPは初めて正解した用語のみ）</p>
              )}
              {earned.levelUp && <div className="font-pixel mt-2 animate-pulse text-lg text-rose-300">LEVEL UP!</div>}
              <button
                onClick={close}
                className="mt-4 w-full rounded-lg bg-gradient-to-r from-gold-500 to-orange-500 py-3 text-sm font-bold text-night-950"
              >
                学園に戻る
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 用語図鑑（習得済みの用語だけ意味を表示）
// ============================================================
function GlossaryBook({ category, onClose }: { category: GlossaryCategoryId; onClose: () => void }) {
  const mastered = useGame((s) => s.masteredTerms);
  const cat = GLOSSARY_CATEGORIES.find((c) => c.id === category)!;
  const terms: GlossaryTerm[] = useMemo(() => GLOSSARY.filter((t) => t.category === category), [category]);

  return (
    <div className="bg-sky fixed inset-0 z-40 flex flex-col">
      <div className="safe-top safe-x border-b border-white/10 bg-night-900/90">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2">
          <button
            onClick={() => {
              sfx.cancel();
              onClose();
            }}
            className="grid h-9 w-9 place-items-center rounded-full bg-black/40 ring-1 ring-white/20"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="font-pixel text-[11px] text-gold-300">用語図鑑</div>
            <div className="truncate text-sm font-bold">{cat.name}</div>
          </div>
        </div>
      </div>
      <div className="safe-x flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto grid max-w-3xl gap-2.5 px-4 py-4">
          {terms.map((t) => {
            const ok = mastered.includes(t.id);
            return (
              <article key={t.id} className={`rpg-window p-3 ${ok ? '' : 'opacity-70'}`}>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-base font-black text-gold-300">{t.term}</h3>
                  {t.reading && <span className="text-[11px] text-indigo-200">{t.reading}</span>}
                </div>
                {ok ? (
                  <>
                    <p className="mt-1 text-sm font-bold leading-relaxed">{t.meaning}</p>
                    <p className="mt-1 text-xs leading-relaxed text-indigo-100/90">{t.detail}</p>
                  </>
                ) : (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-indigo-300">
                    <Lock className="h-3.5 w-3.5" /> 用語テストで正解すると意味と解説が解放されます
                  </p>
                )}
              </article>
            );
          })}
          <p className="flex items-center justify-center gap-1 pt-2 text-center text-[11px] text-indigo-300/70">
            <ChevronRight className="h-3 w-3" /> 図鑑は正解した用語から埋まっていきます
          </p>
        </div>
      </div>
    </div>
  );
}
