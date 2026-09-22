/* ===== BGMの見本を音声ファイルにする =====
 * 実際にゲームで鳴るのと同じ経路で書き出すので、
 * 聴いた見本と実際の音がずれない。
 *
 *   node tools/export-music.js
 *   → dist/bgm-見本.wav（7曲を順に、各8秒）
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const SEC = 7;                       // 1曲あたりの長さ
/* 見本は 22050Hz で書き出す。ファイルが半分になり、
 * ファミコン風の音にはこれで十分。ゲーム中の音は端末に合わせた品質で鳴る。 */
const OUT_RATE = 22050;
const NAMES = {
  bgm_title: 'タイトル', bgm_academy: '学院', bgm_town: '街・ギルド', bgm_field: '探索',
  bgm_battle: '戦闘', bgm_boss: 'ボス戦', bgm_final: '決戦',
};

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

/* 16bit の WAV にまとめる */
function toWav(samples, rate) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

(async () => {
  const { srv, port } = await serve();
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForSelector('.title-logo');

  const ids = await page.evaluate(() => Object.keys(G.MUSIC));
  const rate = OUT_RATE;
  /* 配列をまとめて展開（push(...arr)）すると、
   * 数十万個で呼び出しの上限を超えて落ちる。塊のまま持って最後に繋ぐ。 */
  const chunks = [];
  for (const id of ids) {
    const data = await page.evaluate(async (a) => {
      const b = await G.Audio.renderTo(a.sec, a.id, a.rate);
      return b ? Array.from(b.getChannelData(0)) : null;
    }, { id, sec: SEC, rate });
    if (!data) { console.log(`  ⚠ ${id} を書き出せませんでした`); continue; }
    /* 曲の切れ目で音が途切れて聞こえるよう、前後を少しなめらかにする */
    const fade = Math.round(rate * 0.12);
    for (let i = 0; i < fade; i++) {
      data[i] *= i / fade;
      data[data.length - 1 - i] *= i / fade;
    }
    chunks.push(Float32Array.from(data));
    chunks.push(new Float32Array(Math.round(rate * 0.4)));    // 曲間の間
    console.log(`  ${NAMES[id] || id}（${id}）`);
  }

  fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
  const out = path.join(ROOT, 'dist/bgm-見本.wav');
  let total = 0;
  for (const c of chunks) total += c.length;
  const all = new Float32Array(total);
  let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.length; }
  fs.writeFileSync(out, toWav(all, rate));
  console.log(`\n  dist/bgm-見本.wav  ${Math.round(fs.statSync(out).size / 1024)}KB  （${ids.length}曲 × ${SEC}秒）`);

  await browser.close();
  srv.close();
})().catch(e => { console.error('実行中に失敗:', e.stack || e.message); process.exit(1); });
