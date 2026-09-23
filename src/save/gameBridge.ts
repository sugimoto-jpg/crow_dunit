import { useGame } from '../store/gameStore';
import type { GameBridge } from './SaveManager';

/**
 * ゲーム状態（zustand）と SaveManager の接点。
 * ゲームのアクションには保存処理を書かず、ここで状態の変化を監視して自動セーブを依頼する。
 *   - 進行に関わる変化（EXP・所持金・職業・クエスト・習得・名前・初回イベント）… 150ms でまとめて保存
 *     （レベルアップ・戦闘報酬・お金の増減・クエスト達成・重要イベントはすべてここに含まれる）
 *   - 画面移動・設定の変化 … 1秒まとめて保存
 *   - クエスト受注 … 直ちに保存（現在地を含むチェックポイント）
 */
export const gameBridge: GameBridge = {
  getData: () => useGame.getState().toSaveData(),
  apply: (data) => useGame.getState().applySaveData(data),
  reset: () => useGame.getState().resetAll(),
  subscribe: (onChange) =>
    useGame.subscribe((s, p) => {
      const progress =
        s.exp !== p.exp ||
        s.gold !== p.gold ||
        s.jobId !== p.jobId ||
        s.questRecords !== p.questRecords ||
        s.completedLectures !== p.completedLectures ||
        s.masteredTerms !== p.masteredTerms ||
        s.glossaryStats !== p.glossaryStats ||
        s.onboarded !== p.onboarded ||
        s.playerName !== p.playerName ||
        s.gender !== p.gender;
      if (progress) return onChange(p.exp !== s.exp && s.exp > p.exp ? 'progress' : 'state', 150);
      if (s.activeQuestId && s.activeQuestId !== p.activeQuestId) return onChange('quest_accept', 0);
      if (s.tab !== p.tab || s.guildIndustry !== p.guildIndustry) return onChange('area_move', 1000);
      if (s.soundOn !== p.soundOn || s.bgmOn !== p.bgmOn) return onChange('settings', 1000);
    }),
};
