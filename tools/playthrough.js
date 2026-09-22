/* ===== 通しプレイのシミュレーション =====
 * 「そこそこ賢いプレイヤー」を再現して最初から魔王討伐まで自動で進め、
 * 暦・学費・レベル・ギルドランクが破綻しないかを見る。
 */
const { G, allyAI } = require('./balance.js');

const log = [];
const say = s => log.push(s);

function fight(enemyIds, canFlee = false) {
  const b = G.Battle.init(enemyIds, { canFlee });
  let guard = 0;
  while (!G.Battle.checkEnd(b) && guard++ < 300) {
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
  const out = G.Battle.finish(b);
  return out;
}

/* 現在の装備より強い物が買えるなら買い替える */
function shop() {
  const d = G.State.d;
  for (const key of ['item', 'weapon', 'armor', 'accessory']) {
    for (const line of G.World.shopStock(key)) {
      const it = line.item;
      if (it.type === 'consume') {
        // 回復薬は常に一定数そろえる
        const want = it.id === 'potion' || it.id === 'hi_potion' ? 8 : it.id === 'ether' || it.id === 'hi_ether' ? 5 : 0;
        while (want && G.State.countItem(it.id) < want && d.gold > it.price * 3) G.World.buy(it.id);
        continue;
      }
      for (const c of d.party) {
        const slot = it.type;
        const cur = G.ITEMS[c.equip[slot]];
        const score = x => x ? Object.values(x.mods || {}).reduce((a, b) => a + b, 0) : -1;
        // 買い替えは「学費を払える余裕」を残して行う
        const reserve = G.World.tuitionAmount() * (d.tuitionPaid ? 0 : 1);
        if (score(it) > score(cur) && d.gold - it.price > reserve) {
          if (G.World.buy(it.id).ok) G.Char.equipItem(c, it.id);
        }
      }
    }
  }
}

/* 試験に受かる見込みがあるか */
function examProjection() {
  const d = G.State.d;
  return G.examScore(d.subjects) - G.ACADEMY.passLine[Math.min(d.term, 8)];
}

/* ---------- 本編 ---------- */
/* 難易度は環境変数で切り替える。
 * 既定は ふつう。easy / hard も通しで遊べることを確かめるため。
 *   DIFF=hard node tools/playthrough.js */
const DIFF = process.env.DIFF || 'normal';
G.State.newGame('アルト', DIFF);
console.log(`難易度: ${G.DIFFICULTY[G.State.d.difficulty].name}`);
G.State.recruit('riina');
G.World.registerGuild();

let day = 0, wipes = 0, examFails = 0, caution = 0;
const marks = [];

while (day < 400 && !G.State.d.graduated) {
  const d = G.State.d;
  day++;

  // 学費は払えるときに払う
  if (!d.tuitionPaid && d.gold >= G.World.tuitionAmount()) G.World.payTuition();

  // 試験
  if (d.examAvailable) {
    if (!d.tuitionPaid) {
      // 学費が払えないうちは依頼で稼ぐ
    } else {
      const r = G.World.takeExam();
      if (r.ok) {
        if (!r.pass) { examFails++; say(`${day}日目 [試験] 不合格 ${r.score}/${r.line} → 留年`); }
        else if (r.graduated) say(`${day}日目 ★卒業★ Lv${d.player.level} 所持金${d.gold}G`);
        else marks.push(`${day}日目 試験${r.term}合格 ${r.score}/${r.line} Lv${d.player.level} ${G.World.rankKey()}級 ${d.gold}G`);
      }
    }
  }

  // 仲間の加入
  if (d.player.level >= 8 && !d.roster.velt) G.State.recruit('velt');
  if (d.player.level >= 14 && !d.roster.noa) G.State.recruit('noa');
  // 転職（もっとも成長の良いものを選ぶ＝剣士ルートを代表とする）
  const opts = G.Char.jobOptions(d.player);
  if (opts.length) {
    const pref = ['apprentice_knight', 'swordsman', 'magic_swordsman', 'sword_saint'];
    G.Char.changeJob(d.player, opts.find(o => pref.includes(o)) || opts[0]);
  }

  shop();

  // 昇格試験
  const promo = G.World.promotionInfo();
  if (promo.ok) {
    if (promo.boss) {
      const r = fight([promo.boss]);
      if (r.result === 'win') { G.World.promote(); say(`${day}日目 [昇格] ${G.World.rankKey()}級へ Lv${d.player.level}`); }
      else { wipes++; G.World.onDefeat(); }
    } else { G.World.promote(); say(`${day}日目 [昇格] ${G.World.rankKey()}級へ Lv${d.player.level}`); }
  }

  // 行動力を使い切る
  let stuck = 0;
  while (d.ap > 0 && stuck++ < 10) {
    const needStudy = examProjection() < 6;
    if (needStudy && !d.graduated) {
      // 最も遅れている科目を受講
      const worst = G.SUBJECT_IDS.slice().sort((a, b) => d.subjects[a] - d.subjects[b])[0];
      if (!G.World.takeLesson(worst).ok) break;
    } else {
      // 現在の実力に見合う依頼を選ぶ（負けが込んだら格を下げる）
      const cap = Math.max(0, d.guild.rank - caution);
      const qs = G.World.availableQuests().filter(q => q.ap <= d.ap && q.rank <= cap)
        .sort((a, b) => (b.rank - a.rank) || (b.gold - a.gold));
      if (!qs.length) { G.World.train(); continue; }
      const q = qs[0];
      if (!G.World.spendAp(q.ap)) break;
      const r = fight(q.enemies, true);
      if (r.result === 'win') { G.World.completeQuest(q); caution = Math.max(0, caution - 1); }
      else { wipes++; caution = Math.min(2, caution + 1); G.World.onDefeat(); break; }
    }
  }
  G.World.endDay();
}

const d = G.State.d;

/* --- 卒業後：S級を目指して依頼をこなす --- */
let postDays = 0;
while (postDays < 120 && (d.guild.rank < G.RANKS.length - 1 || d.player.level < 50)) {
  postDays++;
  const promo = G.World.promotionInfo();
  if (promo.ok) {
    if (promo.boss) { if (fight([promo.boss]).result === 'win') G.World.promote(); else { wipes++; G.World.onDefeat(); continue; } }
    else G.World.promote();
    say(`卒業後${postDays}日目 [昇格] ${G.World.rankKey()}級へ Lv${d.player.level}`);
  }
  const opts = G.Char.jobOptions(d.player);
  if (opts.length) {
    const pref = ['apprentice_knight', 'swordsman', 'magic_swordsman', 'sword_saint'];
    G.Char.changeJob(d.player, opts.find(o => pref.includes(o)) || opts[0]);
  }
  shop();
  let stuck = 0;
  while (d.ap > 0 && stuck++ < 10) {
    const cap = Math.max(0, d.guild.rank - caution);
    const qs = G.World.availableQuests().filter(q => q.ap <= d.ap && q.rank <= cap)
      .sort((a, b) => (b.rank - a.rank) || (b.gold - a.gold));
    if (!qs.length) { G.World.train(); continue; }
    const q = qs[0];
    if (!G.World.spendAp(q.ap)) break;
    const r = fight(q.enemies, true);
    if (r.result === 'win') { G.World.completeQuest(q); caution = Math.max(0, caution - 1); }
    else { wipes++; caution = Math.min(2, caution + 1); G.World.onDefeat(); break; }
  }
  G.World.endDay();
}

console.log(log.join('\n'));
console.log('\n--- 学期ごとの推移 ---');
console.log(marks.join('\n'));
console.log('\n=== 卒業時点 ===');
console.log(`在学 ${day}日 + 卒業後 ${postDays}日 / 留年 ${examFails}回 / 全滅 ${wipes}回`);
console.log(`Lv${d.player.level} ${G.Char.jobName(d.player)} / 所持金 ${G.util.g(d.gold)}G / ${G.World.rankKey()}級 / 依頼 ${d.guild.totalClears}件`);
console.log('習熟度:', G.SUBJECT_IDS.map(s => `${G.SUBJECTS[s].name}${Math.round(d.subjects[s])}`).join(' '));
console.log('パーティ:', d.party.map(c => `${c.name} Lv${c.level} ${G.Char.jobName(c)}`).join(' / '));

/* ---------- 魔王城 ---------- */
if (d.graduated) {
  for (const c of d.party) {
    for (const id of ['excalibur', 'hero_proof']) if (G.State.countItem(id)) G.Char.equipItem(c, id);
  }
  console.log('\n=== 魔王城 ===');
  let floorDay = 0;
  for (let i = 0; i < G.World.DEMON_FLOORS.length; i++) {
    const f = G.World.DEMON_FLOORS[i];
    const groups = f.boss ? [[f.boss]] : f.enemies;
    let ok = true;
    for (const g of groups) {
      let tries = 0;
      while (tries++ < 5) {
        const r = fight(g);
        if (r.result === 'win') break;
        G.State.restParty(); floorDay++;
        if (tries === 5) ok = false;
      }
      if (!ok) break;
    }
    console.log(`${f.name}: ${ok ? '突破' : '突破できず'}  Lv${d.player.level}`);
    if (!ok) break;
    if (f.second) {
      const r = fight([f.second]);
      console.log(`真魔王戦: ${r.result === 'win' ? '★勝利★' : '敗北'}  Lv${d.player.level}`);
    }
    G.State.restParty();
    G.World.clearFloor();
  }
  console.log(`魔王城での全滅 ${floorDay}回 / 最終 Lv${d.player.level}`);
}
