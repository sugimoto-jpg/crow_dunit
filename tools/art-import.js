/* ===== キャラクター画像の取り込み =====
 * 生成AIから出てきた画像を、ゲームで使える形に整える。
 *
 *   node tools/art-import.js <入力画像> <出力先> [--size 384x480] [--check]
 *
 * 例）
 *   node tools/art-import.js ~/dl/hero.jpg assets/characters/player/battle_m.webp
 *
 * やること
 *   1. 透過を表す市松模様の背景を消して、本当に透明にする
 *      （JPEGには透明が無いので、模様が絵に焼き付いてしまっている）
 *   2. キャラクターの周りの余分な余白を切り落とす
 *   3. 決められた比率の枠に、足元を下端に合わせて収める
 *   4. WebP で書き出す
 *
 * 画像を扱う道具がこの環境に無いため、Chromium の canvas を使う。
 * （テストで既に使っているものなので、新しい依存は増やさない）
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const flags = {};
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--size') { flags.size = args[++i]; continue; }
  if (args[i] === '--check') { flags.check = true; continue; }
  if (args[i] === '--pad') { flags.pad = Number(args[++i]); continue; }
  files.push(args[i]);
}
if (files.length < 2) {
  console.error('使い方: node tools/art-import.js <入力画像> <出力先> [--size 384x480]');
  process.exit(1);
}
const [src, dest] = files;
const [W, H] = (flags.size || '384x480').split('x').map(Number);
const PAD = flags.pad == null ? 0.03 : flags.pad;

const EXE = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => fs.existsSync(p));

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

(async () => {
  if (!fs.existsSync(src)) { console.error(`入力が見つかりません: ${src}`); process.exit(1); }
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const dataUrl = `data:${MIME[path.extname(src).toLowerCase()] || 'image/png'};base64,`
    + fs.readFileSync(src).toString('base64');

  const out = await page.evaluate(async ({ url, W, H, PAD }) => {
    const img = new Image(); img.src = url; await img.decode();
    const w = img.width, h = img.height;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    const id = cx.getImageData(0, 0, w, h);
    const d = id.data;

    const sat = o => {
      const r = d[o], g = d[o + 1], b = d[o + 2];
      return Math.max(r, g, b) - Math.min(r, g, b);
    };
    const lum = o => (d[o] * 299 + d[o + 1] * 587 + d[o + 2] * 114) / 1000;

    /* --- 1. 縁から塗りつぶして背景を見つける ---
     * 市松模様は灰色（彩度が低い）。
     * キャラの輪郭には明るい黄色の縁取りがあるので、そこで必ず止まる。
     * 「縁から繋がっている灰色」だけを背景にするので、
     * 服の白や鎧の銀（どちらも彩度が低い）は消えない。 */
    const BG_SAT = 30;
    const bg = new Uint8Array(w * h);
    const stack = [];
    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = y * w + x;
      if (bg[i]) return;
      if (sat(i * 4) > BG_SAT) return;
      bg[i] = 1; stack.push(i);
    };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    while (stack.length) {
      const i = stack.pop();
      const x = i % w, y = (i / w) | 0;
      push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
    }

    /* --- 2. 境目の暗い縁取りを削る ---
     * 切り口をそのまま残すと、キャラの周りに黒い線が出る。
     * 背景に接していて、暗くて彩度も低い画素を、もう一段消す。 */
    for (let pass = 0; pass < 2; pass++) {
      const add = [];
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (bg[i]) continue;
          if (!(bg[i - 1] || bg[i + 1] || bg[i - w] || bg[i + w])) continue;
          const o = i * 4;
          if (sat(o) < 46 && lum(o) < 96) add.push(i);
        }
      }
      for (const i of add) bg[i] = 1;
    }

    /* --- 3. 背景を透明にする --- */
    let minX = w, minY = h, maxX = -1, maxY = -1, kept = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (bg[i]) { d[i * 4 + 3] = 0; continue; }
        kept++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return { error: 'キャラクターが見つかりませんでした（全部が背景と判定されました）' };
    cx.putImageData(id, 0, 0);

    /* --- 4. 切り出して、決められた枠に収める --- */
    const cw = maxX - minX + 1, ch = maxY - minY + 1;
    const o = document.createElement('canvas'); o.width = W; o.height = H;
    const ox = o.getContext('2d');
    ox.imageSmoothingEnabled = true; ox.imageSmoothingQuality = 'high';
    const availW = W * (1 - PAD * 2), availH = H * (1 - PAD * 2);
    const s = Math.min(availW / cw, availH / ch);
    const dw = cw * s, dh = ch * s;
    /* 足元を下端に合わせる（下の余白はPAD分だけ残す） */
    ox.drawImage(c, minX, minY, cw, ch, (W - dw) / 2, H - dh - H * PAD, dw, dh);

    return {
      w, h, cw, ch, kept,
      ratio: +(kept / (w * h)).toFixed(3),
      webp: o.toDataURL('image/webp', 0.9),
      png: o.toDataURL('image/png'),
    };
  }, { url: dataUrl, W, H, PAD });

  await browser.close();

  if (out.error) { console.error(out.error); process.exit(1); }

  const isWebp = /\.webp$/i.test(dest);
  const b64 = (isWebp ? out.webp : out.png).split(',')[1];
  const buf = Buffer.from(b64, 'base64');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);

  const kb = (buf.length / 1024).toFixed(1);
  console.log(`  ${path.basename(src)} → ${dest}`);
  console.log(`     元 ${out.w}×${out.h} / 切り出し ${out.cw}×${out.ch}`
    + ` / 書き出し ${W}×${H} / ${kb}KB`);
  if (out.ratio > 0.75) console.log(`     ⚠ 背景がうまく消えていないかもしれません（残った割合 ${out.ratio}）`);
  if (out.ratio < 0.03) console.log(`     ⚠ 切り抜きすぎかもしれません（残った割合 ${out.ratio}）`);
  if (buf.length > 40 * 1024) console.log(`     ⚠ 40KBを超えています（${kb}KB）`);
})().catch(e => { console.error('取り込みに失敗:', e.message); process.exit(1); });
