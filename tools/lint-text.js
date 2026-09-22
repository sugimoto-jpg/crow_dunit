/* データ内の日本語文字列に紛れたラテン語句・キリル文字を検出する */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

// src 配下の全 JS を対象にする
function walk(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(dir + '/' + e.name) : (e.name.endsWith('.js') ? [dir + '/' + e.name] : []));
}
const FILES = walk('src');
// 固有名詞として許容する語
const ALLOW = /^(HP|MP|AP|EXP|G|Lv|S|A|B|C|D|E|F)$/;

let found = 0;
for (const rel of FILES) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  src.split('\n').forEach((line, i) => {
    // name: '...' / desc:'...' / intro:'...' の中身だけを見る
    const m = [...line.matchAll(/(?:name|desc|intro|sub|text|speaker|title)\s*:\s*'([^']*)'/g)];
    for (const mm of m) {
      const s = mm[1];
      if (!/[぀-ヿ一-鿿]/.test(s)) continue;       // 日本語を含まない文字列は対象外
      if (/[Ѐ-ӿ]/.test(s)) { console.log(`${rel}:${i + 1} キリル文字: ${s}`); found++; continue; }
      const latin = [...s.matchAll(/[A-Za-z]{2,}/g)].map(x => x[0]).filter(w => !ALLOW.test(w));
      if (latin.length) { console.log(`${rel}:${i + 1} 英字混入 [${latin}]: ${s}`); found++; }
    }
  });
}
console.log(found ? `\n検出: ${found} 件` : '日本語テキスト: 問題なし');
process.exit(found ? 1 : 0);
