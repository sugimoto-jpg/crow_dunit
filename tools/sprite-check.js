/* ===== 描画が変わっていないかを確かめる =====
 * 見た目の作りを整理するとき、「整理しただけのつもりが絵が変わっていた」
 * を防ぐため、全25職・全32体のSVGをそのまま書き出して突き合わせる。
 *
 *   node tools/sprite-check.js --save    いまの状態を基準として保存
 *   node tools/sprite-check.js --check   基準と一致するか確かめる（違えば失敗）
 *
 * 基準は tools/sprite-baseline.json。
 * 意図して絵を変えたときは --save で基準を更新する。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const BASE = path.join(__dirname, 'sprite-baseline.json');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const MODE = process.argv.includes('--save') ? 'save' : 'check';

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

/* 空白の違いは見た目に影響しないので、詰めてから比べる。
 * そうしないと、行を1つ足しただけで「絵が変わった」と出てしまう。 */
const norm = s => String(s).replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
const hash = s => crypto.createHash('sha1').update(norm(s)).digest('hex').slice(0, 12);

(async () => {
  const { srv, port } = await serve();
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => fs.existsSync(p));
  if (!exe) throw new Error('Chromium が見つかりません');
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForSelector('.title-logo');

  const out = await page.evaluate(() => {
    /* この照合は「コードで描く絵（SVG）が変わっていないか」を見るためのもの。
     * 画像素材が入っていると <img> に置き換わって比べられなくなるので、
     * 一時的に画像の一覧を空にして、SVG の側だけを測る。
     * 画像側の検証は tools/art-test.js が受け持つ。 */
    G.ART_MANIFEST = {};
    G.State.newGame('基準', 'normal');
    const res = { jobs: {}, enemies: {} };
    /* 武器の違いで絵が変わるので、全ての武器の形を1つずつ試す */
    const SHAPES = ['sword', 'dagger', 'staff', 'mace', 'bow', 'stick'];
    const WEAP = {};
    for (const [id, it] of Object.entries(G.ITEMS)) if (it.shape && !WEAP[it.shape]) WEAP[it.shape] = id;
    for (const jobId of Object.keys(G.JOBS)) {
      for (const sh of SHAPES) {
        const c = G.Char.create({ key: 'player', name: 'x', icon: '🧑', isPlayer: true });
        c.jobId = jobId;
        c.equip.weapon = WEAP[sh] || null;
        res.jobs[`${jobId}/${sh}`] = G.Sprite.hero(c);
      }
    }
    /* 仲間ごとの色違いも確かめる */
    for (const key of ['riina', 'velt', 'noa']) {
      const c = G.Char.create({ key, name: 'x', icon: '🧑' });
      c.jobId = 'villager';
      res.jobs[`${key}/tint`] = G.Sprite.hero(c);
    }
    for (const [id, e] of Object.entries(G.ENEMIES)) {
      res.enemies[id] = G.Sprite.enemy({ enemyId: id, uid: 'u', name: e.name, isBoss: !!e.boss });
    }
    return res;
  });

  await browser.close();
  srv.close();

  const now = {};
  for (const [k, v] of Object.entries(out.jobs)) now['job:' + k] = hash(v);
  for (const [k, v] of Object.entries(out.enemies)) now['foe:' + k] = hash(v);
  const count = Object.keys(now).length;

  if (MODE === 'save') {
    fs.writeFileSync(BASE, JSON.stringify(now, null, 1));
    console.log(`  ✅ いまの描画を基準として保存しました（${count} 通り）`);
    console.log(`     ${path.relative(ROOT, BASE)}`);
    return;
  }

  if (!fs.existsSync(BASE)) {
    console.log('  ⚠ 基準がありません。先に --save を実行してください。');
    process.exit(1);
  }
  const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
  const changed = [], added = [], removed = [];
  for (const k of Object.keys(now)) {
    if (!(k in base)) added.push(k);
    else if (base[k] !== now[k]) changed.push(k);
  }
  for (const k of Object.keys(base)) if (!(k in now)) removed.push(k);

  if (!changed.length && !added.length && !removed.length) {
    console.log(`  ✅ 描画に変化なし（${count} 通りすべて一致）`);
    return;
  }
  console.log(`  ⚠ 描画が変わっています（${count} 通り中）`);
  if (changed.length) {
    console.log(`\n  変わったもの ${changed.length} 件`);
    for (const k of changed.slice(0, 40)) console.log(`    ${k}`);
    if (changed.length > 40) console.log(`    … ほか ${changed.length - 40} 件`);
  }
  if (added.length) console.log(`\n  増えたもの ${added.length} 件: ${added.slice(0, 10).join(', ')}`);
  if (removed.length) console.log(`\n  無くなったもの ${removed.length} 件: ${removed.slice(0, 10).join(', ')}`);
  console.log('\n  意図した変更であれば --save で基準を更新してください。');
  process.exit(1);
})().catch(e => { console.error('実行中に失敗:', e.stack || e.message); process.exit(1); });
