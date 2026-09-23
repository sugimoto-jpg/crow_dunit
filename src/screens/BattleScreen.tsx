import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Coins,
  Crosshair,
  FlaskConical,
  Heart,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Swords,
  Trophy,
} from 'lucide-react';
import type { BattleChoice, Quest } from '../data/types';
import { DIFFICULTY, INDUSTRY_MAP, PHASE_DESCRIPTIONS, PHASE_NAMES } from '../data/industries';
import { JOBS, CHARACTER_NAMES } from '../data/jobs';
import { maxHpFor, useGame, useLevel } from '../store/gameStore';
import { CharacterStage, type StageHandle } from '../components/CharacterStage';
import { Bar } from '../components/ui';
import { playBgm, sfx } from '../audio/sfx';

type Status = 'intro' | 'choose' | 'animating' | 'feedback' | 'victory' | 'defeat';

interface Outcome {
  choice: BattleChoice;
  correct: boolean;
  damage: number;
  critical: boolean;
}

const POTION_COST = 50;
const POSITIVE_LINES = [
  '……ほう。確かに、そこは気になっていたところだ。',
  'む……なるほど。もう少し聞かせてもらおうか。',
  '……よく分かっているじゃないか。',
  '痛いところを突いてくるな……。続けてくれ。',
];
const POTION_HEAL = 45;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function BattleScreen({ quest }: { quest: Quest }) {
  const level = useLevel();
  const jobId = useGame((s) => s.jobId);
  const gender = useGame((s) => s.gender);
  const gold = useGame((s) => s.gold);
  const exitQuest = useGame((s) => s.exitQuest);
  const gainReward = useGame((s) => s.gainReward);
  const spendGold = useGame((s) => s.spendGold);
  const recordQuestClear = useGame((s) => s.recordQuestClear);
  const record = useGame((s) => s.questRecords[quest.id]);
  const bgmOn = useGame((s) => s.bgmOn);
  const soundOn = useGame((s) => s.soundOn);

  const job = JOBS[jobId];
  const diff = DIFFICULTY[quest.difficulty];
  const industry = INDUSTRY_MAP[quest.industry];
  const playerMax = maxHpFor(level, jobId);
  const bossScale = quest.difficulty === 'maou' ? 1.3 : quest.difficulty === 'advanced' ? 1.12 : 1;

  const [attempt, setAttempt] = useState(0);
  const phasesChoices = useMemo(() => quest.phases.map((p) => shuffle(p.choices)), [quest, attempt]);

  const [status, setStatus] = useState<Status>('intro');
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [monsterHp, setMonsterHp] = useState(diff.monsterHp);
  const [playerHp, setPlayerHp] = useState(playerMax);
  const [turn, setTurn] = useState(1);
  const [disabled, setDisabled] = useState<Set<number>>(new Set());
  const [scouted, setScouted] = useState<Set<number>>(new Set());
  const [scoutLeft, setScoutLeft] = useState(job.perks.scoutCharges);
  const [mistakes, setMistakes] = useState(0);
  const [phaseMistakes, setPhaseMistakes] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [fx, setFx] = useState<{ key: number; type: 'slash' | 'hurt' | 'heal'; amount: number; critical: boolean } | null>(null);
  const [monsterLine, setMonsterLine] = useState(quest.phases[0].monsterLine);
  const [shaking, setShaking] = useState(false);
  const [result, setResult] = useState<{ exp: number; gold: number; levelUp: boolean; perfect: boolean } | null>(null);
  const stage = useRef<StageHandle>(null);
  const timers = useRef<number[]>([]);

  const phase = quest.phases[phaseIdx];
  const choices = phasesChoices[phaseIdx];

  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (bgmOn && soundOn) playBgm('battle');
  }, [bgmOn, soundOn]);

  // ---- 開幕 ----
  useEffect(() => {
    if (status !== 'intro') return;
    const t = window.setTimeout(() => setStatus('choose'), 1600);
    return () => clearTimeout(t);
  }, [status]);

  const pick = (i: number) => {
    if (status !== 'choose' || disabled.has(i) || scouted.has(i)) return;
    const choice = choices[i];
    setStatus('animating');
    setTurn((t) => t + 1);
    sfx.confirm();

    if (choice.correct) {
      const critical = phaseMistakes === 0;
      const base = (diff.monsterHp / 3) * job.perks.attackRate * (critical ? 1.2 : 1) * (0.92 + Math.random() * 0.16);
      const floor = phaseIdx < 2 ? Math.round(diff.monsterHp * 0.12 * (2 - phaseIdx)) : 0;
      const damage = phaseIdx === 2 ? monsterHp : Math.max(1, Math.min(Math.round(base), monsterHp - floor));
      stage.current?.playHero('attack');
      later(300, () => {
        setFx({ key: Date.now(), type: 'slash', amount: damage, critical });
        stage.current?.playMonster('hit');
        stage.current?.burst('monster', '#ffd166', critical ? 90 : 55);
        if (critical) sfx.critical();
        else sfx.slash();
        setMonsterHp((hp) => Math.max(0, hp - damage));
        if (phaseIdx < 2) setMonsterLine(POSITIVE_LINES[Math.floor(Math.random() * POSITIVE_LINES.length)]);
      });
      later(1000, () => {
        setOutcome({ choice, correct: true, damage, critical });
        setStatus('feedback');
      });
    } else {
      const damage = Math.max(1, Math.round(diff.damage * (1 - job.perks.guardRate) * (0.9 + Math.random() * 0.2)));
      setMistakes((m) => m + 1);
      setPhaseMistakes((m) => m + 1);
      setDisabled((d) => new Set(d).add(i));
      setMonsterLine(choice.reaction ?? 'そういう話なら結構です。');
      stage.current?.playMonster('attack');
      later(320, () => {
        stage.current?.playHero('hit');
        stage.current?.burst('hero', '#ff4d6d', 40);
        sfx.hurt();
        setShaking(true);
        setFx({ key: Date.now(), type: 'hurt', amount: damage, critical: false });
        setPlayerHp((hp) => Math.max(0, hp - damage));
      });
      later(800, () => setShaking(false));
      later(1000, () => {
        setOutcome({ choice, correct: false, damage, critical: false });
        setStatus('feedback');
      });
    }
  };

  const proceed = () => {
    if (!outcome) return;
    sfx.select();
    if (outcome.correct) {
      if (phaseIdx < 2) {
        const next = phaseIdx + 1;
        setPhaseIdx(next);
        setMonsterLine(quest.phases[next].monsterLine);
        setDisabled(new Set());
        setScouted(new Set());
        setPhaseMistakes(0);
        setOutcome(null);
        setStatus('choose');
        sfx.phase();
      } else {
        // 討伐（商談合意）
        setOutcome(null);
        setStatus('animating');
        setMonsterLine(quest.victoryLine);
        stage.current?.playMonster('defeat');
        stage.current?.burst('monster', '#fff2a8', 120);
        later(1300, () => {
          const perfect = mistakes === 0;
          const firstClear = !record;
          const mult = firstClear ? 1 : 0.5;
          const exp = Math.round(quest.rewards.exp * mult);
          const g = Math.round(quest.rewards.gold * mult * (perfect ? 1.2 : 1));
          const res = gainReward(exp, g);
          recordQuestClear(quest.id, turn - 1, perfect);
          setResult({ exp, gold: g, levelUp: !!res.levelUp, perfect });
          stage.current?.playHero('victory');
          sfx.victory();
          setStatus('victory');
        });
      }
    } else {
      if (playerHp <= 0) {
        setOutcome(null);
        setStatus('defeat');
        sfx.defeat();
      } else {
        setOutcome(null);
        setStatus('choose');
      }
    }
  };

  const handleScout = () => {
    if (scoutLeft <= 0 || status !== 'choose') return;
    const candidates = choices.map((c, i) => ({ c, i })).filter(({ c, i }) => !c.correct && !disabled.has(i) && !scouted.has(i));
    if (candidates.length === 0) return;
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    setScouted((s) => new Set(s).add(target.i));
    setScoutLeft((n) => n - 1);
    sfx.skill();
  };

  const handlePotion = () => {
    if (status !== 'choose' || playerHp >= playerMax) return;
    if (!spendGold(POTION_COST)) return;
    setPlayerHp((hp) => Math.min(playerMax, hp + POTION_HEAL));
    setFx({ key: Date.now(), type: 'heal', amount: POTION_HEAL, critical: false });
    stage.current?.burst('hero', '#6ee7b7', 40);
    sfx.heal();
  };

  const retry = () => {
    sfx.confirm();
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setAttempt((a) => a + 1);
    setPhaseIdx(0);
    setMonsterHp(diff.monsterHp);
    setPlayerHp(playerMax);
    setTurn(1);
    setDisabled(new Set());
    setScouted(new Set());
    setScoutLeft(job.perks.scoutCharges);
    setMistakes(0);
    setPhaseMistakes(0);
    setOutcome(null);
    setResult(null);
    setMonsterLine(quest.phases[0].monsterLine);
    stage.current?.reviveMonster();
    setStatus('intro');
  };

  const leave = () => {
    sfx.cancel();
    exitQuest();
  };

  const showHint = job.perks.insight;

  return (
    <div className={`bg-battle fixed inset-0 z-40 flex flex-col overflow-hidden ${shaking ? 'anim-shake' : ''}`}>
      {/* ===== 上部：モンスター情報 ===== */}
      <header className="safe-top safe-x relative z-10 border-b border-white/10 bg-night-950/80 backdrop-blur">
        <div className="mx-auto max-w-4xl px-3 py-2">
          <div className="flex items-center gap-2">
            <button onClick={leave} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/40 ring-1 ring-white/20" aria-label="撤退">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1">
                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-night-950" style={{ background: industry.color }}>
                  {industry.shortName}｜{quest.sector}
                </span>
                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${diff.color}33`, color: diff.color }}>
                  {diff.label}
                </span>
              </div>
              <div className="truncate text-sm font-black leading-tight">{quest.monster.name}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-pixel text-[10px] text-indigo-300">TURN</div>
              <div className="font-pixel text-base leading-none tabular-nums text-gold-300">{turn}</div>
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="font-pixel text-[10px] text-rose-300">HP</span>
            <Bar value={monsterHp} max={diff.monsterHp} color="linear-gradient(90deg,#f43f5e,#fb923c)" height="h-3" />
            <span className="w-16 shrink-0 text-right font-pixel text-[11px] tabular-nums">
              {monsterHp}/{diff.monsterHp}
            </span>
          </div>
          {/* フェーズ表示 */}
          <div className="mt-2 grid grid-cols-3 gap-1">
            {([1, 2, 3] as const).map((p, i) => (
              <div
                key={p}
                className={`rounded-md px-1 py-1 text-center text-[10px] font-bold leading-tight ${
                  i < phaseIdx ? 'bg-emerald-600/60 text-emerald-50' : i === phaseIdx ? 'bg-gold-400 text-night-950' : 'bg-white/10 text-indigo-300'
                }`}
              >
                <span className="font-pixel">P{p}</span> {PHASE_NAMES[p]}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ===== 中央：3Dステージ ===== */}
      <div className="relative min-h-[180px] flex-1">
        <CharacterStage
          ref={stage}
          mode="battle"
          jobId={jobId}
          gender={gender}
          monster={quest.monster}
          bossScale={bossScale}
          className="absolute inset-0"
        />

        {/* 吹き出し */}
        <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-end px-3">
          <div key={monsterLine} className="bubble anim-pop max-w-[88%] px-3 py-2 text-[13px] font-bold leading-snug sm:max-w-md sm:text-sm">
            <div className="mb-0.5 text-[10px] font-normal text-slate-500">{quest.monster.persona}</div>
            {monsterLine}
          </div>
        </div>

        {/* 自キャラHP */}
        <div className="pointer-events-none absolute bottom-2 left-2 w-44 rounded-lg bg-night-950/75 px-2.5 py-1.5 ring-1 ring-white/15 sm:w-56">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold">
              {CHARACTER_NAMES[gender]}
              <span className="ml-1 text-indigo-300">{job.name}</span>
            </span>
            <span className="font-pixel tabular-nums">
              {playerHp}/{playerMax}
            </span>
          </div>
          <Bar
            value={playerHp}
            max={playerMax}
            color={playerHp / playerMax > 0.5 ? 'linear-gradient(90deg,#22c55e,#86efac)' : playerHp / playerMax > 0.25 ? '#facc15' : '#ef4444'}
            height="h-2"
            className="mt-1"
          />
        </div>

        {/* エフェクト */}
        {fx && fx.type === 'slash' && (
          <div key={fx.key} className="pointer-events-none absolute inset-0">
            <div className="anim-flash absolute inset-0 bg-gradient-to-br from-yellow-200/60 via-transparent to-transparent" />
            <svg className="anim-slash absolute left-[46%] top-[18%] h-[60%] w-[46%]" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="gslash" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#fff" stopOpacity="0" />
                  <stop offset="0.45" stopColor="#fff7c2" />
                  <stop offset="0.6" stopColor="#ffd166" />
                  <stop offset="1" stopColor="#f59e0b" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 8 Q 55 38 100 92 Q 45 50 0 8 Z" fill="url(#gslash)" />
              <path d="M8 0 Q 60 30 92 100" stroke="#fff" strokeWidth="1.5" fill="none" opacity="0.9" />
              {fx.critical && <path d="M0 40 Q 50 45 100 60 Q 50 52 0 40 Z" fill="url(#gslash)" />}
            </svg>
            <div className="anim-damage absolute left-[70%] top-[28%] whitespace-nowrap text-center">
              {fx.critical && <div className="font-pixel text-sm text-rose-300 text-shadow-rpg">会心の一撃！</div>}
              <div className="font-pixel text-4xl text-gold-300 text-shadow-rpg">{fx.amount}</div>
            </div>
          </div>
        )}
        {fx && fx.type === 'hurt' && (
          <div key={fx.key} className="pointer-events-none absolute inset-0">
            <div className="anim-flash absolute inset-0 bg-rose-600/50" />
            <div className="anim-damage absolute left-[28%] top-[40%] whitespace-nowrap font-pixel text-3xl text-rose-400 text-shadow-rpg">
              -{fx.amount}
            </div>
          </div>
        )}
        {fx && fx.type === 'heal' && (
          <div key={fx.key} className="anim-damage pointer-events-none absolute left-[28%] top-[40%] whitespace-nowrap font-pixel text-3xl text-emerald-300 text-shadow-rpg">
            +{fx.amount}
          </div>
        )}

        {/* 開幕演出 */}
        {status === 'intro' && (
          <div className="absolute inset-0 grid place-items-center bg-black/40">
            <div className="anim-pop text-center">
              <div className="font-pixel text-sm text-indigo-200">{quest.monster.persona}</div>
              <div className="font-pixel mt-1 px-4 text-2xl text-shine sm:text-3xl">{quest.monster.name}</div>
              <div className="font-pixel mt-2 text-lg text-rose-300 text-shadow-rpg">が あらわれた！</div>
            </div>
          </div>
        )}
      </div>

      {/* ===== 下部：営業コマンド ===== */}
      <footer className="safe-bottom safe-x relative z-10 border-t-2 border-white/20 bg-night-950/95">
        <div className="mx-auto max-w-4xl px-3 pb-2 pt-2">
          {(status === 'choose' || status === 'animating' || status === 'intro') && (
            <>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="font-pixel shrink-0 rounded bg-gold-400 px-1.5 text-xs text-night-950">PHASE {phase.phase}</span>
                <span className="truncate text-xs text-indigo-100">{PHASE_DESCRIPTIONS[phase.phase]}</span>
              </div>
              {showHint && (
                <div className="mb-1.5 flex items-start gap-1.5 rounded-md bg-sky-900/40 px-2 py-1 text-[11px] leading-snug text-sky-100 ring-1 ring-sky-400/30">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" />
                  <span>
                    <b className="text-sky-300">インサイト：</b>
                    {phase.hint}
                  </span>
                </div>
              )}
              <div className="grid max-h-[38dvh] gap-1.5 overflow-y-auto overflow-x-hidden sm:grid-cols-2">
                {choices.map((c, i) => {
                  const off = disabled.has(i);
                  const sc = scouted.has(i);
                  return (
                    <button
                      key={`${phaseIdx}-${i}`}
                      onClick={() => pick(i)}
                      disabled={status !== 'choose' || off || sc}
                      className={`group relative flex items-start gap-2 rounded-lg border-2 px-2.5 py-2 text-left text-[13px] leading-snug transition-all ${
                        off
                          ? 'border-rose-500/40 bg-rose-950/40 text-rose-200/50 line-through'
                          : sc
                            ? 'border-white/10 bg-black/30 text-white/30'
                            : 'border-white/25 bg-night-800 hover:border-gold-400 hover:bg-night-700 active:scale-[0.98]'
                      }`}
                    >
                      <span className="font-pixel mt-px shrink-0 text-gold-400 group-hover:animate-pulse">{off ? '✕' : sc ? '🏹' : '▶'}</span>
                      <span>{c.text}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-1.5">
                {job.perks.scoutCharges > 0 && (
                  <button
                    onClick={handleScout}
                    disabled={scoutLeft <= 0 || status !== 'choose'}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-700/70 py-2 text-xs font-bold ring-1 ring-emerald-300/40 disabled:opacity-35"
                  >
                    <Crosshair className="h-4 w-4" /> 事前調査 ×{scoutLeft}
                  </button>
                )}
                <button
                  onClick={handlePotion}
                  disabled={status !== 'choose' || gold < POTION_COST || playerHp >= playerMax}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-pink-700/60 py-2 text-xs font-bold ring-1 ring-pink-300/40 disabled:opacity-35"
                >
                  <FlaskConical className="h-4 w-4" /> 回復薬 +{POTION_HEAL}HP（{POTION_COST}G）
                </button>
              </div>
            </>
          )}

          {status === 'feedback' && outcome && (
            <div className="anim-slide-up">
              {outcome.correct ? (
                <div className="rpg-window-gold p-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-gold-300" />
                    <span className="font-pixel text-base text-shine">{outcome.critical ? '会心の一撃！' : '有効打！'}</span>
                    <span className="ml-auto font-pixel text-sm text-gold-300">{outcome.damage} ダメージ</span>
                  </div>
                  <div className="mt-2 text-[11px] font-bold text-gold-300">なぜこの話法が刺さるのか</div>
                  <p className="mt-0.5 max-h-[30dvh] overflow-y-auto text-[13px] leading-relaxed text-amber-50">{outcome.choice.feedback}</p>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-rose-400/70 bg-rose-950/80 p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-rose-300" />
                    <span className="font-pixel text-base text-rose-200">失注リスク！</span>
                    <span className="ml-auto flex items-center gap-1 font-pixel text-sm text-rose-300">
                      <Heart className="h-3.5 w-3.5" />-{outcome.damage}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] font-bold text-rose-300">なぜこの発言が相手を警戒させるのか</div>
                  <p className="mt-0.5 max-h-[30dvh] overflow-y-auto text-[13px] leading-relaxed text-rose-50">{outcome.choice.feedback}</p>
                </div>
              )}
              <button
                onClick={proceed}
                className="mt-2 w-full rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 py-3 text-sm font-bold"
              >
                {outcome.correct
                  ? phaseIdx < 2
                    ? `次のフェーズへ（${PHASE_NAMES[(phaseIdx + 2) as 2 | 3]}）`
                    : 'とどめを刺す！（商談合意）'
                  : playerHp <= 0
                    ? '……'
                    : '体勢を立て直す'}
              </button>
            </div>
          )}

          {status === 'victory' && result && (
            <div className="rpg-window-gold anim-pop p-4 text-center">
              <Trophy className="anim-float mx-auto h-9 w-9 text-gold-300" />
              <div className="font-pixel mt-1 text-2xl text-shine">討伐完了！ 商談合意</div>
              <p className="mt-1 text-xs text-amber-100/90">
                {turn - 1}ターンで {quest.monster.name} を討伐した
                {result.perfect && '（ノーミス！ ゴールド+20%）'}
              </p>
              <div className="mt-3 flex justify-center gap-5 text-base font-bold">
                <span className="flex items-center gap-1 text-sky-300">
                  <Sparkles className="h-4 w-4" />+{result.exp} EXP
                </span>
                <span className="flex items-center gap-1 text-gold-300">
                  <Coins className="h-4 w-4" />+{result.gold} G
                </span>
              </div>
              {result.levelUp && <div className="font-pixel mt-2 animate-pulse text-lg text-rose-300">LEVEL UP!</div>}
              <div className="mt-3 flex gap-2">
                <button onClick={retry} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/10 py-3 text-sm font-bold">
                  <RotateCcw className="h-4 w-4" /> 再戦
                </button>
                <button
                  onClick={leave}
                  className="flex flex-[2] items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-gold-500 to-orange-500 py-3 text-sm font-bold text-night-950"
                >
                  ギルドに報告する
                </button>
              </div>
            </div>
          )}

          {status === 'defeat' && (
            <div className="anim-pop rounded-xl border-2 border-rose-500 bg-rose-950/90 p-4 text-center">
              <div className="font-pixel text-2xl text-rose-300">失注……</div>
              <p className="mt-1 text-xs leading-relaxed text-rose-100">
                顧客の警戒心が限界に達し、電話を切られてしまった。
                <br />
                失注リスク解説を振り返り、もう一度挑もう。学園で虎の巻を復習するのも有効だ。
              </p>
              <div className="mt-3 flex gap-2">
                <button onClick={leave} className="flex-1 rounded-lg bg-white/10 py-3 text-sm font-bold">
                  ギルドへ戻る
                </button>
                <button
                  onClick={retry}
                  className="flex flex-[2] items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-rose-500 to-orange-500 py-3 text-sm font-bold"
                >
                  <Swords className="h-4 w-4" /> 再挑戦
                </button>
              </div>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
