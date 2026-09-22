/* ===== 終盤フローの動作確認 =====
 * 試験→卒業→魔王城→真魔王→エンディングは通常操作では到達に時間がかかるため、
 * 状態を進めた上で、実際の画面操作を通して確認する。
 *
 * 画面には「モーダル」「ストーリー」「戦闘」「通常画面」の4状態しかないので、
 * いま何が出ているかを見て次の一手を決める pump() で一貫して進める。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end(); return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(fs.readFileSync(file));
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

const errors = [];
const step = s => console.log('  ' + s);

(async () => {
  const { srv, port } = await serve();
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => fs.existsSync(p));
  if (!exe) throw new Error('Chromium が見つかりません');
  const browser = await chromium.launch({ executablePath: exe, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  const shot = async n => {
    const p = path.join(ROOT, 'tools/shots', n + '.png');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    await page.screenshot({ path: p });
  };
  const has = async sel => (await page.locator(sel).count()) > 0;
  const modalOpen = async () => (await page.locator('#modal:not(.hidden)').count()) > 0;
  const tap = async loc => { await loc.click({ force: true }); await page.waitForTimeout(160); };

  /* 戦闘で1手だけ進める。
   * 回復も蘇生もせずに殴り続けると当然負けるので、
   * 「そこそこ賢いプレイヤー」として、倒れた仲間の蘇生 → 回復 → 攻撃 の順に判断する。 */
  const battleStep = async () => {
    if (!(await has('[data-act="atk"]'))) { await page.waitForTimeout(120); return; }
    await tap(page.locator('[data-act="skill"]'));
    const ids = await page.$$eval('[data-act="sk"]:not([disabled])', els => els.map(e => e.dataset.id));

    const plan = await page.evaluate(list => {
      const b = G.BattleUI.bs.b;
      const actor = G.Battle.unitById(b, b.order[b.cursor]);
      const foes = G.Battle.livingEnemies(b);
      if (!actor || !foes.length) return null;
      const allies = b.allies;
      const dead = allies.find(a => a.hp <= 0);
      const hurt = allies.filter(a => a.hp > 0)
        .sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
      const ofKind = k => list.map(id => ({ id, sk: G.SKILLS[id] })).filter(x => x.sk && x.sk.kind === k);

      const holds = id => G.State.countItem(id) > 0;

      // 1. 倒れた仲間がいれば蘇生する（技がなければ道具で）
      if (dead) {
        const rev = list.map(id => ({ id, sk: G.SKILLS[id] })).find(x => x.sk && x.sk.revive);
        if (rev) return { id: rev.id, target: dead.uid, why: '蘇生' };
        if (holds('phoenix_tail')) return { item: 'phoenix_tail', target: dead.uid, why: '蘇生(道具)' };
      }
      // 2. 大きく削られている仲間がいれば回復する（技がなければ道具で）
      if (hurt && hurt.hp < hurt.maxHp * 0.5) {
        const heals = ofKind('heal').sort((a, c) => c.sk.power - a.sk.power);
        if (heals.length) {
          const h = heals[0];
          return { id: h.id, target: h.sk.target === 'allies' ? null : hurt.uid, why: '回復' };
        }
        for (const id of ['elixir', 'hi_potion', 'potion']) {
          if (holds(id)) return { item: id, target: hurt.uid, why: '回復(道具)' };
        }
      }
      // 3. それ以外は期待ダメージが最大の技
      let top = null, td = 0;
      for (const id of list) {
        const sk = G.SKILLS[id];
        if (!sk || !['phys', 'mag', 'hybrid'].includes(sk.kind)) continue;
        const ts = sk.target === 'all' ? foes : [foes[0]];
        let d = 0;
        for (const t of ts) d += G.Battle.calcDamage(actor, t, sk).amount * (sk.hits || 1);
        if (d > td) { td = d; top = id; }
      }
      return top ? { id: top, target: null, why: '攻撃' } : null;
    }, ids);

    if (plan && plan.id) {
      await tap(page.locator(`[data-act="sk"][data-id="${plan.id}"]`));
    } else if (plan && plan.item) {
      // 技で賄えないときは道具を使う（実プレイヤーなら当然使う）
      await tap(page.locator('[data-act="back"]'));
      await tap(page.locator('[data-act="item"]'));
      const it = page.locator(`[data-act="it"][data-id="${plan.item}"]`);
      if (await it.count()) await tap(it.first());
      else { await tap(page.locator('[data-act="back"]')); await tap(page.locator('[data-act="atk"]')); }
    } else {
      await tap(page.locator('[data-act="back"]'));
      await tap(page.locator('[data-act="atk"]'));
    }

    // 対象選択が出たら選ぶ（蘇生対象は .down、それ以外は .selectable）
    const downed = page.locator(`#party .unit[data-uid="${plan && plan.target}"]`);
    if (plan && plan.item === 'phoenix_tail' && await downed.count()) {
      await tap(downed.first());
    } else if (await has('#field .unit.selectable')) {
      await tap(page.locator('#field .unit.selectable').first());
    } else if (await has('#party .unit.selectable')) {
      const want = plan && plan.target
        ? page.locator(`#party .unit.selectable[data-uid="${plan.target}"]`) : null;
      if (want && await want.count()) await tap(want);
      else await tap(page.locator('#party .unit.selectable').first());
    }
    await page.waitForTimeout(90);
  };

  /* done() が真になるまで、画面の状態に応じて自動で進める */
  const pump = async (done, { cap = 400, onIdle = null, prefer = null, label = '' } = {}) => {
    for (let i = 0; i < cap; i++) {
      if (await done()) return true;
      // どこで詰まっているか分かるよう、定期的に画面の状態を出す
      if (label && i % 25 === 0) {
        const w = await page.evaluate(() => {
          const m = document.getElementById('modal');
          const inBattle = !!document.querySelector('.scene');
          return {
            screen: G.UI.current,
            modal: m && !m.classList.contains('hidden')
              ? (document.getElementById('modal-title').textContent || '(無題)') : null,
            story: !!document.querySelector('[data-act="next"]'),
            foes: inBattle && G.BattleUI.bs
              ? G.BattleUI.bs.b.enemies.map(e => `${e.name} ${e.hp}/${e.maxHp}`).join(' / ') : '',
            hp: inBattle && G.BattleUI.bs
              ? G.BattleUI.bs.b.allies.map(a => a.hp).join(',')
              : G.State.d.party.map(c => c.hp).join(','),
          };
        });
        console.log(`    [${label} ${String(i).padStart(3)}] 画面=${w.screen}`
          + ` モーダル=${w.modal || 'なし'}${w.story ? ' 物語中' : ''}`
          + `${w.foes ? ' 敵=' + w.foes : ''} 味方HP=${w.hp}`);
      }

      if (await modalOpen()) {
        const btns = page.locator('#modal-actions .btn');
        let clicked = false;
        if (prefer) {
          const b = page.locator('#modal-actions .btn', { hasText: prefer });
          if (await b.count()) { await tap(b.first()); clicked = true; }
        }
        if (!clicked) await tap(btns.last());   // 既定は否定側＝閉じる
        continue;
      }
      if (await has('[data-act="next"]')) { await tap(page.locator('[data-act="next"]')); continue; }
      if (await has('.scene')) { await battleStep(); continue; }
      if (onIdle) { await onIdle(); continue; }
      await page.waitForTimeout(150);
    }
    return await done();
  };

  console.log('▼ 終盤フロー');
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForSelector('.title-logo');

  /* 最終学期の直前まで状態を進める */
  await page.evaluate(() => {
    G.State.newGame('終盤テスト');
    for (const k of ['riina', 'velt', 'noa']) G.State.recruit(k);
    for (const j of ['apprentice_knight', 'swordsman', 'magic_swordsman', 'sword_saint']) {
      while (G.State.d.player.level < G.JOBS[j].req) G.Char.levelUp(G.State.d.player);
      G.Char.changeJob(G.State.d.player, j);
    }
    for (const c of G.State.d.party) {
      while (c.level < 52) { G.Char.levelUp(c); let g = 0; while (G.Char.autoJob(c) && g++ < 6); }
      G.Char.fullRestore(c);
    }
    for (const id of G.SUBJECT_IDS) G.State.d.subjects[id] = 100;
    Object.assign(G.State.d, { gold: 300000, term: 8, examAvailable: true, tuitionPaid: true });
    G.State.d.battleSpeed = 3;   // 演出を瞬速にして検証時間を詰める
    Object.assign(G.State.d.guild, { registered: true, rank: 6, totalClears: 40 });
    G.State.setFlag('awaken');
    G.State.save();
    G.UI.setChromeVisible(true);
    G.UI.show('academy');
  });
  await page.waitForSelector('[data-act="exam"]');
  step('最終学期の学院画面を表示');

  /* 卒業試験 → 卒業 */
  await tap(page.locator('[data-act="exam"]'));
  const graduated = await pump(() => page.evaluate(() => G.State.d.graduated && G.UI.current === 'home'), { cap: 120, label: '卒業' });
  const grad = await page.evaluate(() => ({
    graduated: G.State.d.graduated, unlocked: G.State.d.demon.unlocked,
    sword: G.State.countItem('excalibur'), proof: G.State.countItem('hero_proof'),
  }));
  if (!grad.graduated) errors.push('卒業できていない');
  if (!grad.unlocked) errors.push('魔王領が解禁されていない');
  if (!grad.sword || !grad.proof) errors.push('卒業記念品が渡されていない');
  step(`卒業: 到達=${graduated} 魔王領解禁=${grad.unlocked} 聖剣=${grad.sword} 勇者の証=${grad.proof}`);
  await shot('11-graduate');

  /* 装備を整えて魔王城の最上階へ */
  await page.evaluate(() => {
    const d = G.State.d;
    // 役割に合った装備を配る。
    // 剣士に杖を持たせるような配り方をすると、ゲーム側の問題と区別がつかなくなる。
    const LOADOUT = {
      player: ['excalibur', 'dragon_mail', 'hero_proof'],
      riina:  ['world_tree_staff', 'star_robe', 'mana_pendant'],
      velt:   ['flame_tongue', 'dragon_mail', 'life_amulet'],
      noa:    ['shadow_fang', 'shadow_garb', 'swift_boots'],
    };
    for (const c of d.party) {
      for (const id of (LOADOUT[c.key] || [])) {
        G.State.addItem(id);
        G.Char.equipItem(c, id);
      }
      while (c.level < 62) { G.Char.levelUp(c); let g = 0; while (G.Char.autoJob(c) && g++ < 6); }
      G.Char.fullRestore(c);
    }
    for (const id of ['elixir', 'hi_potion', 'phoenix_tail']) G.State.addItem(id, 20);
    d.demon.floor = G.World.DEMON_FLOORS.length - 1;
    d.demon.cleared = [0, 1, 2, 3, 4];
    G.UI.show('demon');
  });
  await page.waitForSelector('[data-act="floor"]');
  await shot('12-demon');
  step('魔王城の階層一覧を表示');

  /* 魔王を倒した後に真魔王へ負けたら、再挑戦は真魔王から始まること */
  await page.evaluate(() => {
    G.State.setFlag('met_demon_lord');
    G.State.setFlag('demon_lord_down');
    G.UI.show('demon');
  });
  await tap(page.locator('[data-act="floor"]').last());
  await page.waitForTimeout(250);
  const b = page.locator('#modal-actions .btn', { hasText: '戦う' });
  if (await b.count()) await tap(b.first());
  await page.waitForSelector('.scene', { timeout: 8000 });
  const foe = await page.evaluate(() => G.BattleUI.bs.b.enemies[0].enemyId);
  if (foe !== 'demon_lord_2') {
    errors.push(`魔王を倒した後の再挑戦なのに ${foe} と戦わされている`);
  } else {
    step('魔王撃破後の再挑戦は真魔王から始まる');
  }
  // 検証用の状態を戻して、本来の流れをやり直す
  await page.evaluate(() => {
    G.State.setFlag('demon_lord_down', false);
    G.State.restParty();
    G.UI.el('nav').classList.remove('hidden');
    G.UI.show('demon');
  });
  await page.waitForSelector('[data-act="floor"]');

  /* 魔王 → 真魔王 → エンディング。全滅したら立て直して再挑戦する。 */
  const enterTop = async () => {
    if (await has('[data-act="floor"]')) { await tap(page.locator('[data-act="floor"]').last()); return; }
    await page.evaluate(() => { G.State.restParty(); G.State.d.ap = 3; G.UI.show('demon'); });
    await page.waitForTimeout(200);
  };
  const cleared = await pump(() => page.evaluate(() => G.State.d.ending),
    { cap: 900, onIdle: enterTop, prefer: '戦う', label: '魔王城' });
  step(`魔王討伐: ${cleared ? '達成' : '未達成'}`);

  await pump(() => page.evaluate(() => !document.querySelector('[data-act="next"]')), { cap: 60 });
  await shot('13-ending');

  const fin = await page.evaluate(() => ({ ending: G.State.d.ending, lv: G.State.d.player.level }));
  if (!fin.ending) errors.push('エンディングに到達できなかった');
  step(`エンディング到達: ${fin.ending} (Lv${fin.lv})`);

  await browser.close();
  srv.close();
  if (errors.length) {
    console.log(`\n❌ ${errors.length} 件の問題\n` + errors.map(e => '  - ' + e).join('\n'));
    process.exit(1);
  }
  console.log('✅ エラーなし');
})().catch(e => {
  console.error('\n❌ 実行中に失敗:', e.message);
  if (errors.length) console.error(errors.map(x => '  - ' + x).join('\n'));
  process.exit(1);
});
