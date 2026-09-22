/* ===== エラー処理が本当に効いているか、わざと壊して確かめる =====
 * 「例外を捕まえる仕組みを書いた」だけでは、効いている証拠にならない。
 * 実際にブラウザで動かし、わざと4種類の失敗を起こして
 *   ・ゲームが無言で固まらないこと
 *   ・遊ぶ人に技術的な内容（例外名・スタックトレース）を見せないこと
 *   ・開発モード（?debug=1）では詳細が見えること
 *   ・同じエラーで何度もモーダルが出ないこと
 * を確かめる。
 *
 *   node tools/errors-test.js
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

const ok = [];
const ng = [];
const check = (cond, label, extra) => {
  (cond ? ok : ng).push(label + (cond || !extra ? '' : `\n       ${extra}`));
  console.log(`  ${cond ? '✅' : '❌'} ${label}`);
  if (!cond && extra) console.log(`       ${extra}`);
};

/* モーダルが出るまで待つ（出なければ null） */
async function waitModal(page, ms = 3000) {
  try {
    await page.waitForSelector('#modal:not(.hidden)', { timeout: ms });
    return await page.evaluate(() => ({
      title: document.getElementById('modal-title').textContent,
      body: document.getElementById('modal-body').textContent,
      html: document.getElementById('modal-body').innerHTML,
      actions: [...document.querySelectorAll('#modal-actions .btn')].map(b => b.textContent),
    }));
  } catch (e) { return null; }
}

const closeModal = page => page.evaluate(() => {
  const b = document.querySelector('#modal-actions .btn:last-child');
  if (b) b.click();
});

/* 表示の中に技術的な内容が混じっていないか。
 * 遊ぶ人はこれを見ても何もできないので、出してはいけない。 */
const TECH = /TypeError|ReferenceError|SyntaxError|RangeError|undefined|null|\.js:\d|at [A-Za-z_$]|stack|Object|function/;

(async () => {
  const { srv, port } = await serve();
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => fs.existsSync(p));
  if (!exe) throw new Error('Chromium が見つかりません');
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  /* ================= 本番モード（詳細を見せない） ================= */
  console.log('▼ 1. 本番モード（通常の読み込み）\n');
  const ctx1 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx1.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) consoleErrors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForSelector('.title-logo');

  const inst = await page.evaluate(() => !!(window.G && G.Err && G.Err.installed));
  check(inst, 'G.Err が読み込み直後から設置されている');
  const host = await page.evaluate(() => location.hostname);
  const devOff = await page.evaluate(() => G.Err.dev === false);
  check(devOff, `${host} から開いても本番モードと判定される（dev = false）`);
  check(devOff, 'localhost を開発モードにしない（スマホアプリ化すると localhost で動くため）');

  /* --- 1-a. 同期エラー（window の error） --- */
  await page.evaluate(() => { setTimeout(() => { null.x = 1; }, 0); });
  let m = await waitModal(page);
  check(!!m, '同期エラーでモーダルが出る（無言で固まらない）');
  if (m) {
    check(!TECH.test(m.body), '本番では技術的な内容を見せない', `本文: ${m.body.trim().slice(0, 160)}`);
    check(/問題が発生/.test(m.title), 'タイトルが日本語の案内になっている', `タイトル: ${m.title}`);
    check(m.actions.some(a => /タイトルに戻る/.test(a)), '復帰する手段（タイトルに戻る）がある', `ボタン: ${m.actions.join(' / ')}`);
    await closeModal(page);
  }
  const logged = await page.evaluate(() => G.Err.log.length);
  check(logged >= 1, `エラーが記録に残っている（${logged} 件）`);
  const kept = await page.evaluate(() => G.Err.log[0].message);
  check(/null|Cannot set/i.test(kept), '記録には原因がそのまま残っている（開発者が追える）', `記録: ${kept}`);
  check(consoleErrors.length === 0, '本番ではコンソールにも出さない', consoleErrors.slice(0, 2).join(' / '));

  /* --- 1-b. Promise の失敗（await されない非同期） --- */
  await page.evaluate(() => { G.Err._lastShownAt = 0; });
  await page.evaluate(() => { (async () => { throw new Error('テスト用の非同期エラー'); })(); });
  m = await waitModal(page);
  check(!!m, 'await されない非同期エラーでもモーダルが出る');
  if (m) {
    check(!TECH.test(m.body), '非同期エラーでも技術的な内容を見せない', m.body.trim().slice(0, 160));
    await closeModal(page);
  }
  const kinds = await page.evaluate(() => G.Err.log.map(e => e.kind));
  check(kinds.includes('promise'), "種類が 'promise' として記録されている", kinds.join(','));

  /* --- 1-c. 連続で同じエラーが出てもモーダルは1回だけ --- */
  await page.evaluate(() => { G.Err._lastShownAt = 0; G.Err.log.length = 0; });
  await page.evaluate(async () => {
    for (let i = 0; i < 10; i++) { try { null.x = 1; } catch (e) { G.Err.report('game', e.message, e.stack); } }
  });
  await page.waitForTimeout(300);
  const shown = await page.evaluate(() => document.querySelectorAll('#modal:not(.hidden)').length);
  const recorded = await page.evaluate(() => G.Err.log.length);
  check(shown === 1, `10回連続で失敗してもモーダルは1つだけ（実際: ${shown}）`);
  check(recorded === 10, `記録は10件すべて残っている（実際: ${recorded}）`);
  await closeModal(page);

  /* --- 1-d. 戦闘中に壊れても、無言で固まらない --- */
  await page.evaluate(() => { G.Err._lastShownAt = 0; G.Err.log.length = 0; });
  const battle = await page.evaluate(async () => {
    G.State.newGame('検証', 'normal');
    G.UI.setChromeVisible(true);
    // 戦闘演出の途中で必ず失敗するようにする
    const orig = G.BattleUI.playEvents;
    G.BattleUI.playEvents = () => { throw new Error('テスト用：演出の失敗'); };
    G.BattleUI.start(['slime'], { canFlee: true });
    await new Promise(r => setTimeout(r, 800));
    G.BattleUI.playEvents = orig;                        // 元に戻す
    return { screen: G.UI.current, logged: G.Err.log.length };
  });
  m = await waitModal(page);
  check(!!m, '戦闘演出が失敗しても、案内が出る（コマンドが出ないまま固まらない）',
    `画面=${battle.screen} 記録=${battle.logged}件`);
  if (m) {
    check(!TECH.test(m.body), '戦闘中のエラーでも技術的な内容を見せない', m.body.trim().slice(0, 160));
    await closeModal(page);
  }
  const gameKind = await page.evaluate(() => G.Err.log.map(e => e.kind + ':' + e.screen).join(' / '));
  check(/battle/.test(gameKind), 'どの画面で起きたかが記録されている', gameKind);

  await ctx1.close();

  /* ================= 開発モード（詳細を見せる） ================= */
  console.log('\n▼ 2. 開発モード（?debug=1）\n');
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const dev = await ctx2.newPage();
  await dev.goto(`http://127.0.0.1:${port}/index.html?debug=1`);
  await dev.waitForSelector('.title-logo');
  const devOn = await dev.evaluate(() => G.Err.dev === true);
  check(devOn, '開発モードと判定されている（dev = true）');
  await dev.evaluate(() => { setTimeout(() => { undefinedFunctionForTest(); }, 0); });
  m = await waitModal(dev);
  check(!!m, '開発モードでもモーダルが出る');
  if (m) {
    check(/undefinedFunctionForTest/.test(m.body), '開発モードでは原因が読める', m.body.trim().slice(0, 200));
    check(/<pre/.test(m.html), '詳細は本文と分けて表示されている');
    check(!/<script/i.test(m.html), 'エラー文はエスケープされている（HTMLとして実行されない）');
  }

  /* エラー文に HTML が混じっていても、そのまま実行されないこと */
  await dev.evaluate(() => { G.Err._lastShownAt = 0; });
  await dev.evaluate(() => { document.getElementById('modal-actions').querySelector('.btn').click(); });
  await dev.waitForTimeout(200);
  await dev.evaluate(() => { G.Err._lastShownAt = 0; G.Err.report('game', '<img src=x onerror="window.__pwned=1">', ''); });
  await dev.waitForTimeout(400);
  const pwned = await dev.evaluate(() => !!window.__pwned);
  check(!pwned, 'エラー文に仕込まれたHTMLが実行されない');

  /* ?debug=1 を一度付けたら、付け直さなくても開発モードのまま */
  await dev.goto(`http://127.0.0.1:${port}/index.html`);
  await dev.waitForSelector('.title-logo');
  const stick = await dev.evaluate(() => G.Err.dev === true);
  check(stick, '一度 ?debug=1 を付ければ、次からは付けなくても開発モード');

  await ctx2.close();

  /* ================= モーダルが使えない状況 ================= */
  console.log('\n▼ 3. 画面の仕組み自体が壊れている場合\n');
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const broke = await ctx3.newPage();
  await broke.goto(`http://127.0.0.1:${port}/index.html`);
  await broke.waitForSelector('.title-logo');
  await broke.evaluate(() => {
    G.UI.modal = () => { throw new Error('モーダルも壊れている'); };
    G.Err.report('game', 'テスト用：全部壊れている', '');
  });
  await broke.waitForTimeout(300);
  const fb = await broke.evaluate(() => {
    const d = document.getElementById('err-fallback');
    return d ? { text: d.textContent, hasBtn: !!document.getElementById('err-reload') } : null;
  });
  check(!!fb, 'モーダルが使えなくても、素の画面で案内が出る');
  if (fb) {
    check(fb.hasBtn, '読み込み直すボタンがある');
    check(!TECH.test(fb.text), '最終手段の表示でも技術的な内容を見せない', fb.text.trim().slice(0, 160));
  }
  await ctx3.close();

  await browser.close();
  srv.close();

  console.log(`\n▼ 判定：${ok.length} 件成功 / ${ng.length} 件失敗`);
  if (ng.length) {
    console.log('\n  ❌ 失敗した項目');
    for (const s of ng) console.log(`     ${s}`);
    process.exit(1);
  }
  console.log('  ✅ わざと壊しても、無言で固まらず、技術的な内容も漏れない');
})().catch(e => { console.error('実行中に失敗:', e.stack || e.message); process.exit(1); });
