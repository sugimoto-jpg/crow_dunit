/* ===== キャラクター描画 =====
 * 外部画像は読み込めない（配信時にブロックされる）ため、
 * キャラクターはすべてインラインSVGで描く。
 *
 * 体を「脚・胴・頭・後ろ腕・前腕・武器」のパーツに分け、
 * それぞれ class を振ってCSS側で動かせるようにしてある。
 * viewBox は 0 0 64 84 で統一し、地面は y=80。
 */
(function () {
'use strict';
/* ↑ このファイル内で作った名前を、他のファイルから見えないように閉じ込めている。
   全ファイルは1つのスクリプトに連結されるため、包まないと名前が衝突しうる。
   中身のインデントは変えていない（差分を小さく保つため）。 */

window.G = window.G || {};

/* ---------- 配色 ---------- */
const SKIN = '#f2caa4';
const SKIN_D = '#d9a87d';
const LINE = '#241a38';

G.SPRITE_PAL = {
  villager: { main: '#c2b295', sub: '#8d7b5e', accent: '#7d9b5c', metal: '#b7b7c2', hair: '#6b4426', eye: '#4a7a5c' },
  mage:     { main: '#5b3fa8', sub: '#3a2770', accent: '#c9a6ff', metal: '#e3d4ff', hair: '#4a3b6b', eye: '#7c5ad6' },
  knight:   { main: '#7c8595', sub: '#4d5462', accent: '#d94f5c', metal: '#e4e9f2', hair: '#6b4a2f', eye: '#3f6bbf' },
  cleric:   { main: '#f3ecdd', sub: '#cfc1a4', accent: '#f2c14e', metal: '#f7e6b8', hair: '#c8a45e', eye: '#c9903a' },
  scout:    { main: '#3f6b53', sub: '#27402f', accent: '#8fd6a8', metal: '#cfd8d2', hair: '#4a4a5e', eye: '#3f8f6b' },
};

/* ジョブ -> 見た目の系統（土台となる5系統） */
G.SPRITE_ARCH = {
  villager: 'villager',
  apprentice_mage: 'mage', sorcerer: 'mage', elementalist: 'mage',
  archmage: 'mage', spirit_lord: 'mage', sage: 'mage',
  apprentice_knight: 'knight', swordsman: 'knight', guardian: 'knight',
  magic_swordsman: 'knight', paladin: 'knight', sword_saint: 'knight',
  apprentice_cleric: 'cleric', priest: 'cleric', exorcist: 'cleric',
  bishop: 'cleric', inquisitor: 'cleric', saint: 'cleric',
  apprentice_scout: 'scout', thief: 'scout', ranger: 'scout',
  ninja: 'scout', sniper: 'scout', shadow_emperor: 'scout',
};

/* ---------- 職業ごとの見た目 ----------
 * 「どの職業が、どう見えるか」をここ1か所にまとめる。
 * 系統(5種)だけで描くと、同じ系統の6職がほぼ同じ絵になってしまうため、
 * 職業ごとの違いをこの表で足していく。
 *
 * 書ける項目（すべて任意。書かなければ系統の既定どおり）
 *   head    頭の形。省略すると系統の既定
 *   body    体の形。省略すると系統の既定
 *   weapon  武器を持っていないときに描く形
 *   cape    マントの有無。省略すると「Tier2以上で付く」
 *   pal     色の上書き（main / sub / accent / metal）
 *   deco    その職だけの飾り
 *
 * 将来、絵（画像）に差し替えるときは、ここに img を足して
 * 描画側で切り替えれば、ゲーム側のコードは変えずに済む。
 */
G.SPRITE_JOB = {
  /* Tier0 */
  villager: {},
  /* 剣士系：見習いの革鎧から、板金・外套・白銀を経て、鎧を脱いだ剣聖まで */
  apprentice_knight: {
    head: 'k_bare', body: 'k_leather', weapon: 'sword', cape: false,
    pal: { main: '#8a6e52', sub: '#5c4735', accent: '#d94f5c', metal: '#c9b79a' },
  },
  swordsman: {
    head: 'k_band', body: 'k_chain', weapon: 'sword', cape: false,
    pal: { main: '#7c8595', sub: '#4d5462', accent: '#d94f5c' },
  },
  guardian: {
    head: 'k_full', body: 'k_plate', weapon: 'sword', cape: true,
    pal: { main: '#5f6a7d', sub: '#39414f', accent: '#c7902f', metal: '#aab4c4' },
    deco: shieldSvg,
  },
  magic_swordsman: {
    head: 'k_hood', body: 'k_coat', weapon: 'sword', cape: false,
    pal: { main: '#6a5e93', sub: '#3d3560', accent: '#b98cff', metal: '#d9d2f2' },
  },
  paladin: {
    head: 'k_wing', body: 'k_holy', weapon: 'sword', cape: true,
    pal: { main: '#dfe4ee', sub: '#a8b2c6', accent: '#f2c14e', metal: '#f4f7fc' },
    deco: shieldSvg,
  },
  sword_saint: {
    head: 'k_ribbon', body: 'k_gi', weapon: 'sword', cape: false,
    pal: { main: '#2f3550', sub: '#1d2135', accent: '#f2c14e', metal: '#e8edf7' },
  },
  /* 魔術系：布の帽子から、とんがり帽・光輪・頭巾へ */
  apprentice_mage: {
    head: 'm_cap', body: 'm_simple', weapon: 'staff', cape: false,
    pal: { main: '#6b5aa8', sub: '#443379', accent: '#c9a6ff' },
  },
  sorcerer: {
    head: 'm_hat', body: 'm_belt', weapon: 'staff', cape: false,
    pal: { main: '#5b3fa8', sub: '#3a2770', accent: '#c9a6ff' },
  },
  elementalist: {
    head: 'm_crown', body: 'm_shawl', weapon: 'staff', cape: false,
    pal: { main: '#3f7a86', sub: '#27515c', accent: '#8fe0c9', metal: '#d9f2ea' },
  },
  archmage: {
    head: 'm_tall', body: 'm_grand', weapon: 'staff', cape: true,
    pal: { main: '#432b7d', sub: '#2a1a55', accent: '#f2c14e', metal: '#e3d4ff' },
  },
  spirit_lord: {
    head: 'm_halo', body: 'm_veil', weapon: 'staff', cape: false,
    pal: { main: '#b9e4f2', sub: '#79aec4', accent: '#7fe0ff', metal: '#ffffff' },
  },
  sage: {
    head: 'm_sage', body: 'm_sagebody', weapon: 'staff', cape: true,
    pal: { main: '#e8e3f5', sub: '#9d92c4', accent: '#f2c14e', metal: '#ffffff' },
  },
  /* 神官系：短いベールから、法冠・鉄仮面・光輪へ */
  apprentice_cleric: {
    head: 'c_veil', body: 'c_plain', weapon: 'mace', cape: false,
    pal: { main: '#f3ecdd', sub: '#cfc1a4', accent: '#e0c98a' },
  },
  priest: {
    head: 'c_hood', body: 'c_robe', weapon: 'mace', cape: false,
    pal: { main: '#f7f2e6', sub: '#cfc1a4', accent: '#f2c14e' },
  },
  exorcist: {
    head: 'c_blind', body: 'c_talis', weapon: 'mace', cape: false,
    pal: { main: '#6f5f7d', sub: '#443a52', accent: '#c98ae0', metal: '#efe6d2' },
  },
  bishop: {
    head: 'c_mitre', body: 'c_stole', weapon: 'mace', cape: true,
    pal: { main: '#fdf8ee', sub: '#d2c3a2', accent: '#f2c14e', metal: '#fff7dd' },
  },
  inquisitor: {
    head: 'c_mask', body: 'c_iron', weapon: 'mace', cape: true,
    pal: { main: '#3a3242', sub: '#241f2c', accent: '#d94f5c', metal: '#b9bcc7' },
  },
  saint: {
    head: 'c_halo', body: 'c_light', weapon: 'mace', cape: false,
    pal: { main: '#fffdf6', sub: '#ded2b4', accent: '#ffd76b', metal: '#ffffff' },
  },
  /* 斥候系：布のずきんから、覆面・つば帽・角の頭巾へ */
  apprentice_scout: {
    head: 's_cloth', body: 's_light', weapon: 'dagger', cape: false,
    pal: { main: '#5c7a5e', sub: '#3a4f3c', accent: '#b9d6a0' },
  },
  thief: {
    head: 's_mask', body: 's_belts', weapon: 'dagger', cape: false,
    pal: { main: '#4a5a6b', sub: '#2c3743', accent: '#e0b45c', metal: '#cfd8e2' },
  },
  ranger: {
    head: 's_feather', body: 's_quiver', weapon: 'bow', cape: false,
    pal: { main: '#6b5a3a', sub: '#453723', accent: '#9fd66b', metal: '#d8cfae' },
  },
  ninja: {
    head: 's_ninja', body: 's_gi', weapon: 'dagger', cape: false,
    pal: { main: '#2b3040', sub: '#191d28', accent: '#d94f5c', metal: '#c3c9d6' },
  },
  sniper: {
    head: 's_scope', body: 's_coat', weapon: 'bow', cape: false,
    pal: { main: '#3f5a5c', sub: '#26393b', accent: '#7fe0d0', metal: '#d2e2e0' },
  },
  shadow_emperor: {
    head: 's_shadow', body: 's_veilshadow', weapon: 'dagger', cape: false,
    pal: { main: '#2a2140', sub: '#171126', accent: '#a86bff', metal: '#cfc0f0' },
  },
};

/* 仲間ごとの髪色（同じ系統でも見分けがつくように） */
G.SPRITE_HAIR = {
  player: '#6b4a2f', riina: '#f0d089', velt: '#c0533a', noa: '#59566e',
};

/* 仲間ごとの差し色。
 * 同じ職業に就いた仲間どうしを見分けるためのもの。
 *
 * ここで main（服の地の色）まで変えると、職業ごとに決めた色が消えてしまう。
 * 実際、ヴェルトを大魔道士にしても紫の法衣にならず、
 * ノアを影皇にしても緑のままだった。
 * そのため、上書きするのは差し色だけにしている。髪の色は SPRITE_HAIR 側。 */
G.SPRITE_TINT = {
  player: { accent: '#f2c14e' },   // 金
  riina:  { accent: '#ff9ec4' },   // 桜色
  velt:   { accent: '#d94f5c' },   // 赤
  noa:    { accent: '#7fe0a8' },   // 若草
};

/* ---------- 飾り ---------- */
/* 盾。後ろ側の腕（画面左）に構える。
 * G.SPRITE_JOB の deco に入れて使う。 */
function shieldSvg(pal) {
  return `<g class="s-shield">
    <path d="M13 40 q7 -4 14 0 q0 13 -7 19 q-7 -6 -7 -19 z"
          fill="${pal.metal}" stroke="${LINE}" stroke-width="1.4"/>
    <path d="M16 43 q4 -2 8 0 q0 9 -4 13 q-4 -4 -4 -13 z"
          fill="${pal.accent}" stroke="${LINE}" stroke-width="1.1" opacity=".9"/>
  </g>`;
}

/* ---------- 武器 ---------- */
/* 前腕の先（32,20 付近）に付く。刃は上向きに描く。 */
function weaponSvg(shape, pal) {
  switch (shape) {
    case 'sword':
      return `<g class="s-weap">
        <rect x="29.4" y="-26" width="5.2" height="34" rx="1.6" fill="${pal.metal}" stroke="${LINE}" stroke-width="1.3"/>
        <path d="M29.4 -26 L32 -34 L34.6 -26 Z" fill="${pal.metal}" stroke="${LINE}" stroke-width="1.3"/>
        <rect x="25" y="7" width="14" height="3.5" rx="1.5" fill="${pal.accent}" stroke="${LINE}" stroke-width="1"/>
        <rect x="30.5" y="10" width="3" height="7" rx="1.5" fill="${pal.sub}" stroke="${LINE}" stroke-width="1"/>
      </g>`;
    case 'dagger':
      return `<g class="s-weap">
        <rect x="30.5" y="-8" width="3" height="16" rx="1" fill="${pal.metal}" stroke="${LINE}" stroke-width="1.1"/>
        <path d="M30.5 -8 L32 -13 L33.5 -8 Z" fill="${pal.metal}" stroke="${LINE}" stroke-width="1.1"/>
        <rect x="27" y="7" width="10" height="3" rx="1.5" fill="${pal.accent}" stroke="${LINE}" stroke-width="1"/>
        <rect x="30.5" y="9" width="3" height="6" rx="1.5" fill="${pal.sub}" stroke="${LINE}" stroke-width="1"/>
      </g>`;
    case 'staff':
      return `<g class="s-weap">
        <rect x="30.5" y="-20" width="3" height="42" rx="1.5" fill="#8a6b45" stroke="${LINE}" stroke-width="1.2"/>
        <circle cx="32" cy="-23" r="6" fill="${pal.accent}" stroke="${LINE}" stroke-width="1.3"/>
        <circle cx="30" cy="-25" r="2" fill="#fff" opacity=".75"/>
        <circle class="s-orb" cx="32" cy="-23" r="9" fill="${pal.accent}" opacity=".25"/>
      </g>`;
    case 'mace':
      return `<g class="s-weap">
        <rect x="30.5" y="-14" width="3" height="34" rx="1.5" fill="#8a6b45" stroke="${LINE}" stroke-width="1.2"/>
        <path d="M26 -16 h12 v6 a6 6 0 0 1 -12 0 z" fill="${pal.metal}" stroke="${LINE}" stroke-width="1.2"/>
        <circle cx="32" cy="-19" r="3.5" fill="${pal.accent}" stroke="${LINE}" stroke-width="1.1"/>
      </g>`;
    case 'bow':
      return `<g class="s-weap">
        <path d="M38 -18 Q24 2 38 22" fill="none" stroke="#8a6b45" stroke-width="3.2" stroke-linecap="round"/>
        <path d="M38 -18 L38 22" fill="none" stroke="${pal.metal}" stroke-width="1.2" opacity=".85"/>
      </g>`;
    default: // stick
      return `<g class="s-weap">
        <rect x="30.5" y="-10" width="3" height="28" rx="1.5" fill="#8a6b45" stroke="${LINE}" stroke-width="1.2"/>
        <path d="M33 -6 l5 -5" stroke="#8a6b45" stroke-width="2.4" stroke-linecap="round"/>
      </g>`;
  }
}

/* ---------- 頭 ---------- */
/* kind は見た目の型。既定では系統名と同じだが、
 * 職業ごとに別の型を指定できるようにしてある。 */
/* 色を暗くする（髪の影用） */
function darken(hex, amt) {
  const n = parseInt(String(hex).slice(1), 16);
  const ch = i => Math.max(0, Math.round(((n >> (16 - i * 8)) & 255) * (1 - amt)));
  return '#' + [0, 1, 2].map(i => ch(i).toString(16).padStart(2, '0')).join('');
}

/* 髪。
 * 以前は頭にかぶせた丸い帽子のような形だったため、
 * どの職業も同じ輪郭に見えてしまっていた。
 * 後ろ髪・横の毛束・前髪の3層に分け、毛先を尖らせて動きを出す。
 *   back  … 顔より先に描く（後頭部と横の毛束）
 *   front … 顔の上に描く（前髪と艶）
 */
function hairSvg(col) {
  const d = darken(col, 0.26);
  return {
    back: `<g class="s-hairB">
      <path d="M14 33 q-2 -30 18 -30 q20 0 18 30 q-2 5 -4 1 q3 -22 -14 -22 q-17 0 -14 22 q-2 4 -4 -1 z"
            fill="${col}" stroke="${LINE}" stroke-width="1.3"/>
      <path d="M16 25 q-4 11 -2 19 q5 -1 6 -5 q-3 -7 -1 -14 z"
            fill="${d}" stroke="${LINE}" stroke-width="1.2"/>
      <path d="M48 25 q4 11 2 19 q-5 -1 -6 -5 q3 -7 1 -14 z"
            fill="${d}" stroke="${LINE}" stroke-width="1.2"/>
    </g>`,
    front: `<g class="s-hairF">
      <path d="M18 21 q0 -18 14 -18 q14 0 14 18
               q-3 -4 -6 -4 l-2 5 l-3 -6 l-4 7 l-3 -6 l-3 5 l-2 -4 q-3 0 -5 3 z"
            fill="${col}" stroke="${LINE}" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M22 15 q4 -7 11 -7 q-6 3 -8 9 z" fill="#fff" opacity=".22"/>
    </g>`,
  };
}

/* 目。アニメ調に、白目・虹彩・瞳・光の点を重ねて描く。
 * 点を2つ置くだけだった頃より、ぐっと表情が出る。
 * 影やまつ毛も入れるが、線は最小限にして小さくても潰れないようにする。 */
function eyeSvg(cx, col) {
  return `
    <ellipse cx="${cx}" cy="24.2" rx="3.1" ry="3.9" fill="#fff"/>
    <ellipse cx="${cx}" cy="24.2" rx="3.1" ry="3.9" fill="${LINE}" opacity=".12"/>
    <ellipse cx="${cx}" cy="24.9" rx="2.5" ry="3.1" fill="${col}"/>
    <ellipse cx="${cx}" cy="25.4" rx="1.5" ry="2" fill="${LINE}"/>
    <circle cx="${cx - 1}" cy="22.8" r="1.15" fill="#fff"/>
    <circle cx="${cx + 1.1}" cy="26.4" r="0.55" fill="#fff" opacity=".7"/>
    <path d="M${cx - 3.3} 21.6 q3.3 -2 6.6 0" stroke="${LINE}" stroke-width="1.5"
          fill="none" stroke-linecap="round"/>`;
}

function headSvg(kind, pal, hair) {
  const eye = pal.eye || '#5a3f8f';
  const H = hairSvg(hair);
  const face = `
    <path d="M25 33 h14 v5 h-14 z" fill="${SKIN_D}"/>
    <circle cx="32" cy="23" r="13" fill="${SKIN}" stroke="${LINE}" stroke-width="1.4"/>
    <path d="M32 10 a13 13 0 0 1 0 26 a13 13 0 0 0 0 -26 z" fill="${SKIN_D}" opacity=".28"/>
    <ellipse cx="24.5" cy="28.5" rx="2.6" ry="1.5" fill="#ff9aa2" opacity=".42"/>
    <ellipse cx="39.5" cy="28.5" rx="2.6" ry="1.5" fill="#ff9aa2" opacity=".42"/>
    ${eyeSvg(26.2, eye)}
    ${eyeSvg(37.8, eye)}
    <path d="M30.4 30.6 q1.6 1.7 3.2 0" stroke="${LINE}" stroke-width="1.15" fill="none" stroke-linecap="round"/>`;

  /* ---- 魔術系：職業ごとの頭 ---- */
  /* 見習い：短い布の帽子。まだ飾りが無い */
  if (kind === 'm_cap') {
    return `<g class="s-head">
      ${face}
      <path d="M18 20 q3 -13 14 -13 q11 0 14 13 q-14 -5 -28 0 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.4"/>
      <rect x="17" y="18" width="30" height="4" rx="2" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.2"/>
    </g>`;
  }
  /* 魔道士：つば付きのとんがり帽 */
  if (kind === 'm_hat') {
    return `<g class="s-head">
      ${face}
      <path d="M19 18 q4 -16 13 -16 q9 0 13 16 q-13 -5 -26 0 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M32 2 q10 -8 13 0 q-6 2 -8 5" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
      <ellipse cx="32" cy="19" rx="18" ry="4.4" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
      <circle cx="32" cy="13" r="2.4" fill="${pal.accent}" stroke="${LINE}" stroke-width="1"/>
    </g>`;
  }
  /* 精霊術師：帽子を被らず、葉と羽根の冠 */
  if (kind === 'm_crown') {
    return `<g class="s-head">
      ${H.back}
      ${face}
${H.front}
      <path d="M18 16 q6 -7 14 -7 q8 0 14 7" fill="none" stroke="${pal.accent}" stroke-width="2" stroke-linecap="round"/>
      <path d="M22 13 q-4 -6 1 -8 q3 5 -1 8 z" fill="${pal.accent}" stroke="${LINE}" stroke-width="1"/>
      <path d="M42 13 q4 -6 -1 -8 q-3 5 1 8 z" fill="${pal.accent}" stroke="${LINE}" stroke-width="1"/>
      <circle cx="32" cy="9" r="2.2" fill="${pal.metal}" stroke="${LINE}" stroke-width="1"/>
    </g>`;
  }
  /* 大魔道士：ひときわ高いとんがり帽 */
  if (kind === 'm_tall') {
    return `<g class="s-head">
      ${face}
      <path d="M19 19 q3 -18 13 -18 q10 0 13 18 q-13 -6 -26 0 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M32 1 q12 -1 13 8 q-7 -2 -11 2" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
      <ellipse cx="32" cy="20" rx="20" ry="5" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
      <circle cx="45" cy="9" r="2.6" fill="${pal.accent}" stroke="${LINE}" stroke-width="1"/>
      <path d="M22 18 h20" stroke="${pal.accent}" stroke-width="1.8" opacity=".85"/>
    </g>`;
  }
  /* 精霊王の巫子：帽子ではなく光の輪と薄衣 */
  if (kind === 'm_halo') {
    return `<g class="s-head">
      <path d="M15 30 q0 -27 17 -27 q17 0 17 27 q-7 5 -17 5 q-10 0 -17 -5 z"
            fill="${pal.metal}" stroke="${LINE}" stroke-width="1.2" opacity=".55"/>
      ${H.back}
      ${face}
${H.front}
      <ellipse cx="32" cy="6" rx="12" ry="3.4" fill="none" stroke="${pal.accent}" stroke-width="2" opacity=".9"/>
      <circle cx="32" cy="14" r="2.2" fill="${pal.accent}" stroke="${LINE}" stroke-width="1"/>
    </g>`;
  }
  /* 賢者：深い頭巾と白い髭 */
  if (kind === 'm_sage') {
    return `<g class="s-head">
      ${face}
      <path d="M14 29 q-1 -26 18 -26 q19 0 18 26 q-7 -13 -18 -13 q-11 0 -18 13 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M16 26 q2 -17 16 -17 q14 0 16 17 q-7 -8 -16 -8 q-9 0 -16 8 z"
            fill="${pal.sub}" stroke="${LINE}" stroke-width="1.2"/>
      <path d="M25 30 q7 12 14 0 q-3 9 -7 10 q-4 -1 -7 -10 z"
            fill="${pal.metal}" stroke="${LINE}" stroke-width="1.2"/>
      <circle cx="32" cy="10" r="2.6" fill="${pal.accent}" stroke="${LINE}" stroke-width="1"/>
    </g>`;
  }
  if (kind === 'mage') {
    return `<g class="s-head">
      ${face}
      <path d="M17 20 q4 -17 15 -17 q11 0 15 17 q-15 -6 -30 0 z" fill="${pal.main}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M32 3 q9 -9 13 -1 q-6 2 -8 6" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
      <circle cx="32" cy="12" r="2.6" fill="${pal.accent}" stroke="${LINE}" stroke-width="1"/>
    </g>`;
  }
  /* ---- 剣士系：職業ごとの頭 ---- */
  /* 見習いは兜をかぶらない。髪が見える */
  if (kind === 'k_bare') {
    return `<g class="s-head">
      ${H.back}
      ${face}
${H.front}
      <path d="M19 19 q6 -6 13 -5" stroke="${pal.accent}" stroke-width="1.6" fill="none" opacity=".7"/>
    </g>`;
  }
  /* 剣士：額を守る鉢金 */
  if (kind === 'k_band') {
    return `<g class="s-head">
      ${H.back}
      ${face}
${H.front}
      <rect x="18" y="15" width="28" height="5" rx="2" fill="${pal.metal}" stroke="${LINE}" stroke-width="1.3"/>
      <path d="M29 15 l3 -4 l3 4 z" fill="${pal.accent}" stroke="${LINE}" stroke-width="1"/>
    </g>`;
  }
  /* 重騎士：顔まで覆う全身兜 */
  if (kind === 'k_full') {
    return `<g class="s-head">
      <path d="M17 26 q0 -23 15 -23 q15 0 15 23 q-4 7 -15 7 q-11 0 -15 -7 z"
            fill="${pal.metal}" stroke="${LINE}" stroke-width="1.5"/>
      <rect x="22" y="20" width="20" height="4.5" rx="1.6" fill="${LINE}"/>
      <rect x="25.5" y="25" width="13" height="2.6" rx="1.2" fill="${LINE}" opacity=".7"/>
      <path d="M32 3 l0 20" stroke="${pal.sub}" stroke-width="2" opacity=".8"/>
      <path d="M28 4 q4 -6 8 0 q-4 3 -8 0 z" fill="${pal.accent}" stroke="${LINE}" stroke-width="1.1"/>
    </g>`;
  }
  /* 魔法剣士：目深なフード */
  if (kind === 'k_hood') {
    return `<g class="s-head">
      ${face}
      <path d="M15 28 q-1 -25 17 -25 q18 0 17 25 q-6 -12 -17 -12 q-11 0 -17 12 z"
            fill="${pal.sub}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M17 24 q3 -15 15 -15 q12 0 15 15 q-7 -7 -15 -7 q-8 0 -15 7 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.2"/>
      <circle cx="32" cy="11" r="2.4" fill="${pal.accent}" stroke="${LINE}" stroke-width="1"/>
    </g>`;
  }
  /* 聖騎士：翼飾りの兜 */
  if (kind === 'k_wing') {
    return `<g class="s-head">
      ${face}
      <path d="M18 22 q0 -19 14 -19 q14 0 14 19 l-4 0 q0 -11 -10 -11 q-10 0 -10 11 z"
            fill="${pal.metal}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M18 12 q-9 -3 -11 3 q7 3 11 1 z" fill="${pal.metal}" stroke="${LINE}" stroke-width="1.2"/>
      <path d="M46 12 q9 -3 11 3 q-7 3 -11 1 z" fill="${pal.metal}" stroke="${LINE}" stroke-width="1.2"/>
      <path d="M32 2 q2 -5 4 1 q-2 6 -4 9 z" fill="${pal.accent}" stroke="${LINE}" stroke-width="1.1"/>
    </g>`;
  }
  /* 剣聖：鉢巻。兜を捨てた者 */
  if (kind === 'k_ribbon') {
    return `<g class="s-head">
      ${H.back}
      ${face}
${H.front}
      <rect x="17" y="14" width="30" height="4.4" rx="2" fill="${pal.accent}" stroke="${LINE}" stroke-width="1.2"/>
      <path d="M17 16 q-8 4 -10 12 q6 -2 9 -7 z" fill="${pal.accent}" stroke="${LINE}" stroke-width="1.1"/>
    </g>`;
  }
  if (kind === 'knight') {
    return `<g class="s-head">
      ${face}
      <path d="M18 22 q0 -19 14 -19 q14 0 14 19 l-4 0 q0 -11 -10 -11 q-10 0 -10 11 z"
            fill="${pal.metal}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M32 3 q2 -6 4 0 q-2 6 -4 10 z" fill="${pal.accent}" stroke="${LINE}" stroke-width="1.1"/>
    </g>`;
  }
  /* ---- 神官系：職業ごとの頭 ---- */
  /* 見習い：短いベール。髪がよく見える */
  if (kind === 'c_veil') {
    return `<g class="s-head">
      ${H.back}
      ${face}
${H.front}
      <path d="M19 18 q1 -15 13 -15 q12 0 13 15 q-6 -6 -13 -6 q-7 0 -13 6 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.3"/>
    </g>`;
  }
  /* 僧侶：長いベールと額の印 */
  if (kind === 'c_hood') {
    return `<g class="s-head">
      <path d="M16 26 q0 -23 16 -23 q16 0 16 23 q-6 6 -16 6 q-10 0 -16 -6 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.4"/>
      ${face}
      <path d="M17 24 q0 -21 15 -21 q15 0 15 21 q-5 -9 -15 -9 q-10 0 -15 9 z"
            fill="${hair}" stroke="${LINE}" stroke-width="1.3"/>
      <path d="M16 26 q0 -23 16 -23 q16 0 16 23 q-4 -2 -6 -2 q0 -16 -10 -16 q-10 0 -10 16 q-2 0 -6 2 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.3"/>
      <circle cx="32" cy="9" r="2.4" fill="${pal.accent}" stroke="${LINE}" stroke-width="1"/>
    </g>`;
  }
  /* 祓魔師：目を隠す布。口元だけ見える */
  if (kind === 'c_blind') {
    return `<g class="s-head">
      ${H.back}
      ${face}
${H.front}
      <rect x="18" y="19" width="28" height="7" rx="2" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
      <path d="M46 22 q7 3 8 11 q-6 -2 -9 -7 z" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.2"/>
      <path d="M27 22.5 h4 M33 22.5 h4" stroke="${pal.accent}" stroke-width="1.4" opacity=".9"/>
    </g>`;
  }
  /* 司祭：高い法冠 */
  if (kind === 'c_mitre') {
    return `<g class="s-head">
      ${face}
      <path d="M17 24 q0 -21 15 -21 q15 0 15 21 q-5 -9 -15 -9 q-10 0 -15 9 z"
            fill="${hair}" stroke="${LINE}" stroke-width="1.3"/>
      <path d="M20 18 q0 -16 12 -16 q12 0 12 16 q-12 -4 -24 0 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M32 2 l0 16 M25 10 h14" stroke="${pal.accent}" stroke-width="2" stroke-linecap="round"/>
      <rect x="18" y="17" width="28" height="4.6" rx="2" fill="${pal.metal}" stroke="${LINE}" stroke-width="1.2"/>
    </g>`;
  }
  /* 審問官：鉄仮面と垂れ布 */
  if (kind === 'c_mask') {
    return `<g class="s-head">
      <path d="M16 27 q0 -24 16 -24 q16 0 16 24 q-6 7 -16 7 q-10 0 -16 -7 z"
            fill="${pal.sub}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M20 24 q0 -18 12 -18 q12 0 12 18 q-5 7 -12 7 q-7 0 -12 -7 z"
            fill="${pal.metal}" stroke="${LINE}" stroke-width="1.3"/>
      <path d="M25 21 l5 2 M39 21 l-5 2" stroke="${LINE}" stroke-width="2" stroke-linecap="round"/>
      <path d="M32 25 l0 5" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M32 3 l0 7" stroke="${pal.accent}" stroke-width="2.2" stroke-linecap="round"/>
    </g>`;
  }
  /* 聖者：ベールを外し、光輪だけを戴く */
  if (kind === 'c_halo') {
    return `<g class="s-head">
      ${face}
      <path d="M17 24 q0 -21 15 -21 q15 0 15 21 q-5 -10 -15 -10 q-10 0 -15 10 z"
            fill="${hair}" stroke="${LINE}" stroke-width="1.3"/>
      <path d="M17 24 q-3 10 -1 18 M47 24 q3 10 1 18" stroke="${hair}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="32" cy="5" rx="13" ry="3.6" fill="none" stroke="${pal.accent}" stroke-width="2.2"/>
      <circle cx="32" cy="16" r="2" fill="${pal.accent}" stroke="${LINE}" stroke-width="1"/>
    </g>`;
  }
  if (kind === 'cleric') {
    return `<g class="s-head">
      <path d="M16 26 q0 -23 16 -23 q16 0 16 23 q-6 6 -16 6 q-10 0 -16 -6 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.4"/>
      ${face}
      <path d="M17 24 q0 -21 15 -21 q15 0 15 21 q-5 -9 -15 -9 q-10 0 -15 9 z"
            fill="${hair}" stroke="${LINE}" stroke-width="1.3"/>
      <path d="M16 26 q0 -23 16 -23 q16 0 16 23 q-4 -2 -6 -2 q0 -16 -10 -16 q-10 0 -10 16 q-2 0 -6 2 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.3"/>
      <circle cx="32" cy="9" r="2.4" fill="${pal.accent}" stroke="${LINE}" stroke-width="1"/>
    </g>`;
  }
  /* ---- 斥候系：職業ごとの頭 ---- */
  /* 見習い：簡素な布のずきん */
  if (kind === 's_cloth') {
    return `<g class="s-head">
      ${face}
      <path d="M18 23 q0 -20 14 -20 q14 0 14 20 q-5 -8 -14 -8 q-9 0 -14 8 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M18 23 q-4 5 -2 9 q5 -2 7 -5" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.2"/>
    </g>`;
  }
  /* 盗賊：口元を布で覆う */
  if (kind === 's_mask') {
    return `<g class="s-head">
      ${face}
      <path d="M18 23 q0 -20 14 -20 q14 0 14 20 q-5 -8 -14 -8 q-9 0 -14 8 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M20 27 q12 5 24 0 q-2 8 -12 8 q-10 0 -12 -8 z"
            fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
      <path d="M44 28 q7 2 9 9 q-6 -1 -10 -5 z" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.2"/>
    </g>`;
  }
  /* 狩人：羽根を挿したつば帽 */
  if (kind === 's_feather') {
    return `<g class="s-head">
      ${H.back}
      ${face}
${H.front}
      <path d="M20 17 q2 -14 12 -14 q10 0 12 14 q-12 -4 -24 0 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.4"/>
      <ellipse cx="32" cy="18" rx="17" ry="4" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
      <path d="M44 14 q8 -9 11 -3 q-5 5 -10 6 z" fill="${pal.accent}" stroke="${LINE}" stroke-width="1.1"/>
    </g>`;
  }
  /* 忍者：目だけを出す覆面 */
  if (kind === 's_ninja') {
    return `<g class="s-head">
      <circle cx="32" cy="23" r="13" fill="${pal.main}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M19 21 q13 -5 26 0 q-1 5 -13 5 q-12 0 -13 -5 z" fill="${SKIN}"/>
      <ellipse cx="26.5" cy="22.5" rx="1.7" ry="2.2" fill="${LINE}"/>
      <ellipse cx="37.5" cy="22.5" rx="1.7" ry="2.2" fill="${LINE}"/>
      <path d="M19 14 q13 -8 26 0" fill="none" stroke="${pal.sub}" stroke-width="2.4"/>
      <path d="M45 17 q9 4 11 13 q-8 -2 -12 -8 z" fill="${pal.main}" stroke="${LINE}" stroke-width="1.2"/>
    </g>`;
  }
  /* 狙撃手：つば広の帽子と片眼鏡 */
  if (kind === 's_scope') {
    return `<g class="s-head">
      ${H.back}
      ${face}
${H.front}
      <path d="M21 16 q1 -13 11 -13 q10 0 11 13 q-11 -4 -22 0 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.4"/>
      <ellipse cx="32" cy="17" rx="21" ry="4.2" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
      <circle cx="37.5" cy="24" r="5" fill="none" stroke="${pal.metal}" stroke-width="1.8"/>
      <circle cx="37.5" cy="24" r="5" fill="${pal.accent}" opacity=".25"/>
      <path d="M42 24 h5" stroke="${pal.metal}" stroke-width="1.4"/>
    </g>`;
  }
  /* 影皇：角のある頭巾。顔は影に沈む */
  if (kind === 's_shadow') {
    return `<g class="s-head">
      <path d="M15 28 q-1 -25 17 -25 q18 0 17 25 q-7 6 -17 6 q-10 0 -17 -6 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M19 22 q13 -5 26 0 q-2 8 -13 8 q-11 0 -13 -8 z" fill="${LINE}"/>
      <ellipse cx="27" cy="24" rx="1.9" ry="2.4" fill="${pal.accent}"/>
      <ellipse cx="37" cy="24" rx="1.9" ry="2.4" fill="${pal.accent}"/>
      <path d="M18 12 q-6 -8 -1 -10 q5 4 4 10 z" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.2"/>
      <path d="M46 12 q6 -8 1 -10 q-5 4 -4 10 z" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.2"/>
    </g>`;
  }
  if (kind === 'scout') {
    return `<g class="s-head">
      ${face}
      <path d="M17 24 q0 -21 15 -21 q15 0 15 21 q-4 -4 -7 -4 l-3 -6 l-5 6 l-5 -5 l-2 5 q-4 0 -8 4 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M17 24 q-3 6 0 10 q6 -3 8 -6" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.2"/>
    </g>`;
  }
  // villager
  return `<g class="s-head">
    ${face}
    <path d="M18 22 q0 -19 14 -19 q14 0 14 19 q-5 -8 -14 -8 q-9 0 -14 8 z"
          fill="${hair}" stroke="${LINE}" stroke-width="1.3"/>
  </g>`;
}

/* ---------- 胴と脚 ---------- */
function bodySvg(kind, pal, tier, hasCape) {
  const legs = `
    <g class="s-legs">
      <g class="s-legB"><rect x="25" y="57" width="7" height="21" rx="3" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
        <rect x="23.5" y="73" width="10" height="6" rx="2.5" fill="${LINE}"/></g>
      <g class="s-legF"><rect x="32" y="57" width="7" height="21" rx="3" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
        <rect x="30.5" y="73" width="10" height="6" rx="2.5" fill="${LINE}"/></g>
    </g>`;

  // 上位職はマントが付く
  const cape = hasCape
    ? `<path class="s-cape" d="M22 38 q-8 20 -5 36 q15 -6 30 0 q3 -16 -5 -36 z"
         fill="${pal.accent}" opacity=".85" stroke="${LINE}" stroke-width="1.3"/>` : '';

  /* ---- 魔術系：職業ごとの体 ---- */
  /* 共通のローブ（裾で脚を隠す） */
  const robe = (main, sub) => `<path d="M23 38 q-7 22 -9 40 q20 5 36 0 q-2 -18 -9 -40 z"
        fill="${main}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M32 38 l0 40" stroke="${sub}" stroke-width="1.6" opacity=".7"/>`;

  /* 見習い：飾りのない簡素なローブ */
  if (kind === 'm_simple') {
    return `${cape}${robe(pal.main, pal.sub)}
      <path d="M24 46 q8 3 16 0" stroke="${pal.sub}" stroke-width="1.8" fill="none" opacity=".8"/>`;
  }
  /* 魔道士：帯と肩布 */
  if (kind === 'm_belt') {
    return `${cape}${robe(pal.main, pal.sub)}
      <path d="M22 54 q10 4 20 0" stroke="${pal.accent}" stroke-width="2.6" fill="none"/>
      <path d="M23 38 q9 -4 18 0 q-2 7 -9 8 q-7 -1 -9 -8 z"
            fill="${pal.sub}" stroke="${LINE}" stroke-width="1.2"/>`;
  }
  /* 精霊術師：肩掛けと裾の葉飾り */
  if (kind === 'm_shawl') {
    return `${cape}${robe(pal.main, pal.sub)}
      <path d="M21 39 q11 8 22 0 q-3 10 -11 12 q-8 -2 -11 -12 z"
            fill="${pal.accent}" stroke="${LINE}" stroke-width="1.2" opacity=".9"/>
      <circle cx="32" cy="43" r="2.4" fill="${pal.metal}" stroke="${LINE}" stroke-width="1"/>
      <path d="M17 70 q6 -5 9 0 M47 70 q-6 -5 -9 0" stroke="${pal.accent}" stroke-width="1.6" fill="none" opacity=".8"/>`;
  }
  /* 大魔道士：肩章と金の縁取り */
  if (kind === 'm_grand') {
    return `${cape}${robe(pal.main, pal.sub)}
      <path d="M17 40 q7 -7 14 -2 l-3 9 q-8 0 -11 -3 z" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
      <path d="M47 40 q-7 -7 -14 -2 l3 9 q8 0 11 -3 z" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
      <path d="M22 54 q10 4 20 0" stroke="${pal.accent}" stroke-width="2.6" fill="none"/>
      <path d="M15 74 q17 5 34 0" stroke="${pal.accent}" stroke-width="2.2" fill="none" opacity=".9"/>
      <circle cx="32" cy="46" r="3" fill="${pal.accent}" stroke="${LINE}" stroke-width="1.1"/>`;
  }
  /* 精霊王の巫子：薄衣。裾が大きく広がる */
  if (kind === 'm_veil') {
    return `${cape}
      <path d="M24 38 q-11 24 -14 42 q23 6 44 0 q-3 -18 -14 -42 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M24 38 q-11 24 -14 42 q23 6 44 0 q-3 -18 -14 -42 z"
            fill="${pal.metal}" opacity=".3"/>
      <path d="M32 38 l0 42" stroke="${pal.sub}" stroke-width="1.4" opacity=".6"/>
      <path d="M20 58 q12 5 24 0" stroke="${pal.accent}" stroke-width="2" fill="none" opacity=".9"/>
      <circle cx="32" cy="44" r="3.2" fill="${pal.accent}" opacity=".85"/>`;
  }
  /* 賢者：厚い法衣と、腰に提げた書物 */
  if (kind === 'm_sagebody') {
    return `${cape}${robe(pal.main, pal.sub)}
      <path d="M22 38 q10 -4 20 0 q-3 9 -10 11 q-7 -2 -10 -11 z"
            fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
      <path d="M22 55 q10 4 20 0" stroke="${pal.accent}" stroke-width="2.4" fill="none"/>
      <g>
        <rect x="38" y="57" width="10" height="12" rx="1.6" fill="${pal.metal}" stroke="${LINE}" stroke-width="1.2"/>
        <path d="M43 57 l0 12" stroke="${LINE}" stroke-width="1"/>
        <circle cx="43" cy="63" r="1.6" fill="${pal.accent}"/>
      </g>`;
  }
  /* ---- 神官系：職業ごとの体 ---- */
  /* 見習い：飾りのない白い法衣 */
  if (kind === 'c_plain') {
    return `${cape}${robe(pal.main, pal.sub)}
      <path d="M24 48 q8 3 16 0" stroke="${pal.sub}" stroke-width="1.8" fill="none" opacity=".8"/>`;
  }
  /* 僧侶：胸の印と腰紐 */
  if (kind === 'c_robe') {
    return `${cape}${robe(pal.main, pal.sub)}
      <path d="M22 54 q10 4 20 0" stroke="${pal.accent}" stroke-width="2.4" fill="none"/>
      <circle cx="32" cy="45" r="4" fill="none" stroke="${pal.accent}" stroke-width="1.6"/>
      <path d="M32 41 v8 M28 45 h8" stroke="${pal.accent}" stroke-width="1.4"/>`;
  }
  /* 祓魔師：札を下げた外套。裾が裂けている */
  if (kind === 'c_talis') {
    return `${cape}
      <path d="M23 38 q-8 22 -10 40 q6 -6 9 0 q5 -7 10 0 q5 -7 10 0 q3 -6 9 0 q-2 -18 -10 -40 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M32 38 l0 34" stroke="${pal.sub}" stroke-width="1.6" opacity=".7"/>
      <g>
        <rect x="21" y="44" width="5" height="9" rx="1" fill="${pal.metal}" stroke="${LINE}" stroke-width="1"/>
        <rect x="38" y="47" width="5" height="9" rx="1" fill="${pal.metal}" stroke="${LINE}" stroke-width="1"/>
        <path d="M23.5 46 v5 M40.5 49 v5" stroke="${pal.accent}" stroke-width="1.2"/>
      </g>`;
  }
  /* 司祭：肩衣と金の縁取り */
  if (kind === 'c_stole') {
    return `${cape}${robe(pal.main, pal.sub)}
      <path d="M26 38 l-2 34 l6 0 l1 -34 z" fill="${pal.accent}" stroke="${LINE}" stroke-width="1.2" opacity=".95"/>
      <path d="M38 38 l2 34 l-6 0 l-1 -34 z" fill="${pal.accent}" stroke="${LINE}" stroke-width="1.2" opacity=".95"/>
      <path d="M22 40 q10 6 20 0 q-2 6 -10 7 q-8 -1 -10 -7 z"
            fill="${pal.metal}" stroke="${LINE}" stroke-width="1.2"/>
      <path d="M15 74 q17 5 34 0" stroke="${pal.accent}" stroke-width="2" fill="none" opacity=".85"/>`;
  }
  /* 審問官：黒い長衣に鉄の胸当て */
  if (kind === 'c_iron') {
    return `${cape}${robe(pal.main, pal.sub)}
      <path d="M24 39 q8 -3 16 0 q2 9 1 15 q-9 3 -18 0 q-1 -6 1 -15 z"
            fill="${pal.metal}" stroke="${LINE}" stroke-width="1.3"/>
      <path d="M32 41 v12" stroke="${LINE}" stroke-width="1.2" opacity=".6"/>
      <path d="M27 45 h10" stroke="${pal.accent}" stroke-width="1.8"/>
      <path d="M22 56 q10 4 20 0" stroke="${pal.accent}" stroke-width="2.2" fill="none"/>`;
  }
  /* 聖者：光をまとう薄い法衣 */
  if (kind === 'c_light') {
    return `${cape}
      <path d="M24 38 q-10 23 -13 42 q22 6 42 0 q-3 -19 -13 -42 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M24 38 q-10 23 -13 42 q22 6 42 0 q-3 -19 -13 -42 z"
            fill="${pal.metal}" opacity=".35"/>
      <path d="M32 38 l0 42" stroke="${pal.sub}" stroke-width="1.4" opacity=".55"/>
      <path d="M32 42 v14 M25 48 h14" stroke="${pal.accent}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M18 66 q14 5 28 0" stroke="${pal.accent}" stroke-width="1.8" fill="none" opacity=".8"/>`;
  }
  if (kind === 'mage' || kind === 'cleric') {
    // ローブ（脚は裾で隠す）
    return `${cape}
      <path d="M23 38 q-7 22 -9 40 q20 5 36 0 q-2 -18 -9 -40 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M32 38 l0 40" stroke="${pal.sub}" stroke-width="1.6" opacity=".7"/>
      <path d="M22 54 q10 4 20 0" stroke="${pal.accent}" stroke-width="2.2" fill="none"/>`;
  }

  const torso = `<path d="M23 37 q9 -3 18 0 q3 12 2 22 q-11 3 -22 0 q-1 -10 2 -22 z"
        fill="${pal.main}" stroke="${LINE}" stroke-width="1.4"/>
    <rect x="21" y="53" width="22" height="4.5" rx="2" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.1"/>`;

  /* ---- 剣士系：職業ごとの体 ---- */
  /* 見習い：革の胴着。金具は最小限 */
  if (kind === 'k_leather') {
    return `${legs}${cape}${torso}
      <path d="M24 40 q8 -2 16 0 q1 8 0 14 q-8 2 -16 0 q-1 -6 0 -14 z"
            fill="${pal.sub}" stroke="${LINE}" stroke-width="1.2" opacity=".9"/>
      <path d="M26 44 h12 M26 49 h12" stroke="${pal.accent}" stroke-width="1.2" opacity=".7"/>`;
  }
  /* 剣士：鎖帷子。輪の連なりを点で表す */
  if (kind === 'k_chain') {
    return `${legs}${cape}${torso}
      <path d="M20 39 q4 -5 9 -3 l-1 7 q-5 0 -8 -1 z" fill="${pal.metal}" stroke="${LINE}" stroke-width="1.2"/>
      <path d="M44 39 q-4 -5 -9 -3 l1 7 q5 0 8 -1 z" fill="${pal.metal}" stroke="${LINE}" stroke-width="1.2"/>
      <g opacity=".55" fill="${pal.metal}">
        <circle cx="27" cy="43" r="1.3"/><circle cx="32" cy="43" r="1.3"/><circle cx="37" cy="43" r="1.3"/>
        <circle cx="29.5" cy="47" r="1.3"/><circle cx="34.5" cy="47" r="1.3"/>
        <circle cx="27" cy="51" r="1.3"/><circle cx="32" cy="51" r="1.3"/><circle cx="37" cy="51" r="1.3"/>
      </g>`;
  }
  /* 重騎士：板金鎧。肩と胴を一回り大きくして重さを出す */
  if (kind === 'k_plate') {
    return `${legs}${cape}
      <path d="M21 36 q11 -4 22 0 q4 13 3 24 q-14 4 -28 0 q-1 -11 3 -24 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.5"/>
      <rect x="19" y="54" width="26" height="5" rx="2.2" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.2"/>
      <path d="M17 39 q5 -8 12 -4 l-2 10 q-7 0 -11 -2 z" fill="${pal.metal}" stroke="${LINE}" stroke-width="1.3"/>
      <path d="M47 39 q-5 -8 -12 -4 l2 10 q7 0 11 -2 z" fill="${pal.metal}" stroke="${LINE}" stroke-width="1.3"/>
      <path d="M32 40 l0 18" stroke="${pal.sub}" stroke-width="1.6" opacity=".8"/>
      <path d="M32 42 l5 8 l-5 8 l-5 -8 z" fill="${pal.accent}" stroke="${LINE}" stroke-width="1.1"/>`;
  }
  /* 魔法剣士：軽鎧に外套。腰に魔法陣 */
  if (kind === 'k_coat') {
    return `${legs}
      <path class="s-cape" d="M22 38 q-9 19 -7 34 q17 -5 34 0 q2 -15 -7 -34 z"
            fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
      ${torso}
      <path d="M20 39 q4 -5 9 -3 l-1 7 q-5 0 -8 -1 z" fill="${pal.metal}" stroke="${LINE}" stroke-width="1.2"/>
      <circle cx="32" cy="49" r="6" fill="none" stroke="${pal.accent}" stroke-width="1.4" opacity=".9"/>
      <circle cx="32" cy="49" r="2.6" fill="${pal.accent}" opacity=".8"/>
      <path d="M26 49 h12 M32 43 v12" stroke="${pal.accent}" stroke-width="1" opacity=".65"/>`;
  }
  /* 聖騎士：白銀の鎧に金の装飾 */
  if (kind === 'k_holy') {
    return `${legs}${cape}${torso}
      <path d="M20 39 q4 -6 10 -3 l-1 8 q-6 0 -9 -1 z" fill="${pal.metal}" stroke="${LINE}" stroke-width="1.3"/>
      <path d="M44 39 q-4 -6 -10 -3 l1 8 q6 0 9 -1 z" fill="${pal.metal}" stroke="${LINE}" stroke-width="1.3"/>
      <path d="M32 40 v16 M26 46 h12" stroke="${pal.accent}" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="32" cy="46" r="2.2" fill="${pal.accent}" stroke="${LINE}" stroke-width="1"/>`;
  }
  /* 剣聖：鎧を脱いだ道着。帯だけが目印 */
  if (kind === 'k_gi') {
    return `${legs}
      <path d="M23 37 q9 -3 18 0 q3 12 2 22 q-11 3 -22 0 q-1 -10 2 -22 z"
            fill="${pal.main}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M32 37 l-7 20 M32 37 l7 20" stroke="${pal.sub}" stroke-width="1.6" opacity=".85" fill="none"/>
      <rect x="20" y="52" width="24" height="6" rx="2.4" fill="${pal.accent}" stroke="${LINE}" stroke-width="1.2"/>
      <path d="M20 55 q-7 5 -8 13 q6 -2 9 -8 z" fill="${pal.accent}" stroke="${LINE}" stroke-width="1.1"/>`;
  }
  if (kind === 'knight') {
    return `${legs}${cape}${torso}
      <path d="M20 39 q4 -5 9 -3 l-1 7 q-5 0 -8 -1 z" fill="${pal.metal}" stroke="${LINE}" stroke-width="1.2"/>
      <path d="M44 39 q-4 -5 -9 -3 l1 7 q5 0 8 -1 z" fill="${pal.metal}" stroke="${LINE}" stroke-width="1.2"/>
      <path d="M32 42 l4 7 l-4 7 l-4 -7 z" fill="${pal.accent}" stroke="${LINE}" stroke-width="1"/>`;
  }
  /* ---- 斥候系：職業ごとの体 ---- */
  /* 見習い：軽い革の胴着 */
  if (kind === 's_light') {
    return `${legs}${torso}
      <path d="M25 41 h14 M25 47 h14" stroke="${pal.sub}" stroke-width="1.4" opacity=".8"/>
      <rect x="28" y="52" width="8" height="4" rx="1.6" fill="${pal.accent}" stroke="${LINE}" stroke-width="1"/>`;
  }
  /* 盗賊：短いマントと多数のベルト */
  if (kind === 's_belts') {
    return `${legs}
      <path class="s-cape" d="M23 38 q-6 13 -5 22 q13 -4 26 0 q1 -9 -5 -22 z"
            fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
      ${torso}
      <path d="M24 42 l16 5 M24 49 l16 5" stroke="${pal.accent}" stroke-width="1.8" opacity=".9"/>
      <rect x="22" y="55" width="20" height="3.6" rx="1.6" fill="${pal.sub}" stroke="${LINE}" stroke-width="1"/>
      <circle cx="26" cy="57" r="1.4" fill="${pal.metal}"/><circle cx="38" cy="57" r="1.4" fill="${pal.metal}"/>`;
  }
  /* 狩人：革鎧と背中の矢筒 */
  if (kind === 's_quiver') {
    return `${legs}
      <g>
        <rect x="14" y="34" width="8" height="20" rx="3" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
        <path d="M16 34 l0 -7 M18 34 l0 -9 M20 34 l0 -7" stroke="#8a6b45" stroke-width="1.6"/>
        <path d="M16 27 l-2 -3 l4 0 z M18 25 l-2 -3 l4 0 z M20 27 l-2 -3 l4 0 z" fill="${pal.accent}"/>
      </g>
      ${torso}
      <path d="M25 39 l14 14" stroke="${pal.sub}" stroke-width="3" opacity=".9"/>
      <path d="M22 53 h22" stroke="${pal.accent}" stroke-width="2" opacity=".85"/>`;
  }
  /* 忍者：忍装束と襷 */
  if (kind === 's_gi') {
    return `${legs}${torso}
      <path d="M23 38 l18 18 M41 38 l-18 18" stroke="${pal.sub}" stroke-width="2.4" opacity=".9"/>
      <rect x="21" y="52" width="22" height="5" rx="2" fill="${pal.accent}" stroke="${LINE}" stroke-width="1.1"/>
      <path d="M21 55 q-6 6 -6 13 q5 -2 8 -8 z" fill="${pal.accent}" stroke="${LINE}" stroke-width="1.1"/>`;
  }
  /* 狙撃手：丈の長いコート */
  if (kind === 's_coat') {
    return `${legs}
      <path class="s-cape" d="M22 38 q-8 20 -6 34 q17 -5 32 0 q2 -14 -6 -34 z"
            fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
      ${torso}
      <path d="M26 38 l-2 20 M38 38 l2 20" stroke="${pal.sub}" stroke-width="2" opacity=".85"/>
      <path d="M22 53 h22" stroke="${pal.accent}" stroke-width="2" opacity=".9"/>
      <circle cx="32" cy="44" r="2.2" fill="${pal.metal}" stroke="${LINE}" stroke-width="1"/>`;
  }
  /* 影皇：影そのものをまとう */
  if (kind === 's_veilshadow') {
    return `${legs}
      <path class="s-cape" d="M21 37 q-11 21 -9 38 q6 -5 10 -1 q5 -6 10 -1 q5 -5 10 1 q4 -4 10 1 q2 -17 -9 -38 z"
            fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
      ${torso}
      <path d="M24 40 q8 -3 16 0 q1 8 0 14 q-8 3 -16 0 q-1 -6 0 -14 z"
            fill="${pal.sub}" stroke="${LINE}" stroke-width="1.2" opacity=".95"/>
      <path d="M32 42 l4 6 l-4 6 l-4 -6 z" fill="${pal.accent}" stroke="${LINE}" stroke-width="1"/>`;
  }
  if (kind === 'scout') {
    return `${legs}
      <path class="s-cape" d="M23 38 q-6 16 -4 28 q13 -4 26 0 q2 -12 -4 -28 z"
            fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
      ${torso}
      <path d="M25 40 l14 12" stroke="${pal.accent}" stroke-width="2" opacity=".8"/>`;
  }
  return `${legs}${torso}`;
}

/* ---------- 腕 ---------- */
function armsSvg(pal, weaponShape) {
  return {
    back: `<g class="s-armB">
        <rect x="18" y="38" width="6.5" height="20" rx="3.2" fill="${pal.main}" stroke="${LINE}" stroke-width="1.3"/>
        <circle cx="21.2" cy="59" r="3.6" fill="${SKIN}" stroke="${LINE}" stroke-width="1.2"/>
      </g>`,
    front: `<g class="s-armF">
        <rect x="39.5" y="38" width="6.5" height="20" rx="3.2" fill="${pal.main}" stroke="${LINE}" stroke-width="1.3"/>
        <circle cx="42.8" cy="59" r="3.8" fill="${SKIN}" stroke="${LINE}" stroke-width="1.2"/>
        <g class="s-hand" transform="translate(12 45.5) rotate(16)">${weaponSvg(weaponShape, pal)}</g>
      </g>`,
  };
}

/* ---------- 味方キャラ ---------- */
G.Sprite = {

  /* キャラ -> 絵。
   *
   * assets/characters/ に画像があればそれを使い、無ければ下のSVGで描く。
   * 画像が1枚も無い状態でも、これまでとまったく同じ絵が出る。
   *
   * use は 'battle'|'field'|'portrait'|'face'。省略すると 'battle'。
   * SVG で描くときは use を見ない（1つの絵をどの大きさでも使うため）。 */
  hero(c, use) {
    const art = G.Art && G.Art.hero(c, use);
    if (art) return G.Art.img(art, c.name, '', G.Art.heroPoses(c, use));

    const arch = G.SPRITE_ARCH[c.jobId] || 'villager';
    const look = G.SPRITE_JOB[c.jobId] || {};
    const job = G.JOBS[c.jobId] || {};
    const base = G.SPRITE_PAL[arch] || G.SPRITE_PAL.villager;
    const pal = Object.assign({}, base, look.pal || {});
    const hair = G.SPRITE_HAIR[c.key] || base.hair;
    const tier = job.tier || 0;

    // 上位職ほど色を締めて、装飾を足す
    if (tier >= 3) { pal.accent = G.Sprite.lighten(pal.accent, 0.18); }
    Object.assign(pal, G.SPRITE_TINT[c.key] || {});

    // 職業ごとの指定があればそれを使い、無ければ系統の既定にする
    const headKind = look.head || arch;
    const bodyKind = look.body || arch;
    const hasCape = (look.cape === undefined) ? tier >= 2 : !!look.cape;
    const wshape = (G.ITEMS[c.equip && c.equip.weapon] || {}).shape
      || look.weapon || 'stick';
    const arms = armsSvg(pal, wshape);

    /* 最上位職（Tier4）の光。
     * 以前は差し色の円を全身にかぶせていたが、白い法衣に金をかぶせると
     * 濁った色になり、Tier3より地味に見えてしまっていた。
     * 体の「後ろ」に輪と粒を置き、本体の色を濁らせない形にする。 */
    const aura = tier >= 4 ? `<g class="s-aura">
        <circle cx="32" cy="46" r="27" fill="${pal.accent}" opacity=".06"/>
        <circle cx="32" cy="46" r="27" fill="none" stroke="${pal.accent}"
                stroke-width="1.6" opacity=".45"/>
        <circle cx="10" cy="32" r="2.1" fill="${pal.accent}" opacity=".85"/>
        <circle cx="54" cy="40" r="1.7" fill="${pal.accent}" opacity=".75"/>
        <circle cx="48" cy="14" r="1.4" fill="${pal.accent}" opacity=".65"/>
        <circle cx="14" cy="62" r="1.5" fill="${pal.accent}" opacity=".6"/>
      </g>` : '';

    /* 影と光は、本体と同じ中身をもう一度重ねて作る。
     * 色は CSS 側で塗り替えるので、形を別に用意する必要がない。 */
    const solid = `${bodySvg(bodyKind, pal, tier, hasCape)}${arms.back}`
      + `${headSvg(headKind, pal, hair)}${arms.front}${look.deco ? look.deco(pal) : ''}`;

    return `<svg class="chr" viewBox="0 0 64 84" role="img" aria-label="${G.util.esc(c.name)}">
      <ellipse class="s-shadow" cx="32" cy="79" rx="15" ry="3.5" fill="#000" opacity=".3"/>
      <g class="s-body">
        ${aura}
        ${solid}
        <g class="s-shade" aria-hidden="true">${solid}</g>
        <g class="s-lit" aria-hidden="true">${solid}</g>
      </g>
    </svg>`;
  },

  lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const ch = i => Math.min(255, Math.round(((n >> (16 - i * 8)) & 255) + 255 * amt));
    return '#' + [0, 1, 2].map(i => ch(i).toString(16).padStart(2, '0')).join('');
  },

  /* ---------- 敵 ---------- */
  /* 敵ID -> 見た目の型と配色。未定義なら tags とレベルから推測する。 */
  ENEMY_LOOK: {
    slime:        ['blob', '#6fd3e8', '#2e8fa8'],
    rat:          ['beast', '#8b7a6a', '#5c4f43'],
    goblin:       ['imp', '#7fae5c', '#4e7036'],
    wild_wolf:    ['wolf', '#7d8490', '#4a5058'],
    giant_bee:    ['bug', '#e8c54e', '#7a5f16'],
    treant:       ['plant', '#6b8f4e', '#3f5a2c'],
    kobold:       ['imp', '#b58a5c', '#6f5232'],
    skeleton:     ['bone', '#e6e2d3', '#9b9584'],
    bat_swarm:    ['flyer', '#6b5a86', '#3b3050'],
    orc:          ['brute', '#8a9a5b', '#4f5c30'],
    harpy:        ['flyer', '#c98fb0', '#7a4a63'],
    golem:        ['stone', '#9a9186', '#5f594f'],
    dark_mage:    ['caster', '#6a4fa8', '#3a2a66'],
    minotaur:     ['brute', '#a86b4a', '#60392a'],
    wraith:       ['ghost', '#9a8fd8', '#463c73'],
    chimera:      ['beast', '#c08a4a', '#6d4a24'],
    ice_queen:    ['caster', '#8fd6e8', '#3f7f96'],
    young_dragon: ['dragon', '#7aa86b', '#3f5f36'],
    demon_soldier:['demon', '#a84f5c', '#5f2932'],
    hell_hound:   ['wolf', '#d4653a', '#7a2f18'],
    lich:         ['bone', '#cfe2d8', '#5a6f66'],
    demon_knight: ['demon', '#5a5a6e', '#2d2d3c'],
    archdemon:    ['demon', '#b0434f', '#5c1f26'],

    boss_goblin_lord:   ['imp', '#8fbf68', '#4e7036'],
    boss_cave_guardian: ['stone', '#8f9aa8', '#4e5764'],
    boss_swamp_hydra:   ['dragon', '#5fa87f', '#2d6247'],
    boss_flame_dragon:  ['dragon', '#d9583a', '#7a2414'],
    gate_keeper:        ['brute', '#6b6b80', '#33333f'],
    four_general_1:     ['caster', '#5f8fd9', '#1f3a6b'],
    four_general_2:     ['brute', '#e07a3a', '#7a3412'],
    demon_lord_1:       ['lord', '#8a3f8f', '#3d1a45'],
    demon_lord_2:       ['lord', '#c9434f', '#4a1220'],
  },

  enemy(u, use) {
    const art = G.Art && G.Art.foe(u.enemyId, use, u.isBoss);
    if (art) {
      return G.Art.img(art, u.name, 'foe' + (u.isBoss ? ' is-boss' : ''),
        G.Art.foePoses(u.enemyId, use, u.isBoss));
    }

    const look = G.Sprite.ENEMY_LOOK[u.enemyId] || ['imp', '#8a8a9a', '#4a4a58'];
    const [kind, c1, c2] = look;
    const big = u.isBoss;
    const svg = G.Sprite.enemyShape(kind, c1, c2, big);
    /* ボスは大きさと光だけでは見分けにくいので、頭上に冠を置く。
     * 形によらず同じ位置に出すので、どの敵でも成立する。 */
    const crown = big ? `<g class="s-crown">
        <path d="M22 16 l4 7 l6 -9 l6 9 l4 -7 l2 12 q-11 3 -24 0 z"
              fill="${c2}" stroke="${LINE}" stroke-width="1.4"/>
        <circle cx="32" cy="21" r="2" fill="#ffe58a" stroke="${LINE}" stroke-width="1"/>
      </g>` : '';
    /* 味方と同じように、同じ形を重ねて影と光を作る */
    const solid = `${svg}${crown}`;
    return `<svg class="chr foe ${big ? 'is-boss' : ''}" viewBox="0 0 64 84" role="img"
                 aria-label="${G.util.esc(u.name)}">
      <ellipse class="s-shadow" cx="32" cy="79" rx="${big ? 20 : 15}" ry="4" fill="#000" opacity=".32"/>
      <g class="s-body">
        ${solid}
        <g class="s-shade" aria-hidden="true">${solid}</g>
        <g class="s-lit" aria-hidden="true">${solid}</g>
      </g>
    </svg>`;
  },

  enemyShape(kind, c1, c2, big) {
    const eyes = (cx1, cx2, cy, r, col) =>
      `<circle cx="${cx1}" cy="${cy}" r="${r}" fill="${col || '#fff'}"/>
       <circle cx="${cx2}" cy="${cy}" r="${r}" fill="${col || '#fff'}"/>
       <circle cx="${cx1}" cy="${cy}" r="${r * 0.45}" fill="${LINE}"/>
       <circle cx="${cx2}" cy="${cy}" r="${r * 0.45}" fill="${LINE}"/>`;

    switch (kind) {
      case 'blob':
        return `<path class="s-wob" d="M12 78 q-4 -30 20 -34 q24 4 20 34 z" fill="${c1}"
                 stroke="${LINE}" stroke-width="1.5" opacity=".92"/>
          <ellipse cx="24" cy="56" rx="6" ry="4" fill="#fff" opacity=".45"/>
          ${eyes(26, 39, 62, 3.2)}
          <path d="M28 70 q4 3 8 0" stroke="${LINE}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;

      case 'beast':
        return `<path d="M10 70 q2 -16 16 -18 l16 0 q14 2 14 18 q-8 8 -23 8 q-15 0 -23 -8 z"
                 fill="${c1}" stroke="${LINE}" stroke-width="1.5"/>
          <path d="M40 52 q10 -6 15 2 q-2 10 -12 11 z" fill="${c1}" stroke="${LINE}" stroke-width="1.4"/>
          <path d="M45 46 l4 -9 l6 7 z" fill="${c2}" stroke="${LINE}" stroke-width="1.3"/>
          <path d="M38 48 l-5 -9 l8 4 z" fill="${c2}" stroke="${LINE}" stroke-width="1.3"/>
          ${eyes(46, 53, 56, 2.6, '#ffe58a')}
          <path d="M50 64 l7 2 l-7 2" stroke="${LINE}" stroke-width="1.4" fill="none"/>
          <path class="s-tail" d="M12 62 q-8 -6 -6 -14" stroke="${c2}" stroke-width="4" fill="none" stroke-linecap="round"/>`;

      /* 犬科。獣型より鼻先が長く、尾を立てる。狼・魔犬に使う */
      case 'wolf':
        return `<path d="M11 70 q1 -15 15 -17 l16 0 q13 2 13 17 q-8 8 -22 8 q-14 0 -22 -8 z"
                 fill="${c1}" stroke="${LINE}" stroke-width="1.5"/>
          <path d="M40 53 q12 -8 19 0 l-3 9 q-9 3 -16 2 z" fill="${c1}" stroke="${LINE}" stroke-width="1.4"/>
          <path d="M55 56 l6 3 l-6 4 z" fill="${c2}" stroke="${LINE}" stroke-width="1.3"/>
          <path d="M44 47 l2 -11 l7 8 z" fill="${c2}" stroke="${LINE}" stroke-width="1.3"/>
          <path d="M37 48 l-4 -11 l9 5 z" fill="${c2}" stroke="${LINE}" stroke-width="1.3"/>
          ${eyes(45, 52, 55, 2.4, '#ffd24a')}
          <path d="M52 62 l2 4 M56 61 l1 4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
          <path class="s-tail" d="M13 64 q-10 -10 -4 -20" stroke="${c2}" stroke-width="5" fill="none" stroke-linecap="round"/>
          <path d="M18 76 h8 M32 76 h8" stroke="${c2}" stroke-width="4" stroke-linecap="round"/>`;

      case 'imp':
        return `<rect x="22" y="48" width="20" height="26" rx="7" fill="${c1}" stroke="${LINE}" stroke-width="1.5"/>
          <rect x="24" y="72" width="7" height="6" rx="2.5" fill="${c2}" stroke="${LINE}" stroke-width="1.2"/>
          <rect x="33" y="72" width="7" height="6" rx="2.5" fill="${c2}" stroke="${LINE}" stroke-width="1.2"/>
          <circle cx="32" cy="36" r="14" fill="${c1}" stroke="${LINE}" stroke-width="1.5"/>
          <path d="M18 34 l-8 -6 l9 -2 z" fill="${c1}" stroke="${LINE}" stroke-width="1.3"/>
          <path d="M46 34 l8 -6 l-9 -2 z" fill="${c1}" stroke="${LINE}" stroke-width="1.3"/>
          ${eyes(27, 37, 35, 3.4, '#ffe58a')}
          <path d="M27 43 q5 4 10 0" stroke="${LINE}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          <path class="s-armF" d="M20 52 l-8 10" stroke="${c2}" stroke-width="5" stroke-linecap="round"/>
          <path class="s-armB" d="M44 52 l8 10" stroke="${c2}" stroke-width="5" stroke-linecap="round"/>`;

      case 'brute':
        return `<path d="M16 76 q-2 -24 16 -26 q18 2 16 26 z" fill="${c1}" stroke="${LINE}" stroke-width="1.6"/>
          <circle cx="32" cy="32" r="15" fill="${c1}" stroke="${LINE}" stroke-width="1.6"/>
          <path d="M18 26 q-6 -10 2 -12 q4 4 4 10 z" fill="${c2}" stroke="${LINE}" stroke-width="1.4"/>
          <path d="M46 26 q6 -10 -2 -12 q-4 4 -4 10 z" fill="${c2}" stroke="${LINE}" stroke-width="1.4"/>
          ${eyes(26, 38, 31, 3.6, '#ff9a6d')}
          <path d="M25 40 q7 5 14 0 l-2 4 q-5 3 -10 0 z" fill="${LINE}"/>
          <path class="s-armF" d="M16 54 l-9 14" stroke="${c1}" stroke-width="8" stroke-linecap="round"/>
          <path class="s-armB" d="M48 54 l9 14" stroke="${c1}" stroke-width="8" stroke-linecap="round"/>`;

      case 'bone':
        return `<path d="M24 50 l16 0 l-2 26 l-12 0 z" fill="${c1}" stroke="${LINE}" stroke-width="1.4"/>
          <path d="M25 56 h14 M25 62 h14 M26 68 h12" stroke="${c2}" stroke-width="1.6"/>
          <path d="M20 30 q0 -16 12 -16 q12 0 12 16 q0 10 -6 13 l-12 0 q-6 -3 -6 -13 z"
                fill="${c1}" stroke="${LINE}" stroke-width="1.5"/>
          <ellipse cx="26.5" cy="31" rx="3.6" ry="4.2" fill="${LINE}"/>
          <ellipse cx="37.5" cy="31" rx="3.6" ry="4.2" fill="${LINE}"/>
          <circle cx="27" cy="31" r="1.5" fill="#ff7a6d"/><circle cx="38" cy="31" r="1.5" fill="#ff7a6d"/>
          <path d="M27 41 h10 M29 41 v4 M33 41 v4" stroke="${LINE}" stroke-width="1.3"/>
          <path class="s-armF" d="M22 52 l-8 12" stroke="${c1}" stroke-width="4" stroke-linecap="round"/>
          <path class="s-armB" d="M42 52 l8 12" stroke="${c1}" stroke-width="4" stroke-linecap="round"/>`;

      case 'flyer':
        return `<path class="s-wingB" d="M26 48 q-22 -14 -22 4 q10 10 22 6 z" fill="${c2}" stroke="${LINE}" stroke-width="1.4"/>
          <path class="s-wingF" d="M38 48 q22 -14 22 4 q-10 10 -22 6 z" fill="${c2}" stroke="${LINE}" stroke-width="1.4"/>
          <ellipse cx="32" cy="54" rx="11" ry="14" fill="${c1}" stroke="${LINE}" stroke-width="1.5"/>
          <circle cx="32" cy="38" r="11" fill="${c1}" stroke="${LINE}" stroke-width="1.5"/>
          <path d="M22 32 l-4 -9 l8 4 z" fill="${c1}" stroke="${LINE}" stroke-width="1.2"/>
          <path d="M42 32 l4 -9 l-8 4 z" fill="${c1}" stroke="${LINE}" stroke-width="1.2"/>
          ${eyes(28, 36, 38, 2.8, '#ffd76d')}`;

      case 'bug':
        return `<path class="s-wingB" d="M24 44 q-18 -16 -14 2 q6 8 14 4 z" fill="#dff1ff" opacity=".8" stroke="${LINE}" stroke-width="1.2"/>
          <path class="s-wingF" d="M40 44 q18 -16 14 2 q-6 8 -14 4 z" fill="#dff1ff" opacity=".8" stroke="${LINE}" stroke-width="1.2"/>
          <ellipse cx="32" cy="58" rx="13" ry="16" fill="${c1}" stroke="${LINE}" stroke-width="1.5"/>
          <path d="M19 52 h26 M19 60 h26 M22 68 h20" stroke="${c2}" stroke-width="3.4"/>
          <path d="M32 74 l0 7" stroke="${LINE}" stroke-width="2.6" stroke-linecap="round"/>
          <circle cx="32" cy="36" r="10" fill="${c2}" stroke="${LINE}" stroke-width="1.4"/>
          ${eyes(28, 36, 35, 2.8, '#fff')}
          <path d="M27 27 l-4 -8 M37 27 l4 -8" stroke="${LINE}" stroke-width="1.5" stroke-linecap="round"/>`;

      case 'plant':
        return `<path d="M24 78 q-2 -26 8 -30 q10 4 8 30 z" fill="${c2}" stroke="${LINE}" stroke-width="1.5"/>
          <path d="M26 60 q-14 -6 -18 -18 q12 0 18 10 z" fill="${c1}" stroke="${LINE}" stroke-width="1.4"/>
          <path d="M38 60 q14 -6 18 -18 q-12 0 -18 10 z" fill="${c1}" stroke="${LINE}" stroke-width="1.4"/>
          <ellipse cx="32" cy="30" rx="20" ry="16" fill="${c1}" stroke="${LINE}" stroke-width="1.6"/>
          ${eyes(26, 38, 32, 3.2, '#ffe58a')}
          <path d="M28 40 q4 3 8 0" stroke="${LINE}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;

      case 'stone':
        return `<rect x="18" y="44" width="28" height="32" rx="4" fill="${c1}" stroke="${LINE}" stroke-width="1.6"/>
          <rect x="22" y="20" width="20" height="22" rx="4" fill="${c1}" stroke="${LINE}" stroke-width="1.6"/>
          ${eyes(28, 37, 30, 3, '#8fe8ff')}
          <path d="M22 52 h22 M24 62 h18" stroke="${c2}" stroke-width="2"/>
          <path class="s-armF" d="M16 48 l-8 20" stroke="${c1}" stroke-width="9" stroke-linecap="round"/>
          <path class="s-armB" d="M48 48 l8 20" stroke="${c1}" stroke-width="9" stroke-linecap="round"/>`;

      case 'caster':
        return `<path d="M22 40 q-8 22 -8 38 q18 5 36 0 q0 -16 -8 -38 z" fill="${c1}" stroke="${LINE}" stroke-width="1.5"/>
          <path d="M18 24 q4 -18 14 -18 q10 0 14 18 q-14 -6 -28 0 z" fill="${c2}" stroke="${LINE}" stroke-width="1.5"/>
          <ellipse cx="32" cy="30" rx="11" ry="10" fill="#1a1430"/>
          ${eyes(28, 36, 30, 2.6, '#a8e8ff')}
          <path class="s-armF" d="M46 44 l10 -6" stroke="${c1}" stroke-width="5" stroke-linecap="round"/>
          <circle class="s-orb" cx="57" cy="36" r="6" fill="${c1}" opacity=".55"/>`;

      case 'ghost':
        return `<path class="s-float" d="M14 62 q0 -38 18 -38 q18 0 18 38 q-5 -6 -9 0 q-4 6 -9 0 q-5 -6 -9 0 q-4 6 -9 0 z"
                 fill="${c1}" stroke="${LINE}" stroke-width="1.5" opacity=".85"/>
          ${eyes(26, 38, 38, 3.4, '#fff')}
          <path d="M28 48 q4 5 8 0" stroke="${LINE}" stroke-width="1.6" fill="none"/>
          <path d="M10 44 q-6 6 -2 12" stroke="${c2}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
          <path d="M54 44 q6 6 2 12" stroke="${c2}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;

      case 'dragon':
        // 翼は体より大きく、骨も描いて竜らしい影にする
        return `<g class="s-wingB">
            <path d="M24 40 q-26 -26 -22 -2 q-2 16 8 22 q10 -6 16 -12 z" fill="${c2}" stroke="${LINE}" stroke-width="1.5"/>
            <path d="M24 40 L4 40 M24 40 L6 54 M24 40 L12 62" stroke="${LINE}" stroke-width="1.1" opacity=".7"/>
          </g>
          <g class="s-wingF">
            <path d="M40 40 q26 -26 22 -2 q2 16 -8 22 q-10 -6 -16 -12 z" fill="${c2}" stroke="${LINE}" stroke-width="1.5"/>
            <path d="M40 40 L60 40 M40 40 L58 54 M40 40 L52 62" stroke="${LINE}" stroke-width="1.1" opacity=".7"/>
          </g>
          <path d="M18 76 q-2 -26 14 -28 q16 2 14 28 z" fill="${c1}" stroke="${LINE}" stroke-width="1.6"/>
          <path d="M26 50 q-4 -16 6 -20 q10 4 6 20 z" fill="${c1}" stroke="${LINE}" stroke-width="1.5"/>
          <path d="M20 28 q0 -12 12 -12 q14 0 14 12 q0 8 -8 10 l-10 0 q-8 -2 -8 -10 z"
                fill="${c1}" stroke="${LINE}" stroke-width="1.6"/>
          <path d="M22 18 l-6 -8 l9 2 z" fill="${c2}" stroke="${LINE}" stroke-width="1.3"/>
          <path d="M42 18 l6 -8 l-9 2 z" fill="${c2}" stroke="${LINE}" stroke-width="1.3"/>
          ${eyes(26, 38, 27, 3, '#ffd24a')}
          <path d="M25 36 h14 l-2 4 h-10 z" fill="${LINE}"/>
          <path class="s-tail" d="M16 70 q-12 -4 -12 -16" stroke="${c1}" stroke-width="5" fill="none" stroke-linecap="round"/>`;

      case 'demon':
        return `<path d="M18 76 q-2 -28 14 -30 q16 2 14 30 z" fill="${c1}" stroke="${LINE}" stroke-width="1.6"/>
          <path class="s-cape" d="M18 46 q-10 20 -8 32 q22 -8 44 0 q2 -12 -8 -32 z" fill="${c2}"
                stroke="${LINE}" stroke-width="1.4" opacity=".9"/>
          <circle cx="32" cy="30" r="14" fill="${c1}" stroke="${LINE}" stroke-width="1.6"/>
          <path d="M19 22 q-8 -12 0 -14 q5 5 5 12 z" fill="${c2}" stroke="${LINE}" stroke-width="1.4"/>
          <path d="M45 22 q8 -12 0 -14 q-5 5 -5 12 z" fill="${c2}" stroke="${LINE}" stroke-width="1.4"/>
          ${eyes(26, 38, 29, 3.4, '#ff6a5c')}
          <path d="M25 38 q7 5 14 0 l-2 4 q-5 3 -10 0 z" fill="${LINE}"/>`;

      case 'lord':
        return `<path class="s-cape" d="M10 78 q-4 -30 10 -44 q22 -10 34 0 q14 14 10 44 z" fill="${c2}"
                 stroke="${LINE}" stroke-width="1.6" opacity=".95"/>
          <path d="M20 76 q-2 -32 12 -34 q14 2 12 34 z" fill="${c1}" stroke="${LINE}" stroke-width="1.6"/>
          <circle cx="32" cy="28" r="15" fill="${c1}" stroke="${LINE}" stroke-width="1.6"/>
          <path d="M17 20 q-11 -14 -1 -17 q7 6 7 15 z" fill="${c2}" stroke="${LINE}" stroke-width="1.5"/>
          <path d="M47 20 q11 -14 1 -17 q-7 6 -7 15 z" fill="${c2}" stroke="${LINE}" stroke-width="1.5"/>
          ${eyes(26, 38, 27, 3.8, '#ffdc4a')}
          <path d="M24 37 q8 6 16 0 l-2 5 q-6 4 -12 0 z" fill="${LINE}"/>
          <circle class="s-aura" cx="32" cy="44" r="34" fill="${c1}" opacity=".16"/>
          <path class="s-armF" d="M14 52 l-8 16" stroke="${c1}" stroke-width="7" stroke-linecap="round"/>
          <path class="s-armB" d="M50 52 l8 16" stroke="${c1}" stroke-width="7" stroke-linecap="round"/>`;

      default:
        return `<circle cx="32" cy="50" r="20" fill="${c1}" stroke="${LINE}" stroke-width="1.6"/>
          ${eyes(26, 38, 48, 3.2)}`;
    }
    void big;
  },
};

/* ---------- 場所の背景 ---------- */
/* 街や学院の見出しに使う。空・地面はCSS、建物などの書き割りはここで描く。 */
G.PLACES = {
  home:    { name:'学生寮', sub:'アルカナ魔法学院 寄宿舎', sky:'linear-gradient(180deg,#2b1f4e,#4a2f52 60%,#6b3f4a)' },
  academy: { name:'王立アルカナ魔法学院', sub:'白亜の尖塔が七本', sky:'linear-gradient(180deg,#1f2a5e,#3a4a8f 55%,#6d7ec4)' },
  guild:   { name:'冒険者ギルド「暁の天秤」', sub:'街の東門近く', sky:'linear-gradient(180deg,#3a2436,#6b3f3a 55%,#a86a45)' },
  town:    { name:'王都アルカディア 商店街', sub:'露店がひしめく通り', sky:'linear-gradient(180deg,#232049,#40386e 55%,#6f5f9e)' },
  demon:   { name:'魔王城', sub:'紫に淀んだ空', sky:'linear-gradient(180deg,#1a0d22,#3b1236 55%,#6b1230)' },
};

G.Sprite.placeProps = function (kind) {
  const L = '#120d1c';
  switch (kind) {
    case 'academy':   // 尖塔
      return `<svg viewBox="0 0 320 128" preserveAspectRatio="none" class="props">
        ${[30, 78, 128, 182, 236, 288].map((x, i) => {
          const h = [58, 82, 96, 74, 90, 62][i];
          return `<g opacity="${0.55 + (i % 3) * 0.15}">
            <rect x="${x - 11}" y="${88 - h}" width="22" height="${h}" fill="#cfd6f0" stroke="${L}" stroke-width="1.2"/>
            <path d="M${x - 14} ${88 - h} L${x} ${88 - h - 20} L${x + 14} ${88 - h} z" fill="#8f9bd8" stroke="${L}" stroke-width="1.2"/>
            <rect x="${x - 4}" y="${96 - h}" width="8" height="10" rx="4" fill="#3a2f66"/>
          </g>`;
        }).join('')}
      </svg>`;
    case 'guild':     // 木造の建屋と看板
      return `<svg viewBox="0 0 320 128" preserveAspectRatio="none" class="props">
        <rect x="18" y="40" width="120" height="48" fill="#6b4a32" stroke="${L}" stroke-width="1.4"/>
        <path d="M10 42 L78 18 L146 42 z" fill="#8a5f3f" stroke="${L}" stroke-width="1.4"/>
        <rect x="52" y="58" width="30" height="30" fill="#2e2036" stroke="${L}" stroke-width="1.2"/>
        <rect x="150" y="34" width="10" height="54" fill="#5a3f2b" stroke="${L}" stroke-width="1.2"/>
        <rect x="132" y="34" width="46" height="20" rx="3" fill="#c9a24a" stroke="${L}" stroke-width="1.3"/>
        <path d="M148 44 h14 M155 39 v10" stroke="${L}" stroke-width="1.6"/>
        <rect x="200" y="52" width="100" height="36" fill="#5f4430" stroke="${L}" stroke-width="1.3" opacity=".8"/>
        <path d="M194 54 L250 32 L306 54 z" fill="#7a5540" stroke="${L}" stroke-width="1.3" opacity=".8"/>
      </svg>`;
    case 'town':      // 露店の並び
      return `<svg viewBox="0 0 320 128" preserveAspectRatio="none" class="props">
        ${[24, 104, 188, 268].map((x, i) => `<g opacity="${0.9 - i * 0.08}">
          <rect x="${x}" y="56" width="60" height="32" fill="#4a3f6b" stroke="${L}" stroke-width="1.2"/>
          <path d="M${x - 6} 56 h72 l-6 -14 h-60 z" fill="${['#c95f5f', '#5f9ec9', '#c9a24a', '#6bc98f'][i]}"
                stroke="${L}" stroke-width="1.2"/>
          <rect x="${x + 8}" y="64" width="44" height="6" rx="3" fill="#2a2140"/>
        </g>`).join('')}
      </svg>`;
    case 'demon':     // 黒い尖塔
      return `<svg viewBox="0 0 320 128" preserveAspectRatio="none" class="props">
        <path d="M40 88 L60 20 L80 88 z" fill="#1d0f24" stroke="#5a1f46" stroke-width="1.3"/>
        <path d="M120 88 L160 -4 L200 88 z" fill="#25102c" stroke="#6b2450" stroke-width="1.4"/>
        <path d="M240 88 L262 26 L284 88 z" fill="#1d0f24" stroke="#5a1f46" stroke-width="1.3"/>
        <circle cx="160" cy="34" r="7" fill="#d9434f" opacity=".85"/>
      </svg>`;
    default:          // 寮：窓と棚
      return `<svg viewBox="0 0 320 128" preserveAspectRatio="none" class="props">
        <rect x="26" y="20" width="76" height="54" rx="4" fill="#2a1f45" stroke="${L}" stroke-width="1.4"/>
        <path d="M64 20 v54 M26 47 h76" stroke="${L}" stroke-width="1.3"/>
        <rect x="30" y="24" width="30" height="20" fill="#7f6bd0" opacity=".55"/>
        <rect x="200" y="44" width="96" height="44" fill="#4a3a2c" stroke="${L}" stroke-width="1.3"/>
        <rect x="204" y="50" width="88" height="6" fill="#6b4a32"/>
        <rect x="204" y="64" width="88" height="6" fill="#6b4a32"/>
      </svg>`;
  }
};

/* ↓ 閉じ込めここまで */
})();
