import { useState } from 'react';
import { BookMarked, Sparkles } from 'lucide-react';
import { hasAnySlot } from '../store/saveSlots';
import { NAME_MAX, sanitizeName, useGame } from '../store/gameStore';
import { CHARACTER_NAMES } from '../data/jobs';
import type { Gender } from '../data/types';
import { CharacterStage } from './CharacterStage';
import { sfx, unlockAudio } from '../audio/sfx';

export function Onboarding() {
  const onboarded = useGame((s) => s.onboarded);
  if (onboarded) return null;
  return <OnboardingInner />;
}

function OnboardingInner() {
  const gender = useGame((s) => s.gender);
  const setGender = useGame((s) => s.setGender);
  const setPlayerName = useGame((s) => s.setPlayerName);
  const finish = useGame((s) => s.finishOnboarding);
  const setSaveMenu = useGame((s) => s.setSaveMenu);
  const [hasSave] = useState(hasAnySlot);
  const [name, setName] = useState<string>(CHARACTER_NAMES[gender]);
  const [touched, setTouched] = useState(false);
  const valid = sanitizeName(name).length > 0;

  const pickGender = (g: Gender) => {
    unlockAudio();
    sfx.select();
    setGender(g);
    // 名前を自分で入力していなければ、見た目タイプに合わせた既定名に差し替える
    if (!touched) setName(CHARACTER_NAMES[g]);
  };

  const start = () => {
    if (!valid) return;
    unlockAudio();
    sfx.levelUp();
    setPlayerName(name);
    finish();
  };

  return (
    <div className="bg-sky safe-top safe-x safe-bottom fixed inset-0 z-50 flex flex-col overflow-y-auto overflow-x-hidden">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-4">
        <div className="text-center">
          <div className="text-[11px] font-bold tracking-[0.3em] text-indigo-300">AIDMA SALES QUEST</div>
          <h1 className="logo-title mt-1 text-[34px] sm:text-4xl">アイドマ営業クエスト</h1>
          <p className="mt-2 text-sm leading-relaxed text-indigo-100">
            キミは営業カバン一つで旅立つ見習い営業「村人」。
            <br />
            虎の巻を学び、全7大業界の魔物（見込み顧客）と商談バトルで渡り合い、伝説の勇者を目指せ！
          </p>
        </div>
        <div className="rpg-window relative mt-4 min-h-[260px] flex-1 overflow-hidden">
          <CharacterStage mode="viewer" jobId="villager" gender={gender} className="absolute inset-0" />
          <div className="pointer-events-none absolute left-3 top-3">
            <div className="font-pixel text-xs text-gold-300">村人（見習い営業）</div>
            <div className="text-lg font-black text-shadow-rpg">{sanitizeName(name) || '？？？'}</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(['male', 'female'] as Gender[]).map((g) => (
            <button
              key={g}
              onClick={() => pickGender(g)}
              className={`rounded-xl py-2.5 font-bold ring-2 transition-all ${
                gender === g ? 'bg-gradient-to-r from-indigo-500 to-violet-600 ring-gold-400' : 'bg-night-800 ring-white/10'
              }`}
            >
              <div>{g === 'male' ? '男性タイプ' : '女性タイプ'}</div>
              <div className="text-[11px] font-normal text-indigo-200">{g === 'male' ? '熱血の跳ね髪営業' : '聡明なポニーテール営業'}</div>
            </button>
          ))}
        </div>
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
        >
          <label htmlFor="onboarding-name" className="text-xs font-bold text-gold-300">
            主人公の名前（{NAME_MAX}文字まで）
          </label>
          <input
            id="onboarding-name"
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => {
              setTouched(true);
              setName(e.target.value);
            }}
            placeholder="名前を入力"
            autoComplete="off"
            enterKeyHint="done"
            className="mt-1 w-full rounded-xl bg-night-800 px-4 py-3 text-lg font-bold outline-none ring-2 ring-white/15 placeholder:text-indigo-300/50 focus:ring-gold-400"
          />
          {!valid && <p className="mt-1 text-xs text-rose-300">名前を入力してください。</p>}
          <button
            type="submit"
            disabled={!valid}
            className="anim-glow mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-orange-500 py-4 text-lg font-black text-night-950 disabled:animate-none disabled:from-slate-600 disabled:to-slate-700 disabled:text-white/60"
          >
            <Sparkles className="h-5 w-5" /> 冒険をはじめる
          </button>
        </form>
        {hasSave && (
          <button
            onClick={() => {
              unlockAudio();
              sfx.confirm();
              setSaveMenu('load');
            }}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-night-800 py-3 font-bold ring-2 ring-gold-400/50"
          >
            <BookMarked className="h-5 w-5 text-gold-300" /> 冒険の書から再開する
          </button>
        )}
      </div>
    </div>
  );
}
