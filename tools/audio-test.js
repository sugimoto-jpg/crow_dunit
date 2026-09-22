/* ===== 音が本当に鳴っているかを確かめる =====
 * 音は耳で聞くしかない、と思われがちだが、
 * Web Audio の出口に測定器をつなげば「実際に音が出たか」を数値で測れる。
 *
 *   ・画面を触るまで鳴らない（スマートフォンの決まり）
 *   ・触った後は鳴る
 *   ・画面ごとに曲が変わる
 *   ・切ると本当に止まる
 *   ・音を切ってもゲームは動く
 *   ・音が使えない環境でも落ちない
 *
 *   node tools/audio-test.js
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

/* 音の大きさを測る仕掛けをページに仕込む */
const METER = () => {
  window.__meter = { peak: 0 };
  const install = () => {
    const ctxs = [];
    const AC = window.AudioContext;
    window.AudioContext = function (...a) {
      const c = new AC(...a);
      ctxs.push(c);
      /* 出口の手前に測定器を挟む */
      const an = c.createAnalyser();
      an.fftSize = 256;
      const realDest = c.destination;
      an.connect(realDest);
      Object.defineProperty(c, 'destination', { get: () => an, configurable: true });
      const buf = new Float32Array(an.fftSize);
      window.__meter.read = () => {
        an.getFloatTimeDomainData(buf);
        let p = 0;
        for (const v of buf) p = Math.max(p, Math.abs(v));
        window.__meter.peak = Math.max(window.__meter.peak, p);
        return p;
      };
      window.__meter.reset = () => { window.__meter.peak = 0; };
      window.__meter.state = () => c.state;
      return c;
    };
    window.AudioContext.prototype = AC.prototype;
  };
  install();
};

/* しばらく測り続けて、いちばん大きかった値を返す */
async function peakOver(page, ms) {
  await page.evaluate(() => { if (window.__meter.reset) window.__meter.reset(); });
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await page.evaluate(() => { if (window.__meter.read) window.__meter.read(); });
    await page.waitForTimeout(25);
  }
  return page.evaluate(() => window.__meter.peak);
}

(async () => {
  const { srv, port } = await serve();
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({
    executablePath: exe, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(METER);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForSelector('.title-logo');

  console.log('▼ 1. 楽譜と仕組み\n');
  const info = await page.evaluate(() => ({
    songs: Object.keys(G.MUSIC || {}),
    hasAudio: !!G.Audio,
    ready: G.Audio.ready,
  }));
  check(info.hasAudio, '音の仕組みが読み込まれている');
  check(info.songs.length === 7, `BGMが7曲ある（${info.songs.length}曲）`, info.songs.join(','));
  check(info.ready === false, '画面を触るまでは音の出口を開かない（スマートフォンの決まり）');

  console.log('\n▼ 2. 触ると鳴る\n');
  await page.evaluate(() => {
    G.State.newGame('音の検証', 'normal');
    G.UI.setChromeVisible(true);
  });
  await page.mouse.click(200, 400);                 // 最初のタップ
  await page.waitForTimeout(150);
  check(await page.evaluate(() => G.Audio.ready), '触ると音の出口が開く');

  await page.evaluate(() => G.UI.show('home'));
  let peak = await peakOver(page, 1400);
  check(peak > 0.005, `拠点のBGMが実際に鳴っている（音量 ${peak.toFixed(3)}）`);

  console.log('\n▼ 3. 画面ごとに曲が変わる\n');
  const seen = {};
  for (const [scr, want] of [['town', 'bgm_town'], ['guild', 'bgm_town'], ['academy', 'bgm_academy']]) {
    await page.evaluate(n => G.UI.show(n), scr);
    await page.waitForTimeout(80);
    seen[scr] = await page.evaluate(() => G.UI.SCREEN_BGM[G.UI.current]);
    check(seen[scr] === want, `${scr} は ${want}`, `実際: ${seen[scr]}`);
  }

  console.log('\n▼ 4. 戦闘の曲と効果音\n');
  await page.evaluate(() => { G.State.d.battleSpeed = 1; G.BattleUI.start(['slime', 'rat'], { canFlee: true }); });
  await page.waitForSelector('[data-act="atk"]', { timeout: 15000 });
  peak = await peakOver(page, 1200);
  check(peak > 0.005, `戦闘中もBGMが鳴っている（音量 ${peak.toFixed(3)}）`);

  const seNames = await page.evaluate(() => {
    const got = [];
    for (const id of ['se_ok', 'se_cancel', 'se_attack', 'se_magic', 'se_hit',
      'se_heal', 'se_status', 'se_gain', 'se_alert']) {
      try { G.Audio.se(id); got.push(id); } catch (e) { /* 失敗したものは入れない */ }
    }
    return got;
  });
  check(seNames.length === 9, `効果音が9種類すべて呼べる（${seNames.length}種）`);
  const seErr = await page.evaluate(() => { try { G.Audio.se('存在しない音'); return 'ok'; } catch (e) { return e.message; } });
  check(seErr === 'ok', '存在しない音を指定しても落ちない');

  console.log('\n▼ 5. 切ると止まる\n');
  await page.evaluate(() => { G.BattleUI.bs = null; G.UI.current = 'home'; G.UI.show('home'); });
  await page.waitForTimeout(200);
  await page.evaluate(() => G.Audio.setEnabled('bgm', false));
  await page.waitForTimeout(500);
  peak = await peakOver(page, 900);
  check(peak < 0.004, `BGMを切ると本当に止まる（音量 ${peak.toFixed(4)}）`);

  const stillWorks = await page.evaluate(() => {
    G.UI.show('town'); G.UI.show('guild'); G.UI.show('home');
    return G.UI.current;
  });
  check(stillWorks === 'home', '音を切ってもゲームは動く');

  await page.evaluate(() => G.Audio.setEnabled('bgm', true));
  await page.waitForTimeout(400);
  peak = await peakOver(page, 1200);
  check(peak > 0.005, `入れ直すと鳴る（音量 ${peak.toFixed(3)}）`);

  console.log('\n▼ 6. 設定が残る\n');
  await page.evaluate(() => { G.Audio.setEnabled('se', false); G.Audio.setVolume('bgm', 0.3); });
  await page.reload();
  await page.waitForSelector('.title-logo');
  const kept = await page.evaluate(() => G.Audio.settings);
  check(kept.se === false && Math.abs(kept.bgmVol - 0.3) < 0.001,
    '読み込み直しても設定が残る', JSON.stringify(kept));
  await page.evaluate(() => { G.Audio.setEnabled('se', true); G.Audio.setVolume('bgm', 0.45); });

  check(errs.length === 0, 'JSエラーなし', errs.slice(0, 3).join(' / '));
  await ctx.close();

  console.log('\n▼ 7. 音が使えない環境でも遊べる\n');
  const ctx2 = await browser.newContext({ viewport: { width: 393, height: 852 } });
  await ctx2.addInitScript(() => {
    /* 音の仕組みごと取り上げる */
    delete window.AudioContext;
    delete window.webkitAudioContext;
  });
  const p2 = await ctx2.newPage();
  const errs2 = [];
  p2.on('pageerror', e => errs2.push(e.message));
  await p2.goto(`http://127.0.0.1:${port}/index.html`);
  await p2.waitForSelector('.title-logo');
  const survived = await p2.evaluate(async () => {
    G.Audio.unlock();
    G.Audio.bgm('bgm_battle');
    G.Audio.se('se_hit');
    G.State.newGame('無音', 'normal');
    G.UI.setChromeVisible(true);
    G.UI.show('home');
    G.BattleUI.start(['slime'], { canFlee: true });
    await new Promise(r => setTimeout(r, 700));
    return G.UI.current;
  });
  check(survived === 'battle', '音が使えなくても戦闘まで進める', `画面=${survived}`);
  check(errs2.length === 0, '音が使えない環境でもJSエラーなし', errs2.slice(0, 3).join(' / '));

  await browser.close();
  srv.close();
  console.log(`\n▼ 判定：${ok.length} 件成功 / ${ng.length} 件失敗`);
  if (ng.length) { for (const s of ng) console.log(`  ❌ ${s}`); process.exit(1); }
  console.log('  ✅ 音が実際に鳴り、切ることもでき、使えなくても遊べる');
})().catch(e => { console.error('実行中に失敗:', e.stack || e.message); process.exit(1); });
