/* ===== アプリ版（Capacitor）の動きを、実機なしで確かめる =====
 * Capacitor の入れ物を模した偽物をページに先に仕込み、
 * アプリとして動いたときの振る舞いを検証する。
 *
 *   ・保存先が端末の領域に切り替わるか
 *   ・ブラウザに残っていたデータを引き継ぐか
 *   ・戻るボタンがゲームの「戻る」につながるか
 *   ・戻るところが無いときにアプリを閉じるか
 *   ・オフラインの仕組みを登録しない（更新が届かなくなるため）
 *   ・ブラウザで開いたときは、何も変わらない
 *
 *   node tools/native-test.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'dist/pwa');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

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

/* Capacitor を模した偽物。実際のプラグインと同じ形だけ持たせる。 */
const FAKE = () => {
  const store = {};
  window.__native = { exited: false, backHandlers: [], splashHidden: false, statusBar: null };
  window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    Plugins: {
      Preferences: {
        keys: async () => ({ keys: Object.keys(store) }),
        get: async ({ key }) => ({ value: key in store ? store[key] : null }),
        set: async ({ key, value }) => { store[key] = value; },
        remove: async ({ key }) => { delete store[key]; },
      },
      App: {
        addListener: (name, fn) => { if (name === 'backButton') window.__native.backHandlers.push(fn); },
        exitApp: () => { window.__native.exited = true; },
      },
      StatusBar: {
        setStyle: async (o) => { window.__native.statusBar = o.style; },
        setBackgroundColor: async () => {},
      },
      SplashScreen: { hide: async () => { window.__native.splashHidden = true; } },
      Haptics: { impact: async () => { window.__native.hapticCount = (window.__native.hapticCount || 0) + 1; } },
    },
  };
  // アプリ化する前に遊んでいた人のデータを模す
  try { localStorage.setItem('tensei_arcana_save_v1', '{"legacy":true}'); } catch (e) {}
};

(async () => {
  if (!fs.existsSync(DIR)) { console.error('先に npm run build:pwa を実行してください'); process.exit(1); }
  const { srv, port } = await serve();
  const base = `http://127.0.0.1:${port}`;
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  /* ---------- アプリ版として ---------- */
  console.log('▼ 1. アプリとして動いたとき\n');
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(FAKE);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(base + '/index.html');
  await page.waitForSelector('.title-logo');
  await page.evaluate(() => G.Native.ready);

  check(await page.evaluate(() => G.Native.active === true), 'アプリとして動いていると判定される');
  check(await page.evaluate(() => G.Storage.kind === 'native'),
    '保存先が端末の領域に切り替わる', await page.evaluate(() => G.Storage.kind));
  check(await page.evaluate(() => G.Storage.get('tensei_arcana_save_v1') === '{"legacy":true}'),
    'アプリ化する前のデータを引き継ぐ');

  // 保存して読めるか
  const roundTrip = await page.evaluate(() => {
    G.State.newGame('アプリ版', 'normal');
    G.State.d.gold = 12345;
    G.State.save();
    G.State.data = null;
    return G.State.load() && G.State.d.gold === 12345 && G.State.d.party[0].name === 'アプリ版';
  });
  check(roundTrip, '端末の領域に保存して、読み戻せる');

  check(await page.evaluate(() => window.__native.splashHidden === true), '起動画面が消える');
  check(await page.evaluate(() => window.__native.statusBar === 'DARK'), '状態バーの色が合わせられる');

  console.log('\n▼ 2. 戻るボタン\n');
  check(await page.evaluate(() => window.__native.backHandlers.length === 1), '戻るボタンを受け取る用意がある');
  await page.evaluate(() => { G.UI.setChromeVisible(true); G.UI.show('guild'); });
  await page.waitForTimeout(120);
  await page.evaluate(() => window.__native.backHandlers[0]());
  await page.waitForTimeout(200);
  check(await page.evaluate(() => G.UI.current) === 'home',
    'ギルドで戻るボタン → 拠点へ戻る', await page.evaluate(() => G.UI.current));
  check(await page.evaluate(() => window.__native.exited === false), 'このときアプリは閉じない');

  await page.evaluate(() => window.__native.backHandlers[0]());
  await page.waitForTimeout(200);
  check(await page.evaluate(() => window.__native.exited === true),
    '拠点でもう一度押す → アプリを閉じる（保存してから）');
  check(await page.evaluate(() => !!G.Storage.get('tensei_arcana_save_v1')), '閉じる前に保存されている');

  console.log('\n▼ 3. オフラインの仕組み\n');
  const swCount = await page.evaluate(async () => {
    if (!navigator.serviceWorker) return 0;
    const rs = await navigator.serviceWorker.getRegistrations();
    return rs.length;
  });
  check(swCount === 0, 'アプリ版では登録しない（更新が届かなくなるため）', `登録数 ${swCount}`);
  check(errs.length === 0, 'JSエラーなし', errs.slice(0, 3).join(' / '));
  await ctx.close();

  /* ---------- ブラウザ版として ---------- */
  console.log('\n▼ 4. ブラウザで開いたとき（変わっていないこと）\n');
  const ctx2 = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const page2 = await ctx2.newPage();
  const errs2 = [];
  page2.on('pageerror', e => errs2.push(e.message));
  await page2.goto(base + '/index.html');
  await page2.waitForSelector('.title-logo');
  check(await page2.evaluate(() => G.Native.active === false), 'アプリではないと判定される');
  check(await page2.evaluate(() => G.Storage.kind === 'browser'), '保存先はブラウザのまま');
  check(await page2.evaluate(() => { G.Native.tap('heavy'); return true; }), '振動を呼んでも何も起きない（落ちない）');
  const sw2 = await page2.evaluate(async () => {
    await new Promise(r => setTimeout(r, 1500));
    const rs = await navigator.serviceWorker.getRegistrations();
    return rs.length;
  });
  check(sw2 >= 1, 'ブラウザではオフラインの仕組みが登録される', `登録数 ${sw2}`);
  check(errs2.length === 0, 'JSエラーなし', errs2.slice(0, 3).join(' / '));

  await browser.close();
  srv.close();
  console.log(`\n▼ 判定：${ok.length} 件成功 / ${ng.length} 件失敗`);
  if (ng.length) { for (const s of ng) console.log(`  ❌ ${s}`); process.exit(1); }
  console.log('  ✅ アプリ版・ブラウザ版とも期待どおりに動く');
})().catch(e => { console.error('実行中に失敗:', e.stack || e.message); process.exit(1); });
