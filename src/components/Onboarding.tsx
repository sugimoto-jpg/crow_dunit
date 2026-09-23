import { Sparkles } from 'lucide-react';
import { useGame } from '../store/gameStore';
import { CHARACTER_NAMES } from '../data/jobs';
import type { Gender } from '../data/types';
import { CharacterStage } from './CharacterStage';
import { PixelTitle } from './ui';
import { sfx, unlockAudio } from '../audio/sfx';

export function Onboarding() {
  const onboarded = useGame((s) => s.onboarded);
  const gender = useGame((s) => s.gender);
  const setGender = useGame((s) => s.setGender);
  const finish = useGame((s) => s.finishOnboarding);
  if (onboarded) return null;

  return (
    <div className="bg-sky fixed inset-0 z-50 flex flex-col overflow-y-auto overflow-x-hidden">
      <div className="safe-top safe-x safe-bottom mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-4">
        <div className="text-center">
          <div className="font-pixel text-xs tracking-widest text-indigo-300">AIDMA SALES QUEST</div>
          <PixelTitle className="mt-1 text-3xl text-shine">アイドマ営業クエスト</PixelTitle>
          <p className="mt-2 text-sm leading-relaxed text-indigo-100">
            キミは営業カバン一つで旅立つ見習い営業「村人」。
            <br />
            虎の巻を学び、全7大業界の魔物（見込み顧客）と商談バトルで渡り合い、伝説の勇者を目指せ！
          </p>
        </div>
        <div className="rpg-window relative mt-4 min-h-[280px] flex-1 overflow-hidden">
          <CharacterStage mode="viewer" jobId="villager" gender={gender} className="absolute inset-0" />
          <div className="pointer-events-none absolute left-3 top-3 font-pixel text-sm text-gold-300">村人（見習い営業）</div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(['male', 'female'] as Gender[]).map((g) => (
            <button
              key={g}
              onClick={() => {
                unlockAudio();
                sfx.select();
                setGender(g);
              }}
              className={`rounded-xl py-3 font-bold ring-2 transition-all ${
                gender === g ? 'bg-gradient-to-r from-indigo-500 to-violet-600 ring-gold-400' : 'bg-night-800 ring-white/10'
              }`}
            >
              <div className="text-lg">{CHARACTER_NAMES[g]}</div>
              <div className="text-[11px] font-normal text-indigo-200">{g === 'male' ? '熱血の跳ね髪営業' : '聡明なポニーテール営業'}</div>
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            unlockAudio();
            sfx.levelUp();
            finish();
          }}
          className="anim-glow mt-3 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-orange-500 py-4 text-lg font-black text-night-950"
        >
          <Sparkles className="h-5 w-5" /> 冒険をはじめる
        </button>
      </div>
    </div>
  );
}
