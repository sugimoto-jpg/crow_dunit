/* 標準的なパーティの「1ラウンド総火力」と「総HP」をレベルごとに実測する */
const { G, setupParty } = require('./balance.js');

// レベル帯ごとに、その時期に現実的に買える装備
const GEAR = [
  { lv: 1,  weapon:['wood_stick'], armor:'cloth' },
  { lv: 5,  weapon:['bronze_sword','oak_staff','bronze_dagger'], armor:'academy_robe' },
  { lv: 12, weapon:['iron_sword','apprentice_wand','cleric_mace','hunting_bow'], armor:'leather_armor' },
  { lv: 20, weapon:['iron_sword','apprentice_wand','cleric_mace','hunting_bow'], armor:'chain_mail', accessory:'power_ring' },
  { lv: 26, weapon:['silver_sword','crystal_rod','assassin_edge','holy_scepter'], armor:'chain_mail', accessory:'guard_ring' },
  { lv: 33, weapon:['mithril_blade','arch_staff','storm_bow','holy_scepter'], armor:['plate_armor','mage_robe'], accessory:'swift_boots' },
  { lv: 40, weapon:['flame_tongue','world_tree_staff','shadow_fang'], armor:['dragon_mail','holy_vestment','shadow_garb'], accessory:'life_amulet' },
  { lv: 50, weapon:['flame_tongue','world_tree_staff','shadow_fang'], armor:['dragon_mail','star_robe','shadow_garb'], accessory:'mana_pendant' },
  { lv: 54, weapon:['excalibur','world_tree_staff','shadow_fang'], armor:['dragon_mail','star_robe','shadow_garb'], accessory:'hero_proof' },
];
const gearFor = lv => GEAR.filter(g => g.lv <= lv).pop();

// 主人公は剣士ルート（中庸な火力）を代表とする
const PATH = [
  { lv: 5,  job:'apprentice_knight' },
  { lv: 15, job:'swordsman' },
  { lv: 30, job:'magic_swordsman' },
  { lv: 50, job:'sword_saint' },
];
const pathFor = lv => PATH.filter(p => p.lv <= lv).map(p => p.job);
const companionsFor = lv => lv >= 15 ? ['riina','velt','noa'] : lv >= 8 ? ['riina','velt'] : lv >= 2 ? ['riina'] : [];

/* ダミーの的に対する総火力を測る（防御の影響を切り離すため、素の的を使う） */
function measure(lv) {
  const g = gearFor(lv);
  const equip = { weapon: g.weapon, armor: g.armor };
  if (g.accessory) equip.accessory = g.accessory;
  setupParty({ level: lv, jobPath: pathFor(lv), companions: companionsFor(lv), equip });

  const b = G.Battle.init(['slime'], { canFlee:false });
  // 的：その時期の敵の平均的な守備値を持つ仮想ユニット
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
  const hp = b.allies.reduce((s,u)=>s+u.maxHp,0);
  return { lv, n: b.allies.length, dps: Math.round(dps), hp, avgHp: Math.round(hp/b.allies.length) };
}

const rows = [];
for (let lv = 1; lv <= 60; lv += lv < 10 ? 2 : 3) {
  // ばらつきを均すため複数回測って中央値を取る
  const samples = Array.from({length:7}, () => measure(lv).dps).sort((a,b)=>a-b);
  const m = measure(lv);
  m.dps = samples[3];
  rows.push(m);
}
console.log('Lv  人数   総火力/R   総HP   平均HP');
for (const r of rows) {
  console.log(String(r.lv).padStart(2), String(r.n).padStart(4), String(r.dps).padStart(10), String(r.hp).padStart(7), String(r.avgHp).padStart(7));
}
console.log('\n// 敵1体の目標HP（通常＝火力×1.2 / ボス＝火力×11）');
for (const r of rows) {
  console.log(`Lv${String(r.lv).padStart(2)}想定: 通常 ${Math.round(r.dps*1.2)} / ボス ${Math.round(r.dps*11)} / 被弾許容 ${Math.round(r.avgHp*0.22)}`);
}
