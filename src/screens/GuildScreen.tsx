import { Coins, Lock, ScrollText, Sparkles, Swords, Trophy } from 'lucide-react';
import { monsterSprite } from '../data/sprites';
import { INDUSTRIES, INDUSTRY_MAP, DIFFICULTY } from '../data/industries';
import { QUESTS, isQuestUnlocked } from '../data/quests';
import { useGame, useLevel } from '../store/gameStore';
import { GUILD_UNLOCK_LEVEL } from '../data/levels';
import { PixelTitle, Stars } from '../components/ui';
import { sfx } from '../audio/sfx';
import type { IndustryId } from '../data/types';

export function GuildScreen() {
  const level = useLevel();
  const industry = useGame((s) => s.guildIndustry) as IndustryId;
  const setIndustry = useGame((s) => s.setGuildIndustry);
  const records = useGame((s) => s.questRecords);
  const startQuest = useGame((s) => s.startQuest);
  const setTab = useGame((s) => s.setTab);

  if (level < GUILD_UNLOCK_LEVEL) {
    return (
      <div className="mx-auto max-w-3xl px-3 pt-10">
        <div className="rpg-window p-6 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-rose-500/20 ring-2 ring-rose-300/50">
            <Lock className="h-8 w-8 text-rose-200" />
          </div>
          <PixelTitle className="mt-4 text-xl text-gold-300">冒険者ギルド（封印中）</PixelTitle>
          <p className="mt-3 text-sm leading-relaxed text-indigo-100">
            ギルドの扉は Lv.{GUILD_UNLOCK_LEVEL} 以上の冒険者にのみ開かれる。
            <br />
            まずはアイドマ学園で「虎の巻」を習得し、経験値を積もう。
          </p>
          <button
            onClick={() => {
              sfx.confirm();
              setTab('academy');
            }}
            className="mt-5 w-full rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 py-3 text-sm font-bold"
          >
            アイドマ学園へ
          </button>
        </div>
      </div>
    );
  }

  const ind = INDUSTRY_MAP[industry] ?? INDUSTRIES[0];
  const quests = QUESTS.filter((q) => q.industry === ind.id);
  const totalCleared = QUESTS.filter((q) => records[q.id]).length;

  return (
    <div className="mx-auto max-w-3xl px-3 pb-6 pt-4">
      <section className="rpg-window p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-600 ring-2 ring-white/30">
            <ScrollText className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <PixelTitle className="text-xl text-gold-300">冒険者ギルド</PixelTitle>
            <p className="text-xs text-indigo-200">全7大業界 討伐依頼掲示板</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="flex items-center gap-1 text-xs text-indigo-200">
              <Trophy className="h-3.5 w-3.5 text-gold-400" /> 討伐数
            </div>
            <div className="font-pixel text-lg tabular-nums text-gold-300">
              {totalCleared}/{QUESTS.length}
            </div>
          </div>
        </div>
      </section>

      {/* 業界タブ（折り返しグリッドで横スクロールを発生させない） */}
      <div className="mt-4 grid grid-cols-4 gap-1.5 sm:grid-cols-7" role="tablist">
        {INDUSTRIES.map((i) => {
          const active = i.id === ind.id;
          const cleared = QUESTS.filter((q) => q.industry === i.id && records[q.id]).length;
          const count = QUESTS.filter((q) => q.industry === i.id).length;
          return (
            <button
              key={i.id}
              role="tab"
              aria-selected={active}
              onClick={() => {
                sfx.select();
                setIndustry(i.id);
              }}
              className={`relative rounded-lg px-1 py-2 text-center text-xs font-bold transition-all ${
                active ? 'scale-[1.03] text-night-950 shadow-lg' : 'bg-night-800/80 text-indigo-100 ring-1 ring-white/10'
              }`}
              style={active ? { background: i.color } : undefined}
            >
              {i.shortName}
              <span className={`block text-[10px] font-normal ${active ? 'text-night-900/80' : 'text-indigo-300/70'}`}>
                {cleared}/{count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 rounded-xl border-l-4 bg-night-800/60 p-3" style={{ borderColor: ind.color }}>
        <div className="text-sm font-bold" style={{ color: ind.color }}>
          {ind.name}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-indigo-100/90">{ind.description}</p>
      </div>

      <div className="mt-3 grid gap-3">
        {quests.length === 0 && <p className="py-8 text-center text-sm text-indigo-300">現在この業界の依頼はありません。</p>}
        {quests.map((q) => {
          const diff = DIFFICULTY[q.difficulty];
          const unlocked = isQuestUnlocked(q, level);
          const rec = records[q.id];
          return (
            <article key={q.id} className={`rpg-window anim-slide-up relative overflow-hidden p-3 ${unlocked ? '' : 'opacity-70'}`}>
              {q.difficulty === 'maou' && (
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-rose-600/15 via-transparent to-purple-700/20" />
              )}
              <div className="relative flex items-start gap-3">
                <div
                  className="relative grid h-20 w-20 shrink-0 place-items-end justify-center overflow-hidden rounded-xl ring-2 ring-white/25"
                  style={{ background: `radial-gradient(circle at 50% 80%, ${diff.color}55, #0b1026 75%)` }}
                  aria-hidden
                >
                  <img src={monsterSprite(q.id).src} alt="" className="max-h-[76px] max-w-[76px] object-contain drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)]" loading="lazy" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-night-950" style={{ background: ind.color }}>
                      {q.sector}
                    </span>
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${diff.color}33`, color: diff.color }}>
                      {diff.label}
                    </span>
                    {rec && (
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                        討伐済×{rec.clears}
                        {rec.perfect && ' ★完全'}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 text-[15px] font-black leading-snug">{q.monster.name}</h3>
                  <div className="text-xs text-indigo-200/80">{q.monster.persona}</div>
                </div>
              </div>
              <p className="relative mt-2 text-[13px] leading-relaxed text-indigo-50/90">{q.summary}</p>
              <div className="relative mt-2 flex flex-wrap gap-1">
                {q.pains.map((p) => (
                  <span key={p} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-indigo-100">
                    #{p}
                  </span>
                ))}
              </div>
              <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <Stars count={diff.stars} color={diff.color} />
                  <span className="text-indigo-200">推奨Lv.{q.recommendedLevel}</span>
                  <span className="flex items-center gap-0.5 text-sky-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    {rec ? Math.round(q.rewards.exp / 2) : q.rewards.exp}
                  </span>
                  <span className="flex items-center gap-0.5 text-gold-300">
                    <Coins className="h-3.5 w-3.5" />
                    {rec ? Math.round(q.rewards.gold / 2) : q.rewards.gold}G
                  </span>
                </div>
                <button
                  disabled={!unlocked}
                  onClick={() => {
                    sfx.confirm();
                    startQuest(q.id);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-rose-500 to-orange-500 px-4 py-2 text-sm font-bold shadow-md active:scale-95 disabled:from-slate-600 disabled:to-slate-700"
                >
                  {unlocked ? (
                    <>
                      <Swords className="h-4 w-4" /> 出撃
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" /> Lv.{Math.max(2, q.recommendedLevel - 1)}で解放
                    </>
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <p className="mt-4 text-center text-[11px] text-indigo-300/60">※ 討伐済みの依頼は報酬半減で何度でも挑戦できます</p>
    </div>
  );
}
