import { useState, type ReactNode } from 'react';
import { BookMarked, Check, Coins, Heart, Music, Pencil, RotateCcw, Sparkles, Swords, Trophy, Wand2 } from 'lucide-react';
import { useGame, useLevel, maxHpFor, usePlayerName, NAME_MAX, sanitizeName } from '../store/gameStore';
import { JOBS } from '../data/jobs';
import { QUESTS } from '../data/quests';
import { LECTURES } from '../data/lectures';
import { CharacterStage } from '../components/CharacterStage';
import { PixelTitle, Modal } from '../components/ui';
import { sfx } from '../audio/sfx';
import type { Gender } from '../data/types';

export function HeroScreen() {
  const level = useLevel();
  const gender = useGame((s) => s.gender);
  const setGender = useGame((s) => s.setGender);
  const jobId = useGame((s) => s.jobId);
  const exp = useGame((s) => s.exp);
  const gold = useGame((s) => s.gold);
  const records = useGame((s) => s.questRecords);
  const lectures = useGame((s) => s.completedLectures);
  const setJobModalOpen = useGame((s) => s.setJobModalOpen);
  const setSaveMenu = useGame((s) => s.setSaveMenu);
  const bgmOn = useGame((s) => s.bgmOn);
  const soundOn = useGame((s) => s.soundOn);
  const toggleBgm = useGame((s) => s.toggleBgm);
  const toggleSound = useGame((s) => s.toggleSound);
  const resetAll = useGame((s) => s.resetAll);
  const [confirmReset, setConfirmReset] = useState(false);
  const playerName = usePlayerName();
  const setPlayerName = useGame((s) => s.setPlayerName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const saveName = () => {
    if (!sanitizeName(draft)) return;
    setPlayerName(draft);
    setEditing(false);
    sfx.confirm();
  };
  const job = JOBS[jobId];
  const cleared = QUESTS.filter((q) => records[q.id]).length;
  const perfect = QUESTS.filter((q) => records[q.id]?.perfect).length;

  return (
    <div className="mx-auto max-w-3xl px-3 pb-6 pt-4">
      <div className="grid gap-4 md:grid-cols-2">
        {/* キャラクター表示 */}
        <section className="rpg-window relative overflow-hidden">
          <div className="relative h-[46dvh] min-h-[300px] md:h-[440px]">
            <CharacterStage mode="viewer" jobId={jobId} gender={gender} className="absolute inset-0" />
            <div className="pointer-events-none absolute left-3 top-3">
              <div className="font-pixel text-xs text-gold-300">Lv.{level} {job.style}</div>
              <PixelTitle className="text-2xl">{job.name}</PixelTitle>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 border-t border-white/10 p-2">
            {(['male', 'female'] as Gender[]).map((g) => (
              <button
                key={g}
                onClick={() => {
                  sfx.select();
                  setGender(g);
                }}
                className={`rounded-lg py-2 text-sm font-bold transition-colors ${
                  gender === g ? 'bg-gradient-to-r from-indigo-500 to-violet-600' : 'bg-white/5 text-indigo-200'
                }`}
              >
                {g === 'male' ? '男性タイプ' : '女性タイプ'}
              </button>
            ))}
          </div>
        </section>

        {/* ステータス */}
        <section className="flex flex-col gap-3">
          <div className="rpg-window p-3">
            {editing ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveName();
                }}
              >
                <input
                  id="hero-name"
                  autoFocus
                  value={draft}
                  maxLength={NAME_MAX}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-label="主人公の名前"
                  className="min-w-0 flex-1 rounded-lg bg-black/40 px-3 py-2 text-base font-bold outline-none ring-2 ring-gold-400/60 focus:ring-gold-300"
                />
                <button
                  type="submit"
                  disabled={!sanitizeName(draft)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gold-400 text-night-950 disabled:opacity-40"
                  aria-label="名前を保存"
                >
                  <Check className="h-5 w-5" />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xl font-black">{playerName}</span>
                <button
                  onClick={() => {
                    sfx.select();
                    setDraft(playerName);
                    setEditing(true);
                  }}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-bold text-indigo-100"
                >
                  <Pencil className="h-3.5 w-3.5" /> 名前を変更
                </button>
              </div>
            )}
            <PixelTitle className="mt-3 text-base text-gold-300">ステータス</PixelTitle>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <Stat icon={<Heart className="h-4 w-4 text-rose-400" />} label="最大HP" value={maxHpFor(level, jobId)} />
              <Stat icon={<Swords className="h-4 w-4 text-orange-300" />} label="攻撃倍率" value={`×${job.perks.attackRate.toFixed(2)}`} />
              <Stat icon={<Sparkles className="h-4 w-4 text-sky-300" />} label="累計EXP" value={exp} />
              <Stat icon={<Coins className="h-4 w-4 text-gold-400" />} label="ゴールド" value={`${gold}G`} />
              <Stat icon={<Trophy className="h-4 w-4 text-gold-300" />} label="討伐" value={`${cleared}/${QUESTS.length}`} />
              <Stat icon={<Trophy className="h-4 w-4 text-emerald-300" />} label="虎の巻" value={`${lectures.length}/${LECTURES.length}`} />
            </dl>
            <div className="mt-3 rounded-lg bg-black/30 p-2.5">
              <div className="text-xs font-bold text-gold-300">スキル：{job.skillName}</div>
              <p className="mt-0.5 text-xs leading-relaxed text-indigo-100">{job.skillDescription}</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-indigo-200/90">{job.description}</p>
            {perfect > 0 && <p className="mt-1 text-[11px] text-emerald-300">★ノーミス討伐 {perfect}件</p>}
          </div>

          <button
            onClick={() => {
              sfx.confirm();
              setJobModalOpen(true);
            }}
            className="anim-glow flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-orange-500 py-3.5 font-bold text-night-950"
          >
            <Wand2 className="h-5 w-5" /> 転職の神殿へ
          </button>

          <button
            onClick={() => {
              sfx.confirm();
              setSaveMenu('save');
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-night-700 py-3 font-bold ring-1 ring-gold-400/40"
          >
            <BookMarked className="h-5 w-5 text-gold-300" /> 冒険の書（セーブ／ロード）
          </button>

          <button
            role="switch"
            aria-checked={bgmOn && soundOn}
            onClick={() => {
              if (!soundOn) toggleSound();
              toggleBgm();
              sfx.select();
            }}
            className="flex items-center gap-2 rounded-xl bg-night-800 px-4 py-3 text-sm font-bold ring-1 ring-white/10"
          >
            <Music className="h-4 w-4 text-indigo-200" />
            <span className="flex-1 text-left">BGM（8bitチップチューン）</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs ${bgmOn && soundOn ? 'bg-emerald-500 text-night-950' : 'bg-white/10 text-indigo-200'}`}>
              {bgmOn && soundOn ? 'ON' : 'OFF'}
            </span>
          </button>

          <button
            onClick={() => setConfirmReset(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs text-indigo-300/70 hover:text-rose-300"
          >
            <RotateCcw className="h-3.5 w-3.5" /> 冒険の記録を消去する
          </button>
        </section>
      </div>

      {confirmReset && (
        <Modal onClose={() => setConfirmReset(false)}>
          <div className="rpg-window p-5 text-center">
            <PixelTitle className="text-lg text-rose-300">冒険の記録を消去しますか？</PixelTitle>
            <p className="mt-2 text-sm text-indigo-100">レベル・ゴールド・習得状況・討伐記録がすべて初期化されます。</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setConfirmReset(false)} className="flex-1 rounded-lg bg-white/10 py-2.5 text-sm font-bold">
                やめる
              </button>
              <button
                onClick={() => {
                  sfx.defeat();
                  resetAll();
                  setConfirmReset(false);
                }}
                className="flex-1 rounded-lg bg-rose-600 py-2.5 text-sm font-bold"
              >
                消去する
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-black/25 px-2.5 py-2">
      {icon}
      <dt className="text-xs text-indigo-200">{label}</dt>
      <dd className="ml-auto font-pixel tabular-nums">{value}</dd>
    </div>
  );
}
