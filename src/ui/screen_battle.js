/* ===== 戦闘画面 =====
 * キャラクターはSVGで描き、CSSアニメで動かす。
 * 毎回まるごと描き直すとアニメーションが途切れてしまうので、
 *   mount() … 骨組みとキャラを一度だけ描く
 *   sync()  … HPや状態など変化した部分だけ更新する
 * に分けてある。
 */
(function () {
'use strict';
/* ↑ このファイル内で作った名前を、他のファイルから見えないように閉じ込めている。
   全ファイルは1つのスクリプトに連結されるため、包まないと名前が衝突しうる。
   中身のインデントは変えていない（差分を小さく保つため）。 */

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

  /* 戦闘を開始する。opts.onEnd(out) が呼ばれる */
  start(enemyIds, opts = {}) {
    const b = G.Battle.init(enemyIds, opts);
    b.log = [];
    G.BattleUI.bs = { b, opts, activeUid: null };
    G.UI.current = 'battle';
    G.UI.currentArgs = null;
    G.UI.el('nav').classList.add('hidden');

    /* 相手に応じて曲を変える。魔王は専用の曲。 */
    if (G.Audio) {
      const ids = b.enemies.map(e => e.enemyId);
      G.Audio.bgm(ids.some(i => /demon_lord/.test(i)) ? 'bgm_final'
        : b.enemies.some(e => e.isBoss) ? 'bgm_boss' : 'bgm_battle');
    }

    G.BattleUI.mount();
    if (opts.intro) G.BattleUI.log(opts.intro, 'sys');
    G.BattleUI.log(`${b.enemies.map(e => e.name).join('、')} が現れた！`, 'hi');
    // 登場の動き
    for (const u of b.enemies) G.BattleUI.animate(u.uid, 'is-enter', 500);
    // run() は非同期。await せずに走らせるので、中で例外が出ても
    // 呼び出し側には伝わらない（コマンドが出ないまま固まる）。
    // guard で包んで、失敗したら必ず画面に出るようにする。
    G.Err.guard('戦闘の進行', () => G.BattleUI.run());
  },

  /* ---------- 骨組み ---------- */
  mount() {
    const { b } = G.BattleUI.bs;
    const spd = (G.State.data && G.State.data.battleSpeed) || 2;

    G.UI.el('screen').innerHTML = `
      <div class="battle">
        <div class="scene ${b.enemies.some(e => e.isBoss) ? 'boss' : ''}" id="scene">
          <div class="scene-ground"></div>
          <div class="scene-row scene-foes" id="field">
            ${b.enemies.map(u => G.BattleUI.unitHtml(u, true)).join('')}
          </div>
          <div class="scene-row scene-heroes" id="party">
            ${b.allies.map(u => G.BattleUI.unitHtml(u, false)).join('')}
          </div>
        </div>

        <div class="party-row" id="cards">
          ${b.allies.map(u => G.BattleUI.cardHtml(u)).join('')}
        </div>

        <div class="row" style="justify-content:flex-end;margin:-4px 0 -2px">
          <button class="btn sm ghost" data-act="speed">⏩ 演出 ${G.BattleUI.SPEEDS[spd].label}</button>
        </div>

        <div class="battle-log" id="blog"></div>
        <div id="cmd"></div>
      </div>`;

    G.UI.on('speed', () => {
      const d = G.State.d;
      d.battleSpeed = d.battleSpeed >= 3 ? 1 : d.battleSpeed + 1;
      G.State.save();
      const el = document.querySelector('#screen [data-act="speed"]');
      if (el) el.textContent = `⏩ 演出 ${G.BattleUI.SPEEDS[d.battleSpeed].label}`;
    });

    G.BattleUI.drawLog();
    G.BattleUI.sync();
    G.UI.updateHud();
  },

  /* シーン内のキャラ1体 */
  unitHtml(u, isFoe) {
    const svg = isFoe ? G.Sprite.enemy(u) : G.Sprite.hero(u.ref);
    // 敵は名前とHPを上に、味方は下に置く。
    // 敵の名前が味方の行動マーカーと同じ高さに来て読みにくくなるため。
    const label = `<div class="unit-tag">${G.util.esc(u.name)}</div>
      ${isFoe ? '<div class="unit-hp"><i></i></div><div class="unit-hpn"></div>' : ''}
      <div class="unit-st"></div>`;
    return `<div class="unit ${isFoe ? 'foe' : 'hero'} ${u.isBoss ? 'big' : ''}"
                 data-uid="${u.uid}" id="u-${u.uid}">
      ${isFoe ? label : ''}
      <div class="unit-sprite">${svg}</div>
      ${isFoe ? '' : label}
    </div>`;
  },

  /* 味方のHP/MPカード */
  cardHtml(a) {
    return `<div class="ally-card" data-uid="${a.uid}" id="c-${a.uid}">
      <div class="an"><span class="em">${a.icon}</span>${G.util.esc(a.name)}</div>
      <div class="ab">
        <div class="mini h"><i></i></div>
        <div class="mini m"><i></i></div>
      </div>
      <div class="nums"><span class="c-hp"></span><span class="c-mp"></span></div>
      <div class="st-badges"></div>
    </div>`;
  },

  /* ---------- 変化した部分だけ更新 ---------- */
  /* mode: 'enemy' | 'ally' | 'dead' のとき、その対象に選択可能の印を付ける */
  sync(mode) {
    const { b, activeUid } = G.BattleUI.bs;
    const pct = (a, c) => (c > 0 ? G.util.clamp(a / c, 0, 1) : 0) * 100 + '%';
    const badges = u => Object.keys(u.status)
      .map(s => `<span class="st-badge">${G.STATUS[s].icon}</span>`).join('')
      + (u.buffs.length ? '<span class="st-badge buff">▲</span>' : '');

    for (const u of G.Battle.units(b)) {
      const el = document.getElementById('u-' + u.uid);
      if (!el) continue;
      const dead = u.hp <= 0;
      el.classList.toggle('dead', dead);
      el.classList.toggle('acting', u.uid === activeUid && !dead);

      const selectable =
        (mode === 'enemy' && u.side === 'enemy' && !dead) ||
        (mode === 'ally' && u.side === 'ally' && !dead) ||
        (mode === 'dead' && u.side === 'ally' && dead);
      el.classList.toggle('targetable', !!selectable);
      el.classList.toggle('selectable', !!selectable);  // 検証用の目印

      /* 敵のHPは、棒の長さだけだと読み取りにくい。
       * 数字を添えて、残りの割合で色も変える。
       * 「あと一撃で倒せるか」が一目で分かるようにするため。 */
      const bar = el.querySelector('.unit-hp i');
      if (bar) {
        const left = u.maxHp > 0 ? u.hp / u.maxHp : 0;
        bar.style.width = pct(u.hp, u.maxHp);
        const box = bar.parentNode;
        box.classList.toggle('mid', left <= 0.5 && left > 0.25);
        box.classList.toggle('low', left <= 0.25);
      }
      const hpn = el.querySelector('.unit-hpn');
      if (hpn) hpn.textContent = `${Math.max(0, u.hp)}/${u.maxHp}`;
      const st = el.querySelector('.unit-st');
      if (st) st.innerHTML = badges(u);

      const chr = el.querySelector('.chr');
      if (chr) {
        chr.classList.toggle('is-down', dead);
        /* 倒れている絵があれば使う。立ち上がったら元に戻す。
         *
         * sync() は1手ごとに何度も呼ばれる。
         * ここで無条件に元へ戻すと、攻撃の絵に差し替えた直後に
         * 戻されてしまい、動きの絵が一瞬しか出ない。
         * 倒れた／立ち上がった瞬間だけ触る。 */
        if (G.Art) {
          if (dead && !chr._downPose) { chr._downPose = !!G.Art.setPose(chr, 'is-down'); }
          else if (!dead && chr._downPose) { G.Art.clearPose(chr); chr._downPose = false; }
        }
      }
    }

    for (const a of b.allies) {
      const c = document.getElementById('c-' + a.uid);
      if (!c) continue;
      c.classList.toggle('down', a.hp <= 0);
      c.classList.toggle('active', a.uid === activeUid);
      c.querySelector('.mini.h i').style.width = pct(a.hp, a.maxHp);
      c.querySelector('.mini.m i').style.width = pct(a.mp, a.maxMp);
      c.querySelector('.c-hp').textContent = `HP ${Math.max(0, a.hp)}/${a.maxHp}`;
      c.querySelector('.c-mp').textContent = `MP ${a.mp}/${a.maxMp}`;
      c.querySelector('.st-badges').innerHTML = badges(a);
    }
    G.UI.updateHud();
  },

  /* ---------- 戦闘ログ ---------- */
  log(text, cls = '') {
    const b = G.BattleUI.bs.b;
    b.log.push({ text, cls });
    if (b.log.length > 60) b.log.shift();
    const host = G.UI.el('blog');
    if (!host) return;
    const div = document.createElement('div');
    div.className = cls;
    div.textContent = text;
    host.appendChild(div);
    while (host.children.length > 60) host.firstChild.remove();
    host.scrollTop = host.scrollHeight;
  },

  drawLog() {
    const host = G.UI.el('blog');
    if (!host) return;
    host.innerHTML = G.BattleUI.bs.b.log
      .map(l => `<div class="${l.cls}">${G.util.esc(l.text)}</div>`).join('');
    host.scrollTop = host.scrollHeight;
  },

  /* ---------- 動き ---------- */
  animate(uid, cls, ms) {
    const el = document.querySelector(`#u-${uid} .chr`);
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;            // 同じ動きを連続で出すために巻き戻す
    el.classList.add(cls);
    /* その動きの絵（画像）が用意されていれば差し替える。
     * 無ければ体ごとを動かすCSSだけが効く。 */
    const swapped = G.Art && G.Art.setPose(el, cls, ms);
    setTimeout(() => {
      el.classList.remove(cls);
      if (swapped) G.Art.clearPose(el);
    }, ms);
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
    f.style.top = (r.top - hr.top + 6) + 'px';
    host.appendChild(f);
    setTimeout(() => f.remove(), 900);
  },

  /* ---------- 技のエフェクト ---------- */
  /* 技の見た目をどれにするか。
   * 属性があればそれ。無ければ攻撃の種類から決める。 */
  FX_EL: { fire: 1, water: 1, wind: 1, earth: 1, light: 1, dark: 1 },
  FX_PARTS: { fire: 3, water: 6, wind: 3, earth: 5, light: 3, dark: 3,
    slash: 3, arcane: 3, heal: 4, buff: 2, debuff: 2 },

  fxKind(skill) {
    if (!skill) return 'slash';
    if (skill.el && G.BattleUI.FX_EL[skill.el]) return skill.el;
    if (skill.kind === 'heal') return 'heal';
    if (skill.kind === 'buff') return 'buff';
    if (skill.kind === 'debuff') return 'debuff';
    if (skill.kind === 'phys') return 'slash';
    return 'arcane';
  },

  /* 「大技」かどうか。
   * MPを多く使う技・全体技・多段技を、見せ場として扱う。
   * ここを1か所にまとめておけば、あとから基準を変えやすい。 */
  isBig(skill) {
    if (!skill) return false;
    return (skill.mp || 0) >= 18 || skill.target === 'all' || (skill.hits || 1) >= 3;
  },

  /* 対象の絵に重ねる。kind は fxKind の戻り値。 */
  fx(uid, kind, ms) {
    const host = document.querySelector(`#u-${uid} .unit-sprite`);
    if (!host) return;
    const d = document.createElement('div');
    d.className = 'fx fx-' + kind;
    d.innerHTML = '<i></i>'.repeat(G.BattleUI.FX_PARTS[kind] || 3);
    host.appendChild(d);
    setTimeout(() => d.remove(), ms || 900);
  },

  /* 戦闘画面ぜんぶに重ねる（大技の閃光・集中線・技名） */
  fxScene(kind, name, who) {
    const scene = document.getElementById('scene');
    if (!scene) return;
    const d = document.createElement('div');
    d.className = 'fx-scene';
    d.innerHTML = `<div class="fx-flash el-${kind}"></div>
      <div class="fx-lines"></div>
      ${name ? `<div class="fx-name">${who ? `<b>${G.util.esc(who)}</b>` : ''}${G.util.esc(name)}</div>` : ''}`;
    scene.appendChild(d);
    setTimeout(() => d.remove(), 1200);
  },

  shake(hard) {
    const scene = document.getElementById('scene');
    if (!scene) return;
    const cls = hard ? 'is-shake-hard' : 'is-shake';
    scene.classList.remove(cls);
    void scene.offsetWidth;
    scene.classList.add(cls);
    setTimeout(() => scene.classList.remove(cls), hard ? 640 : 500);
  },

  /* ---------- 演出 ---------- */
  async playEvents(events) {
    let prev = null;
    let skill = null, fxKind = 'slash';
    for (const ev of events) {
      if (ev.text) {
        if (G.Audio) {
          if (ev.type === 'down') G.Audio.se('se_alert');
          else if (ev.type === 'status') G.Audio.se('se_status');
        }
        const cls = ev.type === 'damage' || ev.type === 'dot' ? 'dmg'
          : ev.type === 'heal' || ev.type === 'revive' ? 'heal'
            : ev.type === 'down' ? 'bad'
              : ev.type === 'use' ? 'hi' : '';
        G.BattleUI.log(ev.text, cls);
      }

      // 技を出す側の動き
      if (ev.type === 'use' && ev.actor) {
        const kind = ev.skill ? ev.skill.kind : 'phys';
        const cast = ['mag', 'heal', 'buff', 'debuff', 'special'].includes(kind);
        /* いま出ている技を覚えておく。
         * これに続くダメージや回復のイベントには技の情報が入っていないので、
         * どの属性のエフェクトを出すかはここで決めた内容を使う。 */
        skill = ev.skill || null;
        fxKind = G.BattleUI.fxKind(skill);
        const big = G.BattleUI.isBig(skill);

        if (G.Audio) G.Audio.se(big ? 'se_ultimate' : cast ? 'se_magic' : 'se_attack');
        if (G.Voice) G.Voice.shout(ev.actor, skill, big);

        if (big) {
          /* 見せ場。閃光と集中線を出し、技名を大きく見せてから当てる。 */
          G.BattleUI.fxScene(fxKind, skill && skill.name, ev.actor.name);
          G.BattleUI.shake(true);
          if (G.Native) G.Native.tap('heavy');
        }
        G.BattleUI.animate(ev.actor.uid, cast ? 'is-cast' : 'is-attack', cast ? 900 : 520);
        await sleep((big ? 620 : cast ? 260 : 170) * G.BattleUI.speed);
      }

      if (ev.type === 'damage' && ev.amount > 0) {
        if (G.Audio) G.Audio.se('se_hit');
        G.BattleUI.fx(ev.target.uid, fxKind);
        G.BattleUI.animate(ev.target.uid, 'is-hurt', 420);
        G.BattleUI.popup(ev.target.uid, '-' + ev.amount, ev.crit ? '#ffd96b' : '#ff9a6d');
        if (ev.crit) G.BattleUI.shake(false);
        // アプリ版では手応えとして短く振動させる（ブラウザでは何も起きない）
        if (G.Native) G.Native.tap(ev.crit ? 'heavy' : (ev.target.side === 'ally' ? 'medium' : 'light'));
      } else if (ev.type === 'dot') {
        G.BattleUI.popup(ev.target.uid, '-' + ev.amount, '#b6ff8a');
      } else if (ev.type === 'heal' && ev.amount > 0) {
        if (G.Audio) G.Audio.se('se_heal');
        G.BattleUI.fx(ev.target.uid, 'heal');
        G.BattleUI.popup(ev.target.uid, '+' + ev.amount, '#7dffb0');
      } else if (ev.type === 'mp' && ev.amount > 0) {
        G.BattleUI.popup(ev.target.uid, '+' + ev.amount, '#7ad4ff');
      } else if (ev.type === 'buff') {
        if (ev.target) G.BattleUI.fx(ev.target.uid, ev.up ? 'buff' : 'debuff');
      } else if (ev.type === 'revive') {
        if (G.Audio) G.Audio.se('se_heal');
        G.BattleUI.fx(ev.target.uid, 'light');
        G.BattleUI.animate(ev.target.uid, 'is-enter', 500);
      }

      G.BattleUI.sync();

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
        G.BattleUI.sync();

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
    G.BattleUI.sync();
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
      let cleanup = () => {};

      const done = act => { cleanup(); G.BattleUI.sync(); resolve(act); };

      const menu = () => {
        cleanup();
        G.BattleUI.sync();
        G.BattleUI.showCmd(`
          <div class="cmd-title">${G.util.esc(u.name)} は どうする？</div>
          <div class="btn-grid">
            <button class="btn primary" data-act="atk">⚔️ たたかう</button>
            <button class="btn" data-act="skill">✨ とくぎ</button>
            <button class="btn" data-act="item">🎒 どうぐ</button>
            <button class="btn" data-act="guard">🛡️ ぼうぎょ</button>
          </div>
          ${b.canFlee ? '<button class="btn ghost mt" data-act="flee">🏃 にげる</button>' : ''}`);

        G.UI.on('atk', () => pickTarget({ type: 'attack' }, 'enemy'));
        G.UI.on('guard', () => done({ type: 'guard' }));
        if (b.canFlee) G.UI.on('flee', () => done({ type: 'flee' }));
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
          if (s.target === 'self' || s.target === 'all' || s.target === 'allies') done(act);
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
          if (it.use.escape) done(act);
          else if (it.use.revive) pickTarget(act, 'dead');
          else pickTarget(act, 'ally');
        });
      };

      /* 対象を選ぶ。候補が1つなら自動で決める */
      const pickTarget = (act, mode) => {
        const pool = mode === 'enemy' ? G.Battle.livingEnemies(b)
          : mode === 'dead' ? b.allies.filter(a => a.hp <= 0)
            : G.Battle.livingAllies(b);
        if (!pool.length) { G.UI.toast('対象がいない', 'bad'); return menu(); }
        if (pool.length === 1) { act.targetUid = pool[0].uid; return done(act); }

        G.BattleUI.sync(mode);
        G.BattleUI.showCmd(`
          <div class="cmd-title">${mode === 'enemy' ? '相手' : '味方'}を選ぶ（キャラをタップ）</div>
          <button class="btn ghost" data-act="back">← もどる</button>`);
        G.UI.on('back', menu);

        const handlers = [];
        document.querySelectorAll('#scene .unit.targetable').forEach(el => {
          const h = () => { act.targetUid = el.dataset.uid; done(act); };
          el.addEventListener('click', h);
          handlers.push([el, h]);
        });
        cleanup = () => {
          for (const [el, h] of handlers) el.removeEventListener('click', h);
          cleanup = () => {};
        };
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

/* ↓ 閉じ込めここまで */
})();
