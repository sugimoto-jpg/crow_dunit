import { useEffect, useRef, useState } from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coins,
  Gem,
  GraduationCap,
  Lightbulb,
  Phone,
  Search,
  Sparkles,
  Swords,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { LECTURES } from '../data/lectures';
import type { Lecture } from '../data/types';
import { useGame, useLevel } from '../store/gameStore';
import { GUILD_UNLOCK_LEVEL } from '../data/levels';
import { Bar, PixelTitle } from '../components/ui';
import { sfx } from '../audio/sfx';
import { GlossarySection, HensachiMeter } from '../components/Glossary';

const ICONS = { phone: Phone, search: Search, gem: Gem } as const;

export function AcademyScreen() {
  const completed = useGame((s) => s.completedLectures);
  const setTab = useGame((s) => s.setTab);
  const level = useLevel();
  const [open, setOpen] = useState<Lecture | null>(null);
  const done = completed.length;

  return (
    <div className="mx-auto max-w-3xl px-3 pb-6 pt-4">
      {/* バナー */}
      <section className="rpg-window relative overflow-hidden p-4">
        <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-indigo-500/20 blur-2xl" />
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-700 ring-2 ring-white/30">
            <GraduationCap className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <PixelTitle className="text-xl text-gold-300">アイドマ学園</PixelTitle>
            <p className="mt-1 text-sm leading-relaxed text-indigo-100/90">
              営業の奥義「虎の巻」と業界用語を学ぶ座学の間。講義の確認問題や用語テストに正解すると、EXPとゴールドを獲得し、営業偏差値が上がる。
            </p>
          </div>
        </div>
        <div className="mt-4">
          <HensachiMeter />
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-indigo-200">
            <span>虎の巻 習得状況</span>
            <span className="tabular-nums">
              {done} / {LECTURES.length}
            </span>
          </div>
          <Bar value={done} max={LECTURES.length} color="linear-gradient(90deg,#ffd166,#f4b400)" />
        </div>
        {level < GUILD_UNLOCK_LEVEL ? (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2 text-xs text-indigo-100">
            <Swords className="h-4 w-4 shrink-0 text-rose-300" />
            Lv.{GUILD_UNLOCK_LEVEL} に到達すると「冒険者ギルド」が解放され、討伐に出撃できます。
          </p>
        ) : (
          <button
            onClick={() => {
              sfx.confirm();
              setTab('guild');
            }}
            className="anim-glow mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-rose-500 to-orange-500 px-3 py-2.5 text-sm font-bold"
          >
            <Swords className="h-4 w-4" />
            冒険者ギルドへ出撃する
          </button>
        )}
      </section>

      {/* 講義一覧 */}
      <div className="mt-5 grid gap-3 sm:grid-cols-1">
        {LECTURES.map((lec) => {
          const Icon = ICONS[lec.icon];
          const isDone = completed.includes(lec.id);
          return (
            <button
              key={lec.id}
              onClick={() => {
                sfx.confirm();
                setOpen(lec);
              }}
              className="rpg-window anim-slide-up group flex w-full items-center gap-3 p-3 text-left transition-transform active:scale-[0.98]"
            >
              <div
                className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl ring-2 ${
                  isDone ? 'bg-emerald-600/30 ring-emerald-300/60' : 'bg-indigo-600/30 ring-indigo-300/50'
                }`}
              >
                <Icon className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-pixel text-xs text-gold-300">虎の巻 其の{lec.chapter}</div>
                <div className="text-[15px] font-bold leading-snug">{lec.title}</div>
                <div className="mt-0.5 truncate text-xs text-indigo-200/80">{lec.subtitle}</div>
                <div className="mt-1.5 flex items-center gap-3 text-[11px]">
                  {isDone ? (
                    <span className="flex items-center gap-1 font-bold text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" /> 習得済み（復習可）
                    </span>
                  ) : (
                    <>
                      <span className="flex items-center gap-1 text-sky-300">
                        <Sparkles className="h-3.5 w-3.5" /> {lec.rewards.exp} EXP
                      </span>
                      <span className="flex items-center gap-1 text-gold-300">
                        <Coins className="h-3.5 w-3.5" /> {lec.rewards.gold} G
                      </span>
                    </>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-white/50 transition-transform group-hover:translate-x-0.5" />
            </button>
          );
        })}
      </div>

      <GlossarySection />

      {open && <LectureReader lecture={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

// ============================================================
// 講義リーダー（スワイプ対応スライド + 確認問題）
// ============================================================
function LectureReader({ lecture, onClose }: { lecture: Lecture; onClose: () => void }) {
  const completeLecture = useGame((s) => s.completeLecture);
  const setLectureOpen = useGame((s) => s.setLectureOpen);
  useEffect(() => {
    setLectureOpen(true);
    return () => setLectureOpen(false);
  }, [setLectureOpen]);
  const alreadyDone = useGame((s) => s.completedLectures.includes(lecture.id));
  const total = lecture.slides.length + 1; // +確認問題
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [reward, setReward] = useState<{ exp: number; gold: number; levelUp: boolean } | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const go = (n: number) => {
    const next = Math.max(0, Math.min(total - 1, n));
    if (next !== idx) {
      sfx.page();
      setIdx(next);
      scroller.current?.scrollTo({ top: 0 });
    }
  };

  const isQuiz = idx === lecture.slides.length;
  const slide = lecture.slides[idx];
  const correctPicked = picked !== null && lecture.quiz.choices[picked].correct;

  const answer = (i: number) => {
    if (correctPicked) return;
    setPicked(i);
    if (lecture.quiz.choices[i].correct) {
      sfx.critical();
      const res = completeLecture(lecture.id, lecture.rewards.exp, lecture.rewards.gold);
      if (res) {
        setTimeout(() => sfx.coin(), 500);
        setReward({ exp: res.exp, gold: res.gold, levelUp: !!res.levelUp });
      }
    } else {
      sfx.hurt();
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-sky">
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
            <div className="font-pixel text-[11px] text-gold-300">虎の巻 其の{lecture.chapter}</div>
            <div className="truncate text-sm font-bold">{lecture.title}</div>
          </div>
          <span className="font-pixel text-xs tabular-nums text-indigo-200">
            {idx + 1}/{total}
          </span>
        </div>
        <div className="mx-auto flex max-w-3xl gap-1 px-3 pb-2">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i <= idx ? 'bg-gold-400' : 'bg-white/15'}`} />
          ))}
        </div>
      </div>

      <div
        ref={scroller}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          if (!touch.current) return;
          const dx = e.changedTouches[0].clientX - touch.current.x;
          const dy = e.changedTouches[0].clientY - touch.current.y;
          touch.current = null;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(idx + (dx < 0 ? 1 : -1));
        }}
      >
        <div key={idx} className="anim-slide-up mx-auto max-w-3xl px-4 py-5">
          {!isQuiz ? (
            <article>
              <PixelTitle className="text-lg leading-snug text-gold-300">{slide.heading}</PixelTitle>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-indigo-50">
                {slide.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              {slide.point && (
                <div className="rpg-window-gold mt-5 flex gap-3 p-3">
                  <Lightbulb className="h-5 w-5 shrink-0 text-gold-300" />
                  <p className="text-sm font-bold leading-relaxed text-gold-300">{slide.point}</p>
                </div>
              )}
              {slide.example && (
                <div className="mt-5 grid gap-3">
                  <div className="rounded-xl border border-emerald-400/50 bg-emerald-900/30 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                      <ThumbsUp className="h-4 w-4" /> 刺さるトーク
                    </div>
                    <p className="text-sm leading-relaxed">{slide.example.good}</p>
                  </div>
                  <div className="rounded-xl border border-rose-400/50 bg-rose-900/30 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-rose-300">
                      <ThumbsDown className="h-4 w-4" /> 警戒されるトーク
                    </div>
                    <p className="text-sm leading-relaxed">{slide.example.bad}</p>
                  </div>
                </div>
              )}
              <p className="mt-6 text-center text-[11px] text-indigo-300/60">← スワイプでページ送り →</p>
            </article>
          ) : (
            <section>
              <div className="flex items-center gap-2">
                <BookOpenCheck className="h-6 w-6 text-gold-300" />
                <PixelTitle className="text-lg text-gold-300">確認問題</PixelTitle>
              </div>
              <p className="mt-3 text-[15px] font-bold leading-relaxed">{lecture.quiz.question}</p>
              <div className="mt-4 grid gap-2.5">
                {lecture.quiz.choices.map((c, i) => {
                  const state = picked === i ? (c.correct ? 'ok' : 'ng') : correctPicked && c.correct ? 'ok' : 'none';
                  return (
                    <button
                      key={i}
                      disabled={correctPicked}
                      onClick={() => answer(i)}
                      className={`rounded-xl border-2 p-3 text-left text-sm leading-relaxed transition-colors ${
                        state === 'ok'
                          ? 'border-emerald-300 bg-emerald-700/40'
                          : state === 'ng'
                            ? 'anim-shake border-rose-400 bg-rose-900/40'
                            : 'border-white/20 bg-night-800/80 hover:border-gold-400'
                      }`}
                    >
                      {c.text}
                    </button>
                  );
                })}
              </div>
              {picked !== null && (
                <div
                  className={`anim-pop mt-4 rounded-xl p-3 text-sm leading-relaxed ${
                    lecture.quiz.choices[picked].correct ? 'bg-emerald-900/50 text-emerald-100' : 'bg-rose-900/50 text-rose-100'
                  }`}
                >
                  {lecture.quiz.choices[picked].feedback}
                  {!lecture.quiz.choices[picked].correct && <div className="mt-1 text-xs opacity-80">もう一度選んでみよう。</div>}
                </div>
              )}
              {correctPicked && (
                <div className="rpg-window-gold anim-pop mt-5 p-4 text-center">
                  <div className="font-pixel text-lg text-shine">虎の巻 其の{lecture.chapter} 習得！</div>
                  {reward ? (
                    <div className="mt-2 flex justify-center gap-4 text-sm font-bold">
                      <span className="text-sky-300">+{reward.exp} EXP</span>
                      <span className="text-gold-300">+{reward.gold} G</span>
                    </div>
                  ) : (
                    alreadyDone && <div className="mt-1 text-xs text-indigo-200">復習完了（報酬は初回のみ）</div>
                  )}
                  {reward?.levelUp && <div className="mt-1 font-pixel text-rose-300">LEVEL UP!</div>}
                  <button
                    onClick={() => {
                      sfx.confirm();
                      onClose();
                    }}
                    className="mt-3 w-full rounded-lg bg-gradient-to-r from-gold-500 to-orange-500 py-2.5 text-sm font-bold text-night-950"
                  >
                    学園に戻る
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      <div className="safe-bottom safe-x border-t border-white/10 bg-night-900/95">
        <div className="mx-auto flex max-w-3xl gap-2 px-3 py-2">
          <button
            onClick={() => go(idx - 1)}
            disabled={idx === 0}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/10 py-3 text-sm font-bold disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" /> 前へ
          </button>
          <button
            onClick={() => go(idx + 1)}
            disabled={isQuiz}
            className="flex flex-[2] items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 py-3 text-sm font-bold disabled:opacity-30"
          >
            {idx === lecture.slides.length - 1 ? '確認問題へ' : '次へ'} <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
