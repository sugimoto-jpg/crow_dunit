/* ===== イベントリスナーの蓄積を実測する =====
 * 「登録13件に対して解除2件」という数字だけでは、漏れているかは分からない。
 * 画面を innerHTML で作り直すと、古い要素ごとリスナーも捨てられるためで、
 * 本当に問題になるのは「ずっと残り続けるDOM（window / document / #modal / #nav）」
 * に付いたまま解除されないリスナーだけ。
 *
 * そこで addEventListener / removeEventListener を差し替えて記録し、
 * 画面遷移・戦闘・モーダルを何十回も繰り返した前後で
 *   ・生きているリスナー数（まだ文書に繋がっている要素に付いているもの）
 *   ・DOMの要素数
 *   ・JSヒープ使用量
 * が増え続けないかを見る。
 *
 *   node tools/listeners.js            通常実行
 *   ROUNDS=60 node tools/listeners.js  繰り返し回数を変える
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const ENTRY = process.env.ENTRY || 'index.html';
const ROUNDS = Number(process.env.ROUNDS || 40);

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((q, r) => {
      const f = path.join(ROOT, q.url === '/' ? ENTRY : q.url.split('?')[0]);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      r.end(fs.readFileSync(f));
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

(async () => {
  const { srv, port } = await serve();
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => fs.existsSync(p));
  if (!exe) throw new Error('Chromium が見つかりません');
  const browser = await chromium.launch({
    executablePath: exe, headless: true,
    // ヒープを測るためにGCを明示的に呼べるようにする
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--js-flags=--expose-gc'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); });

  /* ページのスクリプトより先にリスナーの記録を仕込む */
  await page.addInitScript(() => {
    const W = window;
    W.__L = { entries: [], adds: 0, removes: 0 };
    const label = t => {
      if (t === W) return 'window';
      if (t === W.document) return 'document';
      if (t && t.id) return '#' + t.id;
      if (t && t.className && typeof t.className === 'string') return '.' + t.className.trim().split(/\s+/)[0];
      return (t && t.tagName) ? t.tagName.toLowerCase() : String(t);
    };
    const A = EventTarget.prototype.addEventListener;
    const R = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (type, fn, opt) {
      W.__L.adds++;
      // WeakRef で持つ。強参照で持つと、外れた要素が回収されずヒープ測定が狂う。
      W.__L.entries.push({ ref: new WeakRef(this), type, label: label(this), fn });
      return A.call(this, type, fn, opt);
    };
    EventTarget.prototype.removeEventListener = function (type, fn, opt) {
      W.__L.removes++;
      const i = W.__L.entries.findIndex(e => e.type === type && e.fn === fn && e.ref.deref() === this);
      if (i >= 0) W.__L.entries.splice(i, 1);
      return R.call(this, type, fn, opt);
    };
    /* いま文書に繋がっている要素に付いているリスナーだけを数える */
    W.__measure = () => {
      if (W.gc) W.gc();
      const live = {};
      let total = 0;
      for (const e of W.__L.entries) {
        const t = e.ref.deref();
        if (!t) continue;                                   // 回収済み
        const attached = t === W || t === W.document || t.isConnected;
        if (!attached) continue;                            // 画面から外れた要素
        const k = `${e.label}:${e.type}`;
        live[k] = (live[k] || 0) + 1;
        total++;
      }
      // DOMの内訳（どの種類の要素が増えたかを追えるようにする）
      const byTag = {};
      for (const el of document.getElementsByTagName('*')) {
        const cls = (el.className && typeof el.className === 'string')
          ? el.className.trim().split(/\s+/)[0] : '';
        const k = cls ? `${el.tagName.toLowerCase()}.${cls}` : el.tagName.toLowerCase();
        byTag[k] = (byTag[k] || 0) + 1;
      }
      return {
        total,
        live,
        byTag,
        adds: W.__L.adds,
        removes: W.__L.removes,
        nodes: document.getElementsByTagName('*').length,
        heapKB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024) : null,
      };
    };
  });

  await page.goto(`http://127.0.0.1:${port}/${ENTRY}`);
  await page.waitForSelector('.title-logo');

  /* 中盤の状態を作る（4人パーティ・全画面に行ける状態） */
  await page.evaluate(() => {
    G.State.newGame('計測', 'normal');
    for (const k of ['riina', 'velt', 'noa']) G.State.recruit(k);
    for (const c of G.State.d.party) { while (c.level < 30) { G.Char.levelUp(c); let g = 0; while (G.Char.autoJob(c) && g++ < 6); } }
    Object.assign(G.State.d, { gold: 50000, battleSpeed: 3, tuitionPaid: true });
    Object.assign(G.State.d.guild, { registered: true, rank: 4, totalClears: 18 });
    G.State.setFlag('awaken');
    for (const id of ['potion', 'ether']) G.State.addItem(id, 30);
    G.UI.setChromeVisible(true);
    G.UI.show('home');
  });
  await page.waitForSelector('.place');

  const fmt = m => `リスナー ${String(m.total).padStart(4)} / DOM要素 ${String(m.nodes).padStart(5)}`
    + (m.heapKB ? ` / ヒープ ${String(m.heapKB).padStart(6)}KB` : '')
    + ` （登録 ${m.adds} 解除 ${m.removes}）`;

  const before = await page.evaluate(() => window.__measure());
  console.log(`▼ 計測開始（${ROUNDS} 往復）`);
  console.log(`  開始時: ${fmt(before)}`);

  /* 画面遷移をひたすら繰り返す（歩行演出は飛ばして速く回す） */
  for (let i = 0; i < ROUNDS; i++) {
    for (const s of ['academy', 'guild', 'town', 'status', 'job', 'home']) {
      await page.evaluate(n => G.UI.show(n), s);
    }
    // モーダルの開閉（#modal は作り直されない＝残り続けるDOM）
    await page.evaluate(async () => {
      const p = G.UI.alert('計測', '<p>テスト</p>');
      document.querySelector('#modal-actions .btn').click();
      await p;
    });
    if (i % 10 === 9) {
      const m = await page.evaluate(() => window.__measure());
      console.log(`  ${String(i + 1).padStart(3)}往復: ${fmt(m)}`);
    }
  }

  /* 戦闘も繰り返す（対象選択のリスナーが残らないか） */
  console.log('\n  戦闘を10回（対象選択あり）');
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => G.BattleUI.start(['slime', 'rat', 'goblin'], { canFlee: true }));
    await page.waitForSelector('.scene');
    for (let t = 0; t < 40; t++) {
      if (await page.locator('#modal:not(.hidden)').count()) break;
      if (await page.locator('[data-act="atk"]').count()) {
        await page.locator('[data-act="atk"]').click({ force: true });
        await page.waitForTimeout(80);
        const sel = page.locator('#field .unit.selectable');
        if (await sel.count()) await sel.first().click({ force: true });
      }
      await page.waitForTimeout(90);
    }
    // 結果モーダルを閉じる
    for (let k = 0; k < 6; k++) {
      if (!(await page.locator('#modal:not(.hidden)').count())) break;
      await page.locator('#modal-actions .btn').last().click({ force: true });
      await page.waitForTimeout(120);
    }
    await page.evaluate(() => { G.State.restParty(); G.UI.show('home'); });
    await page.waitForTimeout(80);
  }

  const after = await page.evaluate(() => window.__measure());
  console.log(`\n  終了時: ${fmt(after)}`);

  /* 内訳 */
  console.log('\n▼ 生きているリスナーの内訳（終了時）');
  const rows = Object.entries(after.live).sort((a, b) => b[1] - a[1]);
  for (const [k, v] of rows) {
    const d = (after.live[k] || 0) - (before.live[k] || 0);
    console.log(`  ${String(v).padStart(4)} 件  ${k.padEnd(28)} ${d > 0 ? `(開始時から +${d})` : ''}`);
  }

  /* DOMの増減の内訳 */
  const tagDiff = Object.entries(after.byTag)
    .map(([k, v]) => [k, v - (before.byTag[k] || 0)])
    .filter(([, d]) => d !== 0)
    .sort((a, b) => b[1] - a[1]);
  if (tagDiff.length) {
    console.log('\n▼ DOM要素の増減の内訳');
    for (const [k, d] of tagDiff) console.log(`  ${d > 0 ? '+' : ''}${String(d).padStart(4)}  ${k}`);
  }

  /* 判定 */
  console.log('\n▼ 判定');
  const grow = after.total - before.total;
  const nodeGrow = after.nodes - before.nodes;
  const ok = [];
  const ng = [];
  (grow <= 5 ? ok : ng).push(`リスナー数の増加: ${grow > 0 ? '+' : ''}${grow} 件`);
  (nodeGrow <= 30 ? ok : ng).push(`DOM要素の増加: ${nodeGrow > 0 ? '+' : ''}${nodeGrow} 個`);
  if (errors.length) ng.push(`JSエラー: ${errors.length} 件`);
  for (const s of ok) console.log(`  ✅ ${s}`);
  for (const s of ng) console.log(`  ❌ ${s}`);
  if (errors.length) errors.slice(0, 5).forEach(e => console.log(`     ${e}`));

  await browser.close();
  srv.close();
  if (ng.length) {
    console.log('\n  蓄積が見つかりました。残り続けるDOMに付いたリスナーを解除してください。');
    process.exit(1);
  }
  console.log('\n  ✅ 画面遷移・戦闘・モーダルを繰り返してもリスナーは蓄積しない');
})().catch(e => { console.error('実行中に失敗:', e.message); process.exit(1); });
