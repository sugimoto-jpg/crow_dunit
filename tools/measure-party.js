/* 標準パーティのレベル別 火力/HP/守備 を測り JSON で出す（敵ステータス再設計の基準値） */
const { G, setupParty } = require('./balance.js');

const GEAR = [
  { lv:1,  weapon:['wood_stick'], armor:'cloth' },
  { lv:5,  weapon:['bronze_sword','oak_staff','bronze_dagger'], armor:'academy_robe' },
  { lv:12, weapon:['iron_sword','apprentice_wand','cleric_mace','hunting_bow'], armor:'leather_armor' },
  { lv:20, weapon:['iron_sword','apprentice_wand','cleric_mace','hunting_bow'], armor:'chain_mail', accessory:'power_ring' },
  { lv:26, weapon:['silver_sword','crystal_rod','assassin_edge','holy_scepter'], armor:'chain_mail', accessory:'guard_ring' },
  { lv:33, weapon:['mithril_blade','arch_staff','storm_bow','holy_scepter'], armor:['plate_armor','mage_robe'], accessory:'swift_boots' },
  { lv:40, weapon:['flame_tongue','world_tree_staff','shadow_fang'], armor:['dragon_mail','holy_vestment','shadow_garb'], accessory:'life_amulet' },
  { lv:50, weapon:['flame_tongue','world_tree_staff','shadow_fang'], armor:['dragon_mail','star_robe','shadow_garb'], accessory:'life_amulet' },
  // 卒業時に聖剣と勇者の証を受け取るため、終盤は一段跳ね上がる
  { lv:54, weapon:['excalibur','world_tree_staff','shadow_fang'], armor:['dragon_mail','star_robe','shadow_garb'], accessory:['hero_proof','life_amulet','mana_pendant'] },
];
const gearFor = lv => GEAR.filter(g => g.lv <= lv).pop();
const PATH = [{lv:5,job:'apprentice_knight'},{lv:15,job:'swordsman'},{lv:30,job:'magic_swordsman'},{lv:50,job:'sword_saint'}];
const pathFor = lv => PATH.filter(p => p.lv <= lv).map(p => p.job);
const compFor = lv => lv >= 15 ? ['riina','velt','noa'] : lv >= 8 ? ['riina','velt'] : lv >= 2 ? ['riina'] : [];

function sample(lv) {
  const g = gearFor(lv);
  const equip = { weapon:g.weapon, armor:g.armor };
  if (g.accessory) equip.accessory = g.accessory;
  setupParty({ level:lv, jobPath:pathFor(lv), companions:compFor(lv), equip });
  const b = G.Battle.init(['slime'], { canFlee:false });
  const dummy = { base:{atk:1,def:Math.round(4+lv*2.2),mag:1,res:Math.round(4+lv*2.2),spd:1},
                  buffs:[], status:{}, weak:[], resist:[], tags:[], maxHp:1e9, hp:1e9, guarding:false };
  let dps = 0;
  for (const u of b.allies) {
    let best = G.Battle.calcDamage(u, dummy, {kind:'phys',power:100}).amount;
    for (const id of u.skills) {
      const sk = G.SKILLS[id];
      if (!sk || !['phys','mag','hybrid'].includes(sk.kind)) continue;
      const d = G.Battle.calcDamage(u, dummy, sk).amount * (sk.hits||1);
      if (d > best) best = d;
    }
    dps += best;
  }
  const n = b.allies.length;
  return {
    dps,
    avgHp: b.allies.reduce((s,u)=>s+u.maxHp,0)/n,
    avgDef: b.allies.reduce((s,u)=>s+u.base.def,0)/n,
    avgRes: b.allies.reduce((s,u)=>s+u.base.res,0)/n,
    n,
  };
}

const out = {};
for (let lv = 1; lv <= 64; lv++) {
  const runs = Array.from({length:9}, () => sample(lv));
  const med = k => runs.map(r=>r[k]).sort((a,b)=>a-b)[4];
  out[lv] = { dps:Math.round(med('dps')), avgHp:Math.round(med('avgHp')),
              avgDef:Math.round(med('avgDef')), avgRes:Math.round(med('avgRes')), n:runs[0].n };
}
// 火力とHPは単調増加になるよう均す（装備の入れ替わりで生じる凹みを除く）
let peakD = 0, peakH = 0;
for (let lv = 1; lv <= 64; lv++) {
  out[lv].dps = peakD = Math.max(peakD, out[lv].dps);
  out[lv].avgHp = peakH = Math.max(peakH, out[lv].avgHp);
}
require('fs').writeFileSync(__dirname + '/party-curve.json', JSON.stringify(out, null, 0));
console.log('計測完了: tools/party-curve.json');
console.log('Lv10', out[10], '\nLv30', out[30], '\nLv55', out[55]);
