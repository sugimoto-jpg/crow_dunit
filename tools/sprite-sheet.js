/* ===== いまのキャラクター描画を一覧画像にする =====
 * 参考資料と並べて比べられるように、全25職と全32体の敵を
 * 実際にゲームと同じ方法で描き、1枚の画像にまとめる。
 *
 *   node tools/sprite-sheet.js
 *   → dist/sprites-jobs.png / dist/sprites-enemies.png
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

(async () => {
  const { srv, port } = await serve();
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => fs.existsSync(p));
  if (!exe) throw new Error('Chromium が見つかりません');
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForSelector('.title-logo');

  /* ---- 職業一覧 ---- */
  await page.evaluate(() => {
    G.State.newGame('見本', 'normal');
    /* 系統ごとに並べる。各職の代表的な武器を持たせる */
    const WEAP = { mage: 'oak_staff', knight: 'iron_sword', cleric: 'cleric_mace', scout: 'bronze_dagger', villager: 'wood_stick' };
    const byArch = {};
    for (const [id, j] of Object.entries(G.JOBS)) {
      const a = G.SPRITE_ARCH[id] || 'villager';
      (byArch[a] = byArch[a] || []).push([id, j]);
    }
    const LABEL = { villager: '村人', knight: '剣士系', mage: '魔術系', cleric: '神官系', scout: '斥候系' };
    let html = `<div style="background:#15101f;color:#ece7ff;padding:20px;font:13px system-ui">
      <div style="font-size:19px;font-weight:800;margin-bottom:4px">いまのキャラクター描画：全25職</div>
      <div style="opacity:.6;margin-bottom:16px">系統(5種) × 段階(Tier0〜4) × 装備武器 の組み合わせで描いています</div>`;
    for (const a of ['villager', 'knight', 'mage', 'cleric', 'scout']) {
      const list = (byArch[a] || []).sort((x, y) => (x[1].tier || 0) - (y[1].tier || 0));
      html += `<div style="margin:14px 0 6px;font-weight:800;color:#f2c14e">${LABEL[a]}（${list.length}職）</div>
        <div style="display:flex;flex-wrap:wrap;gap:10px">`;
      for (const [id, j] of list) {
        const c = G.Char.create({ key: 'player', name: j.name, icon: '🧑', isPlayer: true });
        c.jobId = id;
        c.equip.weapon = WEAP[a];
        html += `<div style="width:104px;text-align:center;background:#1d1730;border:1px solid #372c58;border-radius:10px;padding:6px">
          <div style="height:96px">${G.Sprite.hero(c)}</div>
          <div style="font-size:11px;font-weight:700;margin-top:2px">${j.name}</div>
          <div style="font-size:10px;opacity:.55">Tier${j.tier}</div>
        </div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
    document.body.innerHTML = html;
    document.querySelectorAll('svg.chr').forEach(s => { s.style.width = '76px'; s.style.height = '96px'; });
  });
  await page.waitForTimeout(300);
  fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
  await page.screenshot({ path: path.join(ROOT, 'dist/sprites-jobs.png'), fullPage: true });
  console.log('  dist/sprites-jobs.png');

  /* ---- 敵一覧 ---- */
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForSelector('.title-logo');
  await page.evaluate(() => {
    G.State.newGame('見本', 'normal');
    const es = Object.entries(G.ENEMIES).sort((a, b) => a[1].lv - b[1].lv);
    let html = `<div style="background:#15101f;color:#ece7ff;padding:20px;font:13px system-ui">
      <div style="font-size:19px;font-weight:800;margin-bottom:4px">いまの敵の描画：全32体</div>
      <div style="opacity:.6;margin-bottom:16px">14種類の形（blob/beast/imp/bone/dragon など）に色を当てて描き分けています</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px">`;
    for (const [id, e] of es) {
      /* G.Sprite.enemy() は u.enemyId と u.isBoss を見る。
       * 実際の戦闘と同じ形のユニットを作らないと、全部同じ絵になる。 */
      const u = { enemyId: id, uid: 'x' + id, name: e.name, isBoss: !!e.boss };
      html += `<div style="width:104px;text-align:center;background:#1d1730;border:1px solid #372c58;border-radius:10px;padding:6px">
        <div style="height:96px">${G.Sprite.enemy(u)}</div>
        <div style="font-size:11px;font-weight:700;margin-top:2px">${e.name}</div>
        <div style="font-size:10px;opacity:.55">Lv${e.lv}${e.boss ? ' ★' : ''}</div>
      </div>`;
    }
    html += `</div></div>`;
    document.body.innerHTML = html;
    document.querySelectorAll('svg').forEach(s => { s.style.width = '80px'; s.style.height = '96px'; });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ROOT, 'dist/sprites-enemies.png'), fullPage: true });
  console.log('  dist/sprites-enemies.png');

  await browser.close();
  srv.close();
})().catch(e => { console.error('実行中に失敗:', e.stack || e.message); process.exit(1); });
