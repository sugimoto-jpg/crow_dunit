/* ===== ホーム画面に追加して遊べる形（PWA）を作る =====
 * dist/pwa/ に、そのまま公開できる一式を書き出す。
 *
 *   node tools/build-pwa.js   （先に build-single.js が必要）
 *
 * 中身:
 *   index.html            1ファイル版に、ホーム画面追加の設定を足したもの
 *   manifest.webmanifest  アプリ名・アイコン・画面の向き
 *   sw.js                 オフラインで動かすための仕組み
 *   icon-*.png            アイコン
 *
 * ダウンロード版（dist/tensei-arcana.html）はこれまでどおり別に残す。
 * あちらは file:// で開くため、オフラインの仕組みは使えない（使う必要もない）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'dist/tensei-arcana.html');
const PWA = path.join(ROOT, 'pwa');
const OUT = path.join(ROOT, 'dist/pwa');

if (!fs.existsSync(SRC)) {
  console.error('先に npm run build を実行してください（dist/tensei-arcana.html がありません）');
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

/* ---- index.html ---- */
let html = fs.readFileSync(SRC, 'utf8');

/* ホーム画面に追加したときの見え方を整える設定。
 * apple- で始まるものは iPhone 用。iOS は manifest を十分に見てくれないため、
 * 同じことを個別に指定する必要がある。 */
const head = `
<link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="転生魔法学院譚">
<link rel="apple-touch-icon" href="icon-192.png">
<meta name="mobile-web-app-capable" content="yes">`;

if (!/<\/head>/.test(html)) { console.error('head が見つかりません'); process.exit(1); }
html = html.replace('</head>', `${head}\n</head>`);

/* オフラインの仕組みを登録する。
 * 失敗してもゲームは動くので、握りつぶしてよい。 */
const reg = `
<script>
/* 一度開けば、次からは通信なしで起動できるようにする。
   対応していないブラウザや file:// では何もしない。

   アプリ版（Capacitor）では登録しない。
   アプリの中身はもともと端末内にあるので速くする必要がなく、
   むしろ古い内容を抱え込んで、アプリを更新しても
   新しい画面が出てこなくなる恐れがあるため。 */
(function () {
  var native = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function'
                  && window.Capacitor.isNativePlatform());
  if (native) {
    // 以前に登録されたものが残っていれば外しておく
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(function (rs) { rs.forEach(function (r) { r.unregister(); }); })
        .catch(function () {});
    }
    return;
  }
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* 使えなくても遊べる */ });
    });
  }
})();
</script>`;
html = html.replace('</body>', `${reg}\n</body>`);
fs.writeFileSync(path.join(OUT, 'index.html'), html);

/* ---- キャラクター画像 ----
 * 1ファイル版には battle と face しか埋め込んでいない（容量のため）。
 * PWA はファイルを分けて置けるので、立ち絵も含めて全部を運ぶ。
 * オフラインでも出るよう、取り込む一覧にも加える。 */
const ART_SRC = path.join(ROOT, 'assets/characters');
const artFiles = [];
(function copyArt(from, rel) {
  if (!fs.existsSync(from)) return;
  for (const name of fs.readdirSync(from)) {
    const full = path.join(from, name);
    const r = rel ? `${rel}/${name}` : name;
    if (fs.statSync(full).isDirectory()) { copyArt(full, r); continue; }
    if (!/\.(webp|png|jpe?g)$/i.test(name)) continue;
    const dest = path.join(OUT, 'characters', r);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(full, dest);
    artFiles.push(`./characters/${r}`);
  }
})(ART_SRC, '');

/* 埋め込み版は 'assets/characters/...' を知らないので、
 * PWA では配信する場所に合わせて書き換える。 */
if (artFiles.length) html = html.split('assets/characters/').join('characters/');

/* ---- 付属ファイル ---- */
const files = ['manifest.webmanifest', 'sw.js',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
const missing = [];
for (const f of files) {
  const src = path.join(PWA, f);
  if (!fs.existsSync(src)) { missing.push(f); continue; }
  fs.copyFileSync(src, path.join(OUT, f));
}
if (missing.length) {
  console.error(`足りないファイル: ${missing.join(', ')}`);
  console.error('アイコンは node tools/make-icons.js で作れます');
  process.exit(1);
}

/* ---- 取り込む一覧に画像を書き込む ----
 * sw.js は「実在するファイルだけ」を書く決まり。
 * 置いた画像をここで差し込む。 */
{
  const swPath = path.join(OUT, 'sw.js');
  let sw = fs.readFileSync(swPath, 'utf8');
  const list = artFiles.map(f => `  '${f}',`).join('\n');
  sw = sw.replace('/* ART */', list);
  fs.writeFileSync(swPath, sw);
}

/* ---- 点検 ---- */
const problems = [];
if (!/<link rel="manifest"/.test(html)) problems.push('manifest の指定がない');
if (!/serviceWorker/.test(html)) problems.push('オフラインの仕組みが登録されていない');
if (/<script src=/.test(html)) problems.push('外部スクリプト参照が残っている');
if (/<link rel="stylesheet"/.test(html)) problems.push('外部スタイル参照が残っている');

const man = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.webmanifest'), 'utf8'));
for (const k of ['name', 'short_name', 'start_url', 'display', 'icons']) {
  if (!man[k]) problems.push(`manifest に ${k} がない`);
}
if (!man.icons.some(i => i.purpose === 'maskable')) problems.push('maskable アイコンがない');

if (problems.length) {
  for (const p of problems) console.error('  ❌ ' + p);
  process.exit(1);
}

const total = files.concat(['index.html'])
  .reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0);
console.log('▼ dist/pwa/ を作成しました');
for (const f of ['index.html', ...files]) {
  console.log(`  ${f.padEnd(24)} ${String(Math.round(fs.statSync(path.join(OUT, f)).size / 1024)).padStart(4)} KB`);
}
console.log(`  ${'合計'.padEnd(23)} ${String(Math.round(total / 1024)).padStart(4)} KB`);
console.log('\n  このフォルダをそのまま公開すれば、ホーム画面に追加して遊べます。');
