/* ===== 文言の点検 =====
 * ・コードが使っているキーが、辞書にすべてあるか（無いとキーが画面に出る）
 * ・辞書にあるのに、どこからも使われていないキーはないか
 * ・まだコードに直接書かれている日本語がどれだけ残っているか
 * ・言語ごとの翻訳の進み具合
 *
 *   node tools/strings.js
 */
const fs = require('fs');
const path = require('path');
const { scriptsFromIndex, ROOT } = require('./load.js');

const files = scriptsFromIndex();
const JP = /[぀-ヿ㐀-鿿]/;
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* コメントを消す（行数は保つ） */
const strip = s => s
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:'"`])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));

/* ---------- 辞書を読む ---------- */
const dictFiles = files.filter(f => /strings\.[a-z]{2}\.js$/.test(f));
if (!dictFiles.length) { console.log('辞書ファイルが見つかりません'); process.exit(1); }
const STRINGS = {};
for (const f of dictFiles) {
  const g = { STRINGS };
  const sandbox = { window: { G: g } };
  sandbox.window.G = g;
  // eslint-disable-next-line no-new-func
  new Function('window', 'G', read(f))(sandbox.window, g);
}
const BASE = 'ja';
const baseKeys = Object.keys(STRINGS[BASE] || {});

/* ---------- コードが使っているキーを集める ---------- */
const used = new Map();       // key -> [file...]
const dynamic = [];           // 変数でキーを組み立てている箇所（目視が必要）
for (const f of files) {
  const src = strip(read(f));
  for (const m of src.matchAll(/G\.T(?:\.html)?\(\s*'([^']+)'/g)) {
    if (!used.has(m[1])) used.set(m[1], []);
    used.get(m[1]).push(f);
  }
  for (const m of src.matchAll(/G\.T(?:\.html)?\(\s*(?!')/g)) {
    dynamic.push(f);
  }
}

console.log('═══ 1. 辞書 ═══\n');
for (const f of dictFiles) {
  const code = f.match(/strings\.([a-z]{2})\.js$/)[1];
  const n = Object.keys(STRINGS[code] || {}).length;
  const pct = baseKeys.length ? Math.round(n / baseKeys.length * 100) : 0;
  console.log(`  ${f.padEnd(26)} ${String(n).padStart(4)} キー` +
    (code === BASE ? '  （基準）' : `  翻訳率 ${pct}%`));
}

/* ---------- 足りないキー ---------- */
console.log('\n═══ 2. コードが使っているのに辞書に無いキー ═══\n');
const missing = [...used.keys()].filter(k => !baseKeys.includes(k));
if (missing.length) {
  for (const k of missing) console.log(`  ❌ ${k}   ← ${[...new Set(used.get(k))].join(', ')}`);
} else {
  console.log(`  ✅ なし（${used.size} キーすべてが辞書にある）`);
}

/* ---------- 使われていないキー ---------- */
console.log('\n═══ 3. 辞書にあるのに使われていないキー ═══\n');
const unused = baseKeys.filter(k => !used.has(k));
console.log(unused.length ? unused.map(k => `  ⚠ ${k}`).join('\n')
  : '  ✅ なし（すべて使われている）');
if (dynamic.length) {
  console.log(`\n  ※ キーを変数で組み立てている箇所が ${dynamic.length} 件あります`
    + `（${[...new Set(dynamic)].join(', ')}）。\n     この一覧では追えないので、消す前に目で確かめてください。`);
}

/* ---------- 翻訳の抜け ---------- */
for (const f of dictFiles) {
  const code = f.match(/strings\.([a-z]{2})\.js$/)[1];
  if (code === BASE) continue;
  const lack = baseKeys.filter(k => typeof (STRINGS[code] || {})[k] !== 'string');
  console.log(`\n  ${code}: 未翻訳 ${lack.length} キー`
    + (lack.length ? `（日本語のまま表示されます）` : '  ✅ 全て翻訳済み'));
}

/* ---------- 残りの直書き ---------- */
console.log('\n═══ 4. まだコードに直接書かれている日本語 ═══\n');
const layer = f => f.includes('/data/') ? 'データ' : f.includes('/core/') ? '仕組み'
  : f.includes('/ui/') ? '画面' : 'その他';
const rows = [];
for (const f of files) {
  if (/strings\.[a-z]{2}\.js$/.test(f)) continue;
  const src = strip(read(f));
  let n = 0;
  for (const ln of src.split('\n')) if (JP.test(ln)) n++;
  if (n) rows.push({ f, n, layer: layer(f) });
}
const byLayer = {};
for (const r of rows) byLayer[r.layer] = (byLayer[r.layer] || 0) + r.n;
for (const [k, v] of Object.entries(byLayer)) console.log(`  ${k.padEnd(6)} ${String(v).padStart(4)} 行`);
console.log(`  ${'合計'.padEnd(5)} ${String(rows.reduce((a, r) => a + r.n, 0)).padStart(4)} 行`);
console.log('\n  多い順:');
for (const r of rows.sort((a, b) => b.n - a.n).slice(0, 8)) {
  console.log(`    ${String(r.n).padStart(4)} 行  ${r.f}`);
}

/* ---------- 判定 ---------- */
console.log('\n═══ 5. 判定 ═══\n');
if (missing.length) {
  console.log(`  ❌ 辞書に無いキーが ${missing.length} 件あります。`);
  console.log('     そのままだとキー文字列が画面に出てしまいます。');
  console.log('     src/data/strings.ja.js に追加してください。');
  process.exit(1);
}
console.log('  ✅ 辞書に無いキーはない（画面にキー名が出ることはない）');
