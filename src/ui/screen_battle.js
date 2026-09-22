/* ===== 戦闘画面 ===== */
window.G = window.G || {};

const sleep = ms => new Promise(r => setTimeout(r, ms));

G.BattleUI = {
  bs: null,       // { b, opts }

  /* 演出の速さ。1手ごとに数秒かかると長期戦がつらいので切り替えられるようにする。 */
  SPEEDS: { 1: { label: 'ふつう', mult: 1 }, 2: { label: 'はやい', mult: 0.5 }, 3: { label: '瞬速', mult: 0.2 } },
  get speed() {
    const n = (G.State.data && G.State.data.battleSpeed) || 2;
    return (G.BattleUI.SPEEDS[n] || G.BattleUI.SPEEDS[2]).mult;
  },

  /* 戦闘を開始する。onEnd(out, result) が呼ばれる */
  start(enemyIds, opts = {}) {
    const b = G.Battle.init(enemyIds, opts);
    b.log = [];
    G.BattleUI.bs = { b, opts };
    G.UI.current = 'battle';
    G.UI.currentArgs = null;
    G.UI.el('nav').classList.add('hidden');

    if (opts.intro) G.BattleUI.log(opts.intro, 'sys');
    G.BattleUI.log(
      `${b.enemies.map(e => e.name).join('、')} が現れた！`, 'hi');
    G.BattleUI.render();
    G.BattleUI.run();
  },

  log(text, cls = '') {
    const b = G.BattleUI.bs.b;
    b.log.push({ text, cls });
    if (b.log.length > 60) b.log.shift();
  },

  /* ---------- 描画 ---------- */
  render(mode) {
    const { b } = G.BattleUI.bs;
    const host = G.UI.el('screen');
    host.innerHTML = `
      <div class="battle">
        <div class="battle-field" id="field">
          ${b.enemies.map(e => G.BattleUI.enemyHtml(e, mode)).join('')}
        </div>
        <div class="party-row" id="party">
          ${b.allies.map(a => G.BattleUI.allyHtml(a, mode)).join('')}
        </div>
        <div class="row" style="justify-content:flex-end;margin:-4px 0 -2px">
          <button class="btn sm ghost" data-act="speed">⏩ 演出 ${
            G.BattleUI.SPEEDS[(G.State.data && G.State.data.battleSpeed) || 2].label}</button>
        </div>
        <div class="battle-log" id="blog">
          ${b.log.map(l => `<div class="${l.cls}">${G.util.esc(l.text)}</div>`).join('')}
        </div>
        <div id="cmd"></div>
      </div>`;
    const lg = G.UI.el('blog');
    if (lg) lg.scrollTop = lg.scrollHeight;
    G.UI.on('speed', () => {
      const d = G.State.d;
      d.battleSpeed = d.battleSpeed >= 3 ? 1 : d.battleSpeed + 1;
      G.State.save();
      G.BattleUI.render(mode);
    });
    G.UI.updateHud();
  },

  enemyHtml(e, mode) {
    const pct = G.util.clamp(e.hp / e.maxHp, 0, 1) * 100;
    const st = Object.keys(e.status).map(s =>
      `<span class="st-badge">${G.STATUS[s].icon}</span>`).join('');
    const buffs = e.buffs.length ? '<span class="st-badge buff">▲</span>' : '';
    return `<div class="enemy ${e.hp <= 0 ? 'dead' : ''} ${mode === 'enemy' ? 'selectable' : ''}"
                 data-uid="${e.uid}" id="u-${e.uid}">
      <span class="sprite">${e.icon}</span>
      <div class="en-name">${G.util.esc(e.name)}</div>
      <div class="hpbar"><i style="width:${pct}%"></i></div>
      <div class="st-badges">${st}${buffs}</div>
    </div>`;
  },

  allyHtml(a, mode) {
    const hp = G.util.clamp(a.hp / a.maxHp, 0, 1) * 100;
    const mp = G.util.clamp(a.mp / Math.max(1, a.maxMp), 0, 1) * 100;
    const st = Object.keys(a.status).map(s =>
      `<span class="st-badge">${G.STATUS[s].icon}</span>`).join('');
    const buffs = a.buffs.length ? '<span class="st-badge buff">▲</span>' : '';
    const act = G.BattleUI.bs.activeUid === a.uid ? 'active' : '';
    const sel = (mode === 'ally' && a.hp > 0) || (mode === 'dead' && a.hp <= 0) ? 'selectable' : '';
    return `<div class="ally ${a.hp <= 0 ? 'down' : ''} ${act} ${sel}" data-uid="${a.uid}" id="u-${a.uid}">
      <div class="an"><span class="em">${a.icon}</span>${G.util.esc(a.name)}</div>
      <div class="ab">
        <div class="mini h"><i style="width:${hp}%"></i></div>
        <div class="mini m"><i style="width:${mp}%"></i></div>
      </div>
      <div class="nums"><span>HP ${Math.max(0, a.hp)}/${a.maxHp}</span><span>MP ${a.mp}/${a.maxMp}</span></div>
      <div class="st-badges">${st}${buffs}</div>
    </div>`;
  },

  /* ダメージ数値のポップアップ */
  popup(uid, text, color) {
    const el = document.getElementById('u-' + uid);
    if (!el) return;
    const host = G.UI.el('screen');
    const r = el.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'float-dmg';
    f.textContent = text;
    f.style.color = color;
    f.style.left = (r.left - hr.left + r.width / 2 - 18) + 'px';
    f.style.top = (r.top - hr.top + 8) + 'px';
    host.appendChild(f);
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 340);
    setTimeout(() => f.remove(), 900);
  },

  /* ---------- 演出 ---------- */
  async playEvents(events) {
    let prev = null;
    for (const ev of events) {
      if (ev.text) {
        const cls = ev.type === 'damage' || ev.type === 'dot' ? 'dmg'
          : ev.type === 'heal' || ev.type === 'revive' ? 'heal'
          : ev.type === 'down' ? 'bad'
          : ev.type === 'use' ? 'hi' : '';
        G.BattleUI.log(ev.text, cls);
      }
      G.BattleUI.render();
      if (ev.type === 'damage' && ev.amount > 0) {
        G.BattleUI.popup(ev.target.uid, '-' + ev.amount, ev.crit ? '#ffd96b' : '#ff9a6d');
      } else if (ev.type === 'dot') {
        G.BattleUI.popup(ev.target.uid, '-' + ev.amount, '#b6ff8a');
      } else if (ev.type === 'heal' && ev.amount > 0) {
        G.BattleUI.popup(ev.target.uid, '+' + ev.amount, '#7dffb0');
      } else if (ev.type === 'mp' && ev.amount > 0) {
        G.BattleUI.popup(ev.target.uid, '+' + ev.amount, '#7ad4ff');
      }
      // 多段ヒットの2発目以降は待ち時間を詰める（同じ演出が続くだけなので）
      const quick = ev.type === 'damage' && prev && prev.type === 'damage' && prev.target === ev.target;
      prev = ev;
      await sleep((quick ? 150 : 360) * G.BattleUI.speed);
    }
  },

  /* ---------- 本体ループ ---------- */
  async run() {
    const bs = G.BattleUI.bs;
    const b = bs.b;
    let guard = 0;

    while (!G.Battle.checkEnd(b) && guard++ < 400) {
      G.Battle.startRound(b);
      let u;
      while ((u = G.Battle.nextActor(b))) {
        if (G.Battle.checkEnd(b)) break;

        bs.activeUid = u.uid;
        const bt = G.Battle.beginTurn(b, u);
        await G.BattleUI.playEvents(bt.events);
        if (G.Battle.checkEnd(b)) break;

        if (bt.canAct) {
          let action;
          if (u.side === 'ally') {
            action = await G.BattleUI.askAction(u);
          } else {
            G.BattleUI.showCmd(`<div class="cmd-title">${G.util.esc(u.name)} の行動……</div>`);
            await sleep(420 * G.BattleUI.speed);
            action = G.Battle.enemyAction(b, u);
          }
          G.BattleUI.showCmd('');
          const ev = G.Battle.perform(b, u, action);
          await G.BattleUI.playEvents(ev);
        }

        const endEv = G.Battle.endTurn(b, u);
        await G.BattleUI.playEvents(endEv);
        G.Battle.advanceCursor(b);
        if (G.Battle.checkEnd(b)) break;
      }
    }
    bs.activeUid = null;
    G.BattleUI.render();
    await sleep(500);
    await G.BattleUI.finish();
  },

  showCmd(html) {
    const c = G.UI.el('cmd');
    if (c) c.innerHTML = html;
  },

  /* ---------- 行動選択 ---------- */
  askAction(u) {
    return new Promise(resolve => {
      const b = G.BattleUI.bs.b;
      G.BattleUI.render();

      const menu = () => {
        G.BattleUI.showCmd(`
          <div class="cmd-title">${G.util.esc(u.name)} は どうする？</div>
          <div class="btn-grid">
            <button class="btn primary" data-act="atk">⚔️ たたかう</button>
            <button class="btn" data-act="skill">✨ とくぎ</button>
            <button class="btn" data-act="item">🎒 どうぐ</button>
            <button class="btn" data-act="guard">🛡️ ぼうぎょ</button>
          </div>
          <button class="btn ghost mt" data-act="flee">🏃 にげる</button>`);

        G.UI.on('atk', () => pickTarget({ type: 'attack' }, 'enemy'));
        G.UI.on('guard', () => resolve({ type: 'guard' }));
        G.UI.on('flee', () => resolve({ type: 'flee' }));
        G.UI.on('skill', skillList);
        G.UI.on('item', itemList);
      };

      const skillList = () => {
        const silenced = G.Battle.hasStatus(u, 'silence');
        const rows = u.skills.map(id => {
          const s = G.SKILLS[id];
          if (!s) return '';
          const can = !silenced && u.mp >= s.mp;
          return `<button class="btn" data-act="sk" data-id="${id}" ${can ? '' : 'disabled'}>
            ${G.util.esc(s.name)} <span class="chip">MP ${s.mp}</span>
            <span class="btn-sub">${G.util.esc(s.desc || '')}</span></button>`;
        }).join('');
        G.BattleUI.showCmd(`
          <div class="cmd-title">${silenced ? '沈黙していて技が使えない' : 'とくぎを選ぶ'}</div>
          ${rows || '<p class="dim">使える技がない。</p>'}
          <button class="btn ghost mt" data-act="back">← もどる</button>`);
        G.UI.on('back', menu);
        G.UI.on('sk', ds => {
          const s = G.SKILLS[ds.id];
          const act = { type: 'skill', skillId: ds.id };
          if (s.target === 'self' || s.target === 'all' || s.target === 'allies') resolve(act);
          else if (s.target === 'ally') pickTarget(act, s.revive ? 'dead' : 'ally');
          else pickTarget(act, 'enemy');
        });
      };

      const itemList = () => {
        const list = G.State.itemsByType('consume');
        const rows = list.map(({ id, n, item }) =>
          `<button class="btn" data-act="it" data-id="${id}">
            ${item.icon} ${G.util.esc(item.name)} <span class="chip">×${n}</span>
            <span class="btn-sub">${G.util.esc(item.desc)}</span></button>`).join('');
        G.BattleUI.showCmd(`
          <div class="cmd-title">どうぐを選ぶ</div>
          ${rows || '<p class="dim">使える道具がない。</p>'}
          <button class="btn ghost mt" data-act="back">← もどる</button>`);
        G.UI.on('back', menu);
        G.UI.on('it', ds => {
          const it = G.ITEMS[ds.id];
          const act = { type: 'item', itemId: ds.id };
          if (it.use.escape) resolve(act);
          else if (it.use.revive) pickTarget(act, 'dead');
          else pickTarget(act, 'ally');
        });
      };

      /* 対象を選ぶ。候補が1つなら自動で決める */
      const pickTarget = (act, mode) => {
        const pool = mode === 'enemy' ? G.Battle.livingEnemies(b)
          : mode === 'dead' ? b.allies.filter(a => a.hp <= 0)
            : G.Battle.livingAllies(b);
        if (!pool.length) {
          G.UI.toast('対象がいない', 'bad');
          return menu();
        }
        if (pool.length === 1) { act.targetUid = pool[0].uid; return resolve(act); }

        G.BattleUI.render(mode);
        G.BattleUI.showCmd(`
          <div class="cmd-title">${mode === 'enemy' ? '相手' : '味方'}を選ぶ</div>
          <button class="btn ghost" data-act="back">← もどる</button>`);
        G.UI.on('back', menu);
        const sel = mode === 'enemy' ? '#field .enemy.selectable' : '#party .ally.selectable';
        document.querySelectorAll(sel).forEach(el => {
          el.addEventListener('click', () => { act.targetUid = el.dataset.uid; resolve(act); });
        });
      };

      menu();
    });
  },

  /* ---------- 決着 ---------- */
  async finish() {
    const bs = G.BattleUI.bs;
    const b = bs.b;
    const out = G.Battle.finish(b);
    G.UI.el('nav').classList.remove('hidden');

    if (out.result === 'win') {
      const drops = {};
      for (const id of out.drops) drops[id] = (drops[id] || 0) + 1;
      await G.UI.alert('⚔️ 戦闘に勝利した！', `
        <div class="result-line"><span>獲得経験値</span><b>${G.util.g(out.exp)}</b></div>
        <div class="result-line"><span>獲得ゴールド</span><b>${G.util.g(out.gold)} G</b></div>
        ${Object.keys(drops).length ? `<div class="mt"><span class="chip gold">戦利品</span></div>
          ${Object.entries(drops).map(([id, n]) => G.UI.itemLine(id, n)).join('')}` : ''}`);
      await G.UI.showLevelReports(out.levelReports);
    } else if (out.result === 'flee') {
      G.UI.toast('戦闘から離脱した', '');
    } else {
      const pen = G.World.onDefeat();
      await G.UI.alert('💀 全滅した……', `
        <p>目を覚ますと、学院の医務室だった。</p>
        <p class="dim">誰かが運んでくれたらしい。治療費として <b class="gold">${G.util.g(pen.lost)} G</b> を失った。</p>
        <p class="dim">今日はもう動けない。</p>`);
    }

    G.UI.updateHud();
    if (bs.opts.onEnd) bs.opts.onEnd(out);
    else G.UI.show('home');
  },
};

/* ナビから戦闘画面には戻れないようにしておく */
G.UI.register('battle', { render: () => '<p class="dim">戦闘中……</p>' });
