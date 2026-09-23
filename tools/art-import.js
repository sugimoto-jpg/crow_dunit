/* ===== キャラクター画像の取り込み =====
 * 生成AIから出てきた画像を、ゲームで使える形に整える。
 *
 *   node tools/art-import.js <入力画像> <出力先> [--size 384x480]
 *   node tools/art-import.js --group <入力1> <出力1> <入力2> <出力2> ...
 *
 * 例）
 *   node tools/art-import.js ~/dl/hero.jpg assets/characters/player/battle_m.webp
 *
 *   ふだんの絵と、動きの絵をまとめて入れる（位置と大きさが揃う）
 *   node tools/art-import.js --group \
 *     ~/dl/stand.jpg  assets/characters/jobs/villager/battle_m.webp \
 *     ~/dl/attack.jpg assets/characters/jobs/villager/battle_m_attack.webp
 *
 * --group が要る理由：
 *   1枚ずつ入れると、それぞれの絵のふちに合わせて切り出すため、
 *   腕を広げた絵は縮み、縮こまった絵は大きくなる。
 *   差し替わった瞬間にキャラが伸び縮みして見えてしまう。
 *   --group では全部の絵を見てから、共通の切り出し方で書き出すので揃う。
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
  if (args[i] === '--group') { flags.group = true; continue; }
  if (args[i] === '--pad') { flags.pad = Number(args[++i]); continue; }
  if (args[i] === '--q') { flags.q = Number(args[++i]); continue; }
  files.push(args[i]);
}
if (files.length < 2 || files.length % 2 !== 0) {
  console.error('使い方: node tools/art-import.js <入力画像> <出力先> [--size 384x480]');
  console.error('        node tools/art-import.js --group <入力1> <出力1> <入力2> <出力2> ...');
  console.error('  --size 384x480  枠の大きさ / --pad 0.03  余白 / --q 0.9  画質');
  process.exit(1);
}
const pairs = [];
for (let i = 0; i < files.length; i += 2) pairs.push([files[i], files[i + 1]]);
const [W, H] = (flags.size || '384x480').split('x').map(Number);
const PAD = flags.pad == null ? 0.03 : flags.pad;
/* WebPの画質。枠を大きくすると同じ画質でも容量が増えるので下げられるようにする。 */
const Q = flags.q == null ? 0.9 : flags.q;

const EXE = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => fs.existsSync(p));

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

/* ===== ブラウザの中で動く処理 ===== */

/* 背景を消して、キャラの入っている範囲を測る。
 * 透明にした絵は PNG（可逆）で返す。ここで劣化させると、
 * このあとの縮小で粗が出るため。 */
function cut({ url }) {
  return (async () => {
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

    /* すでに透明な絵は、その透明をそのまま使う。
     * 一覧表から切り出した絵（tools/art-slice.js の出力）は、
     * もう背景が抜けている。もう一度色で判定すると、
     * 白い骨や銀の鎧を「灰色＝背景」と間違えて削ってしまう。 */
    let hasAlpha = false;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 250) { hasAlpha = true; break; }
    if (hasAlpha) {
      /* 透明のふちに残った、明るい灰色の背景を削る。
       * 一覧表の背景（透過を表す市松模様）は、一覧表から切り出す段階で
       * 取りきれず、絵のわきに白い板のように残ることがある。
       * 透明な場所から「明るくて色みのない画素」だけをたどって消す。
       * キャラクターの輪郭は暗い線なので、そこで必ず止まる。 */
      const BR_SAT = 26, BR_LUM = 165;
      const seen = new Uint8Array(w * h);
      const q = [];
      const step = (x, y) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const j = y * w + x;
        if (seen[j]) return;
        seen[j] = 1;
        const o = j * 4;
        if (d[o + 3] < 128) { q.push(j); return; }
        if (sat(o) <= BR_SAT && lum(o) >= BR_LUM) { d[o + 3] = 0; q.push(j); }
      };
      for (let j = 0; j < w * h; j++) if (d[j * 4 + 3] < 128) { seen[j] = 1; q.push(j); }
      while (q.length) {
        const j = q.pop();
        const x = j % w, y = (j / w) | 0;
        step(x + 1, y); step(x - 1, y); step(x, y + 1); step(x, y - 1);
      }

      /* 一覧表から切り出すと、隣の絵の端が入り込むことがある。
       * 繋がっている塊に分けて、いちばん大きい塊（＝本体）と、
       * それに近い大きさの塊だけを残す。
       * ごみを残したまま枠に収めると、その分だけ本体が小さくなる。 */
      const lab = new Int32Array(w * h).fill(-1);
      const area = [];
      const st = [];
      for (let i = 0; i < w * h; i++) {
        if (lab[i] >= 0 || d[i * 4 + 3] < 128) continue;
        const cid = area.length; area.push(0);
        lab[i] = cid; st.push(i);
        while (st.length) {
          const j = st.pop(); area[cid]++;
          const x = j % w, y = (j / w) | 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              const k = ny * w + nx;
              if (lab[k] >= 0 || d[k * 4 + 3] < 128) continue;
              lab[k] = cid; st.push(k);
            }
          }
        }
      }
      if (!area.length) return { error: 'キャラクターが見つかりませんでした（全部が透明です）' };
      const big = Math.max(...area);
      const KEEP = 0.35; /* 本体の35%以上なら、離れていても絵の一部とみなす */
      let aX = w, aY = h, bX = -1, bY = -1, kept2 = 0, dropped = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (lab[i] < 0) continue;
          if (area[lab[i]] < big * KEEP) { d[i * 4 + 3] = 0; dropped++; continue; }
          kept2++;
          if (x < aX) aX = x; if (x > bX) bX = x;
          if (y < aY) aY = y; if (y > bY) bY = y;
        }
      }
      cx.putImageData(id, 0, 0);
      return { w, h, minX: aX, minY: aY, maxX: bX, maxY: bY, alpha: true, dropped,
        ratio: +(kept2 / (w * h)).toFixed(3), cut: c.toDataURL('image/png') };
    }

    /* 縁から塗りつぶして背景を見つける。
     * 市松模様は灰色（彩度が低い）。
     * キャラの輪郭には明るい縁取りがあるので、そこで必ず止まる。
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

    /* ※ 振り上げた腕と頭の間や、光の輪の内側のように、
     *    線が輪を作っている場所の背景は、外周から繋がっていないので
     *    ここでは消えずに残る。
     *
     *    模様を機械的に見分ける方法を3通り試したが、どれも駄目だった。
     *      升目の色で判定      → 黒い髪が暗い升と同じ色で、髪が削れる
     *      明暗のばらつきで判定 → 髪の輪郭のざらつきを模様と誤判定する
     *      升ごとの明暗の交代で判定 → 襟やベルトの陰影を模様と誤判定する
     *    JPEGには透明の情報が無いので、確実な手立てがない。
     *
     *    絵を作るときに、線で輪を作らない（振り抜きの光を描かない）と
     *    この問題は起きない。振り抜きの演出はゲーム側で描いている。 */

    /* 境目の暗い縁取りを削る。
     * 切り口をそのまま残すと、キャラの周りに黒い線が出る。 */
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
    return { w, h, minX, minY, maxX, maxY,
      ratio: +(kept / (w * h)).toFixed(3), cut: c.toDataURL('image/png') };
  })();
}

/* 決められた範囲を切り出して、出力の枠に収める。
 * 足の裏が下端に来るように置く。 */
function place({ png, box, W, H, PAD, scale, webp, q }) {
  return (async () => {
    const img = new Image(); img.src = png; await img.decode();
    const cw = box.maxX - box.minX + 1, ch = box.maxY - box.minY + 1;
    const o = document.createElement('canvas'); o.width = W; o.height = H;
    const ox = o.getContext('2d');
    ox.imageSmoothingEnabled = true; ox.imageSmoothingQuality = 'high';
    const s = scale || Math.min(W * (1 - PAD * 2) / cw, H * (1 - PAD * 2) / ch);
    const dw = cw * s, dh = ch * s;
    ox.drawImage(img, box.minX, box.minY, cw, ch,
      (W - dw) / 2, H - dh - H * PAD, dw, dh);
    return o.toDataURL(webp ? 'image/webp' : 'image/png', q);
  })();
}

(async () => {
  for (const [src] of pairs) {
    if (!fs.existsSync(src)) { console.error(`入力が見つかりません: ${src}`); process.exit(1); }
  }
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  /* --- 1回目：背景を消して、キャラの入っている範囲を測る --- */
  const marked = [];
  for (const [src, dest] of pairs) {
    const dataUrl = `data:${MIME[path.extname(src).toLowerCase()] || 'image/png'};base64,`
      + fs.readFileSync(src).toString('base64');
    const r = await page.evaluate(cut, { url: dataUrl });
    if (r.error) { console.error(`${path.basename(src)}: ${r.error}`); process.exit(1); }
    marked.push({ src, dest, ...r });
  }

  /* --- 共通の切り出し方を決める ---
   *
   * 元の画像の大きさがそろっているとき（同じ人の別ポーズなど）は、
   * 全部を囲む1つの範囲を使う。位置まで揃うので、差し替えても動かない。
   *
   * そろっていないとき（一覧表から切り出した別々の絵など）は、
   * 拡大率だけを揃える。大小関係（スライムは小さい、竜は大きい）が残る。 */
  const sameSize = marked.every(m => m.w === marked[0].w && m.h === marked[0].h);
  const group = flags.group && marked.length > 1;
  const box = (group && sameSize)
    ? {
      minX: Math.min(...marked.map(m => m.minX)), minY: Math.min(...marked.map(m => m.minY)),
      maxX: Math.max(...marked.map(m => m.maxX)), maxY: Math.max(...marked.map(m => m.maxY)),
    }
    : null;
  /* 拡大率を揃える場合：いちばん大きい絵が枠に収まる率に合わせる */
  const scale = (group && !sameSize)
    ? Math.min(...marked.map(m => Math.min(W * (1 - PAD * 2) / (m.maxX - m.minX + 1),
      H * (1 - PAD * 2) / (m.maxY - m.minY + 1))))
    : null;

  /* --- 2回目：決めた範囲で書き出す --- */
  for (const m of marked) {
    const b = box || { minX: m.minX, minY: m.minY, maxX: m.maxX, maxY: m.maxY };
    const res = await page.evaluate(place, { png: m.cut, box: b, W, H, PAD, scale,
      webp: /\.webp$/i.test(m.dest), q: Q });
    const buf = Buffer.from(res.split(',')[1], 'base64');
    fs.mkdirSync(path.dirname(m.dest), { recursive: true });
    fs.writeFileSync(m.dest, buf);

    const kb = (buf.length / 1024).toFixed(1);
    console.log(`  ${path.basename(m.src)} → ${m.dest}`);
    console.log(`     元 ${m.w}×${m.h} / 切り出し ${b.maxX - b.minX + 1}×${b.maxY - b.minY + 1}`
      + ` / 書き出し ${W}×${H} / ${kb}KB`);
    /* もともと透明だった絵は、枠いっぱいに絵が詰まっているのが普通なので
     * 「残った割合が多い＝背景が消えていない」の判定はあてはまらない。 */
    if (m.ratio > 0.75 && !m.alpha) console.log(`     ⚠ 背景がうまく消えていないかもしれません（残った割合 ${m.ratio}）`);
    if (m.dropped) console.log(`     離れた小さな塊を ${m.dropped} 画素ぶん取り除きました`);
    if (m.ratio < 0.03) console.log(`     ⚠ 切り抜きすぎかもしれません（残った割合 ${m.ratio}）`);
    if (buf.length > 40 * 1024) console.log(`     ⚠ 40KBを超えています（${kb}KB）`);
  }
  if (group && sameSize) console.log(`\n  ${marked.length}枚を同じ切り出し方で書き出しました（位置と大きさが揃います）`);
  else if (group) console.log(`\n  ${marked.length}枚の拡大率を揃えました（絵どうしの大小関係が残ります）`);

  await browser.close();
})().catch(e => { console.error('取り込みに失敗:', e.message); process.exit(1); });
