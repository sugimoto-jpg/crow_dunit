import { useState } from 'react';
import { Check, Lock, Wand2, X } from 'lucide-react';
import { useGame, useLevel } from '../store/gameStore';
import { JOBS, JOB_ORDER } from '../data/jobs';
import type { JobId } from '../data/types';
import { CharacterStage } from './CharacterStage';
import { PixelTitle } from './ui';
import { sfx } from '../audio/sfx';

export function JobChangeModal() {
  const open = useGame((s) => s.jobModalOpen);
  if (!open) return null;
  return <JobChangeInner />;
}

function JobChangeInner() {
  const level = useLevel();
  const current = useGame((s) => s.jobId);
  const gender = useGame((s) => s.gender);
  const changeJob = useGame((s) => s.changeJob);
  const close = useGame((s) => s.setJobModalOpen);
  const [selected, setSelected] = useState<JobId>(current);
  const [flash, setFlash] = useState(0);
  const job = JOBS[selected];
  const unlocked = job.requiredLevel <= level;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-night-950/95 backdrop-blur">
      <div className="safe-top safe-x border-b border-white/10">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-3 py-2">
          <Wand2 className="h-5 w-5 text-gold-300" />
          <PixelTitle className="flex-1 text-lg text-gold-300">転職の神殿</PixelTitle>
          <button
            onClick={() => {
              sfx.cancel();
              close(false);
            }}
            className="grid h-9 w-9 place-items-center rounded-full bg-black/40 ring-1 ring-white/20"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto grid max-w-4xl gap-3 px-3 py-3 md:grid-cols-[1fr_1.1fr]">
          {/* プレビュー */}
          <div className="rpg-window relative overflow-hidden">
            <div className="relative h-[34dvh] min-h-[240px] md:h-[420px]">
              <CharacterStage mode="viewer" jobId={selected} gender={gender} className="absolute inset-0" />
              {flash > 0 && <div key={flash} className="anim-flash pointer-events-none absolute inset-0 bg-gradient-to-t from-gold-400/80 to-white/60" />}
              <div className="pointer-events-none absolute left-3 top-3">
                <div className="font-pixel text-xs text-gold-300">
                  {job.style}｜Lv.{job.requiredLevel}〜
                </div>
                <PixelTitle className="text-2xl">{job.name}</PixelTitle>
              </div>
            </div>
            <div className="border-t border-white/10 p-3">
              <p className="text-xs leading-relaxed text-indigo-100">{job.description}</p>
              <div className="mt-2 rounded-lg bg-black/30 p-2">
                <div className="text-xs font-bold text-gold-300">スキル：{job.skillName}</div>
                <p className="text-[11px] leading-relaxed text-indigo-100">{job.skillDescription}</p>
              </div>
              <button
                disabled={!unlocked || selected === current}
                onClick={() => {
                  changeJob(selected);
                  sfx.jobChange();
                  setFlash(Date.now());
                }}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-gold-500 to-orange-500 py-3 text-sm font-bold text-night-950 disabled:from-slate-600 disabled:to-slate-700 disabled:text-white/60"
              >
                {selected === current ? (
                  <>
                    <Check className="h-4 w-4" /> 現在の職業
                  </>
                ) : unlocked ? (
                  <>
                    <Wand2 className="h-4 w-4" /> {job.name}に転職する
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" /> Lv.{job.requiredLevel}で解放
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 職業一覧 */}
          <div className="grid grid-cols-2 content-start gap-2">
            {JOB_ORDER.map((id) => {
              const j = JOBS[id];
              const ok = j.requiredLevel <= level;
              const active = id === selected;
              return (
                <button
                  key={id}
                  onClick={() => {
                    sfx.select();
                    setSelected(id);
                  }}
                  className={`relative overflow-hidden rounded-xl p-2.5 text-left ring-2 transition-all ${
                    active ? 'ring-gold-400' : 'ring-white/10'
                  } ${ok ? '' : 'opacity-60'}`}
                  style={{ background: `linear-gradient(135deg, ${j.palette.armor}55, ${j.palette.cape}88)` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-pixel text-[10px] text-gold-300">Lv.{j.requiredLevel}</span>
                    {id === current && <span className="rounded bg-emerald-500 px-1 text-[9px] font-bold">装備中</span>}
                    {!ok && <Lock className="h-3.5 w-3.5 text-white/70" />}
                  </div>
                  <div className="mt-0.5 text-sm font-black text-shadow-rpg">{j.name}</div>
                  <div className="text-[10px] text-indigo-100">{j.style}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
