import { useEffect } from 'react';
import { useGame } from './store/gameStore';
import { QUEST_MAP } from './data/quests';
import { TopHud } from './components/TopHud';
import { BottomNav } from './components/BottomNav';
import { LevelUpModal } from './components/LevelUpModal';
import { JobChangeModal } from './components/JobChangeModal';
import { Onboarding } from './components/Onboarding';
import { SaveMenu } from './components/SaveMenu';
import { AcademyScreen } from './screens/AcademyScreen';
import { GuildScreen } from './screens/GuildScreen';
import { HeroScreen } from './screens/HeroScreen';
import { BattleScreen } from './screens/BattleScreen';
import { playBgm, setSfxEnabled, stopBgm, unlockAudio } from './audio/sfx';

export function App() {
  const tab = useGame((s) => s.tab);
  const activeQuestId = useGame((s) => s.activeQuestId);
  const soundOn = useGame((s) => s.soundOn);
  const bgmOn = useGame((s) => s.bgmOn);
  const quest = activeQuestId ? QUEST_MAP[activeQuestId] : null;

  // iOS Safari などで最初のタップ時に AudioContext をアンロック
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => setSfxEnabled(soundOn), [soundOn]);

  // BGM 切替（バトル中は BattleScreen 側で battle を再生）
  useEffect(() => {
    if (!soundOn || !bgmOn) {
      stopBgm();
      return;
    }
    if (!quest) playBgm('town');
  }, [soundOn, bgmOn, quest]);

  // 画面遷移時は先頭へ
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  // バトル中は背面のスクロールを止める
  useEffect(() => {
    document.body.style.overflow = quest ? 'hidden' : '';
  }, [quest]);

  return (
    <div className="bg-sky min-h-dvh w-full overflow-x-hidden">
      <TopHud />
      <main className="pb-[calc(76px+env(safe-area-inset-bottom))] safe-x">
        {tab === 'academy' && <AcademyScreen />}
        {tab === 'guild' && <GuildScreen />}
        {tab === 'hero' && <HeroScreen />}
      </main>
      <BottomNav />
      {quest && <BattleScreen key={quest.id} quest={quest} />}
      <JobChangeModal />
      <LevelUpModal />
      <Onboarding />
      <SaveMenu />
    </div>
  );
}
