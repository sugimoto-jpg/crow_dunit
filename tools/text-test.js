/* ===== 文言の仕組みが本当に動くか確かめる =====
 * 辞書から取り出せることだけでなく、
 *   ・訳が無いキーは日本語のまま出る（画面が空白にならない）
 *   ・辞書に無いキーでも画面が壊れない
 *   ・差し込む値がHTMLとして実行されない
 *   ・言語を切り替えると実際に表示が変わる
 * を、本物のブラウザで確かめる。
 *
 *   node tools/text-test.js
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
  console.log(`  ${cond ? '✅' : '❌'} ${label}${!cond && extra ? `\n       ${extra}` : ''}`);
};

(async () => {
  const { srv, port } = await serve();
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => fs.existsSync(p));
  if (!exe) throw new Error('Chromium が見つかりません');
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForSelector('.title-logo');

  console.log('▼ 1. 日本語のまま表示されているか\n');
  const logo = await page.textContent('.title-logo');
  check(logo === '転生魔法学院譚', `タイトルが辞書から出ている（${logo}）`);
  const btns = await page.$$eval('.title-screen .btn', els => els.map(e => e.textContent.trim()));
  check(btns.includes('✦ はじめから'), 'ボタンの文字が辞書から出ている', btns.join(' / '));
  check(!btns.some(b => /title\./.test(b)), 'キー名がそのまま画面に出ていない', btns.join(' / '));

  console.log('\n▼ 2. 取り出しかた\n');
  const r = await page.evaluate(() => ({
    plain:   G.T('common.cancel'),
    params:  G.T.html('title.diff.stats', { hp: 120, atk: 115 }),
    unknown: G.T('nonexistent.key.for.test'),
    missing: G.T.missing.map(m => m.kind + ':' + m.key),
    keys:    Object.keys(G.STRINGS.ja).length,
  }));
  check(r.plain === 'やめる', `共通の語が引ける（${r.plain}）`);
  check(r.params === '敵のHP 120% ／ 攻撃力 115%', `差し込みが効く（${r.params}）`);
  check(r.unknown === 'nonexistent.key.for.test', '辞書に無いキーはキー名が返る（空白にならない）');
  check(r.missing.some(m => m.startsWith('missing:')), '辞書に無いキーは記録される', r.missing.join(', '));

  console.log('\n▼ 3. 差し込む値の安全性\n');
  const xss = await page.evaluate(() => {
    const h = G.T.html('title.diff.stats', { hp: '<img src=x onerror="window.__t=1">', atk: 1 });
    const p = G.T('title.diff.stats', { hp: '<b>', atk: 1 });
    const d = document.createElement('div');
    d.innerHTML = h;
    document.body.appendChild(d);
    const fired = !!window.__t;
    d.remove();
    return { h, p, fired };
  });
  check(!xss.fired, 'G.T.html に渡した値はHTMLとして実行されない');
  check(/&lt;img/.test(xss.h), 'G.T.html は差し込む値を安全な形に直す');
  check(/<b>/.test(xss.p), 'G.T はそのまま返す（textContent 用）');

  console.log('\n▼ 4. 英語に切り替えたときの動き\n');
  const sw = await page.evaluate(() => {
    // 一部だけ訳した辞書を足す（英語化の途中を再現する）
    G.STRINGS.en = { 'title.logo': 'Arcana Academy', 'common.cancel': 'Cancel' };
    const okSet = G.T.setLocale('en');
    const out = {
      okSet,
      logo:  G.T('title.logo'),
      cancel: G.T('common.cancel'),
      fallback: G.T('title.sub'),                 // 訳が無いキー
      bogus: G.T.setLocale('zz'),                 // 辞書が無い言語
      afterBogus: G.T.locale,
    };
    G.UI.show('title');                            // 画面を描き直す
    out.shown = document.querySelector('.title-logo').textContent;
    G.T.setLocale('ja');
    G.UI.show('title');
    out.backToJa = document.querySelector('.title-logo').textContent;
    return out;
  });
  check(sw.okSet === true, '英語に切り替えられる');
  check(sw.logo === 'Arcana Academy', `訳があるキーは英語になる（${sw.logo}）`);
  check(sw.fallback === '〜 村人から始まる魔王討伐 〜',
    `訳が無いキーは日本語のまま出る（${sw.fallback}）`);
  check(sw.shown === 'Arcana Academy', `画面の表示も実際に変わる（${sw.shown}）`);
  check(sw.bogus === false && sw.afterBogus === 'en', '辞書が無い言語には切り替わらない');
  check(sw.backToJa === '転生魔法学院譚', `日本語に戻せる（${sw.backToJa}）`);

  console.log('\n▼ 5. ゲームが今までどおり始められるか\n');
  await page.evaluate(() => { G.State.newGame('検証', 'normal'); });
  const started = await page.evaluate(() => G.State.d.party[0].name);
  check(started === '検証', '名前を入れた場合はその名前になる');
  const def = await page.evaluate(() => { G.State.newGame('', 'normal'); return G.State.d.party[0].name; });
  check(def === 'アルト', `名前が空なら既定の名前（${def}）`);
  check(errors.length === 0, 'JSエラーなし', errors.slice(0, 3).join(' / '));

  await browser.close();
  srv.close();
  console.log(`\n▼ 判定：${ok.length} 件成功 / ${ng.length} 件失敗`);
  if (ng.length) { for (const s of ng) console.log(`  ❌ ${s}`); process.exit(1); }
  console.log('  ✅ 文言を辞書から取り出せ、英語を足しても壊れない');
})().catch(e => { console.error('実行中に失敗:', e.stack || e.message); process.exit(1); });
