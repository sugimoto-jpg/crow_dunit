/* 主要画面をまとめて撮る（見た目の確認用） */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const ENTRY = process.env.ENTRY || 'index.html';

(async () => {
  const srv = http.createServer((q, r) => {
    const f = path.join(ROOT, q.url === '/' ? ENTRY : q.url.split('?')[0]);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    r.end(fs.readFileSync(f));
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;

  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) console.log('CONSOLE:', m.text()); });

  const dir = path.join(ROOT, 'tools/shots/tour');
  fs.mkdirSync(dir, { recursive: true });
  const shot = async n => { await page.waitForTimeout(450); await page.screenshot({ path: path.join(dir, n + '.png') }); };

  await page.goto(`http://127.0.0.1:${port}/${ENTRY}`);
  await page.waitForSelector('.title-logo');
  await shot('00-title');

  /* 中盤の状態を作る（各ジョブの見た目を確認したいので装備も配る） */
  await page.evaluate(() => {
    G.State.newGame('アルト', 'normal');
    for (const k of ['riina', 'velt', 'noa']) G.State.recruit(k);
    for (const j of ['apprentice_knight', 'swordsman', 'magic_swordsman']) {
      while (G.State.d.player.level < G.JOBS[j].req) G.Char.levelUp(G.State.d.player);
      G.Char.changeJob(G.State.d.player, j);
    }
    const kit = {
      player: ['mithril_blade', 'plate_armor', 'power_ring'],
      riina:  ['holy_scepter', 'mage_robe', 'mana_pendant'],
      velt:   ['silver_sword', 'chain_mail', 'life_amulet'],
      noa:    ['assassin_edge', 'shadow_garb', 'swift_boots'],
    };
    for (const c of G.State.d.party) {
      for (const id of (kit[c.key] || [])) { G.State.addItem(id); G.Char.equipItem(c, id); }
      while (c.level < 32) { G.Char.levelUp(c); let g = 0; while (G.Char.autoJob(c) && g++ < 6); }
      G.Char.fullRestore(c);
    }
    for (const id of G.SUBJECT_IDS) G.State.d.subjects[id] = 62;
    Object.assign(G.State.d, { gold: 48000, term: 4, day: 68, battleSpeed: 3 });
    Object.assign(G.State.d.guild, { registered: true, rank: 4, totalClears: 18 });
    G.State.setFlag('awaken');
    G.State.d.tuitionPaid = true;
    for (const id of ['potion', 'hi_potion', 'ether', 'phoenix_tail']) G.State.addItem(id, 6);
    G.UI.setChromeVisible(true);
    G.UI.show('home');
  });
  await page.waitForSelector('.place');
  await shot('01-home');

  for (const [nav, name] of [['academy', '02-academy'], ['guild', '03-guild'], ['town', '04-town']]) {
    await page.evaluate(n => G.UI.show(n), nav);
    await page.waitForTimeout(250);
    await shot(name);
  }

  await page.evaluate(() => G.UI.show('status'));
  await shot('05-status');
  await page.evaluate(() => G.UI.show('job'));
  await shot('06-job');

  /* 歩行演出 */
  await page.evaluate(() => { G.UI.current = 'home'; G.UI.walkTo('town'); });
  await page.waitForTimeout(260);
  await page.screenshot({ path: path.join(dir, '07-walk.png') });
  await page.waitForTimeout(700);

  /* 戦闘（複数の敵） */
  await page.evaluate(() => G.BattleUI.start(['minotaur', 'wraith', 'skeleton'], { canFlee: true }));
  await page.waitForSelector('.scene');
  await page.waitForTimeout(1400);
  await shot('08-battle');

  /* ボス戦 */
  await page.evaluate(() => { G.UI.el('modal').classList.add('hidden'); G.BattleUI.start(['boss_flame_dragon'], { canFlee: false }); });
  await page.waitForSelector('.scene');
  await page.waitForTimeout(1400);
  await shot('09-boss');

  /* 魔王城 */
  await page.evaluate(() => {
    G.State.d.demon.unlocked = true; G.State.d.demon.floor = 3;
    G.State.d.graduated = true;
    G.UI.el('nav').classList.remove('hidden');
    G.UI.show('demon');
  });
  await shot('10-demon');

  /* 魔王 */
  await page.evaluate(() => G.BattleUI.start(['demon_lord_2'], { canFlee: false }));
  await page.waitForSelector('.scene');
  await page.waitForTimeout(1400);
  await shot('11-demonlord');

  await browser.close();
  srv.close();
  console.log('撮影完了: tools/shots/tour/');
})();
