/* ===== 使われていないコンテンツの調査 =====
 * データに定義されているのに、遊んでいて一度も出てこないものを洗い出す。
 *
 * 調べかた：
 *   1. ゲームのデータをそのまま読み込む
 *   2. 各IDが「他のデータから指されているか」を全データを辿って探す
 *   3. 加えて「コードから名指しされているか」を全ファイルから探す
 *   4. ジョブは villager から辿れるかで判定する（枝が繋がっていないと選べない）
 *
 * ★ 読み取りのみ。何も削除しません。
 */
const fs = require('fs');
const path = require('path');
const { loadGame, scriptsFromIndex, ROOT } = require('./load.js');

const files = scriptsFromIndex();
const G = loadGame(files);

/* コードの中身（コメントを除く）を1つにまとめておく */
const codeSrc = {};
const toolSrc = {};
for (const f of fs.readdirSync(path.join(ROOT, 'tools'))) {
  if (!f.endsWith('.js') || f === 'unused.js') continue;
  toolSrc['tools/' + f] = fs.readFileSync(path.join(ROOT, 'tools', f), 'utf8');
}
for (const f of files) {
  if (f.includes('/data/')) continue;                 // データ同士の参照は別に辿る
  codeSrc[f] = fs.readFileSync(path.join(ROOT, f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
}

/* データ全体を辿って、文字列として現れるIDを数える。
 * どのテーブルの、どのキーの中に出てきたかも覚えておく。 */
const refs = new Map();       // id -> Set(出どころ)
function walk(node, where, seen) {
  if (node == null) return;
  if (typeof node === 'string') {
    if (!refs.has(node)) refs.set(node, new Set());
    refs.get(node).add(where);
    return;
  }
  if (typeof node !== 'object') return;
  if (seen.has(node)) return;
  seen.add(node);
  for (const [k, v] of Object.entries(node)) walk(v, where, seen);
}

const TABLES = {
  SKILLS: 'スキル', ITEMS: 'アイテム・装備', ENEMIES: '敵',
  SUBJECTS: '履修科目', AREAS: 'エリア', STORY: 'ストーリー',
  /* JOBS は末端の職が誰からも指されないので、別途「村人から辿れるか」で見る */
};

/* 「自分自身のキー」は参照に数えない。テーブルごとに中身だけを辿る。 */
for (const [t] of Object.entries(TABLES)) {
  const tbl = G[t];
  if (!tbl) continue;
  for (const [key, val] of Object.entries(tbl)) walk(val, `${t}.${key}`, new Set());
}
for (const extra of ['QUESTS', 'RANKS', 'SHOPS', 'ACADEMY', 'DIFFICULTY']) {
  if (G[extra]) walk(G[extra], extra, new Set());
}
if (G.World && G.World.DEMON_FLOORS) walk(G.World.DEMON_FLOORS, 'World.DEMON_FLOORS', new Set());

/* コードから名指しされているか。
 * 文字列（'prologue'）だけでなく、ドットで書く形（G.STORY.prologue）も探す。
 * 片方しか見ないと「使われているのに使われていない」と誤って報告してしまう。 */
function inCode(id) {
  const q = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`['"\`]${q}['"\`]|\\.${q}\\b`);
  return Object.keys(codeSrc).filter(f => re.test(codeSrc[f]));
}

/* テーブル全体をまとめて回している場合（Object.keys(G.STORY) や G.SUBJECTS[id]）、
 * 個々のキーはコードに書かれていなくても使われている。
 * この形を見つけたら「一つずつ調べても分からない」ことを明示する。 */
function isEnumerated(table) {
  const re = new RegExp(`Object\\.(keys|values|entries)\\(\\s*G\\.${table}\\b|G\\.${table}\\s*\\[`);
  return Object.keys(codeSrc).filter(f => re.test(codeSrc[f]));
}

/* ---------- ジョブは「villager から辿れるか」で見る ---------- */
const jobReach = new Set(['villager']);
let grew = true;
while (grew) {
  grew = false;
  for (const [k, j] of Object.entries(G.JOBS)) {
    if (jobReach.has(k)) continue;
    const from = j.from || [];
    if (from.some(p => jobReach.has(p))) { jobReach.add(k); grew = true; }
  }
}

/* ---------- 出力 ---------- */
console.log('═══ 使われていないコンテンツの調査 ═══');
console.log('（読み取りのみ。何も削除していません）\n');

const report = {};
for (const [t, label] of Object.entries(TABLES)) {
  const tbl = G[t];
  if (!tbl) continue;
  const total = Object.keys(tbl).length;
  const enumFiles = isEnumerated(t);
  const orphans = [];
  for (const key of Object.keys(tbl)) {
    const from = refs.has(key) ? [...refs.get(key)].filter(w => !w.startsWith(`${t}.${key}`)) : [];
    const code = inCode(key);
    if (!from.length && !code.length) orphans.push({ key, name: (tbl[key] || {}).name || '' });
  }
  report[t] = { label, total, orphans, enumFiles };
  if (enumFiles.length && orphans.length) {
    console.log(`… ${label.padEnd(12)} 全 ${String(total).padStart(3)} 件 / まとめて回されているので個別には判定できない`);
    console.log(`      （${enumFiles.join(', ')} が丸ごと使っている）`);
    continue;
  }
  const mark = orphans.length ? '⚠' : '✅';
  console.log(`${mark} ${label.padEnd(12)} 全 ${String(total).padStart(3)} 件 / 指されていない ${orphans.length} 件`);
  for (const o of orphans) console.log(`      ${o.key.padEnd(22)} ${o.name}`);
}

console.log('\n─── ジョブが村人から辿れるか ───');
const unreach = Object.keys(G.JOBS).filter(k => !jobReach.has(k));
console.log(unreach.length
  ? unreach.map(k => `  ⚠ ${k.padEnd(20)} ${G.JOBS[k].name}（前提 ${(G.JOBS[k].from || []).join(',') || 'なし'}）`).join('\n')
  : `  ✅ 全 ${Object.keys(G.JOBS).length} 職が villager から辿れる`);

/* スキルは「どのジョブが覚えるか／誰が使うか」で見る */
console.log('\n─── スキルの出どころ ───');
const bySkill = {};
for (const [jk, j] of Object.entries(G.JOBS))
  for (const s of Object.values(j.learn || {})) (bySkill[s] = bySkill[s] || []).push(`ジョブ:${jk}`);
for (const [sk, s] of Object.entries(G.SUBJECTS || {}))
  if (s.masterSkill) (bySkill[s.masterSkill] = bySkill[s.masterSkill] || []).push(`科目:${sk}`);
for (const [ek, e] of Object.entries(G.ENEMIES))
  for (const s of (e.skills || [])) (bySkill[s.id] = bySkill[s.id] || []).push(`敵:${ek}`);
for (const [ik, it] of Object.entries(G.ITEMS))
  if (it.skill) (bySkill[it.skill] = bySkill[it.skill] || []).push(`道具:${ik}`);

const noSource = Object.keys(G.SKILLS).filter(k => !bySkill[k]);
console.log(`  全 ${Object.keys(G.SKILLS).length} / 誰も覚えない・誰も使わない ${noSource.length} 件`);
for (const k of noSource) console.log(`  ⚠ ${k.padEnd(20)} ${G.SKILLS[k].name}  (${inCode(k).join(',') || 'コードからも呼ばれない'})`);

/* 敵は「どこで出るか」 */
console.log('\n─── 敵の出どころ ───');
const byEnemy = {};
for (const q of G.QUESTS || []) walkIds(q, `依頼:${q.id || q.name}`);
for (const r of G.RANKS || []) if (r.promo) (byEnemy[r.promo] = byEnemy[r.promo] || []).push(`昇格試験:${r.key}`);
for (const [i, f] of (G.World.DEMON_FLOORS || []).entries()) {
  for (const g of (f.enemies || [])) for (const e of g) (byEnemy[e] = byEnemy[e] || []).push(`魔王城${i + 1}層`);
  for (const b of [f.boss, f.second]) if (b) (byEnemy[b] = byEnemy[b] || []).push(`魔王城${i + 1}層ボス`);
}
for (const [ak, a] of Object.entries(G.AREAS || {}))
  for (const e of (a.pool || [])) (byEnemy[e] = byEnemy[e] || []).push(`エリア:${ak}`);
function walkIds(node, where) {
  if (typeof node === 'string') { if (G.ENEMIES[node]) (byEnemy[node] = byEnemy[node] || []).push(where); return; }
  if (node && typeof node === 'object') for (const v of Object.values(node)) walkIds(v, where);
}
const onlyArea = [];
const nowhere = [];
for (const k of Object.keys(G.ENEMIES)) {
  const src = byEnemy[k] || [];
  const real = src.filter(s => !s.startsWith('エリア:'));
  if (!src.length && !inCode(k).length) nowhere.push(k);
  else if (!real.length && !inCode(k).length) onlyArea.push(k);
}
console.log(`  全 ${Object.keys(G.ENEMIES).length} 体`);
console.log(`  ⚠ エリア定義にしか出てこない（＝今は戦えない）: ${onlyArea.length} 体`);
for (const k of onlyArea) console.log(`      ${k.padEnd(18)} Lv${String(G.ENEMIES[k].lv).padStart(2)} ${G.ENEMIES[k].name}  ← ${(byEnemy[k] || []).join(', ')}`);
console.log(`  ⚠ どこにも出てこない: ${nowhere.length} 体`);
for (const k of nowhere) console.log(`      ${k.padEnd(18)} Lv${String(G.ENEMIES[k].lv).padStart(2)} ${G.ENEMIES[k].name}`);

/* アイテムは「手に入る経路があるか」 */
console.log('\n─── アイテムの入手経路 ───');
const byItem = {};
for (const [sk, s] of Object.entries(G.SHOPS || {}))
  for (const ln of (s.lines || [])) {
    const id = typeof ln === 'string' ? ln : ln.id;
    if (id) (byItem[id] = byItem[id] || []).push(`店:${sk}`);
  }
for (const [ek, e] of Object.entries(G.ENEMIES))
  for (const d of (e.drops || [])) (byItem[d.id] = byItem[d.id] || []).push(`ドロップ:${ek}`);
for (const q of G.QUESTS || []) walkItem(q, `依頼:${q.id || q.name}`);
function walkItem(node, where) {
  if (typeof node === 'string') { if (G.ITEMS[node]) (byItem[node] = byItem[node] || []).push(where); return; }
  if (node && typeof node === 'object') for (const v of Object.values(node)) walkItem(v, where);
}
const noGet = Object.keys(G.ITEMS).filter(k => !byItem[k] && !inCode(k).length);
console.log(`  全 ${Object.keys(G.ITEMS).length} 件 / 入手経路が見当たらない ${noGet.length} 件`);
const byType = {};
for (const k of noGet) (byType[G.ITEMS[k].type] = byType[G.ITEMS[k].type] || []).push(k);
for (const [t, ks] of Object.entries(byType)) {
  console.log(`  ⚠ ${t}（${ks.length}件）`);
  for (const k of ks) console.log(`      ${k.padEnd(18)} ${G.ITEMS[k].name}  ${G.ITEMS[k].price ? G.ITEMS[k].price + 'G' : ''}`);
}

/* ---------- テーブルそのものが読まれているか ---------- */
console.log('\n─── データの表がゲーム本体から読まれているか ───');
for (const t of [...Object.keys(TABLES), 'JOBS', 'QUESTS', 'RANKS', 'SHOPS']) {
  if (!G[t]) continue;
  const re = new RegExp(`G\\.${t}\\b`);
  const users = Object.keys(codeSrc).filter(f => re.test(codeSrc[f]));
  if (users.length) console.log(`  ✅ G.${t.padEnd(10)} ${users.length} ファイルから読まれている`);
  else console.log(`  ⚠ G.${t.padEnd(10)} ゲーム本体のどこからも読まれていない（ツールのみ）`);
}

/* ---------- 個々の項目にあるのに、誰も読まないフィールド ---------- */
/* 例：クエストに area:'plains' と書いてあっても、
 *     それを読むコードが無ければプレイヤーには何も伝わらない。 */
console.log('\n─── 書かれているのに読まれていないフィールド ───');
const FIELD_SKIP = new Set(['name', 'desc', 'icon', 'id', 'key', 'color']);
const entriesOf = t => Array.isArray(G[t]) ? G[t] : Object.values(G[t] || {});
let deadFields = 0;
for (const t of [...Object.keys(TABLES), 'JOBS', 'QUESTS', 'RANKS']) {
  if (!G[t]) continue;
  const fields = new Set();
  for (const e of entriesOf(t)) {
    if (e && typeof e === 'object' && !Array.isArray(e)) for (const k of Object.keys(e)) fields.add(k);
  }
  const dead = [];
  for (const fname of fields) {
    if (FIELD_SKIP.has(fname)) continue;
    /* 読まれ方は3通りある。どれか1つでもあれば「使われている」。
     *   e.area            … そのまま書く
     *   e['area']         … 角括弧で書く
     *   equipBonus(c, 'study') … 名前を文字列で渡す（これを見落としやすい）
     */
    const re = new RegExp(`\\.${fname}\\b|\\[['"\`]${fname}['"\`]\\]|['"\`]${fname}['"\`]`);
    if (!Object.keys(codeSrc).some(f => re.test(codeSrc[f]))) {
      const n = entriesOf(t).filter(e => e && typeof e === 'object' && fname in e).length;
      const tools = Object.keys(toolSrc).filter(f => re.test(toolSrc[f]));
      dead.push(`${fname}（${n}件に記載`
        + (tools.length ? ` / ${tools.join(',')} だけが使用` : '、どこからも読まれない') + '）');
    }
  }
  if (dead.length) { deadFields += dead.length; console.log(`  ⚠ ${t}: ${dead.join(' / ')}`); }
}
if (!deadFields) console.log('  ✅ なし');

console.log('\n※ この一覧は「消してよいもの」ではありません。');
console.log('   作りかけ・繋ぎ忘れ・意図的に外したものが混ざっています。');
