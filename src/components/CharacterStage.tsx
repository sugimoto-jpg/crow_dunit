import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import type { Gender, JobId, MonsterSpec } from '../data/types';
import { JOBS } from '../data/jobs';
import { Stage, type StageMode } from '../three/stage';
import type { HeroAnim } from '../three/heroModel';
import type { MonsterAnim } from '../three/monsterModel';

export interface StageHandle {
  playHero: (a: HeroAnim) => void;
  playMonster: (a: MonsterAnim) => void;
  burst: (target: 'hero' | 'monster', color: string, count?: number) => void;
  reviveMonster: () => void;
  resetView: () => void;
}

interface Props {
  mode: StageMode;
  jobId: JobId;
  gender: Gender;
  monster?: MonsterSpec | null;
  bossScale?: number;
  className?: string;
  ref?: Ref<StageHandle>;
}

/** Three.js ステージを React に載せるラッパー。リサイズ/タッチは Stage 側が処理する */
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
    stageRef.current?.setHero(JOBS[jobId], gender);
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
