import { Coins, Music, Volume2, VolumeX } from 'lucide-react';
import { useGame, usePlayerName } from '../store/gameStore';
import { JOBS } from '../data/jobs';
import { levelProgress } from '../data/levels';
import { Bar } from './ui';
import { sfx } from '../audio/sfx';

export function TopHud() {
  const exp = useGame((s) => s.exp);
  const gold = useGame((s) => s.gold);
  const jobId = useGame((s) => s.jobId);
  const name = usePlayerName();
  const soundOn = useGame((s) => s.soundOn);
  const bgmOn = useGame((s) => s.bgmOn);
  const toggleSound = useGame((s) => s.toggleSound);
  const toggleBgm = useGame((s) => s.toggleBgm);
  const prog = levelProgress(exp);
  const job = JOBS[jobId];

  return (
    <header className="safe-top safe-x sticky top-0 z-30 border-b border-white/10 bg-night-900/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-3 py-2">
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-black ring-2 ring-white/30"
          style={{ background: `linear-gradient(135deg, ${job.palette.armor}, ${job.palette.cape})` }}
          aria-hidden
        >
          {[...name][0]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-pixel text-base text-gold-300">Lv.{prog.level}</span>
            <span className="truncate text-sm font-bold">
              {name}
              <span className="ml-1 text-xs font-normal text-indigo-200">／{job.name}</span>
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Bar value={prog.current} max={prog.needed} color="linear-gradient(90deg,#60a5fa,#a78bfa)" height="h-2" />
            <span className="shrink-0 text-[10px] tabular-nums text-indigo-200">
              {prog.isMax ? 'MAX' : `${prog.current}/${prog.needed}`}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 ring-1 ring-gold-400/40">
          <Coins className="h-4 w-4 text-gold-400" />
          <span className="font-pixel text-sm tabular-nums text-gold-300">{gold.toLocaleString()}</span>
        </div>
        <button
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1 ring-white/20 ${bgmOn && soundOn ? 'bg-indigo-500/40' : 'bg-black/30'}`}
          onClick={() => {
            if (!soundOn) toggleSound();
            toggleBgm();
            sfx.select();
          }}
          aria-label="BGM切替"
        >
          <Music className={`h-4 w-4 ${bgmOn && soundOn ? 'text-white' : 'text-white/40'}`} />
        </button>
        <button
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/30 ring-1 ring-white/20"
          onClick={() => {
            toggleSound();
            sfx.select();
          }}
          aria-label="効果音切替"
        >
          {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-white/40" />}
        </button>
      </div>
    </header>
  );
}
