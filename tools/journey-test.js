/* ===== 探索から依頼達成までを通しで確かめる =====
 * 村 → 草原 → 森 → 洞窟 → ボスの間 → ボス戦 → 依頼達成
 * を、実際のブラウザで最後まで通す。
 *
 *   node tools/journey-test.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
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

const T0 = Date.now();
const tick = m => console.log(`    [${((Date.now() - T0) / 1000).toFixed(1)}s] ${m}`);
const ok = [], ng = [];
const check = (cond, label, extra) => {
  (cond ? ok : ng).push(label + (cond || !extra ? '' : ` … ${extra}`));
  console.log(`  ${cond ? '✅' : '❌'} ${label}${!cond && extra ? `  ← ${extra}` : ''}`);
};

/* 戦闘が出たら勝つまで「たたかう」を押す。戻り値は戦闘したか。
 *
 * 画面の状態を1つずつ問い合わせると往復が多くて非常に遅い。
 * 1回の問い合わせでまとめて見るようにしてある。 */
const look = page => page.evaluate(() => ({
  battle: !!document.querySelector('.scene'),
  map: !!document.querySelector('.mapboard'),
  trip: !!document.querySelector('.trip-bar'),
  modal: !!document.querySelector('#modal:not(.hidden)'),
  cmd: !!document.querySelector('[data-act="atk"]'),
  pick: !!document.querySelector('#field .unit.selectable'),
}));

async function closeModals(page) {
  for (let k = 0; k < 10; k++) {
    const st = await look(page);
    if (!st.modal) return;
    await page.evaluate(() => {
      const bs = document.querySelectorAll('#modal-actions .btn');
      if (bs.length) bs[bs.length - 1].click();
    });
    await page.waitForTimeout(120);
  }
}

async function fightIfAny(page) {
  if (!(await look(page)).battle) return false;
  /* 戦闘の操作はブラウザの中で回す。
   * 1手ごとに node とやりとりすると、通しテストが何分もかかってしまう。 */
  await page.evaluate(() => new Promise(res => {
    let t = 0;
    const tick = () => {
      if (++t > 3000) return res('timeout');
      if (document.querySelector('#modal:not(.hidden)')) return res('end');
      const pick = document.querySelector('#field .unit.selectable');
      if (pick) pick.click();
      else {
        const atk = document.querySelector('[data-act="atk"]');
        if (atk) atk.click();
      }
      setTimeout(tick, 20);
    };
    tick();
  }));
  await closeModals(page);
  return true;
}

/* 戦闘に入るか、地図に着くまでブラウザの中で待つ。 */
const waitStep = page => page.evaluate(() => new Promise(res => {
  let t = 0;
  const tick = () => {
    if (document.querySelector('.scene')) return res('battle');
    if (document.querySelector('.mapboard')) return res('map');
    if (++t > 1500) return res('timeout');
    setTimeout(tick, 20);
  };
  tick();
}));

/* 目的地へ向けて歩く。到着するまで区間を進む。 */
async function travelTo(page, toId, log) {
  for (let hop = 0; hop < 12; hop++) {
    const at = await page.evaluate(() => G.Explore.here().id);
    if (at === toId) return true;
    const next = await page.evaluate(id => {
      const route = G.Explore.routeTo(id);
      const i = route.indexOf(G.Explore.here().id);
      return (i >= 0 && route[i + 1]) || null;
    }, toId);
    if (!next) return false;

    tick(`出発 → ${next}`);
    /* depart() は確認のモーダルの返事を待つことがあるので、返り値は待たない */
    await page.evaluate(id => { G.MapUI.depart(id); }, next);
    await page.waitForSelector('.trip-bar', { timeout: 8000 });
    await page.evaluate(() => { G.TravelUI.fast = true; });

    let fights = 0;
    for (let i = 0; i < 20; i++) {
      const where = await waitStep(page);
      if (where === 'battle') {
        tick('戦闘');
        await fightIfAny(page);
        fights++;
        tick('戦闘おわり');
        /* 1戦ごとにHP・MPを戻す。
         * いまの探索には道中の回復手段がなく、自動の操作は道具も特技も
         * 使わないので、放っておくと連戦でボスの前に全滅してしまう。
         * ここで確かめたいのは「歩ける・遭遇する・着く」ことなので、
         * 強さの釣り合いは別（tools/balance.js）で測る。 */
        await page.evaluate(() => { for (const c of G.State.d.party) G.Char.fullRestore(c); });
        await page.waitForTimeout(120);
        const st = await look(page);
        if (st.trip) { await page.evaluate(() => { G.TravelUI.fast = true; }); continue; }
        break;                              // 到着、または全滅して地図へ
      }
      break;                                // 到着
    }
    await closeModals(page);                // 到着時の依頼のモーダル
    const now = await page.evaluate(() => G.Explore.here().id);
    log.push(`${next}（戦闘${fights}回）`);
    if (now === 'village_01' && next !== 'village_01') return false;   // 全滅して戻された
  }
  return false;
}

(async () => {
  const { srv, port } = await serve();
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForSelector('.title-logo');

  /* ボスに挑める強さのパーティを用意する（探索の検証が目的のため） */
  await page.evaluate(() => {
    G.State.newGame('探検家', 'normal');
    for (const k of ['riina', 'velt', 'noa']) G.State.recruit(k);
    for (const c of G.State.d.party) {
      /* 道中は回復せずに連戦するので、余裕のある強さにしておく。
       * （自動の戦闘は道具を使わないため、実際に遊ぶときより不利） */
      while (c.level < 32) { G.Char.levelUp(c); let g = 0; while (G.Char.autoJob(c) && g++ < 6); }
      G.Char.fullRestore(c);
    }
    Object.assign(G.State.d, { gold: 30000, battleSpeed: 3, ap: 3 });
    Object.assign(G.State.d.guild, { registered: true, rank: 2, totalClears: 8 });
    G.UI.setChromeVisible(true);
    G.UI.show('guild');
  });
  /* 検証用に演出を最速にする（遊ぶときの速さは変えていない） */
  await page.evaluate(() => {
    G.BattleUI.SPEEDS[3].mult = 0.02;
    G.TravelUI.pace = () => 20;
  });
  await page.waitForTimeout(200);

  console.log('▼ 1. ギルドで依頼を受ける（ボスのいる目的地）\n');
  const quest = await page.evaluate(() => {
    /* 目的地にボスがいる依頼を選ぶ。
     * ボスのいない依頼は到達しただけで達成になるので、
     * そちらは 6章で別に確かめる。 */
    const q = G.QUESTS.find(x => {
      const t = G.Quest.targetOf(x);
      return G.SPOTS[t] && G.SPOTS[t].boss;
    });
    const r = G.Quest.accept(q);
    return { id: q.id, name: q.name, target: r.target, ap: G.State.d.ap };
  });
  check(!!quest.target, `依頼を受けると目的地が決まる（${quest.name} → ${quest.target}）`);
  check(quest.ap < 3, `行動力が消費される（3 → ${quest.ap}）`);

  await page.evaluate(() => G.UI.show('map'));
  await page.waitForSelector('.mapboard');
  const marker = await page.evaluate(() => document.querySelectorAll('.mp-node.is-target').length);
  check(marker === 1, '地図に目的地の印が出る', `${marker}件`);
  const routeShown = await page.evaluate(() => document.querySelectorAll('.mp-link.is-route').length);
  check(routeShown > 0, `目的地までの道順が光る（${routeShown}本）`);

  console.log('\n▼ 2. 歩いて目的地まで向かう\n');
  const log = [];
  const arrived = await travelTo(page, quest.target, log);
  check(arrived, `目的地に到達した（${log.join(' → ')}）`);
  const hp = await page.evaluate(() => G.State.d.party.map(c => `${c.name} ${c.hp}/${G.Char.maxHp(c)}`).join(' / '));
  tick(`到着時のHP：${hp}`);
  const atNow = await page.evaluate(() => G.Explore.here().id);
  check(atNow === quest.target, `いまいるのは目的地（${atNow}）`);
  const fought = log.some(x => !/戦闘0回/.test(x));
  check(fought, '道中で魔物と戦った', log.join(' / '));

  console.log('\n▼ 3. ボス戦\n');
  const before = await page.evaluate(() => ({
    gold: G.State.d.gold, cleared: G.State.d.explore.cleared.length,
    quest: G.State.d.quest.active,
  }));
  check(before.quest === quest.id, 'まだ依頼は達成されていない（ボスが残っている）');

  /* bossPrompt() は「進む／引き返す」の返事を待つ。
   * 待ち受けたまま evaluate すると、こちらが答えられず止まってしまうので、
   * 呼び出すだけにして返り値は待たない。 */
  await page.evaluate(() => { G.MapUI.bossPrompt(); });
  await page.waitForSelector('#modal:not(.hidden)', { timeout: 6000 });
  const promptText = await page.evaluate(() => document.getElementById('modal-body').textContent);
  check(/強大な魔力/.test(promptText), 'ボス地点の演出が出る', promptText.trim().slice(0, 60));
  await page.locator('#modal-actions .btn').first().click();     // 進む
  await page.waitForSelector('.scene', { timeout: 8000 });
  check(true, 'ボス戦が始まる');
  const canFlee = await page.evaluate(() => !!document.querySelector('[data-act="flee"]'));
  check(!canFlee, 'ボス戦からは逃げられない');

  await fightIfAny(page);
  await page.waitForTimeout(300);
  await closeModals(page);

  console.log('\n▼ 4. 依頼の達成と報酬\n');
  const after = await page.evaluate(() => ({
    gold: G.State.d.gold, cleared: G.State.d.explore.cleared,
    quest: G.State.d.quest.active, clears: G.State.d.guild.totalClears,
    screen: G.UI.current,
  }));
  check(after.cleared.includes('boss_01'), 'ボスの撃破が記録される', after.cleared.join(','));
  check(after.quest === null, '依頼が達成されて受注が外れる', String(after.quest));
  check(after.gold > before.gold, `報酬が入る（${before.gold} → ${after.gold} G）`);
  check(after.clears === 9, `ギルドの達成数が増える（${after.clears}件）`);
  check(after.screen === 'map', '探索の画面に戻っている', after.screen);

  console.log('\n▼ 5. 2周目\n');
  const again = await page.evaluate(() => {
    const g = G.State.d.gold;
    G.Explore.clearBoss('boss_01');
    return { same: G.State.d.gold === g };
  });
  check(again.same, '2回目のボス撃破で初回報酬は二重に入らない');

  console.log('\n▼ 6. ボスのいない依頼は、到達しただけで達成になる\n');
  const plain = await page.evaluate(() => {
    G.State.d.ap = 3;
    G.State.d.explore.at = 'village_01';
    const q = G.QUESTS.find(x => {
      const t = G.Quest.targetOf(x);
      return G.SPOTS[t] && !G.SPOTS[t].boss;
    });
    G.Quest.accept(q);
    const before = G.State.d.gold;
    /* 歩かずに到達した状態を作り、到達時の処理だけを確かめる */
    G.State.d.explore.at = G.State.d.quest.target;
    /* onReachedTarget はモーダルの返事を待つので、待たずに呼ぶ */
    G.Quest.onReachedTarget(G.State.d.quest.target);
    return { name: q.name, target: G.Quest.targetOf(q), before };
  });
  await page.waitForTimeout(300);
  await closeModals(page);
  const plainAfter = await page.evaluate(() => ({
    done: G.State.d.quest.active === null, gold: G.State.d.gold,
  }));
  plain.done = plainAfter.done;
  plain.gained = plainAfter.gold - plain.before;
  check(plain.done, `到達だけで達成になる（${plain.name} → ${plain.target}）`);
  check(plain.gained > 0, `報酬が入る（+${plain.gained} G）`);

  check(errs.length === 0, 'JSエラーなし', errs.slice(0, 3).join(' / '));

  await browser.close();
  srv.close();
  console.log(`\n▼ 判定：${ok.length} 件成功 / ${ng.length} 件失敗`);
  if (ng.length) { for (const s of ng) console.log(`  ❌ ${s}`); process.exit(1); }
  console.log('  ✅ 村からボス撃破・依頼達成まで通しで成立する');
})().catch(e => { console.error('実行中に失敗:', e.stack || e.message); process.exit(1); });
