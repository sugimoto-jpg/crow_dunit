/* ===== 依存関係の調査 =====
 * 各ファイルが「何を定義し」「何を使っているか」を洗い出す。
 * モジュール化の前に、どこを切り離せるかを把握するために使う。
 * 読み取りのみでコードは変更しない。
 */
const fs = require('fs');
const path = require('path');
const { scriptsFromIndex, ROOT } = require('./load.js');

const files = scriptsFromIndex();

/* コメントを取り除く。
 * 「以前は G.State を読んでいた」のような説明文まで依存として数えてしまうため。 */
const stripComments = s => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* G.XXX の定義（G.XXX = ...）と参照（G.XXX）を拾う */
const defs = {};   // シンボル -> 定義しているファイル
const uses = {};   // ファイル -> 使っているシンボルの集合
const globals = {}; // ファイル -> G を経由しないトップレベル宣言

for (const f of files) {
  const src = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));

  // 定義: G.Foo = / G.Foo.bar = は除く（トップレベルのみ）
  for (const m of src.matchAll(/^G\.([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)) {
    (defs[m[1]] = defs[m[1]] || []).push(f);
  }
  // G.UI.register('name', ...) で登録される画面も定義とみなす
  for (const m of src.matchAll(/G\.UI\.register\('([a-z_]+)'/g)) {
    (defs['[画面] ' + m[1]] = defs['[画面] ' + m[1]] || []).push(f);
  }

  // 参照
  uses[f] = new Set();
  for (const m of src.matchAll(/\bG\.([A-Za-z_][A-Za-z0-9_]*)/g)) uses[f].add(m[1]);

  // G を通さないトップレベル宣言（グローバル汚染）
  globals[f] = [...src.matchAll(/^(?:const|let|var|function)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm)].map(m => m[1]);
}

const ownerOf = sym => (defs[sym] || [])[0] || null;

console.log('═══ 1. 各ファイルが定義するもの ═══\n');
for (const f of files) {
  const own = Object.entries(defs).filter(([, v]) => v.includes(f)).map(([k]) => k);
  if (!own.length && !globals[f].length) continue;
  console.log(`${f}`);
  if (own.length) console.log(`   定義: ${own.join(', ')}`);
  if (globals[f].length) console.log(`   ⚠ グローバル: ${globals[f].join(', ')}`);
}

console.log('\n═══ 2. 依存の向き（ファイル → 使っている他ファイルの定義） ═══\n');
const layerOf = f => f.includes('/core/') ? 'core' : f.includes('/data/') ? 'data'
  : f.includes('/ui/') ? 'ui' : 'main';
const violations = [];

for (const f of files) {
  const deps = new Set();
  for (const sym of uses[f]) {
    const o = ownerOf(sym);
    if (o && o !== f) deps.add(o);
  }
  if (!deps.size) continue;
  console.log(`${f}`);
  for (const d of [...deps].sort()) {
    const from = layerOf(f), to = layerOf(d);
    // core が ui に依存していたら設計違反
    const bad = (from === 'core' && to === 'ui') || (from === 'data' && to !== 'data');
    if (bad) violations.push(`${f} → ${d}`);
    console.log(`   ${bad ? '❌' : '  '} → ${d}`);
  }
}

console.log('\n═══ 3. 設計違反（下位層が上位層に依存） ═══\n');
console.log(violations.length ? violations.map(v => '  ❌ ' + v).join('\n')
  : '  ✅ なし（data → core → ui の一方向が守られている）');

console.log('\n═══ 4. battle.js の DOM 非依存チェック ═══\n');
const DOM = /\bdocument\b|\bwindow\.(?!G\b)|innerHTML|querySelector|addEventListener|getElementById/;
for (const f of files.filter(x => x.includes('/core/') || x.includes('/data/'))) {
  const src = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  const hits = [...src.matchAll(new RegExp(DOM.source, 'g'))]
    .map(m => m[0]).filter(x => x !== 'window.G');
  console.log(`  ${hits.length === 0 ? '✅' : '⚠ '} ${f.padEnd(26)} DOM参照 ${hits.length} 件` +
    (hits.length ? ` (${[...new Set(hits)].join(', ')})` : ''));
}

console.log('\n═══ 5. ファイルの大きさ ═══\n');
const sizes = files.map(f => ({ f, n: fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').length }))
  .sort((a, b) => b.n - a.n);
for (const { f, n } of sizes.slice(0, 8)) {
  const bar = '█'.repeat(Math.round(n / 25));
  console.log(`  ${String(n).padStart(4)}行 ${bar} ${f}`);
}
