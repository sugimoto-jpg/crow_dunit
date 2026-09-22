/* ===== BGMの楽譜 =====
 * 音声ファイルではなく「どの音をいつ鳴らすか」だけを書く。
 * 全7曲で数KBしかないので、ダウンロード版の1ファイルを崩さない。
 *
 * 書きかた:
 *   tempo  1分あたりの拍数
 *   div    1拍を何分割するか（4なら16分音符）
 *   voices 同時に鳴らす声部。上から主旋律・和音・低音
 *     wave  音色 square(ファミコン風) / triangle(やわらかい) / sawtooth(鋭い) / sine(丸い)
 *     gain  音量
 *     len   音の長さ（1ステップに対する割合）
 *     seq   音名の並び。'.' は伸ばす、'-' は休み
 *
 * 将来きちんとした楽曲に差し替えるときは、この表を
 * 音声ファイルの指定に置き換えればよい（src/core/audio.js の説明を参照）。
 */
/* 楽譜を読みやすく書くために小さな道具（S）を使うので、
 * 他のファイルから見えないよう全体を包んでいる。 */
(function () {
'use strict';

window.G = window.G || {};

/* 文字列を配列にする。'A4 - C5' → ['A4','-','C5'] */
const S = str => str.trim().split(/\s+/);

G.MUSIC = {

  /* ---------- タイトル：静かに、これから始まる予感 ---------- */
  bgm_title: {
    tempo: 72, div: 2,
    voices: [
      { wave: 'triangle', gain: 0.20, len: 1.6, seq: S(`
        A4 . . . E5 . . . C5 . . . B4 . . .
        G4 . . . D5 . . . B4 . . . A4 . . .
        F4 . . . C5 . . . A4 . . . G4 . . .
        E4 . . . B4 . . . G4 . . . A4 . . . `) },
      { wave: 'sine', gain: 0.13, len: 3.4, seq: S(`
        A3 . . . . . . . C4 . . . . . . .
        G3 . . . . . . . B3 . . . . . . .
        F3 . . . . . . . A3 . . . . . . .
        E3 . . . . . . . E3 . . . . . . . `) },
    ],
  },

  /* ---------- 学院：穏やかな日常 ---------- */
  bgm_academy: {
    tempo: 104, div: 2,
    voices: [
      { wave: 'triangle', gain: 0.17, len: 1.1, seq: S(`
        E4 - G4 - C5 - B4 - A4 - G4 - E4 - D4 -
        F4 - A4 - C5 - D5 - C5 - A4 - F4 - E4 -
        G4 - B4 - D5 - E5 - D5 - B4 - G4 - F4 -
        E4 - C5 - B4 - G4 - A4 - G4 - E4 - - - `) },
      { wave: 'square', gain: 0.055, len: 0.8, seq: S(`
        C3 - E3 - G3 - E3 - C3 - E3 - G3 - E3 -
        F3 - A3 - C4 - A3 - F3 - A3 - C4 - A3 -
        G3 - B3 - D4 - B3 - G3 - B3 - D4 - B3 -
        C3 - E3 - G3 - E3 - G3 - B3 - D4 - - - `) },
    ],
  },

  /* ---------- 街・ギルド：賑やかで軽い ---------- */
  bgm_town: {
    tempo: 128, div: 2,
    voices: [
      { wave: 'square', gain: 0.13, len: 0.9, seq: S(`
        F4 - A4 C5 - A4 F4 - C5 - A4 F4 - A4 - -
        C4 - E4 G4 - E4 C4 - G4 - E4 C4 - E4 - -
        G4 - B4 D5 - B4 G4 - D5 - B4 G4 - B4 - -
        A4 - C5 E5 - C5 A4 - E5 - C5 A4 - - - - `) },
      { wave: 'triangle', gain: 0.12, len: 1.6, seq: S(`
        F2 . . . C3 . . . F2 . . . A2 . . .
        C2 . . . G2 . . . C2 . . . E2 . . .
        G2 . . . D3 . . . G2 . . . B2 . . .
        A2 . . . E3 . . . A2 . . . E3 . . . `) },
    ],
  },

  /* ---------- 探索：旅の途中、少しの不安 ---------- */
  bgm_field: {
    tempo: 112, div: 2,
    voices: [
      { wave: 'triangle', gain: 0.17, len: 1.2, seq: S(`
        D4 - F4 - A4 - D5 - C5 - A4 - F4 - D4 -
        Bb3 - D4 - F4 - Bb4 - A4 - F4 - D4 - Bb3 -
        F4 - A4 - C5 - F5 - E5 - C5 - A4 - F4 -
        C4 - E4 - G4 - C5 - D5 - C5 - A4 - - - `) },
      { wave: 'sine', gain: 0.13, len: 1.8, seq: S(`
        D2 - - - A2 - - - D2 - - - F2 - - -
        Bb1 - - - F2 - - - Bb1 - - - D2 - - -
        F2 - - - C3 - - - F2 - - - A2 - - -
        C2 - - - G2 - - - C2 - - - G2 - - - `) },
    ],
  },

  /* ---------- 通常戦闘：疾走 ---------- */
  bgm_battle: {
    tempo: 156, div: 4,
    voices: [
      { wave: 'square', gain: 0.13, len: 0.85, seq: S(`
        A4 - A4 - C5 - E5 - D5 - C5 - B4 - A4 -
        A4 - A4 - C5 - E5 - G5 - E5 - D5 - C5 -
        F4 - F4 - A4 - C5 - E5 - C5 - A4 - F4 -
        G4 - B4 - D5 - G5 - F5 - D5 - B4 - G4 - `) },
      { wave: 'sawtooth', gain: 0.09, len: 0.55, seq: S(`
        A2 A2 - A2 A2 - A2 - A2 A2 - A2 A2 - A2 -
        A2 A2 - A2 A2 - A2 - A2 A2 - A2 A2 - A2 -
        F2 F2 - F2 F2 - F2 - F2 F2 - F2 F2 - F2 -
        G2 G2 - G2 G2 - G2 - G2 G2 - G2 G2 - G2 - `) },
    ],
  },

  /* ---------- ボス戦：重く、迫る ---------- */
  bgm_boss: {
    tempo: 146, div: 4,
    voices: [
      { wave: 'square', gain: 0.13, len: 0.8, seq: S(`
        D4 - D4 - F4 - A4 - D5 - A4 - F4 - D4 -
        D4 - D4 - F4 - Bb4 - D5 - Bb4 - F4 - D4 -
        Bb3 - Bb3 - D4 - F4 - Bb4 - F4 - D4 - Bb3 -
        A3 - A3 - C#4 - E4 - A4 - E4 - C#4 - A3 - `) },
      { wave: 'sawtooth', gain: 0.10, len: 0.5, seq: S(`
        D2 D2 D2 - D2 D2 - D2 D2 D2 D2 - D2 D2 - D2
        D2 D2 D2 - D2 D2 - D2 D2 D2 D2 - D2 D2 - D2
        Bb1 Bb1 Bb1 - Bb1 Bb1 - Bb1 Bb1 Bb1 Bb1 - Bb1 Bb1 - Bb1
        A1 A1 A1 - A1 A1 - A1 A1 A1 A1 - A1 A1 - A1 `) },
      { wave: 'triangle', gain: 0.07, len: 2.2, seq: S(`
        A4 . . . . . . . A4 . . . . . . .
        Bb4 . . . . . . . Bb4 . . . . . . .
        F4 . . . . . . . F4 . . . . . . .
        E4 . . . . . . . E4 . . . . . . . `) },
    ],
  },

  /* ---------- 決戦：壮大に ---------- */
  bgm_final: {
    tempo: 138, div: 4,
    voices: [
      { wave: 'square', gain: 0.14, len: 0.9, seq: S(`
        C5 - Eb5 - G5 - C6 - Bb5 - G5 - Eb5 - C5 -
        Ab4 - C5 - Eb5 - Ab5 - G5 - Eb5 - C5 - Ab4 -
        Eb5 - G5 - Bb5 - Eb6 - D6 - Bb5 - G5 - Eb5 -
        Bb4 - D5 - F5 - Bb5 - C6 - Bb5 - G5 - - - `) },
      { wave: 'triangle', gain: 0.10, len: 1.8, seq: S(`
        C4 . . . G4 . . . C4 . . . Eb4 . . .
        Ab3 . . . Eb4 . . . Ab3 . . . C4 . . .
        Eb4 . . . Bb4 . . . Eb4 . . . G4 . . .
        Bb3 . . . F4 . . . Bb3 . . . D4 . . . `) },
      { wave: 'sawtooth', gain: 0.09, len: 0.5, seq: S(`
        C2 C2 - C2 C2 - C2 - C2 C2 - C2 C2 - C2 -
        Ab1 Ab1 - Ab1 Ab1 - Ab1 - Ab1 Ab1 - Ab1 Ab1 - Ab1 -
        Eb2 Eb2 - Eb2 Eb2 - Eb2 - Eb2 Eb2 - Eb2 Eb2 - Eb2 -
        Bb1 Bb1 - Bb1 Bb1 - Bb1 - Bb1 Bb1 - Bb1 Bb1 - Bb1 - `) },
    ],
  },
};

})();
