/* ===== ホーム画面に追加できる形になっているかを確かめる =====
 * ・設定（manifest）が正しく読めるか
 * ・オフラインの仕組みが登録されるか
 * ・実際に通信を切っても起動して遊べるか   ← ここが本番
 *
 *   node tools/pwa-test.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'dist/pwa');
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json',
};

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((q, r) => {
      const f = path.join(DIR, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
      if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      r.end(fs.readFileSync(f));
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

const ok = [], ng = [];
const check = (cond, label, extra) => {
  (cond ? ok : ng).push(label + (cond || !extra ? '' : ` … ${extra}`));
  console.log(`  ${cond ? '✅' : '❌'} ${label}${!cond && extra ? `  ← ${extra}` : ''}`);
};

(async () => {
  if (!fs.existsSync(DIR)) { console.error('先に node tools/build-pwa.js を実行してください'); process.exit(1); }
  const { srv, port } = await serve();
  const base = `http://127.0.0.1:${port}`;
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));

  console.log('▼ 1. 設定（manifest）\n');
  const man = await (await ctx.request.get(`${base}/manifest.webmanifest`)).json();
  check(!!man.name && !!man.short_name, `アプリ名がある（${man.short_name}）`);
  check(man.display === 'standalone', 'ブラウザの枠を出さずに起動する設定');
  check(man.orientation === 'portrait', '縦画面に固定する設定');
  check(man.start_url === './index.html', `起動位置が指定されている（${man.start_url}）`);
  check(man.icons.length >= 3, `アイコンが揃っている（${man.icons.length}種）`);
  check(man.icons.some(i => i.purpose === 'maskable'), '角を切り取られても欠けないアイコンがある');
  for (const i of man.icons) {
    const r = await ctx.request.get(`${base}/${i.src}`);
    check(r.ok(), `アイコンが実在する（${i.src}）`, `HTTP ${r.status()}`);
  }

  console.log('\n▼ 2. 起動とオフラインの仕組み\n');
  await page.goto(base + '/index.html');
  await page.waitForSelector('.title-logo');
  check(true, 'タイトル画面が表示される');
  const iosMeta = await page.evaluate(() =>
    !!document.querySelector('meta[name="apple-mobile-web-app-capable"]')
    && !!document.querySelector('link[rel="apple-touch-icon"]'));
  check(iosMeta, 'iPhone 用の設定が入っている');

  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, { timeout: 15000 })
    .then(() => check(true, 'オフラインの仕組みが動き出した'))
    .catch(() => check(false, 'オフラインの仕組みが動き出した', '時間内に有効にならなかった'));

  console.log('\n▼ 3. 通信を切っても遊べるか（本番）\n');
  // サーバーを止めて、本当に通信できない状態にする
  await new Promise(r => srv.close(r));
  const page2 = await ctx.newPage();
  const errs2 = [];
  page2.on('pageerror', e => errs2.push(e.message));
  let loaded = false;
  try {
    await page2.goto(base + '/index.html', { timeout: 20000 });
    await page2.waitForSelector('.title-logo', { timeout: 15000 });
    loaded = true;
  } catch (e) { /* 失敗 */ }
  check(loaded, '通信を切った状態でも起動する');

  if (loaded) {
    const played = await page2.evaluate(async () => {
      G.State.newGame('オフライン', 'normal');
      G.UI.setChromeVisible(true);
      G.UI.show('home');
      G.BattleUI.start(['slime'], { canFlee: true });
      await new Promise(r => setTimeout(r, 900));
      return { screen: G.UI.current, name: G.State.d.party[0].name };
    });
    check(played.screen === 'battle', '通信を切った状態で戦闘まで進める', `画面=${played.screen}`);
    check(played.name === 'オフライン', 'データの読み書きも動く');
    check(errs2.length === 0, 'オフラインでもJSエラーなし', errs2.slice(0, 2).join(' / '));
  }

  await browser.close();
  console.log(`\n▼ 判定：${ok.length} 件成功 / ${ng.length} 件失敗`);
  if (ng.length) { for (const s of ng) console.log(`  ❌ ${s}`); process.exit(1); }
  console.log('  ✅ ホーム画面に追加でき、通信なしでも遊べる');
})().catch(e => { console.error('実行中に失敗:', e.stack || e.message); process.exit(1); });
