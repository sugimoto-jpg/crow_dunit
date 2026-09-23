/* ===== 探索のロジックを確かめる =====
 * 画面を作る前に、判定だけを先に検証する。
 * explore.js は画面を知らないので、ブラウザなしで全部試せる。
 *
 *   node tools/explore-test.js
 */
const { loadGame, scriptsFromIndex } = require('./load.js');
const G = loadGame(scriptsFromIndex());

const ok = [], ng = [];
const check = (cond, label, extra) => {
  (cond ? ok : ng).push(label + (cond || !extra ? '' : ` … ${extra}`));
  console.log(`  ${cond ? '✅' : '❌'} ${label}${!cond && extra ? `  ← ${extra}` : ''}`);
};

const fresh = (lv) => {
  G.State.newGame('探索', 'normal');
  const p = G.State.d.player;
  while (p.level < (lv || 1)) G.Char.levelUp(p);
  return G.State.d;
};

console.log('▼ 1. 地点データ\n');
const ids = Object.keys(G.SPOTS);
check(ids.length === 5, `地点が5つある（${ids.length}）`, ids.join(','));
let linkBad = 0;
for (const [k, s] of Object.entries(G.SPOTS)) {
  for (const l of s.links) if (!G.SPOTS[l] || !G.SPOTS[l].links.includes(k)) linkBad++;
}
check(linkBad === 0, '繋がりがすべて双方向', `${linkBad}件の不整合`);
check(G.SPOTS[G.SPOT_START].type === 'town', '出発点は村');

console.log('\n▼ 2. 出現する魔物は既存データから来ている\n');
for (const id of ['field_01', 'forest_01', 'cave_01']) {
  const pool = G.Explore.enemyPool(id);
  const area = G.AREAS[G.SPOTS[id].area];
  const same = pool.length === area.pool.length && pool.every(e => area.pool.includes(e));
  check(same, `${id} は ${G.SPOTS[id].area} の出現表と同じ（${pool.length}種）`, pool.join(','));
  check(pool.every(e => !!G.ENEMIES[e]), `${id} の魔物がすべて実在する`);
}

console.log('\n▼ 3. 移動\n');
fresh(1);
check(G.Explore.here().id === 'village_01', '最初は村にいる');
check(G.Explore.exits().length === 1, '村から行けるのは1か所', String(G.Explore.exits().length));
check(G.Explore.depart('forest_01') === null, '隣でない地点へは出発できない');
const trip = G.Explore.depart('field_01');
check(!!trip && trip.total === 6, `草原へ出発（${trip && trip.total}歩）`);

let guard = 0, arrived = false, fights = 0;
while (guard++ < 50) {
  const r = G.Explore.step();
  if (!r) break;
  if (r.encounter) { fights++; continue; }
  if (r.done) { arrived = true; break; }
}
check(arrived, '歩き続ければ到着する');
check(G.Explore.here().id === 'field_01', '到着後は草原にいる', G.Explore.here().id);
check(G.Explore.visited('field_01'), '到達した地点が記録される');

console.log('\n▼ 4. 遭遇\n');
/* 何度も往復して、遭遇の出かたを数える */
fresh(1);
let steps = 0, enc = 0, maxRun = 0, run = 0, maxDry = 0, dry = 0;
for (let trip2 = 0; trip2 < 120; trip2++) {
  const at = G.Explore.here().id;
  const to = at === 'village_01' ? 'field_01' : 'village_01';
  if (!G.Explore.depart(to)) break;
  let g = 0;
  while (g++ < 40) {
    const r = G.Explore.step();
    if (!r) break;
    steps++;
    if (r.encounter) {
      enc++; run++; dry = 0; maxRun = Math.max(maxRun, run);
      continue;
    }
    run = 0; dry++; maxDry = Math.max(maxDry, dry);
    if (r.done) break;
  }
}
const rate = enc / steps;
check(enc > 0, `遭遇が起きる（${steps}歩で${enc}回 / ${(rate * 100).toFixed(1)}%）`);
check(maxRun <= 3, `連続の遭遇は3回まで（実際 ${maxRun}）`);
/* 保証しているのは「判定した歩」で5回まで。
 * 出発直後の1歩と到着の歩は判定しないので、
 * 短い区間を行き来すると、歩数で見るとその分だけ伸びる。
 * 6歩の区間なら判定は4回なので、最悪で 12歩前後になる。 */
check(maxDry <= 12, `出ない状態が続きすぎない（実際 ${maxDry}歩 / 上限12歩）`);

const sizes = {};
for (let i = 0; i < 300; i++) sizes[G.Explore.rollEnemies('forest_01').length] = 1;
check(Object.keys(sizes).every(n => Number(n) >= 1 && Number(n) <= 3),
  '出る魔物は1〜3体', Object.keys(sizes).join(','));

console.log('\n▼ 5. 引き返す・全滅\n');
fresh(1);
G.Explore.depart('field_01');
G.Explore.step();
check(G.Explore.abort(), '移動の途中で引き返せる');
check(G.Explore.here().id === 'village_01', '引き返すと出発地点に戻る', G.Explore.here().id);

fresh(20);
G.State.d.explore.at = 'cave_01';
G.Explore.retreat();
check(G.Explore.here().id === 'village_01', '全滅すると村へ戻される');

console.log('\n▼ 6. ボス\n');
fresh(20);
check(G.Explore.bossOf('boss_01') === 'boss_cave_guardian', 'ボスの間にボスがいる');
check(!!G.ENEMIES[G.Explore.bossOf('boss_01')], 'そのボスが実在する');
check(G.Explore.bossOf('field_01') === null, '草原にはボスがいない');
const goldBefore = G.State.d.gold;
const r1 = G.Explore.clearBoss('boss_01');
check(r1.first === true, '初回撃破と判定される');
check(G.State.d.gold - goldBefore === 1200, `初回の報酬が入る（+${G.State.d.gold - goldBefore}G）`);
check(G.State.countItem('hi_potion') >= 2, '初回の道具が入る');
const gold2 = G.State.d.gold;
const r2 = G.Explore.clearBoss('boss_01');
check(r2.first === false, '2回目は初回扱いにならない');
check(G.State.d.gold === gold2, '2回目は報酬が二重に入らない');
check(G.Explore.cleared('boss_01'), '撃破が記録される');

console.log('\n▼ 7. 依頼との連動\n');
fresh(1);
G.State.d.quest = { active: 'q_slime', target: 'field_01', reached: false };
check(G.Explore.questTarget() === 'field_01', '目的地が読める');
check(!G.Explore.atTarget(), 'まだ目的地にいない');
const route = G.Explore.routeTo('boss_01');
check(route.length === 5 && route[0] === 'village_01' && route[4] === 'boss_01',
  `村からボスまでの道順が出る（${route.join('→')}）`);
G.State.d.explore.at = 'field_01';
check(G.Explore.atTarget(), '目的地に着いたと判定される');

console.log('\n▼ 8. 野営\n');
fresh(20);
for (const k of ['riina']) G.State.recruit(k);
{
  const d = G.State.d;
  const hurt = () => { for (const c of d.party) { c.hp = 1; c.mp = 0; } };

  d.explore.at = 'village_01';
  check(!G.Explore.canCamp(), '村では野営できない（拠点で休めるため）');

  /* ボスの間の手前では休める。
   * 到着したときに「準備を整えて奥へ進もう」と出るのに、
   * 整える手段が無かった。道中で削られたまま挑むことになり、
   * 実測ではボス戦の敗北がいちばん多い負け方だった。 */
  d.explore.at = 'boss_01';
  check(G.Explore.canCamp(), 'ボスの間の手前では野営できる');

  d.explore.at = 'cave_01';
  check(G.Explore.canCamp(), '洞窟では野営できる');

  hurt();
  const n = G.Explore.camp();
  check(n === d.party.length, `休むと全員が回復する（${n}人）`);
  check(d.party.every(c => c.hp === G.Char.maxHp(c) && c.mp === G.Char.maxMp(c)),
    'HPもMPも満タンになる');

  check(G.Explore.camp() === 0, '万全なら何も起きない（回復0人）');

  hurt();
  const gold = d.gold, day = d.day, ap = d.ap;
  G.Explore.camp();
  check(d.gold === gold && d.day === day && d.ap === ap,
    '野営は無料。お金も日数も行動力も減らない');

  hurt();
  d.explore.at = 'forest_01';
  G.Explore.depart('cave_01');
  check(!G.Explore.canCamp(), '歩いている最中は野営できない');
  check(G.Explore.camp() === 0, '移動中に休もうとしても回復しない');
  G.Explore.abort();
}

console.log('\n▼ 9. 遭遇する数の偏り\n');
{
  const total = G.Explore.GROUP.reduce((a, g) => a + g.w, 0);
  const three = G.Explore.GROUP.find(g => g.n === 3);
  check(three && three.w / total < 0.2,
    `3体同時は2割未満（${Math.round(three.w / total * 100)}%）`);
  fresh(1);
  const cnt = { 1: 0, 2: 0, 3: 0 };
  for (let i = 0; i < 600; i++) cnt[G.Explore.rollEnemies('cave_01').length]++;
  check(cnt[3] < cnt[1], `1体のほうが3体より多く出る（1体${cnt[1]} / 3体${cnt[3]}）`);
  check(cnt[1] + cnt[2] + cnt[3] === 600, '出てくる数は必ず1〜3体');
}

console.log('\n▼ 10. 古いセーブでも読める\n');
fresh(5);
const saved = JSON.parse(JSON.stringify(G.State.d));
delete saved.explore; delete saved.quest;              // 探索の追加より前のセーブを模す
G.State.data = G.State.migrate(saved);
check(!!G.State.d.explore && G.State.d.explore.at === 'village_01',
  '探索のデータが無いセーブでも、村から始まる');
check(!!G.State.d.quest && G.State.d.quest.active === null, '依頼のデータも補われる');

G.State.d.explore = { at: '存在しない地点', visited: ['嘘'], cleared: ['嘘'], trip: { from: 'field_01', to: 'x', step: 3, total: 9 } };
G.State.d.quest = { active: '存在しない依頼', target: '嘘', reached: true };
G.State.data = G.State.migrate(G.State.d);
check(G.State.d.explore.at === 'field_01', '移動の途中で終わったセーブは出発地点に戻す', G.State.d.explore.at);
check(G.State.d.explore.trip === null, '中途半端な移動は残さない');
check(G.State.d.explore.visited.length === 1, '存在しない地点の記録は捨てる');
check(G.State.d.quest.active === null, '存在しない依頼は解除される');

console.log(`\n▼ 判定：${ok.length} 件成功 / ${ng.length} 件失敗`);
if (ng.length) { for (const s of ng) console.log(`  ❌ ${s}`); process.exit(1); }
console.log('  ✅ 探索のロジックが期待どおりに動く');
