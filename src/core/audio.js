/* ===== 音（BGM・効果音） =====
 * 音源ファイルを持たず、ブラウザに音を合成させる。
 *   ・容量は 0 バイト（楽譜が数KBあるだけ）
 *   ・ダウンロード版の「1ファイル」を崩さない
 *   ・権利の問題がない
 *
 * 音は飾りなので、使えない環境では黙って何もしない。
 * 音の不具合でゲームが遊べなくなるのは本末転倒なため。
 *
 * スマートフォンの決まりごと（STEP 11 の調査より）:
 *   ・画面を1度も触っていない状態では音を鳴らせない
 *     → 最初のタップで G.Audio.unlock() を呼ぶ
 *   ・iPhone は audio.volume を無視する
 *     → 再生はすべて Web Audio 経由にする（この実装がそう）
 *   ・他のアプリに切り替わったら止める
 *
 * 将来ちゃんとした楽曲に差し替えるときは、
 * G.MUSIC の項目を音声ファイルに置き換え、
 * ここの play を差し替えれば、ゲーム側は変更不要。
 */
(function () {
'use strict';

window.G = window.G || {};

const SET_KEY = 'ta.settings';
const A4 = 440;
const NOTE = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };

/* 'A4' 'C#5' 'Eb3' → 周波数 */
function freq(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return 0;
  let n = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  n += (Number(m[3]) - 4) * 12;
  return A4 * Math.pow(2, n / 12);
}

let ctx = null;          // 音の出口。最初のタップまで作らない
let master = null;       // 全体の音量
let bgmGain = null;
let seGain = null;
let noiseBuf = null;

let current = null;      // いま鳴らしている曲のID
let timer = null;        // 次の小節を予約するための繰り返し
let nextTime = 0;        // 次に音を置く時刻
let step = 0;            // 何個目の音か
let playing = [];        // 予約済みの音（止めるときに使う）

const settings = {
  bgm: true, bgmVol: 0.45,
  se: true, seVol: 0.7,
};

function loadSettings() {
  try {
    const raw = G.Storage && G.Storage.get(SET_KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    if (typeof o.bgm === 'boolean') settings.bgm = o.bgm;
    if (typeof o.se === 'boolean') settings.se = o.se;
    if (typeof o.bgmVol === 'number') settings.bgmVol = Math.min(1, Math.max(0, o.bgmVol));
    if (typeof o.seVol === 'number') settings.seVol = Math.min(1, Math.max(0, o.seVol));
  } catch (e) { /* 壊れていたら既定値のまま */ }
}
function saveSettings() {
  try { G.Storage && G.Storage.set(SET_KEY, JSON.stringify(settings)); } catch (e) {}
}

function makeCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    bgmGain = ctx.createGain();
    bgmGain.gain.value = settings.bgm ? settings.bgmVol : 0;
    bgmGain.connect(master);
    seGain = ctx.createGain();
    seGain.gain.value = settings.se ? settings.seVol : 0;
    seGain.connect(master);
    /* 打撃音に使う雑音。1秒ぶん作って使い回す */
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ctx = null; }
  return ctx;
}

/* 1つの音を、指定した時刻に鳴らす */
function tone(dest, wave, f, at, dur, vol, slideTo) {
  if (!ctx || !f) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = wave;
  o.frequency.setValueAtTime(f, at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), at + dur);
  /* 立ち上がりと減衰。角が立つと耳に痛いので少しなまらせる */
  const a = Math.min(0.02, dur * 0.25);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), at + a);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g); g.connect(dest);
  o.start(at); o.stop(at + dur + 0.02);
  playing.push(o);
  if (playing.length > 120) playing = playing.slice(-120);
}

/* 雑音を鳴らす（打撃・爆発など） */
function noise(dest, at, dur, vol, hz) {
  if (!ctx || !noiseBuf) return;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(hz || 1800, at);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(at); s.stop(at + dur);
}

/* ---------- BGM ---------- */
const LOOKAHEAD = 0.12;   // 何秒先まで予約しておくか
const TICK = 60;          // 予約を入れ直す間隔（ミリ秒）

function schedule() {
  if (!ctx || !current) return;
  const song = (G.MUSIC || {})[current];
  if (!song) return;
  const spb = 60 / song.tempo / (song.div || 4);   // 1ステップの長さ（秒）

  while (nextTime < ctx.currentTime + LOOKAHEAD) {
    for (const v of song.voices) {
      const seq = v.seq;
      const tok = seq[step % seq.length];
      if (!tok || tok === '.' || tok === '-') continue;
      const dur = spb * (v.len || 0.9);
      tone(bgmGain, v.wave || 'triangle', freq(tok), nextTime, dur, v.gain || 0.2);
    }
    nextTime += spb;
    step++;
  }
}

/* ---------- 効果音 ---------- */
const SE = {
  se_ok:     t => { tone(seGain, 'square', 660, t, 0.07, 0.25); tone(seGain, 'square', 990, t + 0.06, 0.09, 0.2); },
  se_cancel: t => { tone(seGain, 'square', 440, t, 0.07, 0.22); tone(seGain, 'square', 300, t + 0.06, 0.1, 0.18); },
  se_attack: t => { noise(seGain, t, 0.1, 0.3, 2600); tone(seGain, 'sawtooth', 220, t, 0.1, 0.16, 90); },
  se_magic:  t => { tone(seGain, 'sine', 330, t, 0.26, 0.2, 1320); tone(seGain, 'triangle', 660, t + 0.04, 0.22, 0.12, 1980); },
  se_hit:    t => { noise(seGain, t, 0.14, 0.34, 1100); tone(seGain, 'square', 150, t, 0.12, 0.2, 70); },
  se_heal:   t => { [523, 659, 784].forEach((f, i) => tone(seGain, 'sine', f, t + i * 0.055, 0.2, 0.16)); },
  se_status: t => { tone(seGain, 'triangle', 300, t, 0.22, 0.18, 200); tone(seGain, 'triangle', 240, t + 0.1, 0.2, 0.14, 300); },
  se_gain:   t => { [523, 659, 784, 1046].forEach((f, i) => tone(seGain, 'square', f, t + i * 0.07, 0.16, 0.2)); },
  se_alert:  t => { tone(seGain, 'sawtooth', 200, t, 0.3, 0.22, 110); noise(seGain, t, 0.2, 0.18, 700); },
  /* 大技。ためてから撃つ感じにする（上がる音 → 一撃 → 余韻） */
  se_ultimate: t => {
    tone(seGain, 'sawtooth', 120, t, 0.34, 0.16, 700);          // ため
    tone(seGain, 'square', 180, t + 0.02, 0.3, 0.1, 900);
    noise(seGain, t + 0.32, 0.36, 0.34, 2400);                   // 着弾
    tone(seGain, 'sawtooth', 320, t + 0.32, 0.4, 0.22, 60);
    [784, 988, 1319].forEach((f, i) => tone(seGain, 'sine', f, t + 0.36 + i * 0.05, 0.3, 0.12));
  },
};
const seLast = {};

/* ---------- 外から使うもの ---------- */
G.Audio = {
  get ready() { return !!ctx; },
  get settings() { return Object.assign({}, settings); },

  /* 最初のタップで呼ぶ。これを通らないとスマートフォンでは鳴らない。 */
  unlock() {
    if (!makeCtx()) return false;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      /* iPhone は「無音でも一度鳴らす」ことで出口が開く */
      const b = ctx.createBufferSource();
      b.buffer = ctx.createBuffer(1, 1, 22050);
      b.connect(ctx.destination); b.start(0);
    } catch (e) { return false; }
    if (current) G.Audio.bgm(current, true);
    return true;
  },

  /* BGMを切り替える。同じ曲なら何もしない（ぶつ切りを防ぐ） */
  bgm(id, force) {
    if (!force && current === id) return;
    current = id;
    if (!ctx || !settings.bgm) return;
    G.Audio.stopBgm(true);
    current = id;
    if (!(G.MUSIC || {})[id]) return;
    step = 0;
    nextTime = ctx.currentTime + 0.05;
    schedule();
    timer = setInterval(schedule, TICK);
  },

  stopBgm(keepId) {
    if (timer) { clearInterval(timer); timer = null; }
    for (const o of playing) { try { o.stop(); } catch (e) {} }
    playing = [];
    if (!keepId) current = null;
  },

  /* 効果音。同じ音が短時間に重なると割れるので間引く。 */
  se(id) {
    if (!ctx || !settings.se) return;
    const f = SE[id];
    if (!f) { if (G.Err && G.Err.dev) console.warn('[G.Audio] 未定義の効果音:', id); return; }
    const now = ctx.currentTime;
    if (seLast[id] && now - seLast[id] < 0.06) return;
    seLast[id] = now;
    try { f(now + 0.005); } catch (e) { /* 鳴らせなくても続行 */ }
  },

  /* ---------- 設定 ---------- */
  setEnabled(kind, on) {
    if (kind === 'bgm') {
      settings.bgm = !!on;
      if (bgmGain) bgmGain.gain.value = on ? settings.bgmVol : 0;
      if (on) { const id = current; current = null; G.Audio.bgm(id); }
      else G.Audio.stopBgm(true);
    } else {
      settings.se = !!on;
      if (seGain) seGain.gain.value = on ? settings.seVol : 0;
    }
    saveSettings();
  },

  setVolume(kind, v) {
    v = Math.min(1, Math.max(0, Number(v) || 0));
    if (kind === 'bgm') { settings.bgmVol = v; if (bgmGain && settings.bgm) bgmGain.gain.value = v; }
    else { settings.seVol = v; if (seGain && settings.se) seGain.gain.value = v; }
    saveSettings();
  },

  /* 他のアプリに切り替わったとき */
  suspend() { try { if (ctx && ctx.state === 'running') ctx.suspend(); } catch (e) {} },
  resume() { try { if (ctx && ctx.state === 'suspended') ctx.resume(); } catch (e) {} },

  /* ---------- 見本の書き出し ----------
   * 曲を音声データにする。見本を作って聴いてもらうためのもので、
   * 遊ぶときには使わない。
   * ここに置いてあるのは、実際に鳴る音とまったく同じ経路で書き出すため。
   * 別に書き起こすと、聴いた見本と実際の音がずれていく。 */
  renderTo(seconds, id, sampleRate) {
    const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const song = (G.MUSIC || {})[id];
    if (!OC || !song) return Promise.resolve(null);

    // いまの状態を退避し、書き出し用の出口に差し替える
    const keep = { ctx, master, bgmGain, seGain, noiseBuf, playing };
    const rate = sampleRate || 44100;
    ctx = new OC(1, Math.ceil(rate * seconds), rate);
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    bgmGain = ctx.createGain(); bgmGain.gain.value = 0.6; bgmGain.connect(master);
    seGain = ctx.createGain(); seGain.gain.value = 0; seGain.connect(master);
    noiseBuf = null;
    playing = [];

    const spb = 60 / song.tempo / (song.div || 4);
    let t = 0, i = 0;
    while (t < seconds) {
      for (const v of song.voices) {
        const tok = v.seq[i % v.seq.length];
        if (tok && tok !== '.' && tok !== '-') {
          tone(bgmGain, v.wave || 'triangle', freq(tok), t, spb * (v.len || 0.9), v.gain || 0.2);
        }
      }
      t += spb; i++;
    }

    const out = ctx.startRendering();
    // 元に戻す（遊んでいる最中でも壊れないように）
    ctx = keep.ctx; master = keep.master; bgmGain = keep.bgmGain;
    seGain = keep.seGain; noiseBuf = keep.noiseBuf; playing = keep.playing;
    return out;
  },
};

loadSettings();

})();
