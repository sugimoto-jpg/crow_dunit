/* ===== 敵ステータス設計 =====
 * 実測したパーティ曲線(party-curve.json)に対して、
 *   ・HP     … 何ラウンドで倒せるか
 *   ・攻撃力 … 1ラウンドあたりパーティ総HPの何割を削るか
 * を目標値として逆算する。全体攻撃を持つ敵は実効火力が数倍になるため、
 * スキル構成から「1ラウンドの期待ダメージ倍率」を求めて補正する。
 */
const fs = require('fs');
const path = require('path');
const curve = require('./party-curve.json');
const { loadGame } = require('./load.js');

const G = loadGame(['src/core/util.js', 'src/data/skills.js', 'src/data/enemies.js',
  'src/data/items.js', 'src/data/quests.js']);
const SKILLS = G.SKILLS;

/* 敵ID -> その敵と初めて戦う頃のパーティレベル */
function buildEncounterLevels() {
  const lv = {};
  const put = (id, v) => { if (lv[id] === undefined || v < lv[id]) lv[id] = v; };
  for (const q of G.QUESTS) for (const id of q.enemies) put(id, RANK_LV[q.rank]);
  // 昇格試験のボスは、そのランクに上がる直前に挑む
  G.RANKS.forEach((r, i) => { if (r.promo) put(r.promo, Math.max(3, RANK_LV[i] - 2)); });
  for (const [id, v] of Object.entries(FIXED_LV)) lv[id] = v;
  // それでも決まらない敵はエリアの上限レベルから推定
  for (const id of Object.keys(G.ENEMIES)) {
    if (lv[id] !== undefined) continue;
    const area = Object.values(G.AREAS).find(a => a.pool.includes(id));
    lv[id] = area ? area.lvRange[1] + 2 : G.ENEMIES[id].lv + 4;
  }
  return lv;
}

const FILE = path.resolve(__dirname, '../src/data/enemies.js');
const WFILE = path.resolve(__dirname, 'enemy-weights.json');
let src = fs.readFileSync(FILE, 'utf8');

/* --- 設計目標 --- */
/* 各ランクの依頼を受ける頃の、現実的なパーティレベル */
const RANK_LV = [4, 9, 15, 22, 30, 39, 48];
/* クエストに出てこない敵（魔王城など）の想定レベルは個別に指定する */
const FIXED_LV = {
  gate_keeper: 48, four_general_1: 51, four_general_2: 53,
  demon_lord_1: 55, demon_lord_2: 58,
  giant_bee: 8, treant: 10, harpy: 20, golem: 20,
};
/* 「1体あたり」ではなく「その戦闘全体」で設計する。
 * 敵が何体で出てくるかによって1体あたりの適正値は変わるため。
 * 数値は瞬間火力基準。実戦は回復やMP切れで 1.5〜2.5 倍のラウンド数になる。 */
const TRASH_FIGHT   = 2.6;   // 通常戦1回に要するラウンド
const TRASH_PRESS   = 0.20;  // 通常戦でパーティが1Rに失う総HPの割合
const BOSS_ROUNDS   = 5.0;   // ボス戦の既定の長さ
const BOSS_PRESS    = 0.185; // ボス戦でパーティが1Rに失う総HPの割合

/* 節目のボスは個別に長さを指定する（物語上の山場ほど長期戦にする） */
const BOSS_LEN = {
  boss_goblin_lord: 4.5, boss_cave_guardian: 3.6, boss_swamp_hydra: 4.2,
  boss_flame_dragon: 3.4, gate_keeper: 4.5,
  four_general_1: 6.5, four_general_2: 6.0,
  demon_lord_1: 7.0, demon_lord_2: 9.0,
};

/* ボスごとの攻撃圧の微調整（1.0 が既定） */
const BOSS_PRESS_MUL = {
  boss_goblin_lord: 0.75,   // 初めてのボス戦。負けて心が折れないように
  boss_cave_guardian: 0.72,
  boss_swamp_hydra: 0.78,
  boss_flame_dragon: 0.85,
  four_general_1: 1.35,     // 四天王は歯応えを出す
  four_general_2: 1.15,
  gate_keeper: 0.80,        // 魔王城の最初の関門。ここで詰まらせない
  demon_lord_1: 0.88,       // 二段階戦の前半。ここで消耗しすぎないように
  demon_lord_2: 0.88,
};

/* 極端な重みは戦闘時間を歪めるので、1.0 寄りに圧縮する */
const compress = (w, f) => 1 + (w - 1) * f;
const AI_SKILL_P   = 0.68;  // 敵AIがスキルを使う確率（battle.js と揃える）
const DEF_BASE     = lv => 4 + lv * 2.2;

const at = lv => curve[Math.max(1, Math.min(64, Math.round(lv)))];
const ENC = buildEncounterLevels();

/* 敵ID -> その敵が何体編成で出てくるか（クエストの編成から） */
function buildPackSizes() {
  const packs = {};
  for (const q of G.QUESTS) for (const id of new Set(q.enemies)) {
    (packs[id] = packs[id] || []).push(q.enemies.length);
  }
  const out = {};
  for (const [id, arr] of Object.entries(packs)) {
    out[id] = arr.sort((a, b) => a - b)[Math.floor(arr.length / 2)];
  }
  return out;
}
const PACK = buildPackSizes();

/* 敵のスキル構成から「通常攻撃1発を1.0としたときの1R期待ダメージ倍率」を求める */
function pressureMultiplier(skills, partySize) {
  const list = (skills || []).map(s => ({ ...s, sk: SKILLS[s.id] })).filter(s => s.sk);
  if (!list.length) return 1;
  const totalW = list.reduce((a, s) => a + (s.w || 1), 0);
  let avg = 0;
  for (const s of list) {
    const sk = s.sk;
    let targets, power;
    if (sk.kind === 'heal' || sk.kind === 'buff') { targets = 0; power = 0; }
    else if (sk.fixedRatio) { targets = sk.target === 'all' ? partySize : 1; power = 60; }
    else if (sk.kind === 'debuff') { targets = sk.target === 'all' ? partySize : 1; power = sk.power || 25; }
    else { targets = sk.target === 'all' ? partySize : 1; power = sk.power || 100; }
    avg += ((s.w || 1) / totalW) * (power / 100) * targets;
  }
  return (1 - AI_SKILL_P) * 1 + AI_SKILL_P * avg;
}

/* --- 既存の数値を読む --- */
const STAT_RE = /lv:(\d+), hp:(\d+), mp:(\d+), atk:(\d+), def:(\d+), mag:(\d+), res:(\d+), spd:(\d+)/g;
const entries = [];
let m;
while ((m = STAT_RE.exec(src))) {
  const before = src.slice(0, m.index);
  const key = ([...before.matchAll(/\n  ([A-Za-z_0-9]+)\s*:\s*\{/g)].pop() || [, '?'])[1];
  const rest = src.slice(m.index);
  const nextKey = rest.slice(1).search(/\n  [A-Za-z_0-9]+\s*:\s*\{/);
  const block = nextKey >= 0 ? rest.slice(0, nextKey + 1) : rest;
  entries.push({
    key, index: m.index, length: m[0].length,
    lv: +m[1], hp: +m[2], mp: +m[3], atk: +m[4], def: +m[5], mag: +m[6], res: +m[7], spd: +m[8],
    isBoss: /boss:\s*true/.test(src.slice(Math.max(0, m.index - 220), m.index)),
    skills: [...block.matchAll(/\{\s*id:'([a-z_0-9]+)'\s*,\s*w:(\d+)\s*\}/g)].map(x => ({ id: x[1], w: +x[2] })),
    hasHeal: /id:'e_heal'/.test(block),
  });
}

/* --- 相対的な硬さ・強さの重み（初回に確定させ、以後はJSONを使う＝再実行しても結果が変わらない） --- */
const median = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)] || 1; };
let weights;
if (fs.existsSync(WFILE)) {
  weights = JSON.parse(fs.readFileSync(WFILE, 'utf8'));
  console.log('重み: tools/enemy-weights.json を使用');
} else {
  weights = {};
  const w = (e, f) => {
    const band = entries.filter(o => o.isBoss === e.isBoss && Math.abs(o.lv - e.lv) <= 6);
    return Math.max(0.55, Math.min(1.9, e[f] / median(band.map(o => o[f]))));
  };
  for (const e of entries) weights[e.key] = { hp: w(e, 'hp'), atk: w(e, 'atk'), def: w(e, 'def'), res: w(e, 'res') };
  fs.writeFileSync(WFILE, JSON.stringify(weights, null, 1));
  console.log('重み: 現在値から算出して tools/enemy-weights.json に保存');
}

const report = [];
for (const e of entries) {
  const w = weights[e.key] || { hp: 1, atk: 1, def: 1, res: 1 };
  const L = ENC[e.key] !== undefined ? ENC[e.key] : e.lv + 4;
  const c = at(L);
  const partyHp = c.avgHp * c.n;

  const pack = e.isBoss ? 1 : (PACK[e.key] || 3);
  const rounds = e.isBoss ? (BOSS_LEN[e.key] || BOSS_ROUNDS) : TRASH_FIGHT / pack;
  const hpW = compress(w.hp, 0.5), atkW = compress(w.atk, 0.7);

  let hp = c.dps * rounds * hpW;
  if (e.hasHeal) hp *= 0.85;              // 自己回復する敵は素のHPを抑える
  hp = Math.round(hp);

  // 1Rの期待ダメージが目標値になるよう、通常攻撃1発のダメージを決める
  // 硬い敵は戦闘が長引くので、1Rの圧力を下げて「戦闘全体で受ける総ダメージ」を一定に保つ
  const pressTotal = e.isBoss ? BOSS_PRESS * (BOSS_PRESS_MUL[e.key] || 1) : TRASH_PRESS / pack;
  const press = pressTotal * atkW / hpW;
  const mult = pressureMultiplier(e.skills, c.n);
  const perHit = (partyHp * press) / mult;

  const atk = Math.max(3, Math.round(perHit * (120 + c.avgDef * 1.5) / 120));
  const mag = Math.max(3, Math.round(perHit * (120 + c.avgRes * 1.5) / 120));
  const def = Math.round(DEF_BASE(e.lv) * compress(w.def, 0.8));
  const res = Math.round(DEF_BASE(e.lv) * compress(w.res, 0.8));

  // 経験値：1編成を倒して 0.15 レベル分（ボスは 1.5 レベル分）
  const toNext = Math.floor(18 * Math.pow(L, 1.75) + 26 * L);
  const exp = Math.max(3, Math.round(e.isBoss ? toNext * 1.5 : toNext * 0.15 / pack));
  // 所持金：討伐だけでも依頼報酬の4割ほどになるように
  const gold = Math.max(2, Math.round(e.isBoss ? toNext * 0.55 : toNext * 0.07 / pack));

  report.push({ key: e.key, lv: e.lv, encLv: L, boss: e.isBoss, hp: [e.hp, hp], atk: [e.atk, atk], mult });
  e.newText = `lv:${e.lv}, hp:${hp}, mp:${e.mp}, atk:${atk}, def:${def}, mag:${mag}, res:${res}, spd:${e.spd}`;
  e.expGold = { exp, gold };
}

for (const e of entries.slice().sort((a, b) => b.index - a.index)) {
  src = src.slice(0, e.index) + e.newText + src.slice(e.index + e.length);
  // 直後にある exp/gold も書き換える
  const after = src.slice(e.index, e.index + 600);
  const rep = after.replace(/exp:\d+, gold:\d+/, `exp:${e.expGold.exp}, gold:${e.expGold.gold}`);
  src = src.slice(0, e.index) + rep + src.slice(e.index + 600);
}
fs.writeFileSync(FILE, src);

console.log('\nkey                  Lv 遭遇     HP          攻撃      全体倍率');
for (const r of report) {
  console.log(
    `${r.key.padEnd(20, ' ')} ${String(r.lv).padStart(2)} ${String(r.encLv).padStart(3)} ${String(r.hp[0]).padStart(6)}→${String(r.hp[1]).padStart(6)} `
    + `${String(r.atk[0]).padStart(5)}→${String(r.atk[1]).padStart(5)}   ×${r.mult.toFixed(2)}${r.boss ? '  [ボス]' : ''}`);
}
