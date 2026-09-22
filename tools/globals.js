/* ===== グローバル変数の調査 =====
 * window.G を通さずにトップレベルで宣言されている名前を洗い出し、
 * 「どこで宣言され、どこから使われているか」を一覧にする。
 *
 * 全ファイルは1つのスクリプトに連結されるため、これらの名前は
 * 共有スコープに置かれる。別ファイルで同じ名前を宣言すると衝突して
 * ゲーム全体が動かなくなるため、どこまで閉じ込められるかを判断する材料にする。
 *
 * 読み取りのみでコードは変更しない。
 */
const fs = require('fs');
const path = require('path');
const { scriptsFromIndex, ROOT } = require('./load.js');

const files = scriptsFromIndex();
const stripComments = s => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* 即時関数で包まれているか。
 * 包まれていれば、中で宣言された名前は他のファイルから見えないので
 * 「漏れているグローバル」には数えない。 */
function isWrapped(src) {
  const body = stripComments(src).trim();
  return /^\(function\s*\(\s*\)\s*\{/.test(body) && /\}\)\(\s*\)\s*;?$/.test(body);
}

/* 1. 宣言されているグローバルを集める */
const declared = [];   // { name, file, kind }
const wrapped = {};
for (const f of files) {
  const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
  wrapped[f] = isWrapped(raw);
  const src = stripComments(raw);
  for (const m of src.matchAll(/^(const|let|var|function)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm)) {
    declared.push({ name: m[2], file: f, kind: m[1], contained: wrapped[f] });
  }
}

/* 2. 各グローバルがどのファイルから参照されているか */
console.log('═══ 1. グローバル変数の一覧と使用箇所 ═══\n');
const crossFile = [];
for (const g of declared) {
  const users = [];
  for (const f of files) {
    const src = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    // 「識別子としての参照」だけを数える。
    // status.sleep（プロパティ）、'sleep'（文字列）、sleep:（オブジェクトのキー）は
    // 同じ綴りでも別物なので除外する。これを分けないと誤検出になる。
    const re = new RegExp(
      `(^|[^.\\w'"\`])\\b${g.name}\\b(?!\\s*:)(?![\\w'"\`])`, 'g');
    const hits = [...src.matchAll(re)].length - (f === g.file ? 1 : 0);
    if (hits > 0) users.push({ f, hits });
  }
  const outside = users.filter(u => u.f !== g.file);
  if (outside.length) crossFile.push({ ...g, outside });

  console.log(`  ${g.name}  (${g.kind})`);
  console.log(`     宣言: ${g.file}`);
  for (const u of users) {
    console.log(`     使用: ${u.f} ${u.hits}回${u.f === g.file ? '' : '   ⚠ ファイルをまたいでいる'}`);
  }
  console.log('');
}

console.log('═══ 2. ファイルをまたいで使われているもの ═══\n');
console.log(crossFile.length
  ? crossFile.map(g => `  ⚠ ${g.name} : ${g.file} → ${g.outside.map(o => o.f).join(', ')}`).join('\n')
  : '  ✅ なし（すべて宣言されたファイル内で完結している）\n'
    + '     → 各ファイルを即時関数で包んでも、他のファイルに影響しない');

/* 3. strict mode にできるか実際に確かめる
 * 正規表現で「宣言のない代入」を探す方法は、SVGのテンプレート文字列
 * （fill="..." など）を代入と誤認するため使えない。
 * 代わりに実際に strict mode として構文解析させ、通るかどうかで判断する。
 * （宣言のない代入は実行時エラーなので、こちらはテストで検出する） */
console.log('\n═══ 3. strict mode での構文チェック ═══\n');
let ng = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  try {
    new Function(`'use strict';\n${src}`);
    console.log(`  ✅ ${f}`);
  } catch (e) {
    ng++;
    console.log(`  ❌ ${f}  ${e.message}`);
  }
}
console.log(ng ? `\n  ${ng} ファイルが strict mode で構文エラー`
  : '\n  全ファイルが strict mode で解析できる（8進数リテラル・with文・重複引数などはなし）');

/* 4. 判定：グローバルが漏れているか */
console.log('\n═══ 4. 判定 ═══\n');
const leaked = declared.filter(d => !d.contained);
const contained = declared.filter(d => d.contained);

for (const f of [...new Set(declared.map(d => d.file))]) {
  const names = declared.filter(d => d.file === f);
  const mark = wrapped[f] ? '✅ 閉じ込め済み' : '⚠ 外に漏れている';
  console.log(`  ${mark}  ${f}`);
  console.log(`     ${names.map(n => n.name).join(', ')}`);
}

console.log(`\n  閉じ込め済み: ${contained.length} 個 / 漏れている: ${leaked.length} 個`);
if (leaked.length) {
  console.log('\n  ❌ 漏れているグローバル:');
  for (const g of leaked) console.log(`     ${g.name} (${g.file})`);
  console.log('\n  対処: そのファイル全体を次の形で包んでください。');
  console.log("     (function () {\n     'use strict';\n     ...既存のコード...\n     })();");
  process.exit(1);
}
console.log('  ✅ window.G 以外のグローバルは存在しない');
