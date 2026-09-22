/* ===== 戻る操作（Androidの戻るボタン）の検証 =====
 * Android では、戻るボタンで何も起きないとアプリが終了してしまう。
 * 実際にブラウザの戻るを押して、期待どおりに動くかを確かめる。
 *
 *   node tools/back-test.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((q, r) => {
      const f = path.join(ROOT, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
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
  const { srv, port } = await serve();
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => fs.existsSync(p));
  if (!exe) throw new Error('Chromium が見つかりません');
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForSelector('.title-logo');

  await page.evaluate(() => {
    G.State.newGame('検証', 'normal');
    for (const k of ['riina', 'velt', 'noa']) G.State.recruit(k);
    Object.assign(G.State.d, { gold: 50000 });
    Object.assign(G.State.d.guild, { registered: true, rank: 4, totalClears: 18 });
    G.UI.setChromeVisible(true);
    G.UI.show('home');
  });
  await page.waitForTimeout(150);

  console.log('▼ 1. 別の画面から拠点へ戻る\n');
  for (const scr of ['academy', 'guild', 'town', 'status']) {
    await page.evaluate(n => G.UI.show(n), scr);
    await page.waitForTimeout(100);
    await page.goBack();
    await page.waitForTimeout(250);
    const now = await page.evaluate(() => G.UI.current);
    check(now === 'home', `${scr} で戻る → 拠点に戻る`, `実際: ${now}`);
  }

  console.log('\n▼ 2. 閉じてよいモーダルは閉じる\n');
  await page.evaluate(() => { G.UI.modal({ title: 'テスト', body: '<p>x</p>', dismissable: true }); });
  await page.waitForSelector('#modal:not(.hidden)');
  await page.goBack();
  await page.waitForTimeout(250);
  const closed = await page.evaluate(() => G.UI.el('modal').classList.contains('hidden'));
  check(closed, '閉じてよいモーダルは、戻るで閉じる');

  console.log('\n▼ 3. 閉じてはいけないものは閉じない\n');
  await page.evaluate(() => { G.UI.alert('大事な知らせ', '<p>読んでください</p>'); });
  await page.waitForSelector('#modal:not(.hidden)');
  await page.goBack();
  await page.waitForTimeout(250);
  const stillOpen = await page.evaluate(() => !G.UI.el('modal').classList.contains('hidden'));
  check(stillOpen, '値を返す必要があるモーダルは、戻るで閉じない（ゲームが壊れない）');
  await page.evaluate(() => { const b = document.querySelector('#modal-actions .btn'); if (b) b.click(); });
  await page.waitForTimeout(200);

  console.log('\n▼ 4. 戦闘中は戻るで抜けられない\n');
  await page.evaluate(() => { G.State.d.battleSpeed = 1; G.BattleUI.start(['golem', 'golem'], { canFlee: true }); });
  await page.waitForSelector('[data-act="atk"]', { timeout: 15000 });
  const navHidden = await page.evaluate(() => G.UI.el('nav').classList.contains('hidden'));
  check(navHidden, '戦闘中は下部タブが隠れている');
  await page.goBack();
  await page.waitForTimeout(300);
  const inBattle = await page.evaluate(() => G.UI.current);
  check(inBattle === 'battle', '戦闘中に戻るを押しても戦闘から抜けない', `実際: ${inBattle}`);

  console.log('\n▼ 5. 拠点で戻るとページから出られる（ブラウザで閉じ込めない）\n');
  await page.evaluate(() => {
    G.BattleUI.bs = null; G.UI.current = 'home';
    G.UI.setChromeVisible(true); G.UI.show('home');
  });
  await page.waitForTimeout(200);
  // 拠点からの戻るは、まだ仕掛けが残っていれば拠点のまま、無ければページ遷移
  const before = page.url();
  await page.goBack();
  await page.waitForTimeout(400);
  let left = page.url() !== before;
  if (!left) { await page.goBack(); await page.waitForTimeout(400); left = page.url() !== before; }
  check(left, '拠点で戻るを繰り返すと、最後はページから出られる');

  check(errs.length === 0, 'JSエラーなし', errs.slice(0, 3).join(' / '));

  await browser.close();
  srv.close();
  console.log(`\n▼ 判定：${ok.length} 件成功 / ${ng.length} 件失敗`);
  if (ng.length) { for (const s of ng) console.log(`  ❌ ${s}`); process.exit(1); }
  console.log('  ✅ 戻る操作が期待どおりに動く');
})().catch(e => { console.error('実行中に失敗:', e.stack || e.message); process.exit(1); });
