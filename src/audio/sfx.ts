// ============================================================
// Web Audio API による 8bit チップチューン合成音
// 外部アセット不要。すべてオシレーターとノイズで生成する。
// ============================================================

type Wave = OscillatorType;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let bgmBus: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let enabled = true;

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 1;
    sfxBus.connect(master);
    bgmBus = ctx.createGain();
    bgmBus.gain.value = 0.32;
    bgmBus.connect(master);
    // ホワイトノイズ
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** 最初のユーザー操作で AudioContext をアンロックする（iOS Safari 対策） */
export function unlockAudio() {
  const c = ensure();
  if (!c) return;
  const buf = c.createBuffer(1, 1, 22050);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start(0);
}

export function setSfxEnabled(on: boolean) {
  enabled = on;
  if (!on) stopBgm();
}

function tone(
  freq: number,
  start: number,
  dur: number,
  opts: { type?: Wave; vol?: number; slideTo?: number; bus?: 'sfx' | 'bgm' } = {},
) {
  const c = ensure();
  if (!c || !sfxBus || !bgmBus) return;
  const { type = 'square', vol = 0.18, slideTo, bus = 'sfx' } = opts;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.setValueAtTime(vol, t0 + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(bus === 'sfx' ? sfxBus : bgmBus);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(start: number, dur: number, opts: { vol?: number; filter?: number; sweepTo?: number } = {}) {
  const c = ensure();
  if (!c || !sfxBus || !noiseBuffer) return;
  const { vol = 0.25, filter = 3000, sweepTo } = opts;
  const t0 = c.currentTime + start;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(filter, t0);
  if (sweepTo) bp.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
  bp.Q.value = 0.8;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(sfxBus);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

const N = (semi: number) => 440 * Math.pow(2, (semi - 9) / 12); // semi: C4=0

function guard(fn: () => void) {
  return () => {
    if (!enabled) return;
    try {
      fn();
    } catch {
      /* オーディオ非対応環境では無音で続行 */
    }
  };
}

export const sfx = {
  /** カーソル移動・タップ */
  select: guard(() => tone(N(19), 0, 0.05, { vol: 0.1 })),
  /** 決定 */
  confirm: guard(() => {
    tone(N(12), 0, 0.06, { vol: 0.14 });
    tone(N(19), 0.06, 0.09, { vol: 0.14 });
  }),
  /** キャンセル・戻る */
  cancel: guard(() => {
    tone(N(12), 0, 0.06, { vol: 0.12 });
    tone(N(7), 0.06, 0.09, { vol: 0.12 });
  }),
  /** ページめくり */
  page: guard(() => noise(0, 0.12, { vol: 0.12, filter: 5000, sweepTo: 1500 })),
  /** 黄金のスラッシュ（正解） */
  slash: guard(() => {
    noise(0, 0.22, { vol: 0.35, filter: 7000, sweepTo: 600 });
    tone(N(24), 0, 0.16, { type: 'sawtooth', vol: 0.12, slideTo: N(0) });
  }),
  /** 会心の一撃 */
  critical: guard(() => {
    noise(0, 0.18, { vol: 0.35, filter: 6000, sweepTo: 800 });
    [12, 16, 19, 24, 28].forEach((s, i) => tone(N(s + 12), 0.1 + i * 0.045, 0.09, { vol: 0.13 }));
  }),
  /** 被弾（不正解） */
  hurt: guard(() => {
    tone(N(-5), 0, 0.25, { type: 'sawtooth', vol: 0.2, slideTo: N(-24) });
    noise(0, 0.2, { vol: 0.28, filter: 900, sweepTo: 200 });
  }),
  /** 選択肢を射抜く（スキル） */
  skill: guard(() => {
    tone(N(24), 0, 0.2, { type: 'triangle', vol: 0.2, slideTo: N(36) });
    noise(0.05, 0.15, { vol: 0.15, filter: 8000 });
  }),
  /** 回復 */
  heal: guard(() => {
    [0, 4, 7, 12, 16].forEach((s, i) => tone(N(s + 12), i * 0.06, 0.12, { type: 'triangle', vol: 0.16 }));
  }),
  /** ゴールド獲得 */
  coin: guard(() => {
    tone(N(23), 0, 0.06, { vol: 0.12 });
    tone(N(28), 0.06, 0.22, { vol: 0.12 });
  }),
  /** フェーズ突破 */
  phase: guard(() => {
    [7, 12, 16].forEach((s, i) => tone(N(s + 12), i * 0.08, 0.1, { vol: 0.13 }));
  }),
  /** 勝利ファンファーレ */
  victory: guard(() => {
    const seq: [number, number, number][] = [
      [12, 0, 0.12], [12, 0.13, 0.12], [12, 0.26, 0.12], [12, 0.39, 0.36],
      [8, 0.78, 0.3], [10, 1.1, 0.3], [12, 1.42, 0.18], [10, 1.62, 0.1], [12, 1.74, 0.6],
    ];
    seq.forEach(([s, t, d]) => {
      tone(N(s + 12), t, d, { vol: 0.15 });
      tone(N(s), t, d, { type: 'triangle', vol: 0.12 });
    });
  }),
  /** 敗北（失注） */
  defeat: guard(() => {
    [7, 6, 5, 4].forEach((s, i) => tone(N(s), i * 0.28, 0.3, { type: 'triangle', vol: 0.18 }));
    tone(N(-12), 1.12, 0.8, { type: 'square', vol: 0.12, slideTo: N(-17) });
  }),
  /** レベルアップ */
  levelUp: guard(() => {
    const seq = [0, 4, 7, 12, 7, 12, 16, 19, 24];
    seq.forEach((s, i) => tone(N(s + 12), i * 0.07, 0.1, { vol: 0.14 }));
    tone(N(24), seq.length * 0.07, 0.5, { vol: 0.15 });
    tone(N(12), seq.length * 0.07, 0.5, { type: 'triangle', vol: 0.14 });
  }),
  /** 転職 */
  jobChange: guard(() => {
    [0, 7, 12, 16, 19, 24, 28, 31].forEach((s, i) => tone(N(s + 5), i * 0.05, 0.25, { type: 'triangle', vol: 0.14 }));
    noise(0, 0.6, { vol: 0.08, filter: 9000, sweepTo: 3000 });
  }),
};

// ============================================================
// BGM（簡易シーケンサー）
// ============================================================
type Track = { bpm: number; lead: (number | null)[]; bass: (number | null)[] };

const TRACKS: Record<'town' | 'battle', Track> = {
  town: {
    bpm: 112,
    lead: [12, null, 16, 19, 17, null, 16, 14, 12, null, 14, 16, 14, null, null, null,
      9, null, 12, 16, 14, null, 12, 11, 12, null, null, null, null, null, null, null],
    bass: [0, null, 7, null, 5, null, 7, null, 0, null, 7, null, 7, null, 2, null,
      -3, null, 4, null, 5, null, 7, null, 0, null, 7, null, 0, null, null, null],
  },
  battle: {
    bpm: 150,
    lead: [12, 12, 15, 12, 17, 15, 12, 10, 12, 12, 15, 17, 19, 17, 15, 17,
      20, 19, 17, 15, 17, 15, 12, 10, 12, null, 15, null, 12, null, null, null],
    bass: [0, 0, 12, 0, 0, 0, 12, 0, -2, -2, 10, -2, -2, -2, 10, -2,
      -4, -4, 8, -4, -4, -4, 8, -4, -5, -5, 7, -5, -5, 7, -5, 7],
  },
};

let bgmTimer: number | null = null;
let currentTrack: 'town' | 'battle' | null = null;

export function playBgm(name: 'town' | 'battle') {
  if (!enabled) return;
  if (currentTrack === name && bgmTimer !== null) return;
  stopBgm();
  const c = ensure();
  if (!c) return;
  currentTrack = name;
  const track = TRACKS[name];
  const step = 60 / track.bpm / 2; // 8分音符
  let idx = 0;
  let nextTime = c.currentTime + 0.1;
  const tick = () => {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.25) {
      const at = nextTime - ctx.currentTime;
      const l = track.lead[idx % track.lead.length];
      const b = track.bass[idx % track.bass.length];
      if (l !== null) tone(N(l + 12), at, step * 0.9, { vol: 0.07, bus: 'bgm', type: 'square' });
      if (b !== null) tone(N(b - 12), at, step * 0.8, { vol: 0.12, bus: 'bgm', type: 'triangle' });
      idx++;
      nextTime += step;
    }
  };
  tick();
  bgmTimer = window.setInterval(tick, 80);
}

export function stopBgm() {
  if (bgmTimer !== null) window.clearInterval(bgmTimer);
  bgmTimer = null;
  currentTrack = null;
}
