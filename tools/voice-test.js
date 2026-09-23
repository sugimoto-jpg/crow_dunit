/* ===== 声（掛け声・物語の読み上げ）を確かめる =====
 * 実際の端末の声は環境によって違うので、
 * 読み上げの仕組みを偽物に差し替えて「何をどう喋ろうとしたか」を見る。
 *
 *   node tools/voice-test.js
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

/* 読み上げの偽物。喋った内容を window.__said に貯める。
 *
 * window.speechSynthesis は読み取り専用なので、ふつうに代入しても
 * 黙って無視される。defineProperty で置き換える必要がある。 */
const fakeSpeech = (voices) => `
  window.__said = [];
  window.__cancels = 0;
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => ${JSON.stringify(voices)},
      speak(u) { window.__said.push({ text: u.text, pitch: u.pitch, rate: u.rate, lang: u.lang, volume: u.volume }); },
      cancel() { window.__cancels++; },
      addEventListener() {},
    },
  });`;

/* プロローグの1行目。読み上げた内容と突き合わせる */
const G_FIRST = '――三十二歳。会社からの帰り道だった。';

const JA = [{ name: 'Kyoko', lang: 'ja-JP', localService: true },
  { name: 'Google 日本語', lang: 'ja-JP', localService: false },
  { name: 'Samantha', lang: 'en-US', localService: true }];

async function open(browser, port, init) {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  if (init) await page.addInitScript(init);
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForSelector('.title-logo');
  return { page, errs };
}

/* 最初のタップで出口を開けるために無音を1回読ませている（main.js）。
 * 中身のない読み上げは数に入れない。 */
const said = page => page.evaluate(() => (window.__said || []).filter(x => String(x.text).trim()));
const clear = page => page.evaluate(() => { window.__said = []; window.__cancels = 0; });

(async () => {
  const { srv, port } = await serve();
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  /* ---------- 1. 読み上げが使えない端末 ---------- */
  console.log('▼ 1. 読み上げが使えない端末でも遊べる\n');
  {
    const { page, errs } = await open(browser, port, 'delete window.speechSynthesis;');
    const st = await page.evaluate(() => ({ sup: G.Voice.supported, ready: G.Voice.ready }));
    check(st.sup === false, '読み上げが無いと判定される');
    check(st.ready === false, '喋らない状態になる');
    const r = await page.evaluate(() => [G.Voice.speak('あ'), G.Voice.narrate('あ', null),
      G.Voice.shout({ side: 'ally', ref: { key: 'riina' } }, { name: 'メテオ' }, true)]);
    check(r.every(x => x === false), '呼んでも空振りするだけ（例外にならない）');
    await page.evaluate(() => { G.State.newGame('声なし', 'normal'); G.UI.setChromeVisible(true); G.UI.show('home'); });
    await page.waitForTimeout(150);
    const home = await page.evaluate(() => !!document.querySelector('[data-act="rest"]'));
    check(home, '拠点までふつうに進める');
    const shown = await page.evaluate(() => !!document.querySelector('[data-act="vshout"]'));
    check(!shown, '声の設定ボタンは出さない（使えないので）');
    check(errs.length === 0, 'JSエラーなし', errs.slice(0, 2).join(' / '));
    await page.close();
  }

  /* ---------- 2. 日本語の声が無い端末 ---------- */
  console.log('\n▼ 2. 日本語の声が無い端末では喋らせない\n');
  {
    const { page, errs } = await open(browser, port,
      fakeSpeech([{ name: 'Samantha', lang: 'en-US', localService: true }]));
    const st = await page.evaluate(() => ({ sup: G.Voice.supported, ready: G.Voice.ready }));
    check(st.sup === true, '読み上げの仕組みはあると判定される');
    check(st.ready === false, '日本語の声が無いので喋らない');
    await page.evaluate(() => G.Voice.narrate('こんにちは', null));
    check((await said(page)).length === 0, '英語の声で日本語を読ませない');
    check(errs.length === 0, 'JSエラーなし', errs.slice(0, 2).join(' / '));
    await page.close();
  }

  /* ---------- 3. 日本語の声がある端末 ---------- */
  console.log('\n▼ 3. 日本語の声があるとき\n');
  {
    const { page, errs } = await open(browser, port, fakeSpeech(JA));
    check(await page.evaluate(() => G.Voice.ready), '喋れる状態になる');
    const v = await page.evaluate(() => { G.Voice.speak('あいうえお'); return window.__said[0]; });
    check(v && /^ja/i.test(v.lang), `日本語の声が選ばれる（${v && v.lang}）`);
    const local = await page.evaluate(() => {
      G.Voice.stop(); G.Voice.speak('て');
      return window.__said[window.__said.length - 1];
    });
    check(!!local, '端末内の声を優先して選ぶ（Kyoko）');

    /* --- 物語の読み上げ --- */
    await clear(page);
    await page.evaluate(() => {
      G.State.newGame('レン', 'normal');
      G.UI.playStory(G.STORY.prologue, () => {});
    });
    await page.waitForTimeout(200);
    const s1 = await said(page);
    check(s1.length === 1, '会話を出すと、その1行を読み上げる', `${s1.length}件`);
    check(s1[0] && s1[0].text === G_FIRST, '読んだ内容が画面の文と一致する', s1[0] && s1[0].text);

    await clear(page);
    await page.locator('[data-act="next"]').click();
    await page.waitForTimeout(200);
    const s2 = await said(page);
    const c2 = await page.evaluate(() => window.__cancels);
    check(s2.length === 1 && s2[0].text !== G_FIRST,
      '次の行に進むと、次の行を読む', s2.map(x => x.text.slice(0, 14)).join(' / '));
    const warm = await page.evaluate(() => (window.__said || []).some(x => !String(x.text).trim()));
    check(warm, '最初のタップで、音の出口を無音で開けている');
    check(c2 >= 1, '前の行の読み上げは必ず止める（重ならない）');

    /* --- 画面を離れたら黙る --- */
    await clear(page);
    await page.evaluate(() => { G.UI.storyPlaying = false; G.UI.setChromeVisible(true); G.UI.show('home'); });
    await page.waitForTimeout(120);
    check(await page.evaluate(() => window.__cancels) >= 1, '画面を変えると読み上げを止める');

    /* --- 話者ごとに声色が変わる --- */
    const tones = await page.evaluate(() => {
      const a = G.Voice.speakerTone('リィナ'), b = G.Voice.speakerTone('ヴェルト');
      const c = G.Voice.speakerTone('女神リュミエル'), d = G.Voice.speakerTone('女神リュミエル');
      return { a: a.pitch, b: b.pitch, c: c.pitch, d: d.pitch };
    });
    check(tones.a !== tones.b, `話者ごとに声色が変わる（リィナ ${tones.a} / ヴェルト ${tones.b}）`);
    check(tones.c === tones.d, '同じ名前なら必ず同じ声になる');

    /* --- 戦闘の掛け声 --- */
    await clear(page);
    const big = await page.evaluate(() => {
      const u = { side: 'ally', ref: { key: 'velt' } };
      G.Voice.shout(u, { name: 'メテオ', mp: 42, target: 'all' }, true);
      return window.__said[0];
    });
    check(big && big.text === 'メテオ', '大技では技名を叫ぶ', big && big.text);

    await clear(page);
    const many = await page.evaluate(() => {
      const u = { side: 'ally', ref: { key: 'riina' } };
      for (let i = 0; i < 20; i++) G.Voice.shout(u, { basic: true }, false);
      return window.__said.length;
    });
    check(many <= 1, `通常攻撃で喋り続けない（20回中 ${many}回）`);

    await clear(page);
    const foe = await page.evaluate(() => {
      G.Voice.shout({ side: 'enemy', isBoss: false }, { name: 'かみつく' }, false);
      return window.__said.length;
    });
    check(foe === 0, '雑魚の通常攻撃では喋らない');

    await clear(page);
    const boss = await page.evaluate(() => {
      G.Voice.shout({ side: 'enemy', isBoss: true }, { name: '終焉の宣告', mp: 0, target: 'all' }, true);
      return window.__said[0];
    });
    check(boss && boss.text === '終焉の宣告', 'ボスの大技は喋る', boss && boss.text);

    /* --- 設定 --- */
    await clear(page);
    const off = await page.evaluate(() => {
      G.Voice.setEnabled('story', false);
      G.Voice.narrate('読まれないはず', null);
      const n = window.__said.length;
      G.Voice.setEnabled('shout', false);
      G.Voice.shout({ side: 'ally', ref: { key: 'velt' } }, { name: 'メテオ' }, true);
      return { n, m: window.__said.length };
    });
    check(off.n === 0, '読み上げを切ると物語を読まない');
    check(off.m === 0, '掛け声を切ると叫ばない');

    const kept = await page.evaluate(() => G.Storage.get('ta.voice'));
    check(kept && /"story":false/.test(kept), '設定が保存される', String(kept).slice(0, 60));

    /* 設定を戻してからボタンを確かめる */
    await page.evaluate(() => { G.Voice.setEnabled('story', true); G.Voice.setEnabled('shout', true); G.UI.show('home'); });
    await page.waitForTimeout(120);
    const btns = await page.evaluate(() => ({
      shout: !!document.querySelector('[data-act="vshout"]'),
      story: !!document.querySelector('[data-act="vstory"]'),
    }));
    check(btns.shout && btns.story, '拠点に声の入切ボタンが出る');

    check(errs.length === 0, 'JSエラーなし', errs.slice(0, 2).join(' / '));
    await page.close();
  }

  await browser.close();
  srv.close();
  console.log(`\n▼ 判定：${ok.length} 件成功 / ${ng.length} 件失敗`);
  if (ng.length) { for (const s of ng) console.log(`  ❌ ${s}`); process.exit(1); }
  console.log('  ✅ 声は、使える端末では喋り、使えない端末では邪魔をしない');
})().catch(e => { console.error('実行中に失敗:', e.stack || e.message); process.exit(1); });
