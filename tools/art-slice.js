/* ===== 一覧表から1体ずつ切り出す =====
 * 何人ものキャラクターが並んだ1枚の絵を、1体ずつのファイルに分ける。
 *
 *   node tools/art-slice.js <一覧表の画像> <出し先フォルダ> [--min-h 60]
 *
 * やること
 *   1. 背景（灰色の市松模様・無地の灰色）を透明にする
 *   2. 繋がっているまとまりを1体ずつに分ける
 *   3. 文字の行を捨てる（小さすぎるまとまり）
 *   4. 上の行から、左から右の順に番号を振って書き出す
 *   5. 番号を焼き込んだ確認用の一覧を作る
 *
 * 大きさは揃えない。一覧表の中の大小関係（スライムは小さい、竜は大きい）を
 * そのまま残したいので、切り出しだけを行う。
 * ゲームに入れるときは tools/art-import.js --group で揃える。
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const flags = {};
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--min-h') { flags.minH = Number(args[++i]); continue; }
  if (args[i] === '--tol') { flags.tol = Number(args[++i]); continue; }
  if (args[i] === '--erode') { flags.erode = Number(args[++i]); continue; }
  if (args[i] === '--cuts') { flags.cuts = args[++i]; continue; }
  if (args[i] === '--save-boxes') { flags.saveBoxes = args[++i]; continue; }
  if (args[i] === '--boxes') { flags.boxes = args[++i]; continue; }
  if (args[i] === '--grow') { flags.grow = args[++i]; continue; }
  files.push(args[i]);
}
if (files.length < 2) {
  console.error('使い方: node tools/art-slice.js <一覧表の画像> <出し先フォルダ> [--min-h 60]');
  console.error('  --save-boxes <file>  見つけた囲みを保存する');
  console.error('  --boxes <file> --grow 14,56  保存した囲みで切る（横,縦に広げる）');
  process.exit(1);
}
const [src, outDir] = files;
const MIN_H = flags.minH || 60;
const TOL = flags.tol == null ? 22 : flags.tol;
const ERODE = flags.erode == null ? 4 : flags.erode;

/* 同じ並びの一覧表が何枚もあるとき（構え・振りかぶり・振り下ろしなど）、
 * 1枚目で見つけた囲みを保存して、残りの枚数でも同じ囲みを使う。
 *
 *   node tools/art-slice.js 構え.jpg  out/hold  --save-boxes boxes.json
 *   node tools/art-slice.js 振り上げ.jpg out/up  --boxes boxes.json --grow 24
 *
 * こうする理由：
 *   武器を持った絵は、剣や弓が隣の人に触れてしまい、機械では分けきれない。
 *   人物の位置はどの枚数でも同じなので、武器を持たない絵で位置を決めて、
 *   そこを少し広げて（--grow）他の枚数を切ると、全部が同じ番号で揃う。
 *   番号が揃っていれば、1体分の4枚をそのまま動きの絵として使える。 */
/* --grow 24 で四方に、--grow 14,56 で「横,縦」に、
 * --grow 14,56,0 で「横,上,下」に分けて広げられる。
 * 名前の文字は絵の下に書いてあるので、下は広げないほうがよい。
 * 振り上げた剣は上に伸びるので、縦を大きく、横は小さくする。
 * 横を大きくすると隣の人が入り込む。 */
const G2 = String(flags.grow == null ? 0 : flags.grow).split(',').map(Number);
const GROW = {
  x: G2[0] || 0,
  up: (G2.length > 1 ? G2[1] : G2[0]) || 0,
  down: (G2.length > 2 ? G2[2] : (G2.length > 1 ? G2[1] : G2[0])) || 0,
};
const BOXES = flags.boxes ? JSON.parse(fs.readFileSync(flags.boxes, 'utf8')) : null;

/* 自動で分けられない重なりを、手で指定して分ける。
 *   --cuts "36:0.33,0.70 40:0.55"
 * 番号は一度切り出したときの番号、値はその囲みの横幅に対する割合。
 * 触れ合った絵は機械では分けきれないことがあるので、逃げ道として用意する。 */
const CUTS = {};
for (const part of (flags.cuts || '').split(/\s+/).filter(Boolean)) {
  const [idx, list] = part.split(':');
  CUTS[Number(idx)] = (list || '').split(',').map(Number).filter(v => v > 0 && v < 1);
}

const EXE = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => fs.existsSync(p));
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function cut({ url, MIN_H, TOL, ERODE, CUTS, BOXES, GROW }) {
  return (async () => {
    const img = new Image(); img.src = url; await img.decode();
    const w = img.width, h = img.height;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    const id = cx.getImageData(0, 0, w, h);
    const d = id.data;

    const at = i => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
    const near = (a, b) => Math.abs(a[0] - b[0]) <= TOL
      && Math.abs(a[1] - b[1]) <= TOL && Math.abs(a[2] - b[2]) <= TOL;

    /* --- 背景の色を、縁で多いものから2つまで拾う --- */
    const tally = {};
    const add = i => { const k = at(i).map(v => v >> 3 << 3).join(','); tally[k] = (tally[k] || 0) + 1; };
    for (let x = 0; x < w; x++) { add(x); add((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { add(y * w); add(y * w + w - 1); }
    const tones = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 2)
      .map(([k]) => k.split(',').map(Number));
    if (!tones.length) return { error: '背景の色が読み取れませんでした' };

    /* --- 縁から塗りつぶす。背景色に近い画素だけを通る --- */
    const bg = new Uint8Array(w * h);
    const stack = [];
    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = y * w + x;
      if (bg[i]) return;
      const v = at(i);
      if (!tones.some(t => near(v, t))) return;
      bg[i] = 1; stack.push(i);
    };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    while (stack.length) {
      const i = stack.pop();
      const x = i % w, y = (i / w) | 0;
      push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
    }

    /* --- 名前が書かれた行を、先に背景にする ---
     * 一覧表には、キャラクターの下に名前が書かれている。
     * 名前にも光彩が付いていてキャラクターと繋がるため、
     * まとまりを数える前に消してしまう。
     *
     * 見分け方：その高さを横に走査したとき、
     * 背景と中身が切り替わる回数が極端に多ければ文字の行。
     *   キャラクターの行 … 1体につき2回ほど（10体なら20回ほど）
     *   文字の行         … 1文字ごとに何度も切り替わる（100回以上）
     */
    (function dropLabels() {
      const flips = new Int32Array(h);
      for (let y = 0; y < h; y++) {
        let n2 = 0;
        for (let x = 1; x < w; x++) if (bg[y * w + x] !== bg[y * w + x - 1]) n2++;
        flips[y] = n2;
      }
      const used = Array.from(flips).filter(v => v > 0).sort((a, b) => a - b);
      if (!used.length) return;
      const med = used[used.length >> 1];
      for (let y = 0; y < h; y++) {
        if (flips[y] < Math.max(24, med * 2.2)) continue;
        for (let x = 0; x < w; x++) bg[y * w + x] = 1;
      }
    })();

    /* 囲みの下にくっついた名前の行を切り落とす。
     * 絵と名前のあいだには、必ず横一列の切れ目がある。
     * 下から3割の範囲でその切れ目を探し、下に絵が残っていればそこで切る。 */
    function trimName(x0, x1, y0, y1) {
      const ink = [];
      for (let y = y0; y <= y1; y++) {
        let n2 = 0;
        for (let x = x0; x <= x1; x++) if (!bg[y * w + x]) n2++;
        ink.push(n2);
      }
      const thin = Math.max(1, Math.round((x1 - x0 + 1) * 0.02));
      const from = Math.floor(ink.length * 0.65);
      for (let k = ink.length - 1; k >= from; k--) {
        if (ink[k] > thin) continue;
        let below = 0;
        for (let j = k + 1; j < ink.length; j++) below += ink[j];
        if (below < 40) continue;
        return y0 + k - 1;
      }
      return y1;
    }

    /* --- 囲みを渡されたときは、探さずにそのまま使う ---
     * 渡された囲みは、武器を持たない絵で見つけたもの。
     * 振り上げた剣がはみ出すので、少し広げてから切る。 */
    if (BOXES) {
      for (let i = 0; i < w * h; i++) if (bg[i]) d[i * 4 + 3] = 0;
      cx.putImageData(id, 0, 0);
      const out0 = [];
      for (const bx of BOXES) {
        const x0 = Math.max(0, bx.x - GROW.x), y0 = Math.max(0, bx.y - GROW.up);
        const x1 = Math.min(w - 1, bx.x + bx.w - 1 + GROW.x);
        const y1 = Math.min(h - 1, bx.y + bx.h - 1 + GROW.down);
        const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
        const o = document.createElement('canvas'); o.width = bw; o.height = bh;
        const oc = o.getContext('2d');
        oc.drawImage(c, x0, y0, bw, bh, 0, 0, bw, bh);
        /* 名前の行は一覧表ごとに位置が違うので、一覧表ごとに探して消す。
         * 切り取る高さは変えない。変えると、同じ番号どうしで
         * 大きさが食い違い、動きの絵を重ねたときに位置がずれる。 */
        const yCut = trimName(x0, x1, y0, y1);
        if (yCut < y1) oc.clearRect(0, yCut - y0 + 1, bw, bh - (yCut - y0 + 1));
        out0.push({ png: o.toDataURL('image/png'), w: bw, h: bh, x: x0, y: y0 });
      }
      const pv0 = document.createElement('canvas'); pv0.width = w; pv0.height = h;
      const px0 = pv0.getContext('2d');
      px0.fillStyle = '#1d1636'; px0.fillRect(0, 0, w, h);
      px0.drawImage(c, 0, 0);
      px0.font = 'bold 22px sans-serif'; px0.textBaseline = 'top';
      out0.forEach((it, i) => {
        px0.strokeStyle = '#f2c14e'; px0.lineWidth = 2;
        px0.strokeRect(it.x - 2, it.y - 2, it.w + 4, it.h + 4);
        const label = String(i + 1);
        px0.fillStyle = '#f2c14e'; px0.fillRect(it.x - 2, it.y - 26, 14 + label.length * 12, 24);
        px0.fillStyle = '#1d1636'; px0.fillText(label, it.x + 4, it.y - 24);
      });
      return { w, h, count: out0.length, items: out0, preview: pv0.toDataURL('image/png') };
    }

    /* --- 数える前に、細い繋がりを切る ---
     * ラベルの文字が、にじみでキャラクターと繋がっていることがある。
     * そのままだと文字までひとまとまりに数えられ、
     * 隣のキャラクターまで一続きになってしまう。
     * 少しだけ痩せさせてから数え、囲みはあとで戻す。 */
    const core = Uint8Array.from(bg);
    for (let k = 0; k < ERODE; k++) {
      const add = [];
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (core[i]) continue;
          if (core[i - 1] || core[i + 1] || core[i - w] || core[i + w]) add.push(i);
        }
      }
      for (const i of add) core[i] = 1;
    }

    /* --- 残ったまとまりを数える --- */
    const seen = new Uint8Array(w * h);
    const items = [];
    for (let s = 0; s < w * h; s++) {
      if (seen[s] || core[s]) continue;
      let minX = w, minY = h, maxX = -1, maxY = -1, n = 0;   // eslint-disable-line prefer-const
      const st = [s]; seen[s] = 1;
      while (st.length) {
        const i = st.pop();
        const x = i % w, y = (i / w) | 0;
        n++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
        for (const [nx, ny] of nb) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (seen[j] || core[j]) continue;
          seen[j] = 1; st.push(j);
        }
      }
      const bh = maxY - minY + 1, bw = maxX - minX + 1;
      if (bh < MIN_H || n < 400) continue;          // 文字の行や点は捨てる
      /* 痩せさせた分を戻す */
      minX = Math.max(0, minX - ERODE); minY = Math.max(0, minY - ERODE);
      maxX = Math.min(w - 1, maxX + ERODE); maxY = Math.min(h - 1, maxY + ERODE);
      items.push({ minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1, n });
    }
    if (!items.length) return { error: 'キャラクターが見つかりませんでした' };

    /* --- 横に繋がってしまったものを分ける ---
     * 羽や枝が隣に触れていると、2〜3体がひとまとまりになる。
     * 縦に見て中身がほとんど無い列（＝キャラとキャラの隙間）で切る。 */
    const medW = items.map(i => i.w).sort((a, b) => a - b)[items.length >> 1];
    const split = [];
    for (const it of items) {
      if (it.w < medW * 1.6) { split.push(it); continue; }
      /* 列ごとの中身の量 */
      const cols = new Int32Array(it.w);
      for (let y = it.minY; y <= it.maxY; y++) {
        for (let x = it.minX; x <= it.maxX; x++) if (!bg[y * w + x]) cols[x - it.minX]++;
      }
      const thin = Math.max(2, Math.round(it.h * 0.035));
      /* 細い列が続くところを隙間とみなす */
      const cuts = [];
      let run = -1;
      for (let x = 0; x < it.w; x++) {
        if (cols[x] <= thin) { if (run < 0) run = x; }
        else if (run >= 0) {
          if (x - run >= 4 && run > 10 && it.w - x > 10) {
            cuts.push(((run + x) / 2) | 0);
          }
          run = -1;
        }
      }
      if (!cuts.length) { split.push(it); continue; }
      const edges = [0, ...cuts, it.w];
      for (let k = 0; k + 1 < edges.length; k++) {
        /* 切った区間の中で、もう一度きちんと囲み直す */
        let a = w, b2 = -1, t = h, u = -1, n2 = 0;
        for (let y = it.minY; y <= it.maxY; y++) {
          for (let x = it.minX + edges[k]; x < it.minX + edges[k + 1]; x++) {
            if (bg[y * w + x]) continue;
            n2++;
            if (x < a) a = x; if (x > b2) b2 = x;
            if (y < t) t = y; if (y > u) u = y;
          }
        }
        if (b2 < 0 || u - t + 1 < MIN_H || n2 < 400) continue;
        split.push({ minX: a, minY: t, maxX: b2, maxY: u, w: b2 - a + 1, h: u - t + 1, n: n2 });
      }
    }
    items.length = 0;
    items.push(...split);

    /* --- 上の行から、左から右へ並べる --- */
    const avgH = items.reduce((a, b) => a + b.h, 0) / items.length;
    items.sort((a, b) => a.minY - b.minY);
    const rows = [];
    for (const it of items) {
      const row = rows.find(r => Math.abs(r.y - (it.minY + it.h / 2)) < avgH * 0.6);
      if (row) { row.items.push(it); row.y = (row.y + it.minY + it.h / 2) / 2; }
      else rows.push({ y: it.minY + it.h / 2, items: [it] });
    }
    rows.sort((a, b) => a.y - b.y);
    const ordered = [];
    for (const r of rows) { r.items.sort((a, b) => a.minX - b.minX); ordered.push(...r.items); }

    /* --- 下にくっついた名前の行を切り落とす ---
     * 名前の文字は絵のすぐ下に書かれていて、光のにじみで絵と繋がることがある。
     * 繋がるとその文字まで1体ぶんの囲みに入ってしまう。
     * 囲みの下のほうに横一列の切れ目があり、その下が小さければ、そこで切る。 */
    for (const it of ordered) {
      const y2 = trimName(it.minX, it.maxX, it.minY, it.maxY);
      if (y2 < it.maxY) { it.maxY = y2; it.h = it.maxY - it.minY + 1; }
    }

    /* --- 手で指定された分け方を当てる ---
     * 触れ合っていて機械では分けきれない絵を、割合の位置で切る。 */
    if (Object.keys(CUTS).length) {
      const out2 = [];
      ordered.forEach((it, idx) => {
        const at2 = CUTS[idx + 1];
        if (!at2 || !at2.length) { out2.push(it); return; }
        const xs = [0, ...at2.map(v => Math.round(it.w * v)), it.w];
        for (let k = 0; k + 1 < xs.length; k++) {
          let a = w, b2 = -1, t = h, u = -1, n2 = 0;
          for (let y = it.minY; y <= it.maxY; y++) {
            for (let x = it.minX + xs[k]; x < it.minX + xs[k + 1]; x++) {
              if (bg[y * w + x]) continue;
              n2++;
              if (x < a) a = x; if (x > b2) b2 = x;
              if (y < t) t = y; if (y > u) u = y;
            }
          }
          if (b2 < 0) continue;
          out2.push({ minX: a, minY: t, maxX: b2, maxY: u, w: b2 - a + 1, h: u - t + 1, n: n2 });
        }
      });
      ordered.length = 0;
      ordered.push(...out2);
    }

    /* --- 背景を透明にして、1体ずつ書き出す --- */
    for (let i = 0; i < w * h; i++) if (bg[i]) d[i * 4 + 3] = 0;
    cx.putImageData(id, 0, 0);

    const out = [];
    const pad = 4;
    for (const it of ordered) {
      const bw = it.w + pad * 2, bh = it.h + pad * 2;
      const o = document.createElement('canvas'); o.width = bw; o.height = bh;
      o.getContext('2d').drawImage(c, it.minX - pad, it.minY - pad, bw, bh, 0, 0, bw, bh);
      out.push({ png: o.toDataURL('image/png'), w: it.w, h: it.h, x: it.minX, y: it.minY });
    }

    /* --- 番号入りの確認用 --- */
    const pv = document.createElement('canvas'); pv.width = w; pv.height = h;
    const px = pv.getContext('2d');
    px.fillStyle = '#1d1636'; px.fillRect(0, 0, w, h);
    px.drawImage(c, 0, 0);
    px.font = 'bold 22px sans-serif'; px.textBaseline = 'top';
    ordered.forEach((it, i) => {
      px.strokeStyle = '#f2c14e'; px.lineWidth = 2;
      px.strokeRect(it.minX - 2, it.minY - 2, it.w + 4, it.h + 4);
      const label = String(i + 1);
      px.fillStyle = '#f2c14e'; px.fillRect(it.minX - 2, it.minY - 26, 14 + label.length * 12, 24);
      px.fillStyle = '#1d1636'; px.fillText(label, it.minX + 4, it.minY - 24);
    });

    return { w, h, count: out.length, items: out, preview: pv.toDataURL('image/png') };
  })();
}

(async () => {
  if (!fs.existsSync(src)) { console.error(`入力が見つかりません: ${src}`); process.exit(1); }
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const url = `data:${MIME[path.extname(src).toLowerCase()] || 'image/png'};base64,`
    + fs.readFileSync(src).toString('base64');
  const r = await page.evaluate(cut, { url, MIN_H, TOL, ERODE, CUTS, BOXES, GROW });
  await browser.close();

  if (r.error) { console.error(r.error); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });
  r.items.forEach((it, i) => {
    const name = String(i + 1).padStart(2, '0') + '.png';
    fs.writeFileSync(path.join(outDir, name), Buffer.from(it.png.split(',')[1], 'base64'));
  });
  fs.writeFileSync(path.join(outDir, '_一覧.png'),
    Buffer.from(r.preview.split(',')[1], 'base64'));

  console.log(`\n  ${path.basename(src)}（${r.w}×${r.h}）から ${r.count} 体を切り出しました`);
  const hs = r.items.map(i => i.h);
  console.log(`  高さ: ${Math.min(...hs)}〜${Math.max(...hs)}px`);
  console.log(`  出し先: ${outDir}/01.png 〜 ${String(r.count).padStart(2, '0')}.png`);
  console.log(`  番号入りの確認用: ${outDir}/_一覧.png`);
  if (flags.saveBoxes) {
    const boxes = r.items.map(it => ({ x: it.x, y: it.y, w: it.w, h: it.h }));
    fs.writeFileSync(flags.saveBoxes, JSON.stringify(boxes));
    console.log(`  囲みの位置: ${flags.saveBoxes}（--boxes で他の一覧表にも使えます）`);
  }
  console.log('');
})().catch(e => { console.error('切り出しに失敗:', e.message); process.exit(1); });
