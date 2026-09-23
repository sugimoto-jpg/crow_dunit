/* ===== 探索の道のりの厳しさを測る =====
 * 村からボスの間まで、実際の戦闘エンジンで通しで歩かせる。
 * 途中の回復はしない（いまのゲームと同じ条件）ので、
 * 連戦でどれだけ消耗するかがそのまま出る。
 *
 *   node tools/explore-balance.js
 *   CAMP=1 node tools/explore-balance.js   … 各地点で野営して回復する場合
 *   LEVELS=8,12,16 node tools/explore-balance.js
 *   N=200 node tools/explore-balance.js
 */
const { loadGame } = require('./load.js');

const FILES = ['src/core/util.js', 'src/data/skills.js', 'src/data/jobs.js', 'src/data/items.js',
  'src/data/enemies.js', 'src/data/areas.js', 'src/data/places.js', 'src/data/quests.js',
  'src/data/academy.js', 'src/data/story.js',
  'src/core/character.js', 'src/core/state.js', 'src/core/world.js',
  'src/core/explore.js', 'src/core/battle.js'];

const G = loadGame(FILES);

/* 味方の自動行動。回復・蘇生を優先する、そこそこ賢い遊び方を想定。
 * （道具は使わない。使う人はもっと楽になる） */
function allyAI(b, u) {
  const foes = G.Battle.livingEnemies(b);
  const friends = G.Battle.livingAllies(b);
  if (!foes.length) return { type: 'guard' };
  const skills = u.skills.map(id => ({ id, s: G.SKILLS[id] })).filter(x => x.s && u.mp >= x.s.mp);
  const silenced = G.Battle.hasStatus(u, 'silence');

  const hurt = friends.filter(f => f.hp < f.maxHp * 0.45)
    .sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
  if (hurt && !silenced) {
    const heal = skills.filter(x => x.s.kind === 'heal').sort((a, c) => c.s.power - a.s.power)[0];
    if (heal) return { type: 'skill', skillId: heal.id, targetUid: heal.s.target === 'allies' ? null : hurt.uid };
  }
  const dead = G.Battle.ownSide(b, u).find(f => f.hp <= 0);
  if (dead && !silenced) {
    const rev = skills.find(x => x.s.revive);
    if (rev) return { type: 'skill', skillId: rev.id, targetUid: dead.uid };
  }
  let best = null, bestDmg = 0;
  const target = foes.slice().sort((a, c) => a.hp - c.hp)[0];
  for (const x of skills) {
    if (silenced) break;
    if (!['phys', 'mag', 'hybrid'].includes(x.s.kind)) continue;
    let d = 0;
    const tlist = x.s.target === 'all' ? foes : [target];
    for (const t of tlist) d += G.Battle.calcDamage(u, t, x.s).amount * (x.s.hits || 1);
    if (d > bestDmg) { bestDmg = d; best = x; }
  }
  const plain = G.Battle.calcDamage(u, target, { kind: 'phys', power: 100 }).amount;
  if (best && bestDmg > plain * 1.25 && u.mp > u.maxMp * 0.18) {
    return { type: 'skill', skillId: best.id, targetUid: G.SKILLS[best.id].target === 'all' ? null : target.uid };
  }
  return { type: 'attack', targetUid: target.uid };
}

function runBattle(enemyIds) {
  const b = G.Battle.init(enemyIds, { canFlee: false });
  let guard = 0;
  while (!G.Battle.checkEnd(b) && guard++ < 200) {
    G.Battle.startRound(b);
    let u;
    while ((u = G.Battle.nextActor(b))) {
      if (G.Battle.checkEnd(b)) break;
      const bt = G.Battle.beginTurn(b, u);
      if (bt.canAct) G.Battle.perform(b, u, u.side === 'ally' ? allyAI(b, u) : G.Battle.enemyAction(b, u));
      G.Battle.endTurn(b, u);
      G.Battle.advanceCursor(b);
      if (G.Battle.checkEnd(b)) break;
    }
  }
  G.Battle.finish(b);          // HP/MP をキャラに書き戻す（連戦の消耗を残す）
  return b.result || 'draw';
}

/* そのキャラが最も力を出せる装備を選ぶ（tools/balance.js と同じ考え方） */
function bestFor(c, slot, cands) {
  let best = cands[0], bestScore = -1;
  const saved = c.equip[slot];
  for (const id of cands) {
    c.equip[slot] = id;
    const d = G.Char.derived(c);
    const usesMag = c.skills.some(x => G.SKILLS[x] && ['mag', 'heal'].includes(G.SKILLS[x].kind));
    const score = usesMag ? Math.max(d.atk, d.mag * 1.1) + d.mp * 0.05 : d.atk + d.spd * 0.2;
    if (score > bestScore) { bestScore = score; best = id; }
  }
  c.equip[slot] = saved;
  return best;
}

/* そのレベルで普通に手に入る装備と職業。
 * ここを省くと「職も武器も無い village 人が4人」という
 * 実際には起こらない弱さで測ってしまう。 */
function gearFor(level) {
  if (level < 7) return { jobPath: [], equip: { weapon: ['bronze_sword', 'oak_staff', 'bronze_dagger'], armor: 'academy_robe' } };
  if (level < 17) return { jobPath: ['apprentice_knight'], equip: { weapon: ['iron_sword', 'apprentice_wand', 'cleric_mace', 'hunting_bow'], armor: 'leather_armor' } };
  return { jobPath: ['apprentice_knight', 'swordsman'], equip: { weapon: ['iron_sword', 'apprentice_wand', 'cleric_mace', 'hunting_bow'], armor: 'chain_mail' } };
}

function setupParty(level) {
  const { jobPath, equip } = gearFor(level);
  G.State.newGame('テスト', process.env.DIFF || 'normal');
  const p = G.State.d.player;
  for (const k of ['riina', 'velt', 'noa']) G.State.recruit(k);
  for (const jid of jobPath) {
    while (p.level < G.JOBS[jid].req) G.Char.levelUp(p);
    if (jid !== 'villager') G.Char.changeJob(p, jid);
  }
  while (p.level < level) G.Char.levelUp(p);
  for (const c of G.State.d.party) {
    if (!c.isPlayer) while (c.level < level) { G.Char.levelUp(c); let g = 0; while (G.Char.autoJob(c) && g++ < 6); }
    const taken = new Set();
    for (const [slot, val] of Object.entries(equip)) {
      let cands = (Array.isArray(val) ? val : [val]).filter(id => G.ITEMS[id]);
      if (!c.isPlayer) cands = cands.filter(id => !G.ITEMS[id].unique);
      if (!cands.length) continue;
      c.equip[slot] = cands.length === 1 ? cands[0] : bestFor(c, slot, cands);
    }
    G.Char.syncSkills(c);
    G.Char.fullRestore(c);
  }
  return G.State.d;
}

const ROUTE = ['field_01', 'forest_01', 'cave_01', 'boss_01'];

/* 1回ぶんの旅。村からボスの間まで歩き、ボスに挑む。 */
function journey(level, camp) {
  const d = setupParty(level);
  let fights = 0;
  for (const to of ROUTE) {
    if (!G.Explore.depart(to)) return { reached: false, fights, why: '道が繋がっていない' };
    for (;;) {
      const r = G.Explore.step();
      if (r.encounter && r.encounter.length) {
        fights++;
        if (runBattle(r.encounter) !== 'win') return { reached: false, fights, why: '道中で全滅' };
      }
      if (r.done) break;
    }
    /* 野営できる地点かどうかは src/data/places.js の camp で決まる。
     * ここに地点名を書くと、データを直したときに測定が古いままになる。 */
    if (camp && G.SPOTS[to].camp) for (const c of d.party) G.Char.fullRestore(c);
  }
  const bossId = G.SPOTS.boss_01.boss;
  fights++;
  const win = runBattle([bossId]) === 'win';
  return { reached: true, won: win, fights, why: win ? '' : 'ボスに敗北' };
}

const N = Number(process.env.N || 120);
const LEVELS = (process.env.LEVELS || '10,13,16,19').split(',').map(Number);
const camp = process.env.CAMP === '1';

console.log(`\n═══ 村 → ボスの間 の通し（${N}回ずつ／難易度 ${process.env.DIFF || 'normal'}`
  + `${camp ? '／各地点で野営あり' : '／回復なし'}） ═══\n`);
console.log('  Lv    ボス到達   ボス撃破   平均戦闘数   おもな失敗');
for (const lv of LEVELS) {
  let reach = 0, won = 0, f = 0;
  const why = {};
  for (let i = 0; i < N; i++) {
    const r = journey(lv, camp);
    if (r.reached) reach++;
    if (r.won) won++;
    f += r.fights;
    if (r.why) why[r.why] = (why[r.why] || 0) + 1;
  }
  const top = Object.entries(why).sort((a, b) => b[1] - a[1])[0];
  console.log(`  ${String(lv).padStart(2)}  `
    + `${(reach / N * 100).toFixed(0).padStart(7)}%  `
    + `${(won / N * 100).toFixed(0).padStart(8)}%  `
    + `${(f / N).toFixed(1).padStart(9)}回   `
    + (top ? `${top[0]} ${(top[1] / N * 100).toFixed(0)}%` : '―'));
}
console.log('');

/* 区間ごと：万全の状態で出発して、次の野営地まで辿り着けるか。
 * 通しの数字は前の区間の結果に引きずられるので、区間単位でも見る。 */
console.log('═══ 区間ごと：万全で出発して着けるか（120回ずつ） ═══\n');
{
  const legs = [['village_01', 'field_01'], ['field_01', 'forest_01'],
    ['forest_01', 'cave_01'], ['cave_01', 'boss_01']];
  for (const [from, to] of legs) {
    const need = G.SPOTS[to].requiredLevel;
    const line = [];
    for (const lv of [need, need + 3]) {
      let ok = 0, f = 0;
      for (let i = 0; i < 120; i++) {
        const d = setupParty(lv);
        d.explore.at = from;
        let dead = false;
        G.Explore.depart(to);
        for (;;) {
          const r = G.Explore.step();
          if (r.encounter && r.encounter.length) { f++; if (runBattle(r.encounter) !== 'win') { dead = true; break; } }
          if (r.done) break;
        }
        if (!dead) ok++;
      }
      line.push(`Lv${String(lv).padStart(2)} ${String(Math.round(ok / 120 * 100)).padStart(3)}%`);
    }
    console.log(`  ${G.SPOTS[from].name} → ${G.SPOTS[to].name}`.padEnd(30, '　')
      + `  到達 ${line.join('  /  ')}`);
  }
  console.log('');
}

/* 1戦ずつの厳しさも見る（万全の状態で1回だけ戦ったら） */
console.log('═══ 万全の状態で1戦だけ（100回ずつ） ═══\n');
for (const id of ['field_01', 'forest_01', 'cave_01']) {
  const s = G.SPOTS[id];
  const lvr = G.AREAS[s.area].lvRange;
  for (const lv of [lvr[0], Math.round((lvr[0] + lvr[1]) / 2)]) {
    let w = 0, hp = 0;
    for (let i = 0; i < 100; i++) {
      const d = setupParty(lv);
      const foes = G.Explore.rollEnemies(id);
      if (runBattle(foes) === 'win') {
        w++;
        hp += d.party.reduce((a, c) => a + Math.max(0, c.hp), 0)
            / d.party.reduce((a, c) => a + G.Char.maxHp(c), 0);
      }
    }
    console.log(`  ${s.name.padEnd(8, '　')} Lv${String(lv).padStart(2)}  `
      + `勝率 ${(w).toString().padStart(3)}%   残HP ${w ? (hp / w * 100).toFixed(0) : '-'}%`);
  }
}
console.log('');
