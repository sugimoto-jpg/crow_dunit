/* パーティの実火力と敵の耐久を突き合わせ、補正値を逆算するための診断 */
const { G, setupParty } = require('./balance.js');

const CHECKS = [
  { n:'Lv4 序盤',  s:{level:4,  jobPath:[], companions:['riina'], equip:{weapon:['bronze_sword','oak_staff','bronze_dagger'],armor:'academy_robe'}}, foes:['goblin','goblin'], boss:null },
  { n:'Lv10 E昇格', s:{level:10, jobPath:['apprentice_knight'], companions:['riina','velt'], equip:{weapon:['iron_sword','apprentice_wand','cleric_mace','hunting_bow'],armor:'leather_armor'}}, foes:['wild_wolf','wild_wolf','wild_wolf'], boss:'boss_goblin_lord' },
  { n:'Lv19 C昇格', s:{level:19, jobPath:['apprentice_knight','swordsman'], companions:['riina','velt','noa'], equip:{weapon:['iron_sword','apprentice_wand','cleric_mace','hunting_bow'],armor:'chain_mail'}}, foes:['orc','orc'], boss:'boss_cave_guardian' },
  { n:'Lv28 A昇格', s:{level:28, jobPath:['apprentice_knight','swordsman'], companions:['riina','velt','noa'], equip:{weapon:['silver_sword','crystal_rod','assassin_edge','holy_scepter'],armor:'chain_mail'}}, foes:['dark_mage','skeleton','skeleton'], boss:'boss_swamp_hydra' },
  { n:'Lv35 B帯',   s:{level:35, jobPath:['apprentice_mage','sorcerer','archmage'], companions:['riina','velt','noa'], equip:{weapon:['mithril_blade','arch_staff','storm_bow','holy_scepter'],armor:'mage_robe'}}, foes:['chimera'], boss:null },
  { n:'Lv44 S昇格', s:{level:44, jobPath:['apprentice_knight','swordsman','magic_swordsman'], companions:['riina','velt','noa'], equip:{weapon:['flame_tongue','world_tree_staff','shadow_fang'],armor:'dragon_mail'}}, foes:['young_dragon','young_dragon'], boss:'boss_flame_dragon' },
  { n:'Lv55 魔王',  s:{level:55, jobPath:['apprentice_knight','swordsman','magic_swordsman','sword_saint'], companions:['riina','velt','noa'], equip:{weapon:['excalibur','world_tree_staff','shadow_fang'],armor:'dragon_mail',accessory:'hero_proof'}}, foes:['archdemon'], boss:'demon_lord_1' },
];

console.log('目安: 通常戦は 3〜5R、ボスは 8〜14R で決着。被ダメは1発あたり最大HPの15〜30%。\n');
console.log('区分        味方総HP  1R総火力  | 敵HP(1体) 撃破R  | 敵1発  対最大HP%');

for (const c of CHECKS) {
  const party = setupParty(c.s);
  const b = G.Battle.init(c.foes, { canFlee:false });

  const partyHp = b.allies.reduce((s,u)=>s+u.maxHp,0);
  const avgMaxHp = partyHp / b.allies.length;

  // 味方1ラウンドの総火力（最良スキルを敵1体に撃った場合）
  const foe = b.enemies[0];
  let dps = 0;
  for (const u of b.allies) {
    let best = G.Battle.calcDamage(u, foe, {kind:'phys',power:100}).amount;
    for (const id of u.skills) {
      const sk = G.SKILLS[id];
      if (!sk || !['phys','mag','hybrid'].includes(sk.kind)) continue;
      const d = G.Battle.calcDamage(u, foe, sk).amount * (sk.hits||1);
      if (d > best) best = d;
    }
    dps += best;
  }

  // 敵の1発
  let foeHit = 0;
  for (const u of b.allies) foeHit += G.Battle.calcDamage(foe, u, {kind:'phys',power:100}).amount;
  foeHit /= b.allies.length;

  const line = (label, e) => {
    let hit = 0;
    for (const u of b.allies) hit += G.Battle.calcDamage(e, u, {kind:'phys',power:100}).amount;
    hit /= b.allies.length;
    console.log(
      `${label.padEnd(11,' ')} ${String(partyHp).padStart(7)} ${String(Math.round(dps)).padStart(9)}  |`
      + ` ${String(e.maxHp).padStart(8)} ${(e.maxHp/dps).toFixed(1).padStart(5)}R  |`
      + ` ${String(Math.round(hit)).padStart(6)} ${((hit/avgMaxHp)*100).toFixed(0).padStart(7)}%`);
  };
  line(c.n, foe);
  if (c.boss) {
    const bb = G.Battle.init([c.boss], { canFlee:false });
    line('  └ボス', bb.enemies[0]);
  }
}
