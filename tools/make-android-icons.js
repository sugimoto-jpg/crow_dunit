/* ===== Androidアプリのアイコンを差し替える =====
 * pwa/icon-512.png を各解像度に縮小して android のリソースに置く。
 * （Capacitor が入れる既定のアイコンのままだと、Capacitorのロゴが出る）
 *
 *   node tools/make-android-icons.js
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'pwa/icon-512.png');
const RES = path.join(ROOT, 'android/app/src/main/res');

/* Android の密度ごとの大きさ。
 * ic_launcher は通常のアイコン、foreground は丸く切り抜かれる前提の層。 */
const SIZES = {
  'mipmap-mdpi': 48, 'mipmap-hdpi': 72, 'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144, 'mipmap-xxxhdpi': 192,
};

(async () => {
  if (!fs.existsSync(SRC)) { console.error('先に node tools/make-icons.js を実行してください'); process.exit(1); }
  if (!fs.existsSync(RES)) { console.error('android プロジェクトがありません（npx cap add android）'); process.exit(1); }
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const b64 = fs.readFileSync(SRC).toString('base64');

  let n = 0;
  for (const [dir, size] of Object.entries(SIZES)) {
    const out = path.join(RES, dir);
    if (!fs.existsSync(out)) continue;
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<body style="margin:0"><img id="i" src="data:image/png;base64,${b64}"
      style="width:${size}px;height:${size}px;display:block"></body>`);
    await page.waitForTimeout(80);
    for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
      const f = path.join(out, name);
      if (!fs.existsSync(f)) continue;
      await page.locator('#i').screenshot({ path: f });
      n++;
    }
    await page.close();
  }
  await browser.close();
  console.log(`  アイコンを ${n} 件差し替えました`);
})().catch(e => { console.error('実行中に失敗:', e.stack || e.message); process.exit(1); });
