/* ===== スマートフォン対応の実測監査 =====
 * 「スマホで遊べるか」を目視ではなく数値で確かめる。
 * 実際の端末の画面サイズでページを開き、全画面を巡回して測る。
 *
 *   ・押せる要素の大きさ（Appleは44px、Googleは48dp以上を推奨）
 *   ・横スクロールが発生していないか
 *   ・文字が小さすぎないか
 *   ・画面からはみ出している要素がないか
 *   ・押せる要素どうしが近すぎないか
 *   ・縦画面で下端のボタンに指が届くか
 *   ・横向きにしたとき破綻しないか
 *
 *   node tools/mobile-audit.js
 *   DEVICE="iPhone SE" node tools/mobile-audit.js   1機種だけ詳しく見る
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

/* 実在する端末の論理解像度（CSSピクセル） */
const DEVICES = [
  { name: 'iPhone SE (第3世代)', w: 375, h: 667, dpr: 2, inset: { top: 20, bottom: 0 } },
  { name: 'iPhone 15',          w: 393, h: 852, dpr: 3, inset: { top: 59, bottom: 34 } },
  { name: 'iPhone 15 Pro Max',  w: 430, h: 932, dpr: 3, inset: { top: 62, bottom: 34 } },
  { name: 'Pixel 7',            w: 412, h: 915, dpr: 2.6, inset: { top: 24, bottom: 24 } },
  { name: 'Galaxy S8 (細長)',    w: 360, h: 740, dpr: 3, inset: { top: 24, bottom: 24 } },
];
const LANDSCAPE = { name: 'iPhone 15 横向き', w: 852, h: 393, dpr: 3, inset: { top: 0, bottom: 21 } };

const TAP_MIN = 44;       // Apple ヒューマンインターフェイスガイドライン
const FONT_MIN = 12;      // これ未満は読みづらい
const GAP_MIN = 8;        // 押せる要素どうしの最低間隔

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

/* ページの中で測る処理。ブラウザ側で実行される */
const MEASURE = (opts) => {
  const { TAP_MIN, FONT_MIN, GAP_MIN, inset } = opts;
  const vw = window.innerWidth, vh = window.innerHeight;
  const out = { small: [], tiny: [], overflow: [], close: [], hidden: [], scrollX: 0, docW: 0 };

  /* 実際に見えている範囲を求める。
   * getBoundingClientRect は、スクロールで隠れている部分も含めた
   * 「本来の大きさ」を返す。リストの途中までしか見えていない項目も
   * そのまま数えてしまうため、囲っている枠で切り取る必要がある。 */
  const visibleRect = el => {
    let r = el.getBoundingClientRect();
    let box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    for (let a = el.parentElement; a; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.overflow === 'visible' && s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const ar = a.getBoundingClientRect();
      box.left = Math.max(box.left, ar.left);
      box.top = Math.max(box.top, ar.top);
      box.right = Math.min(box.right, ar.right);
      box.bottom = Math.min(box.bottom, ar.bottom);
    }
    box.width = Math.max(0, box.right - box.left);
    box.height = Math.max(0, box.bottom - box.top);
    return box;
  };

  const label = el => {
    const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 18);
    const id = el.id ? '#' + el.id : '';
    const cls = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return (t || el.tagName.toLowerCase() + id + cls).slice(0, 26);
  };

  /* 押せる要素をすべて集める */
  const clickable = [...document.querySelectorAll(
    'button, [data-act], [data-nav], [data-pick], input, select, a, .selectable, .list-item .act')]
    .filter(el => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
      if (el.disabled) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });

  const boxes = [];
  for (const el of clickable) {
    const r = el.getBoundingClientRect();
    boxes.push({ el, r, v: visibleRect(el) });
    if (r.width < TAP_MIN || r.height < TAP_MIN) {
      out.small.push({ name: label(el), w: Math.round(r.width), h: Math.round(r.height) });
    }
    // 画面の横からはみ出していないか
    if (r.left < -1 || r.right > vw + 1) {
      out.overflow.push({ name: label(el), left: Math.round(r.left), right: Math.round(r.right) });
    }
    /* ノッチ・ホームバーの帯に食い込んでいないか。
     * :root の余白は position:fixed の要素には効かないため、
     * モーダルやトーストだけが食い込む可能性がある。 */
    const v = visibleRect(el);
    if (v.width > 0 && v.height > 0) {
      const overTop = v.top < inset.top;
      const overBottom = v.bottom > vh - inset.bottom;
      if (overTop || overBottom) {
        out.hidden.push({ name: label(el), top: Math.round(v.top), bottom: Math.round(v.bottom),
          where: overTop ? '上端' : '下端' });
      }
    }
  }

  /* 押せる要素どうしが近すぎないか（誤タップの原因） */
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].v, b = boxes[j].v;
      if (!a.width || !a.height || !b.width || !b.height) continue;
      if (boxes[i].el.contains(boxes[j].el) || boxes[j].el.contains(boxes[i].el)) continue;
      /* 下部タブバーの中で隣り合うボタンは、隙間なく並べるのが通例なので除外する。
       * （1つ1つが十分大きければ誤タップにならない） */
      const navA = boxes[i].el.closest('#nav'), navB = boxes[j].el.closest('#nav');
      if (navA && navA === navB) continue;
      const dx = Math.max(a.left - b.right, b.left - a.right);
      const dy = Math.max(a.top - b.bottom, b.top - a.bottom);
      if (dx < 0 && dy < 0) continue;                       // 重なっている（入れ子など）
      const gap = Math.max(dx, dy);
      if (gap >= 0 && gap < GAP_MIN) {
        out.close.push({ a: label(boxes[i].el), b: label(boxes[j].el), gap: Math.round(gap) });
      }
    }
  }

  /* 文字の大きさ */
  const seen = new Set();
  for (const el of document.querySelectorAll('#app *')) {
    if (!el.childNodes.length) continue;
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!hasText) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    const px = parseFloat(s.fontSize);
    if (px < FONT_MIN) {
      const k = label(el) + '@' + px;
      if (!seen.has(k)) { seen.add(k); out.tiny.push({ name: label(el), px: px.toFixed(1) }); }
    }
  }

  /* 横スクロール */
  out.docW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  out.scrollX = out.docW - vw;

  return out;
};

const SCREENS = ['title', 'home', 'academy', 'guild', 'town', 'status', 'job'];

(async () => {
  const { srv, port } = await serve();
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => fs.existsSync(p));
  if (!exe) throw new Error('Chromium が見つかりません');
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  const only = process.env.DEVICE;
  const list = (only ? DEVICES.filter(d => d.name.includes(only)) : DEVICES).concat(only ? [] : [LANDSCAPE]);
  const all = { small: new Map(), tiny: new Map(), overflow: new Map(), close: new Map(), hidden: new Map(), scroll: [] };
  const add = (m, key, where) => { if (!m.has(key)) m.set(key, new Set()); m.get(key).add(where); };

  for (const dev of list) {
    const ctx = await browser.newContext({ viewport: { width: dev.w, height: dev.h }, deviceScaleFactor: dev.dpr, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${port}/index.html`);
    await page.waitForSelector('.title-logo');
    /* ヘッドレスのブラウザでは env(safe-area-inset-*) が 0 になる。
     * それでは「ノッチに隠れるか」を確かめられないので、
     * 実機と同じ余白を明示的に入れて再現する。 */
    await page.addStyleTag({ content:
      `:root{padding-top:${dev.inset.top}px !important;padding-bottom:${dev.inset.bottom}px !important}` });
    await page.waitForTimeout(80);

    console.log(`\n▼ ${dev.name}  ${dev.w}×${dev.h}`);

    for (const scr of SCREENS) {
      if (scr === 'title') {
        await page.evaluate(() => { G.UI.show('title'); });
      } else {
        await page.evaluate(n => {
          if (!G.State.data) {
            G.State.newGame('検証', 'normal');
            for (const k of ['riina', 'velt', 'noa']) G.State.recruit(k);
            for (const c of G.State.d.party) { while (c.level < 30) { G.Char.levelUp(c); let g = 0; while (G.Char.autoJob(c) && g++ < 6); } }
            Object.assign(G.State.d, { gold: 50000 });
            Object.assign(G.State.d.guild, { registered: true, rank: 4, totalClears: 18 });
            G.State.setFlag('awaken');
            G.UI.setChromeVisible(true);
          }
          G.UI.show(n);
        }, scr);
      }
      await page.waitForTimeout(120);
      const r = await page.evaluate(MEASURE, { TAP_MIN, FONT_MIN, GAP_MIN, inset: dev.inset });
      for (const x of r.small) add(all.small, `${x.name} (${x.w}×${x.h})`, `${dev.name}/${scr}`);
      for (const x of r.tiny) add(all.tiny, `${x.name} (${x.px}px)`, `${dev.name}/${scr}`);
      for (const x of r.overflow) add(all.overflow, `${x.name} 右端${x.right}`, `${dev.name}/${scr}`);
      for (const x of r.close) add(all.close, `${x.a} ↔ ${x.b} (${x.gap}px)`, `${dev.name}/${scr}`);
      for (const x of r.hidden) add(all.hidden, `${x.name} → ${x.where}`, `${dev.name}/${scr}`);
      if (r.scrollX > 1) all.scroll.push(`${dev.name}/${scr} 横に ${r.scrollX}px はみ出し`);
      const flags = [r.small.length && `小${r.small.length}`, r.tiny.length && `字${r.tiny.length}`,
        r.overflow.length && `外${r.overflow.length}`, r.close.length && `近${r.close.length}`,
        r.hidden.length && `隠${r.hidden.length}`, r.scrollX > 1 && `横${r.scrollX}`].filter(Boolean);
      console.log(`   ${scr.padEnd(9)} ${flags.length ? '⚠ ' + flags.join(' ') : '✅'}`);
    }

    /* 戦闘画面 */
    /* 戦闘は「コマンドが出ている状態」で測る。
     * 単に待つだけだと、強いパーティでは戦闘が終わってしまい、
     * 結果画面を測ることになる（下部タブが戻るので数値が変わる）。 */
    await page.evaluate(() => {
      G.State.d.battleSpeed = 1;
      G.BattleUI.start(['golem', 'golem', 'golem'], { canFlee: true });
    });
    await page.waitForSelector('.scene');
    await page.waitForSelector('[data-act="atk"]', { timeout: 15000 });
    await page.waitForTimeout(150);
    const navHidden = await page.evaluate(() => G.UI.el('nav').classList.contains('hidden'));
    if (!navHidden) console.log('   ⚠ 戦闘中なのに下部タブが出ています');
    const rb = await page.evaluate(MEASURE, { TAP_MIN, FONT_MIN, GAP_MIN, inset: dev.inset });
    for (const x of rb.small) add(all.small, `${x.name} (${x.w}×${x.h})`, `${dev.name}/battle`);
    for (const x of rb.tiny) add(all.tiny, `${x.name} (${x.px}px)`, `${dev.name}/battle`);
    for (const x of rb.overflow) add(all.overflow, `${x.name} 右端${x.right}`, `${dev.name}/battle`);
    for (const x of rb.close) add(all.close, `${x.a} ↔ ${x.b} (${x.gap}px)`, `${dev.name}/battle`);
    for (const x of rb.hidden) add(all.hidden, `${x.name} → ${x.where}`, `${dev.name}/battle`);
    if (rb.scrollX > 1) all.scroll.push(`${dev.name}/battle 横に ${rb.scrollX}px はみ出し`);
    const fb = [rb.small.length && `小${rb.small.length}`, rb.tiny.length && `字${rb.tiny.length}`,
      rb.overflow.length && `外${rb.overflow.length}`, rb.close.length && `近${rb.close.length}`,
      rb.hidden.length && `隠${rb.hidden.length}`, rb.scrollX > 1 && `横${rb.scrollX}`].filter(Boolean);
    console.log(`   ${'battle'.padEnd(9)} ${fb.length ? '⚠ ' + fb.join(' ') : '✅'}`);

    await ctx.close();
  }

  /* ---------- まとめ ---------- */
  const section = (title, m, note) => {
    console.log(`\n═══ ${title} ═══`);
    if (!m.size) { console.log('  ✅ なし'); return; }
    if (note) console.log(`  ${note}`);
    const rows = [...m.entries()].sort((a, b) => b[1].size - a[1].size);
    for (const [k, where] of rows.slice(0, 25)) {
      const w = [...where];
      const devs = [...new Set(w.map(x => x.split('/')[0]))];
      const scrs = [...new Set(w.map(x => x.split('/')[1]))];
      console.log(`  ⚠ ${k}`);
      console.log(`      画面: ${scrs.join(', ')}  /  ${devs.length === 6 ? '全機種' : devs.join(', ')}`);
    }
    if (rows.length > 25) console.log(`  … ほか ${rows.length - 25} 件`);
  };

  console.log('\n\n████ 監査結果 ████');
  section(`押しにくい要素（${TAP_MIN}px 未満）`, all.small, 'Apple は 44×44px 以上、Google は 48dp 以上を推奨');
  section('押せる要素どうしが近すぎる', all.close, `${GAP_MIN}px 未満は誤タップの原因になる`);
  section(`文字が小さい（${FONT_MIN}px 未満）`, all.tiny);
  section('画面の横からはみ出している', all.overflow);
  section('ノッチ・ホームバーに隠れる', all.hidden);

  console.log('\n═══ 横スクロール ═══');
  console.log(all.scroll.length ? all.scroll.map(s => '  ⚠ ' + s).join('\n') : '  ✅ どの画面でも発生しない');

  const total = all.small.size + all.close.size + all.tiny.size + all.overflow.size + all.hidden.size + all.scroll.length;
  console.log(`\n═══ 合計 ${total} 件 ═══`);

  await browser.close();
  srv.close();
})().catch(e => { console.error('実行中に失敗:', e.stack || e.message); process.exit(1); });
