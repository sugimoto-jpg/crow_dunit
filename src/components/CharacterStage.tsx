import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import type { Gender, JobId } from '../data/types';
import { HERO_SPRITES, type SpriteInfo } from '../data/sprites';
import { Stage, type StageMode } from '../three/stage';
import type { ActorAnim } from '../three/spriteActor';

export interface StageHandle {
  playHero: (a: ActorAnim) => void;
  playMonster: (a: ActorAnim) => void;
  burst: (target: 'hero' | 'monster', color: string, count?: number) => void;
  reviveMonster: () => void;
  resetView: () => void;
}

interface Props {
  mode: StageMode;
  jobId: JobId;
  gender: Gender;
  monster?: SpriteInfo | null;
  bossScale?: number;
  className?: string;
  ref?: Ref<StageHandle>;
}

/** Three.js ステージ（魔法陣の台座＋2Dスプライト）を React に載せるラッパー */
export function CharacterStage({ mode, jobId, gender, monster = null, bossScale = 1, className, ref }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    let stage: Stage;
    try {
      stage = new Stage(hostRef.current, mode);
    } catch (e) {
      console.warn('WebGL が利用できません', e);
      return;
    }
    stageRef.current = stage;
    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, [mode]);

  useEffect(() => {
    stageRef.current?.setHero(HERO_SPRITES[jobId][gender]);
  }, [jobId, gender, mode]);

  useEffect(() => {
    stageRef.current?.setMonster(monster, bossScale);
  }, [monster, bossScale, mode]);

  useImperativeHandle(ref, () => ({
    playHero: (a) => stageRef.current?.playHero(a),
    playMonster: (a) => stageRef.current?.playMonster(a),
    burst: (t, c, n) => stageRef.current?.burst(t, c, n),
    reviveMonster: () => stageRef.current?.reviveMonster(),
    resetView: () => stageRef.current?.resetView(),
  }));

  return <div ref={hostRef} className={className} />;
}
