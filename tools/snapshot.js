/* ===== 挙動スナップショット =====
 * ゲームの「計算結果」を丸ごと記録し、リファクタ前後で一致するかを確かめる。
 *
 *   node tools/snapshot.js --save    現在の挙動を基準として保存
 *   node tools/snapshot.js --check   基準と一致するか確認
 *
 * 整理（リファクタ）は「見た目を変えずに中身を片付ける」作業なので、
 * 数値が1つでも変わっていたら、それは整理ではなく改変。
 * このツールはその境界を機械的に守るためにある。
 *
 * 乱数は固定値に差し替えて実行するため、結果は毎回同じになる。
 */
const fs = require('fs');
const path = require('path');
const { loadGame, scriptsFromIndex, ROOT } = require('./load.js');

const BASE = path.join(ROOT, 'tools/snapshot-baseline.json');

function build() {
  const G = loadGame(scriptsFromIndex());

  // 乱数を止めて結果を決定的にする
  G.util.rand = (min, max) => (min + max) / 2;
  G.util.randInt = (min, max) => Math.floor((min + max) / 2);
  G.util.chance = () => false;
  G.util.choice = arr => arr[0];
  G.util.shuffle = arr => arr.slice();
  G.util.weighted = arr => arr[0];

  const snap = {};

  /* --- 1. 生データ（定義がそのまま残っているか） --- */
  snap.data = {
    skills: G.SKILLS, jobs: G.JOBS, items: G.ITEMS, shops: G.SHOPS,
    enemies: G.ENEMIES, areas: G.AREAS, quests: G.QUESTS, ranks: G.RANKS,
    academy: G.ACADEMY, subjects: G.SUBJECTS, story: G.STORY,
    companions: G.COMPANIONS, elements: G.ELEMENTS, status: G.STATUS,
    difficulty: G.DIFFICULTY, demonFloors: G.World.DEMON_FLOORS,
  };

  /* --- 2. 敵の実ステータス（難易度ごと） --- */
  snap.enemyUnits = {};
  for (const diff of Object.keys(G.DIFFICULTY)) {
    G.State.newGame('検証', diff);
    const rows = {};
    for (const id of Object.keys(G.ENEMIES)) {
      const u = G.Battle.init([id]).enemies[0];
      rows[id] = { hp: u.maxHp, mp: u.maxMp, ...u.base, exp: u.exp, gold: u.gold };
    }
    snap.enemyUnits[diff] = rows;
  }

  /* --- 3. 成長曲線（各ジョブを Lv1→60 まで育てた結果） --- */
  snap.growth = {};
  for (const jobId of Object.keys(G.JOBS)) {
    G.State.newGame('検証', 'normal');
    const c = G.State.d.player;
    const job = G.JOBS[jobId];
    while (c.level < Math.max(1, job.req)) G.Char.levelUp(c);
    if (jobId !== 'villager') {
      // 前提ジョブを順に辿って到達させる
      const route = [];
      let cur = jobId;
      while (cur && G.JOBS[cur].from) { route.unshift(cur); cur = G.JOBS[cur].from[0]; }
      for (const j of route) {
        while (c.level < G.JOBS[j].req) G.Char.levelUp(c);
        G.Char.changeJob(c, j);
      }
    }
    while (c.level < 60) G.Char.levelUp(c);
    snap.growth[jobId] = { job: c.jobId, ...G.Char.derived(c), skills: c.skills.slice().sort() };
  }

  /* --- 4. 経験値テーブル --- */
  snap.expTable = Array.from({ length: 70 }, (_, i) => G.Char.expToNext(i + 1));

  /* --- 5. 店の品揃え（階級ごと） --- */
  snap.shopStock = {};
  G.State.newGame('検証', 'normal');
  for (let rank = 0; rank < G.RANKS.length; rank++) {
    G.State.d.guild.rank = rank;
    snap.shopStock[G.RANKS[rank].key] = Object.keys(G.SHOPS)
      .map(k => [k, G.World.shopStock(k).map(s => s.id)]);
  }

  /* --- 6. ダメージ計算（代表的な組み合わせ） --- */
  snap.damage = {};
  G.State.newGame('検証', 'normal');
  for (const k of ['riina', 'velt', 'noa']) G.State.recruit(k);
  for (const c of G.State.d.party) { while (c.level < 40) G.Char.levelUp(c); }
  for (const foeId of ['slime', 'orc', 'chimera', 'demon_lord_1']) {
    const b = G.Battle.init([foeId]);
    const foe = b.enemies[0];
    for (const u of b.allies) {
      for (const skId of ['strike', 'fire_bolt', 'power_slash', 'heal']) {
        const sk = G.SKILLS[skId];
        if (!sk) continue;
        const key = `${u.name}/${skId}/${foeId}`;
        snap.damage[key] = sk.kind === 'heal'
          ? Math.floor(G.Battle.stat(u, 'mag') * (sk.power / 100) + 8)
          : G.Battle.calcDamage(u, foe, sk).amount;
      }
    }
  }

  /* --- 7. 学院の判定 --- */
  snap.academy = {
    passLine: G.ACADEMY.passLine, tuition: G.ACADEMY.tuition, reward: G.ACADEMY.examReward,
    scoreAt: [0, 25, 50, 75, 100].map(v => {
      const s = {}; for (const id of G.SUBJECT_IDS) s[id] = v;
      return G.examScore(s);
    }),
  };

  /* --- 8. 昇格条件 --- */
  snap.promotion = G.RANKS.map(r => ({ key: r.key, clears: r.clears, minLv: r.minLv, promo: r.promo || null }));

  return snap;
}

/* 差分を人が読める形で出す */
function diff(a, b, pathStr = '', out = []) {
  if (out.length > 40) return out;
  const ta = a === null ? 'null' : typeof a;
  const tb = b === null ? 'null' : typeof b;
  if (ta !== tb) { out.push(`${pathStr}: 型が違う (${ta} → ${tb})`); return out; }
  if (ta !== 'object') {
    if (a !== b) out.push(`${pathStr}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
    return out;
  }
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) {
    if (!(k in (a || {}))) { out.push(`${pathStr}.${k}: 追加された`); continue; }
    if (!(k in (b || {}))) { out.push(`${pathStr}.${k}: 消えた`); continue; }
    diff(a[k], b[k], pathStr ? `${pathStr}.${k}` : k, out);
  }
  return out;
}

const mode = process.argv[2];
const snap = build();

if (mode === '--save') {
  fs.writeFileSync(BASE, JSON.stringify(snap, null, 1));
  const kb = (fs.statSync(BASE).size / 1024).toFixed(0);
  console.log(`基準を保存しました: tools/snapshot-baseline.json (${kb}KB)`);
  console.log(`記録した項目: 生データ / 敵ステータス(難易度3種 x ${Object.keys(snap.data.enemies).length}体)`
    + ` / 成長曲線(${Object.keys(snap.growth).length}職) / 経験値表 / 店 / ダメージ計算 / 学院 / 昇格条件`);
} else if (mode === '--check') {
  if (!fs.existsSync(BASE)) { console.error('基準がありません。先に --save を実行してください。'); process.exit(1); }
  const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
  const d = diff(base, snap);
  if (!d.length) {
    console.log('✅ 挙動に変化なし（整理の前後で計算結果が完全に一致）');
  } else {
    console.log(`❌ ${d.length} 件の差分:\n` + d.map(x => '  ' + x).join('\n'));
    process.exit(1);
  }
} else {
  console.log('使い方: node tools/snapshot.js --save | --check');
  process.exit(1);
}
