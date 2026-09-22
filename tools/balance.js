/* ===== バランス検証：実際の戦闘エンジンで多数回シミュレートする ===== */
const { loadGame } = require('./load.js');

const FILES = ['src/core/util.js', 'src/data/skills.js', 'src/data/jobs.js', 'src/data/items.js',
  'src/data/enemies.js', 'src/data/quests.js', 'src/data/academy.js', 'src/data/story.js',
  'src/core/character.js', 'src/core/state.js', 'src/core/world.js', 'src/core/battle.js'];

const G = loadGame(FILES);

/* 味方の自動行動（そこそこ賢いプレイヤーを想定） */
function allyAI(b, u) {
  const foes = G.Battle.livingEnemies(b);
  const friends = G.Battle.livingAllies(b);
  if (!foes.length) return { type: 'guard' };

  const skills = u.skills.map(id => ({ id, s: G.SKILLS[id] })).filter(x => x.s && u.mp >= x.s.mp);
  const silenced = G.Battle.hasStatus(u, 'silence');

  // 瀕死の味方がいれば回復
  const hurt = friends.filter(f => f.hp < f.maxHp * 0.4).sort((a, b2) => a.hp / a.maxHp - b2.hp / b2.maxHp)[0];
  if (hurt && !silenced) {
    const heal = skills.filter(x => x.s.kind === 'heal')
      .sort((a, b2) => b2.s.power - a.s.power)[0];
    if (heal) return { type: 'skill', skillId: heal.id, targetUid: heal.s.target === 'allies' ? null : hurt.uid };
  }
  // 戦闘不能者がいれば蘇生
  const dead = G.Battle.ownSide(b, u).find(f => f.hp <= 0);
  if (dead && !silenced) {
    const rev = skills.find(x => x.s.revive);
    if (rev) return { type: 'skill', skillId: rev.id, targetUid: dead.uid };
  }
  // 攻撃スキルの中から期待ダメージが最大のものを選ぶ
  let best = null, bestDmg = 0;
  const target = foes.slice().sort((a, b2) => a.hp - b2.hp)[0];
  for (const x of skills) {
    if (silenced) break;
    if (!['phys', 'mag', 'hybrid'].includes(x.s.kind)) continue;
    let d = 0;
    const tlist = x.s.target === 'all' ? foes : [target];
    for (const t of tlist) d += G.Battle.calcDamage(u, t, x.s).amount * (x.s.hits || 1);
    // MP温存のため、MP消費に対して効率が良いものを優先
    if (d > bestDmg) { bestDmg = d; best = x; }
  }
  const basicDmg = G.Battle.calcDamage(u, target, { kind: 'phys', power: 100 }).amount;
  // MPが心もとない時は通常攻撃
  if (best && bestDmg > basicDmg * 1.25 && u.mp > u.maxMp * 0.18) {
    return { type: 'skill', skillId: best.id, targetUid: target.uid };
  }
  return { type: 'attack', targetUid: target.uid };
}

/* 1戦闘を最後まで回す */
function runBattle(enemyIds, opts = {}) {
  const b = G.Battle.init(enemyIds, { canFlee: false });
  let guard = 0;
  while (!G.Battle.checkEnd(b) && guard++ < 200) {
    G.Battle.startRound(b);
    let u;
    while ((u = G.Battle.nextActor(b))) {
      if (G.Battle.checkEnd(b)) break;
      const bt = G.Battle.beginTurn(b, u);
      if (bt.canAct) {
        const act = u.side === 'ally' ? allyAI(b, u) : G.Battle.enemyAction(b, u);
        G.Battle.perform(b, u, act);
      }
      G.Battle.endTurn(b, u);
      G.Battle.advanceCursor(b);
      if (G.Battle.checkEnd(b)) break;
    }
  }
  return { result: b.result || 'draw', rounds: b.round, b };
}

/* そのキャラが最も火力を出せる装備を選ぶ */
function bestFor(c, slot, cands) {
  let best = cands[0], bestScore = -1;
  const saved = c.equip[slot];
  for (const id of cands) {
    c.equip[slot] = id;
    const d = G.Char.derived(c);
    // そのキャラの得意な攻撃手段で評価する
    const usesMag = c.skills.some(s => G.SKILLS[s] && ['mag', 'heal'].includes(G.SKILLS[s].kind));
    const score = usesMag ? Math.max(d.atk, d.mag * 1.1) + d.mp * 0.05 : d.atk + d.spd * 0.2;
    if (score > bestScore) { bestScore = score; best = id; }
  }
  c.equip[slot] = saved;
  return best;
}

/* 難易度の補正値を、測定のときだけ差し替える。
 * 「この値にしたら勝率はどうなるか」を試すために使う。
 * ゲームのデータ（util.js の G.DIFFICULTY）は書き換えない。
 *   HARD_HP=1.25 HARD_ATK=1.12 DIFF=hard node tools/balance.js
 */
if (process.env.HARD_HP || process.env.HARD_ATK) {
  const hp = Number(process.env.HARD_HP || G.DIFFICULTY.hard.hp);
  const atk = Number(process.env.HARD_ATK || G.DIFFICULTY.hard.atk);
  G.DIFFICULTY.hard = Object.assign({}, G.DIFFICULTY.hard, { hp, atk });
  console.log(`※ 測定用に「むずかしい」を 敵HP${Math.round(hp * 100)}% 敵攻撃${Math.round(atk * 100)}% に差し替えています\n`);
}

/* パーティを指定の進行度に作る */
function setupParty({ level, jobPath, companions = [], equip = {} }) {
  /* 難易度は環境変数で切り替える。既定は ふつう。
   *   DIFF=hard node tools/balance.js */
  G.State.newGame('テスト', process.env.DIFF || 'normal');
  const p = G.State.d.player;
  for (const key of companions) G.State.recruit(key);

  // 主人公を指定レベル・指定ジョブ経路まで育てる
  for (const jid of jobPath) {
    while (p.level < G.JOBS[jid].req) G.Char.levelUp(p);
    if (jid !== 'villager') G.Char.changeJob(p, jid);
  }
  while (p.level < level) G.Char.levelUp(p);

  // 仲間も同レベルに揃える
  for (const c of G.State.d.party) {
    if (c.isPlayer) continue;
    while (c.level < level) { G.Char.levelUp(c); let g = 0; while (G.Char.autoJob(c) && g++ < 6); }
  }
  // 装備：候補が配列なら、そのキャラが最も強くなるものを自動で選ぶ
  //（実プレイでは各自が適した武器を持つため、全員に同じ剣を持たせると測定が歪む）
  // 一点物（聖剣・勇者の証）は主人公だけが持てる。
  // 全員に配ると終盤の実力を大きく過大評価してしまう。
  const takenUnique = new Set();
  for (const c of G.State.d.party) {
    for (const [slot, val] of Object.entries(equip)) {
      let cands = (Array.isArray(val) ? val : [val]).filter(id => G.ITEMS[id]);
      if (!c.isPlayer) cands = cands.filter(id => !G.ITEMS[id].unique);
      cands = cands.filter(id => !takenUnique.has(id));
      if (!cands.length) continue;
      const pick = cands.length === 1 ? cands[0] : bestFor(c, slot, cands);
      if (G.ITEMS[pick].unique) takenUnique.add(pick);
      c.equip[slot] = pick;
    }
    G.Char.syncSkills(c);
    G.Char.fullRestore(c);
  }
  return G.State.d.party;
}

/* N回試行して勝率を出す */
function trial(name, setup, enemyIds, n = 200) {
  let wins = 0, roundsSum = 0, hpSum = 0;
  for (let i = 0; i < n; i++) {
    setupParty(setup);
    const r = runBattle(enemyIds);
    if (r.result === 'win') {
      wins++; roundsSum += r.rounds;
      const alive = r.b.allies.reduce((s, u) => s + u.hp, 0);
      const max = r.b.allies.reduce((s, u) => s + u.maxHp, 0);
      hpSum += alive / max;
    }
  }
  const wr = wins / n;
  const flag = wr >= 0.97 ? '楽勝' : wr >= 0.80 ? '適正' : wr >= 0.55 ? 'やや難' : wr > 0.2 ? '高難度' : '無理';
  console.log(
    `${name.padEnd(30, '　')} 勝率 ${(wr * 100).toFixed(0).padStart(3)}%  `
    + `平均${wins ? (roundsSum / wins).toFixed(1) : '-'}R  `
    + `残HP${wins ? ((hpSum / wins) * 100).toFixed(0) : '-'}%  [${flag}]`);
  return wr;
}

/* 実際の最終決戦は「魔王 → 全回復 → 真魔王」の二段階。
 * 通しでどれだけ勝てるかを測る。 */
function finalGauntlet(setup, n = 120) {
  let first = 0, both = 0;
  for (let i = 0; i < n; i++) {
    setupParty(setup);
    if (runBattle(['demon_lord_1']).result !== 'win') continue;
    first++;
    G.State.restParty();                 // 女神の加護による全回復
    if (runBattle(['demon_lord_2']).result === 'win') both++;
  }
  console.log(
    `${'最終決戦の通し（魔王→全回復→真魔王）'.padEnd(30, '　')} `
    + `前半 ${(first / n * 100).toFixed(0)}%  通し ${(both / n * 100).toFixed(0)}%`);
  return both / n;
}

module.exports = { G, trial, runBattle, setupParty, allyAI, finalGauntlet };

if (require.main === module) {
  console.log('=== 序盤（学院入学〜Fランク / 主人公のみ or リィナ同行） ===');
  trial('Lv1 単騎 vs スライム×1', { level: 1, jobPath: [], equip: { weapon: 'wood_stick', armor: 'cloth' } }, ['slime']);
  trial('Lv1 単騎 vs スライム×3(依頼)', { level: 1, jobPath: [], equip: { weapon: 'wood_stick', armor: 'cloth' } }, ['slime', 'slime', 'slime']);
  trial('Lv2 +リィナ vs スライム×3', { level: 2, jobPath: [], companions: ['riina'], equip: { weapon: 'wood_stick', armor: 'cloth' } }, ['slime', 'slime', 'slime']);
  trial('Lv3 +リィナ vs 大ネズミ×3', { level: 3, jobPath: [], companions: ['riina'], equip: { weapon: 'wood_stick', armor: 'cloth' } }, ['rat', 'rat', 'rat']);
  trial('Lv4 +リィナ vs ゴブリン×2', { level: 4, jobPath: [], companions: ['riina'], equip: { weapon: ['bronze_sword','oak_staff','bronze_dagger'], armor: 'academy_robe' } }, ['goblin', 'goblin']);

  console.log('\n=== Eランク帯（Lv6-10 / 3人) ===');
  trial('Lv9 剣士見習い vs 狼×3', { level: 9, jobPath: ['apprentice_knight'], companions: ['riina', 'velt'], equip: { weapon: ['bronze_sword','oak_staff','bronze_dagger'], armor: 'academy_robe' } }, ['wild_wolf', 'wild_wolf', 'wild_wolf']);
  trial('Lv9 魔術師見習い vs 狼×3', { level: 9, jobPath: ['apprentice_mage'], companions: ['riina', 'velt'], equip: { weapon: ['bronze_sword','oak_staff','bronze_dagger'], armor: 'academy_robe' } }, ['wild_wolf', 'wild_wolf', 'wild_wolf']);
  trial('Lv7 昇格試験 ゴブリンロード', { level: 7, jobPath: ['apprentice_knight'], companions: ['riina', 'velt'], equip: { weapon: ['iron_sword','apprentice_wand','cleric_mace','hunting_bow'], armor: 'leather_armor' } }, ['boss_goblin_lord']);

  console.log('\n=== Dランク帯（Lv12-18 / 4人） ===');
  trial('Lv15 vs コボルト×2+蝙蝠', { level: 15, jobPath: ['apprentice_knight'], companions: ['riina', 'velt', 'noa'], equip: { weapon: ['iron_sword','apprentice_wand','cleric_mace','hunting_bow'], armor: 'leather_armor' } }, ['kobold', 'kobold', 'bat_swarm']);
  trial('Lv17 剣士 vs オーク×2', { level: 17, jobPath: ['apprentice_knight', 'swordsman'], companions: ['riina', 'velt', 'noa'], equip: { weapon: ['iron_sword','apprentice_wand','cleric_mace','hunting_bow'], armor: 'chain_mail' } }, ['orc', 'orc']);
  trial('Lv20 昇格試験 遺跡の守護者', { level: 20, jobPath: ['apprentice_knight', 'swordsman'], companions: ['riina', 'velt', 'noa'], equip: { weapon: ['iron_sword','apprentice_wand','cleric_mace','hunting_bow'], armor: 'chain_mail' } }, ['boss_cave_guardian']);

  trial('Lv37 昇格試験 沼のヒュドラ', { level: 37, jobPath: ['apprentice_knight', 'swordsman', 'magic_swordsman'], companions: ['riina', 'velt', 'noa'], equip: { weapon: ['mithril_blade','arch_staff','storm_bow','holy_scepter'], armor: ['plate_armor','mage_robe'], accessory:'swift_boots' } }, ['boss_swamp_hydra']);

  console.log('\n=== Cランク帯（Lv20-28） ===');
  trial('Lv22 魔道士 vs 遺跡3体', { level: 22, jobPath: ['apprentice_mage', 'sorcerer'], companions: ['riina', 'velt', 'noa'], equip: { weapon: ['silver_sword','crystal_rod','assassin_edge','holy_scepter'], armor: ['chain_mail','mage_robe'] } }, ['harpy', 'golem', 'skeleton']);
  trial('Lv26 剣士 vs 闇術士+骨2', { level: 26, jobPath: ['apprentice_knight', 'swordsman'], companions: ['riina', 'velt', 'noa'], equip: { weapon: ['silver_sword','crystal_rod','assassin_edge','holy_scepter'], armor: ['chain_mail','mage_robe'] } }, ['dark_mage', 'skeleton', 'skeleton']);

  console.log('\n=== Bランク帯（Lv30-36） ===');
  trial('Lv32 魔法剣士 vs ミノタウロス×2', { level: 32, jobPath: ['apprentice_knight', 'swordsman', 'magic_swordsman'], companions: ['riina', 'velt', 'noa'], equip: { weapon: ['mithril_blade','arch_staff','storm_bow','holy_scepter'], armor: ['plate_armor','mage_robe'], accessory:'swift_boots' } }, ['minotaur', 'minotaur']);
  trial('Lv35 大魔道士 vs キマイラ', { level: 35, jobPath: ['apprentice_mage', 'sorcerer', 'archmage'], companions: ['riina', 'velt', 'noa'], equip: { weapon: ['mithril_blade','arch_staff','storm_bow','holy_scepter'], armor: ['plate_armor','mage_robe'], accessory:'swift_boots' } }, ['chimera']);

  console.log('\n=== Aランク帯（Lv40-46） ===');
  trial('Lv39 剣聖ルート vs 幼竜×2', { level: 39, jobPath: ['apprentice_knight', 'swordsman', 'magic_swordsman'], companions: ['riina', 'velt', 'noa'], equip: { weapon: ['flame_tongue','world_tree_staff','shadow_fang'], armor: ['dragon_mail','holy_vestment','shadow_garb'], accessory:'life_amulet' } }, ['young_dragon', 'young_dragon']);
  trial('Lv46 昇格試験 紅蓮竜', { level: 46, jobPath: ['apprentice_knight', 'swordsman', 'magic_swordsman'], companions: ['riina', 'velt', 'noa'], equip: { weapon: ['flame_tongue','world_tree_staff','shadow_fang'], armor: ['dragon_mail','holy_vestment','shadow_garb'], accessory:'life_amulet' } }, ['boss_flame_dragon']);

  console.log('\n=== 終盤・魔王城（Lv50-58） ===');
  trial('Lv50 vs 門番ガルヴァス', { level: 50, jobPath: ['apprentice_knight', 'swordsman', 'magic_swordsman', 'sword_saint'], companions: ['riina', 'velt', 'noa'], equip: { weapon: ['flame_tongue','world_tree_staff','shadow_fang'], armor: ['dragon_mail','star_robe','shadow_garb'], accessory: ['hero_proof','life_amulet','mana_pendant'] } }, ['gate_keeper']);
  trial('Lv54 vs 四天王セレス', { level: 54, jobPath: ['apprentice_knight', 'swordsman', 'magic_swordsman', 'sword_saint'], companions: ['riina', 'velt', 'noa'], equip: { weapon: ['flame_tongue','world_tree_staff','shadow_fang'], armor: ['dragon_mail','star_robe','shadow_garb'], accessory: ['hero_proof','life_amulet','mana_pendant'] } }, ['four_general_1']);
  trial('Lv58 vs 魔王ヴァルドレア', { level: 58, jobPath: ['apprentice_knight', 'swordsman', 'magic_swordsman', 'sword_saint'], companions: ['riina', 'velt', 'noa'], equip: { weapon: ['excalibur','world_tree_staff','shadow_fang'], armor: ['dragon_mail','star_robe','shadow_garb'], accessory: ['hero_proof','life_amulet','mana_pendant'] } }, ['demon_lord_1']);
  trial('Lv62 vs 真魔王', { level: 62, jobPath: ['apprentice_knight', 'swordsman', 'magic_swordsman', 'sword_saint'], companions: ['riina', 'velt', 'noa'], equip: { weapon: ['excalibur','world_tree_staff','shadow_fang'], armor: ['dragon_mail','star_robe','shadow_garb'], accessory: ['hero_proof','life_amulet','mana_pendant'] } }, ['demon_lord_2']);

  console.log('');
  finalGauntlet({ level: 60, jobPath: ['apprentice_knight', 'swordsman', 'magic_swordsman', 'sword_saint'], companions: ['riina', 'velt', 'noa'], equip: { weapon: ['excalibur','world_tree_staff','shadow_fang'], armor: ['dragon_mail','star_robe','shadow_garb'], accessory: ['hero_proof','life_amulet','mana_pendant'] } });
}
