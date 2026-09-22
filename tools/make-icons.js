/* ===== アプリのアイコンを作る =====
 * 外部の画像を使わず、ゲームと同じ描画でアイコンを作る。
 * （キャラクターはコードで描いているので、そのまま大きく描ける）
 *
 *   node tools/make-icons.js
 *   → pwa/icon-192.png / icon-512.png / icon-maskable-512.png
 *
 * maskable 版は、端末が角を丸く切り取っても欠けないよう、
 * 中央8割の中に絵を収めている。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'pwa');
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
  fs.mkdirSync(OUT, { recursive: true });

  for (const [file, size, safe] of [
    ['icon-192.png', 192, 0.96],
    ['icon-512.png', 512, 0.96],
    ['icon-maskable-512.png', 512, 0.72],   // 角が切り取られても欠けない大きさ
  ]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.goto(`http://127.0.0.1:${port}/index.html`);
    await page.waitForSelector('.title-logo');
    await page.evaluate(({ size, safe }) => {
      G.State.newGame('アイコン', 'normal');
      const c = G.Char.create({ key: 'player', name: 'x', icon: '🧑', isPlayer: true });
      c.jobId = 'paladin';                       // 聖騎士。盾と翼の兜で目を引く
      c.equip.weapon = 'silver_sword';
      const hero = G.Sprite.hero(c);
      document.documentElement.style.padding = '0';
      document.body.innerHTML = `
        <div id="ico" style="width:${size}px;height:${size}px;position:relative;overflow:hidden;
             background:
               radial-gradient(120% 90% at 50% 8%, #3a2470 0%, transparent 62%),
               radial-gradient(110% 80% at 88% 106%, #23315c 0%, transparent 58%),
               #120d1c;">
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
            <div style="width:${Math.round(size * safe * 0.78)}px;
                        height:${Math.round(size * safe)}px;
                        filter:drop-shadow(0 ${Math.round(size * 0.02)}px ${Math.round(size * 0.04)}px rgba(0,0,0,.55))">
              ${hero}
            </div>
          </div>
        </div>`;
      const svg = document.querySelector('#ico svg.chr');
      if (svg) { svg.style.width = '100%'; svg.style.height = '100%'; svg.style.display = 'block'; }
      // 背景の星を少し散らす
      const host = document.getElementById('ico');
      const rnd = (a, b) => a + Math.random() * (b - a);
      for (let i = 0; i < 14; i++) {
        const d = document.createElement('div');
        const r = rnd(size * 0.004, size * 0.011);
        d.setAttribute('style', `position:absolute;left:${rnd(4, 96)}%;top:${rnd(4, 60)}%;
          width:${r * 2}px;height:${r * 2}px;border-radius:50%;
          background:#f2c14e;opacity:${rnd(0.18, 0.5)}`);
        host.insertBefore(d, host.firstChild);
      }
    }, { size, safe });
    await page.waitForTimeout(200);
    await page.locator('#ico').screenshot({ path: path.join(OUT, file) });
    console.log(`  pwa/${file}  ${size}×${size}`);
    await page.close();
  }

  await browser.close();
  srv.close();
})().catch(e => { console.error('実行中に失敗:', e.stack || e.message); process.exit(1); });
