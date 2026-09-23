/* ===== 1ファイル完結版のビルド =====
 * CSS と全 JS を index.html に流し込み、外部ファイル参照のない HTML を作る。
 * ファイルを分けたままだと、zip の展開先やブラウザの設定によっては
 * 読み込みに失敗して真っ白になるため。
 *
 *   dist/tensei-arcana.html … ダウンロードして開く用（完全な HTML 文書）
 *   dist/artifact.html      … 公開用（doctype/html/head/body は付けない）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const html = read('index.html');

/* 読み込む JS を index.html の記述順そのままに拾う */
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const css = read('assets/style.css');

/* <body> の中身から <script> と末尾の余白を取り除いたものが本体の markup */
const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/);
if (!bodyMatch) throw new Error('index.html の <body> が読み取れません');
const markup = bodyMatch[1].replace(/<script src="[^"]+"><\/script>\s*/g, '').trim();

const title = (html.match(/<title>([^<]*)<\/title>/) || [, '転生魔法学院譚'])[1];
const icon = (html.match(/<link rel="icon" href="([^"]+)">/) || [])[1];

/* キャラクター画像は外から読めないので、埋め込んだ一覧を作り直してから使う。
 * （画像が1枚も無ければ空の一覧になるだけ） */
require('child_process').execFileSync(process.execPath,
  [path.join(__dirname, 'build-art.js'), '--inline', '--quiet'], { cwd: ROOT });

/* JS は1つの <script> にまとめる。順番が命なので index.html の順を保つ。 */
const js = scripts.map(s => `/* ===== ${s} ===== */\n${read(s)}`).join('\n\n');

const banner = `<!-- 転生魔法学院譚 — 1ファイル完結版
     このファイル単体で動きます。ダブルクリックでブラウザが開けば遊べます。
     生成元: tools/build-single.js -->`;

/* --- ダウンロード用：完全な HTML 文書 --- */
const standalone = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#120d1c">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>${title}</title>
${icon ? `<link rel="icon" href="${icon}">` : ''}
<style>
${css}
</style>
</head>
<body>
${banner}
${markup}
<script>
${js}
</script>
</body>
</html>
`;

/* --- 公開用：doctype/html/head/body は付けない --- */
/* 配信ページ（artifact）の題名は、説明を外した作品名だけにする。
 * 一覧に並んだときに見分けやすくするため。 */
const shortTitle = title.split(/[〜:：]/)[0].trim() || title;
const artifact = `<title>${shortTitle}</title>
<style>
${css}
</style>
${banner}
${markup}
<script>
${js}
</script>
`;

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/tensei-arcana.html'), standalone);
fs.writeFileSync(path.join(ROOT, 'dist/artifact.html'), artifact);

const kb = s => (Buffer.byteLength(s, 'utf8') / 1024).toFixed(0) + 'KB';
console.log(`取り込んだ JS: ${scripts.length} 本`);
console.log(`dist/tensei-arcana.html  ${kb(standalone)}  （ダウンロードして開く用）`);
console.log(`dist/artifact.html       ${kb(artifact)}  （公開用）`);

/* 取りこぼしがないか確かめる */
for (const [label, out] of [['standalone', standalone], ['artifact', artifact]]) {
  if (/<script src=/.test(out)) throw new Error(`${label}: 外部スクリプト参照が残っています`);
  if (/<link rel="stylesheet"/.test(out)) throw new Error(`${label}: 外部スタイル参照が残っています`);
  if (!out.includes('G.UI.register(\'title\'')) throw new Error(`${label}: 画面定義が取り込まれていません`);
}
if (/<!DOCTYPE|<html|<head>|<body>/i.test(artifact)) {
  throw new Error('artifact: doctype/html/head/body を含めてはいけません');
}
console.log('外部参照なし・必要な定義あり');

/* 一覧を通常版（画像へのパス）に戻す。
 * 戻さないと、開発中の index.html まで埋め込み版を読んでしまう。 */
require('child_process').execFileSync(process.execPath,
  [path.join(__dirname, 'build-art.js'), '--quiet'], { cwd: ROOT });
