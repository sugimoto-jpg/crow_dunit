import { useEffect } from 'react';
import { Swords, Wand2 } from 'lucide-react';
import { useGame, maxHpFor } from '../store/gameStore';
import { JOBS } from '../data/jobs';
import { GUILD_UNLOCK_LEVEL } from '../data/levels';
import { Modal } from './ui';
import { sfx } from '../audio/sfx';

export function LevelUpModal() {
  const ev = useGame((s) => s.levelUpEvent);
  const activeQuest = useGame((s) => s.activeQuestId);
  const jobId = useGame((s) => s.jobId);
  const dismiss = useGame((s) => s.dismissLevelUp);
  const openJobs = useGame((s) => s.setJobModalOpen);
  const setTab = useGame((s) => s.setTab);
  const lectureOpen = useGame((s) => s.lectureOpen);
  const visible = !!ev && !activeQuest && !lectureOpen;

  useEffect(() => {
    if (visible) sfx.levelUp();
  }, [visible]);

  if (!visible || !ev) return null;
  const guildUnlocked = ev.from < GUILD_UNLOCK_LEVEL && ev.to >= GUILD_UNLOCK_LEVEL;

  return (
    <Modal onClose={dismiss}>
      <div className="rpg-window-gold relative overflow-hidden p-5 text-center">
        <div
          className="anim-rays pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] opacity-30"
          style={{ background: 'repeating-conic-gradient(#ffd166 0deg 8deg, transparent 8deg 22deg)' }}
        />
        <div className="relative">
          <div className="font-pixel text-4xl text-shine">LEVEL UP!</div>
          <div className="font-pixel mt-2 text-xl">
            Lv.{ev.from} <span className="text-gold-300">→</span> Lv.{ev.to}
          </div>
          <div className="mt-1 text-sm text-amber-100">最大HP {maxHpFor(ev.from, jobId)} → {maxHpFor(ev.to, jobId)}</div>

          {guildUnlocked && (
            <div className="mt-4 rounded-lg bg-rose-900/50 p-3 text-sm font-bold text-rose-100 ring-1 ring-rose-300/50">
              <Swords className="mx-auto mb-1 h-6 w-6" />
              冒険者ギルドが解放された！
              <br />
              <span className="text-xs font-normal">全7大業界の討伐依頼に出撃できます。</span>
            </div>
          )}
          {ev.newJobs.length > 0 && (
            <div className="mt-3 rounded-lg bg-indigo-900/60 p-3 text-sm ring-1 ring-indigo-300/40">
              <Wand2 className="mx-auto mb-1 h-6 w-6 text-gold-300" />
              新たな職業に転職可能になった！
              <div className="mt-1 flex flex-wrap justify-center gap-1.5">
                {ev.newJobs.map((id) => (
                  <span key={id} className="rounded-full bg-gold-400 px-2 py-0.5 text-xs font-bold text-night-950">
                    {JOBS[id].name}（{JOBS[id].style}）
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => {
                sfx.select();
                dismiss();
                if (guildUnlocked) setTab('guild');
              }}
              className="flex-1 rounded-lg bg-white/15 py-2.5 text-sm font-bold"
            >
              {guildUnlocked ? 'ギルドへ' : '閉じる'}
            </button>
            {ev.newJobs.length > 0 && (
              <button
                onClick={() => {
                  sfx.confirm();
                  dismiss();
                  openJobs(true);
                }}
                className="flex-[1.4] rounded-lg bg-gradient-to-r from-gold-500 to-orange-500 py-2.5 text-sm font-bold text-night-950"
              >
                転職の神殿へ
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
