/* ===== 声 =====
 * 掛け声と、物語の読み上げ。
 *
 * 音源ファイルは持たない。
 * 声優の録音を入れると
 *   ・1ファイル完結（ダウンロード版）が崩れる
 *   ・容量が数十MBになる
 *   ・権利の手当てが要る
 * ため、端末に入っている読み上げ機能（Web Speech API）を使う。
 *
 * 正直に書いておくと、これは合成音声であって声優の演技ではない。
 * ただし
 *   ・0バイトで済む
 *   ・iPhone / Android / PC のどれにも日本語の声が入っている
 *   ・通信がなくても喋る
 * ので、雰囲気を足す用途には十分に働く。
 * あとで録音に差し替えるときは、speak() の中だけを替えればよい。
 *
 * 大事にしていること:
 *   1. 声が使えない端末でも、ゲームは普通に遊べる（全部が空振りになるだけ）
 *   2. 読み上げがゲームの進行を止めない（待たない）
 *   3. 前の声が残らない（画面が変わったら必ず止める）
 */
(function () {
'use strict';

window.G = window.G || {};

const KEY = 'ta.voice';
const syn = (typeof window !== 'undefined' && window.speechSynthesis) || null;

const settings = { shout: true, story: true, volume: 1.0, rate: 1.05 };

/* キャラごとの声色。同じ合成音声でも、高さと速さを変えると
 * 「別の人が喋っている」ように聞こえる。 */
const TONE = {
  player: { pitch: 1.00, rate: 1.12 },
  riina:  { pitch: 1.38, rate: 1.08 },
  velt:   { pitch: 0.82, rate: 1.00 },
  noa:    { pitch: 1.18, rate: 1.22 },
  foe:    { pitch: 0.62, rate: 0.92 },
  boss:   { pitch: 0.50, rate: 0.86 },
  narrator: { pitch: 0.96, rate: 1.02 },
};

/* 技を出すときの短い掛け声。
 * 主人公の名前はプレイヤーが決めるので、性別を決め打ちにしない。 */
const CRY = ['はあっ', 'せいっ', 'いくよ', 'そこだ', 'くらえっ', 'とどけっ'];

let voice = null;         // 選ばれた日本語の声
let looked = false;       // 声の一覧を見たか
let lastShout = 0;

function load() {
  try {
    const raw = G.Storage && G.Storage.get(KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    for (const k of ['shout', 'story']) if (typeof o[k] === 'boolean') settings[k] = o[k];
    for (const k of ['volume', 'rate']) if (typeof o[k] === 'number') settings[k] = o[k];
  } catch (e) { /* 壊れていたら既定値 */ }
}
function save() {
  try { G.Storage && G.Storage.set(KEY, JSON.stringify(settings)); } catch (e) {}
}

/* 日本語の声を選ぶ。
 * 一覧は非同期で増えることがあるので、呼ばれるたびに選び直す。 */
function pick() {
  if (!syn) return null;
  let list = [];
  try { list = syn.getVoices() || []; } catch (e) { return null; }
  if (!list.length) return voice;
  looked = true;
  const ja = list.filter(v => /^ja/i.test(v.lang || ''));
  if (!ja.length) { voice = null; return null; }
  /* 端末に入っている声（localService）を優先する。
   * 通信して合成する声は、遅れて鳴ったり、圏外で黙ったりする。 */
  voice = ja.find(v => v.localService) || ja[0];
  return voice;
}

G.Voice = {
  /* 読み上げの仕組みがあるか（無い端末では全部が空振りになる） */
  get supported() { return !!syn; },
  /* 日本語の声が見つかったか。見つからない端末では喋らせない。
   * 英語の声で日本語を読ませると、意味の取れない音になるため。 */
  get ready() { return !!(syn && (voice || pick())); },
  get settings() { return Object.assign({}, settings); },
  get tone() { return TONE; },
  CRY,

  init() {
    if (!syn) return false;
    load();
    pick();
    /* 声の一覧はあとから届くことがある */
    try {
      if (typeof syn.addEventListener === 'function') {
        syn.addEventListener('voiceschanged', pick);
      } else { syn.onvoiceschanged = pick; }
    } catch (e) {}
    return true;
  },

  /* 読む。待たない。失敗しても黙って諦める。 */
  speak(text, opts) {
    if (!syn || !text) return false;
    if (!G.Voice.ready) return false;
    const o = opts || {};
    try {
      /* 前の声を必ず止める。
       * 止めないと、連続で技を出したときに何十秒も喋り続ける。 */
      syn.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      u.voice = voice;
      u.lang = (voice && voice.lang) || 'ja-JP';
      u.pitch = o.pitch == null ? 1 : o.pitch;
      u.rate = (o.rate == null ? 1 : o.rate) * settings.rate;
      u.volume = settings.volume;
      syn.speak(u);
      return true;
    } catch (e) { return false; }
  },

  stop() { try { if (syn) syn.cancel(); } catch (e) {} },

  /* ---------- 戦闘の掛け声 ---------- */
  /* actor は戦闘ユニット。skill は使った技（通常攻撃なら basic が立つ）。 */
  toneOf(actor) {
    if (!actor) return TONE.narrator;
    if (actor.side !== 'ally') return actor.isBoss ? TONE.boss : TONE.foe;
    const key = actor.ref && actor.ref.key;
    return TONE[key] || (actor.ref && actor.ref.isPlayer ? TONE.player : TONE.noa);
  },

  shout(actor, skill, big) {
    if (!settings.shout || !G.Voice.ready || !actor) return false;
    /* 雑魚の通常攻撃までいちいち喋ると、うるさいだけで盛り上がらない。 */
    const isFoe = actor.side !== 'ally';
    if (isFoe && !actor.isBoss && !big) return false;

    const now = Date.now();
    /* 大技は必ず喋る。それ以外は間隔をあけて、たまに。 */
    if (!big) {
      if (now - lastShout < 2600) return false;
      if (skill && skill.basic && Math.random() > 0.3) return false;
      if (!skill && Math.random() > 0.3) return false;
    }
    lastShout = now;

    const t = G.Voice.toneOf(actor);
    /* 大技は技名を叫ぶ。これが一番それらしく聞こえる。 */
    const text = big && skill && skill.name ? skill.name
      : CRY[Math.floor(Math.random() * CRY.length)];
    return G.Voice.speak(text, { pitch: t.pitch, rate: t.rate * (big ? 0.95 : 1.15) });
  },

  /* ---------- 物語の読み上げ ---------- */
  /* who は話者名（地の文なら null）。読点で切って読みやすくする。 */
  narrate(text, who) {
    if (!settings.story || !G.Voice.ready || !text) return false;
    const t = who ? (G.Voice.speakerTone(who) || TONE.narrator) : TONE.narrator;
    return G.Voice.speak(text, { pitch: t.pitch, rate: t.rate });
  },

  /* 話者名から声色を選ぶ。
   * 名前は物語の中で変わる（「？？？」→「女神リュミエル」）ので、
   * 一致しなければ名前そのものから決める。同じ名前なら必ず同じ声になる。 */
  speakerTone(who) {
    const d = G.State && G.State.data;
    if (d && d.player && who === d.player.name) return TONE.player;
    const named = { 'リィナ': TONE.riina, 'ヴェルト': TONE.velt, 'ノア': TONE.noa };
    if (named[who]) return named[who];
    let h = 0;
    for (let i = 0; i < who.length; i++) h = (h * 31 + who.charCodeAt(i)) % 1000;
    return { pitch: 0.7 + (h % 70) / 100, rate: 0.95 + (h % 20) / 100 };
  },

  /* ---------- 設定 ---------- */
  setEnabled(kind, on) {
    if (kind === 'shout') settings.shout = !!on;
    else settings.story = !!on;
    if (!on) G.Voice.stop();
    save();
  },
};

G.Voice.init();

})();
