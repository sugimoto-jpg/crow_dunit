/* ===== キャラクター描画 =====
 * 外部画像は読み込めない（配信時にブロックされる）ため、
 * キャラクターはすべてインラインSVGで描く。
 *
 * 体を「脚・胴・頭・後ろ腕・前腕・武器」のパーツに分け、
 * それぞれ class を振ってCSS側で動かせるようにしてある。
 * viewBox は 0 0 64 84 で統一し、地面は y=80。
 */
window.G = window.G || {};

/* ---------- 配色 ---------- */
const SKIN = '#f2caa4';
const SKIN_D = '#d9a87d';
const LINE = '#241a38';

G.SPRITE_PAL = {
  villager: { main: '#c2b295', sub: '#8d7b5e', accent: '#7d9b5c', metal: '#b7b7c2', hair: '#7a5230' },
  mage:     { main: '#5b3fa8', sub: '#3a2770', accent: '#c9a6ff', metal: '#e3d4ff', hair: '#4a3b6b' },
  knight:   { main: '#7c8595', sub: '#4d5462', accent: '#d94f5c', metal: '#e4e9f2', hair: '#6b4a2f' },
  cleric:   { main: '#f3ecdd', sub: '#cfc1a4', accent: '#f2c14e', metal: '#f7e6b8', hair: '#c8a45e' },
  scout:    { main: '#3f6b53', sub: '#27402f', accent: '#8fd6a8', metal: '#cfd8d2', hair: '#4a4a5e' },
};

/* ジョブ -> 見た目の系統 */
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

/* 仲間ごとの髪色（同じ系統でも見分けがつくように） */
G.SPRITE_HAIR = {
  player: '#6b4a2f', riina: '#f0d089', velt: '#c0533a', noa: '#59566e',
};

/* 同じ系統でも服の色を変える。
   主人公とヴェルトはどちらも剣士系なので、これがないと見分けがつかない。 */
G.SPRITE_TINT = {
  player: { accent: '#f2c14e' },                                    // 主人公は金の房飾り
  velt:   { main: '#96707a', sub: '#5c3f48', metal: '#ecdada' },    // 赤みがかった鎧
  riina:  { accent: '#f2c14e' },
  noa:    { main: '#2f5844', accent: '#7fe0a8' },
};

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
function headSvg(arch, pal, hair) {
  const face = `
    <circle cx="32" cy="23" r="13" fill="${SKIN}" stroke="${LINE}" stroke-width="1.4"/>
    <ellipse cx="26.5" cy="24" rx="1.6" ry="2.2" fill="${LINE}"/>
    <ellipse cx="37.5" cy="24" rx="1.6" ry="2.2" fill="${LINE}"/>
    <path d="M29 29 q3 2.5 6 0" stroke="${SKIN_D}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;

  if (arch === 'mage') {
    return `<g class="s-head">
      ${face}
      <path d="M17 20 q4 -17 15 -17 q11 0 15 17 q-15 -6 -30 0 z" fill="${pal.main}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M32 3 q9 -9 13 -1 q-6 2 -8 6" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
      <circle cx="32" cy="12" r="2.6" fill="${pal.accent}" stroke="${LINE}" stroke-width="1"/>
    </g>`;
  }
  if (arch === 'knight') {
    return `<g class="s-head">
      ${face}
      <path d="M18 22 q0 -19 14 -19 q14 0 14 19 l-4 0 q0 -11 -10 -11 q-10 0 -10 11 z"
            fill="${pal.metal}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M32 3 q2 -6 4 0 q-2 6 -4 10 z" fill="${pal.accent}" stroke="${LINE}" stroke-width="1.1"/>
    </g>`;
  }
  if (arch === 'cleric') {
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
  if (arch === 'scout') {
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
function bodySvg(arch, pal, tier) {
  const legs = `
    <g class="s-legs">
      <g class="s-legB"><rect x="25" y="57" width="7" height="21" rx="3" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
        <rect x="23.5" y="73" width="10" height="6" rx="2.5" fill="${LINE}"/></g>
      <g class="s-legF"><rect x="32" y="57" width="7" height="21" rx="3" fill="${pal.sub}" stroke="${LINE}" stroke-width="1.3"/>
        <rect x="30.5" y="73" width="10" height="6" rx="2.5" fill="${LINE}"/></g>
    </g>`;

  // 上位職はマントが付く
  const cape = tier >= 2
    ? `<path class="s-cape" d="M22 38 q-8 20 -5 36 q15 -6 30 0 q3 -16 -5 -36 z"
         fill="${pal.accent}" opacity=".85" stroke="${LINE}" stroke-width="1.3"/>` : '';

  if (arch === 'mage' || arch === 'cleric') {
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

  if (arch === 'knight') {
    return `${legs}${cape}${torso}
      <path d="M20 39 q4 -5 9 -3 l-1 7 q-5 0 -8 -1 z" fill="${pal.metal}" stroke="${LINE}" stroke-width="1.2"/>
      <path d="M44 39 q-4 -5 -9 -3 l1 7 q5 0 8 -1 z" fill="${pal.metal}" stroke="${LINE}" stroke-width="1.2"/>
      <path d="M32 42 l4 7 l-4 7 l-4 -7 z" fill="${pal.accent}" stroke="${LINE}" stroke-width="1"/>`;
  }
  if (arch === 'scout') {
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

  /* キャラ -> SVG。装備している武器の形も反映する。 */
  hero(c) {
    const arch = G.SPRITE_ARCH[c.jobId] || 'villager';
    const job = G.JOBS[c.jobId] || {};
    const base = G.SPRITE_PAL[arch] || G.SPRITE_PAL.villager;
    const pal = Object.assign({}, base);
    const hair = G.SPRITE_HAIR[c.key] || base.hair;
    const tier = job.tier || 0;

    // 上位職ほど色を締めて、装飾を足す
    if (tier >= 3) { pal.accent = G.Sprite.lighten(pal.accent, 0.18); }
    Object.assign(pal, G.SPRITE_TINT[c.key] || {});
    const wshape = (G.ITEMS[c.equip && c.equip.weapon] || {}).shape || 'stick';
    const arms = armsSvg(pal, wshape);

    return `<svg class="chr" viewBox="0 0 64 84" role="img" aria-label="${G.util.esc(c.name)}">
      <ellipse class="s-shadow" cx="32" cy="79" rx="15" ry="3.5" fill="#000" opacity=".3"/>
      <g class="s-body">
        ${bodySvg(arch, pal, tier)}
        ${arms.back}
        ${headSvg(arch, pal, hair)}
        ${arms.front}
        ${tier >= 4 ? `<circle class="s-aura" cx="32" cy="44" r="30" fill="${pal.accent}" opacity=".12"/>` : ''}
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
    wild_wolf:    ['beast', '#7d8490', '#4a5058'],
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
    hell_hound:   ['beast', '#d4653a', '#7a2f18'],
    lich:         ['bone', '#cfe2d8', '#5a6f66'],
    demon_knight: ['demon', '#5a5a6e', '#2d2d3c'],
    archdemon:    ['demon', '#b0434f', '#5c1f26'],

    boss_goblin_lord:   ['imp', '#8fbf68', '#4e7036'],
    boss_cave_guardian: ['stone', '#8f9aa8', '#4e5764'],
    boss_swamp_hydra:   ['dragon', '#5fa87f', '#2d6247'],
    boss_flame_dragon:  ['dragon', '#d9583a', '#7a2414'],
    gate_keeper:        ['brute', '#6b6b80', '#33333f'],
    four_general_1:     ['caster', '#9fe0f0', '#3f7f96'],
    four_general_2:     ['brute', '#e07a3a', '#7a3412'],
    demon_lord_1:       ['lord', '#8a3f8f', '#3d1a45'],
    demon_lord_2:       ['lord', '#c9434f', '#4a1220'],
  },

  enemy(u) {
    const look = G.Sprite.ENEMY_LOOK[u.enemyId] || ['imp', '#8a8a9a', '#4a4a58'];
    const [kind, c1, c2] = look;
    const big = u.isBoss;
    const svg = G.Sprite.enemyShape(kind, c1, c2, big);
    return `<svg class="chr foe ${big ? 'is-boss' : ''}" viewBox="0 0 64 84" role="img"
                 aria-label="${G.util.esc(u.name)}">
      <ellipse class="s-shadow" cx="32" cy="79" rx="${big ? 20 : 15}" ry="4" fill="#000" opacity=".32"/>
      <g class="s-body">${svg}</g>
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
