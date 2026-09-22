/* ===== 実ブラウザでの通し動作確認 =====
 * 静的サーバを立てて Chromium で実際に操作し、
 * コンソールエラー・未処理例外が出ないことを確かめる。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(fs.readFileSync(file));
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

/* ENTRY で検証対象を差し替えられる。
 *   ENTRY=dist/tensei-arcana.html        … 1ファイル版をサーバ経由で
 *   ENTRY=dist/tensei-arcana.html FILE=1 … ダブルクリック相当（file://）で
 */
const ENTRY = process.env.ENTRY || 'index.html';
const USE_FILE = process.env.FILE === '1';

const errors = [];
const steps = [];
const step = s => { steps.push(s); console.log('  ' + s); };

(async () => {
  const { srv, port } = await serve();
  // 環境に用意済みの Chromium を使う（ダウンロードは不要）
  const fsx = require('fs');
  const CANDIDATES = [
    process.env.CHROMIUM_PATH,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome',
  ].filter(Boolean);
  const exe = CANDIDATES.find(p => fsx.existsSync(p));
  if (!exe) throw new Error('Chromium が見つかりません: ' + CANDIDATES.join(', '));
  const browser = await chromium.launch({ executablePath: exe, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  const shots = [];
  const shot = async name => {
    const p = path.join(ROOT, 'tools/shots', name + '.png');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    await page.screenshot({ path: p });
    shots.push(p);
  };

  const click = async (sel, timeout = 4000) => {
    await page.waitForSelector(sel, { timeout, state: 'visible' });
    await page.click(sel);
    await page.waitForTimeout(120);
  };
  const has = async sel => (await page.locator(sel).count()) > 0;

  /* ストーリーを最後まで送る */
  const advanceStory = async (cap = 80) => {
    for (let i = 0; i < cap; i++) {
      if (!(await has('[data-act="next"]'))) return;
      await page.click('[data-act="next"]');
      await page.waitForTimeout(80);
    }
  };
  /* モーダルが出ていたら最後のボタンで閉じる */
  const closeModal = async (cap = 12) => {
    for (let i = 0; i < cap; i++) {
      if (!(await page.locator('#modal:not(.hidden)').count())) return;
      await page.click('#modal-actions .btn:last-child');
      await page.waitForTimeout(150);
    }
  };

  console.log('▼ ブラウザ操作');
  const target = USE_FILE
    ? 'file://' + path.join(ROOT, ENTRY)
    : `http://127.0.0.1:${port}/${ENTRY}`;
  console.log(`  対象: ${target}`);
  await page.goto(target);
  await page.waitForSelector('.title-logo');
  step('タイトル画面が表示された');
  await shot('01-title');

  // 新規ゲーム
  await click('[data-act="new"]');
  await page.waitForSelector('#name-in');
  await page.fill('#name-in', 'テスト勇者');
  await click('#modal-actions .btn');
  // 難易度選択
  await page.waitForSelector('#modal [data-pick]');
  await click('#modal [data-pick="normal"]');
  step('名前と難易度を選んでゲーム開始');

  await advanceStory();
  await page.waitForTimeout(300);
  await closeModal();
  await page.waitForSelector('#hud:not(.hidden)', { timeout: 5000 });
  step('プロローグを再生し、拠点に到達');
  await shot('02-home');

  const state = async () => page.evaluate(() => ({
    name: G.State.d.player.name, lv: G.State.d.player.level, gold: G.State.d.gold,
    ap: G.State.d.ap, day: G.State.d.day, party: G.State.d.party.length,
    screen: G.UI.current,
  }));
  let s = await state();
  if (s.party !== 2) errors.push(`リィナが加入していない (party=${s.party})`);
  if (s.name !== 'テスト勇者') errors.push(`入力した名前が反映されていない (${s.name})`);
  const diff = await page.evaluate(() => G.State.d.difficulty);
  if (diff !== 'normal') errors.push(`難易度が保存されていない (${diff})`);
  step(`状態: ${s.name} Lv${s.lv} 所持金${s.gold}G パーティ${s.party}人`);

  // 学院：授業
  await click('#nav button[data-nav="academy"]');
  await page.waitForSelector('[data-act="lesson"]');
  await shot('03-academy');
  await click('[data-act="lesson"]');
  await closeModal();
  step('授業を受けた');
  s = await state();
  if (s.ap !== 2) errors.push(`授業でAPが減っていない (ap=${s.ap})`);

  // 学院：自習と訓練
  await click('[data-act="study"]');
  await closeModal();
  step('自習した');
  await click('[data-act="train"]');
  await closeModal();
  step('訓練した');

  // 休息して翌日へ
  await click('#nav button[data-nav="home"]');
  await click('[data-act="rest"]');
  await closeModal();
  await page.waitForTimeout(200);
  s = await state();
  if (s.day !== 2) errors.push(`休息で日付が進んでいない (day=${s.day})`);
  step(`休息して ${s.day}日目 / AP ${s.ap}`);

  // ギルド登録して依頼
  await click('#nav button[data-nav="guild"]');
  await click('[data-act="register"]');
  await page.waitForSelector('[data-act="quest"]');
  await shot('04-guild');
  step('冒険者登録した');

  await click('[data-act="quest"]');
  await click('#modal-actions .btn');   // 受注する
  await page.waitForSelector('.battle-field', { timeout: 6000 });
  step('依頼を受注して戦闘に入った');
  await page.waitForTimeout(600);
  await shot('05-battle');

  // 演出を速くして待ち時間を減らす
  await page.evaluate(() => { G.State.d.battleSpeed = 3; });

  // 戦闘：勝つか負けるまで「たたかう」を押し続ける
  let turns = 0;
  let hudChecked = false;
  for (; turns < 120; turns++) {
    if (await page.locator('#modal:not(.hidden)').count()) break;
    // 戦闘中もHUDのHPが戦闘ユニットの値を追っているか確かめる
    if (!hudChecked) {
      const chk = await page.evaluate(() => {
        const bs = G.BattleUI.bs;
        if (!bs) return null;
        const u = bs.b.allies.find(a => a.ref === G.State.d.player);
        if (!u || u.hp === u.maxHp) return null;   // まだ無傷なら判定しない
        return { unit: u.hp, hud: document.getElementById('hud-hp-text').textContent };
      });
      if (chk) {
        hudChecked = true;
        if (!chk.hud.startsWith(String(chk.unit))) {
          errors.push(`戦闘中のHUDが更新されていない (戦闘=${chk.unit} HUD=${chk.hud})`);
        } else step(`戦闘中のHUD表示を確認 (${chk.hud})`);
      }
    }
    if (await has('[data-act="atk"]')) {
      await page.click('[data-act="atk"]');
      await page.waitForTimeout(150);
      if (await has('#field .enemy.selectable')) {
        await page.locator('#field .enemy.selectable').first().click();
      }
    }
    await page.waitForTimeout(260);
  }
  if (turns >= 120) errors.push('戦闘が終わらなかった');
  const won = await page.locator('#modal-title').textContent().catch(() => '');
  step(`戦闘終了: ${won}`);
  await shot('06-result');
  await closeModal();
  await page.waitForTimeout(400);
  await closeModal();

  // 街・状態・ジョブ画面
  await click('#nav button[data-nav="town"]');
  await page.waitForSelector('[data-act="shop"]');
  await click('[data-act="shop"]');
  await page.waitForSelector('[data-act="buy"]');
  await shot('07-shop');
  step('店の品揃えを開いた');
  await click('[data-act="back"]');

  await click('#nav button[data-nav="status"]');
  await page.waitForSelector('.stat-grid');
  await shot('08-status');
  step('状態画面を開いた');

  // 装備変更
  await click('[data-act="equip"]');
  await page.waitForTimeout(200);
  await closeModal();
  step('装備画面を開いた');

  // レベルを上げてジョブ転職まで確認する
  await page.evaluate(() => {
    const r = G.State.partyExp(3000);
    void r;
    G.State.save();
  });
  await click('#nav button[data-nav="academy"]');
  await click('[data-act="job"]');
  await page.waitForSelector('.job-card');
  await shot('09-job');
  const jobs = await page.locator('.job-card[data-act="pick"]').count();
  if (jobs < 4) errors.push(`Lv5以上なのに転職候補が ${jobs} 件しかない`);
  step(`適性審査室に転職候補が ${jobs} 件`);
  await click('.job-card[data-act="pick"]');
  await click('#modal-actions .btn');   // このジョブになる
  await page.waitForTimeout(300);
  await closeModal();
  s = await state();
  const job = await page.evaluate(() => G.Char.jobName(G.State.d.player));
  if (job === '村人') errors.push('転職が反映されていない');
  step(`転職した: ${job}`);

  // セーブとロードの往復
  const canSave = await page.evaluate(() => {
    try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; }
    catch (e) { return false; }
  });
  if (!canSave) {
    step('この環境では保存領域が使えないため、続きからの確認は省略');
    await browser.close(); srv.close();
    console.log(`\n▼ 結果: ${steps.length} 手順を実行`);
    if (errors.length) { console.log(`\n❌ ${errors.length} 件の問題\n` + errors.map(e => '  - ' + e).join('\n')); process.exit(1); }
    console.log('✅ エラーなし');
    return;
  }
  await page.evaluate(() => G.State.save());
  await page.reload();
  await page.waitForSelector('.title-logo');
  await click('[data-act="continue"]');
  await page.waitForSelector('#hud:not(.hidden)');
  const after = await state();
  if (after.lv !== s.lv) errors.push(`ロード後にレベルが違う (${s.lv} -> ${after.lv})`);
  step(`リロード後もデータを復元: Lv${after.lv} ${after.day}日目`);
  await shot('10-reload');

  await browser.close();
  srv.close();

  console.log(`\n▼ 結果: ${steps.length} 手順を実行`);
  if (errors.length) {
    console.log(`\n❌ ${errors.length} 件の問題\n` + errors.map(e => '  - ' + e).join('\n'));
    process.exit(1);
  }
  console.log('✅ エラーなし');
  console.log('スクリーンショット: tools/shots/');
})().catch(e => {
  console.error('\n❌ 実行中に失敗:', e.message);
  console.error(errors.map(x => '  - ' + x).join('\n'));
  process.exit(1);
});
