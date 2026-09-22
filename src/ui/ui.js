/* ===== UI 共通基盤 ===== */
window.G = window.G || {};

G.UI = {
  current: null,
  currentArgs: null,
  busy: false,

  el(id) { return document.getElementById(id); },

  /* ---------- 画面切り替え ---------- */
  screens: {},   // name -> { render(args) -> html, mount(args) }

  register(name, def) { G.UI.screens[name] = def; },

  show(name, args) {
    const def = G.UI.screens[name];
    if (!def) { console.warn('未登録の画面:', name); return; }
    G.UI.current = name;
    G.UI.currentArgs = args;
    const host = G.UI.el('screen');
    host.innerHTML = def.render(args) || '';
    host.scrollTop = 0;
    if (def.mount) def.mount(args);
    G.UI.updateHud();
    G.UI.updateNav(name);
    G.UI.syncBgm(name);
  },

  /* 現在の画面を描き直す */
  refresh() {
    if (G.UI.current) G.UI.show(G.UI.current, G.UI.currentArgs);
  },

  /* ---------- イベント ---------- */
  /* data-act="名前" の要素にハンドラを結び付ける。
   *
   * 【重要】リスナーを付けてよいのは #screen の中の要素だけ。
   * 画面を切り替えると #screen の中身は innerHTML で丸ごと作り直され、
   * 古い要素ごとリスナーも破棄されるため、ここで付ける分は溜まらない。
   *
   * 逆に window / document / #hud / #nav / #modal のような
   * 「ずっと残り続ける要素」に画面側からリスナーを付けると、
   * 画面を開くたびに増え続けて戻せなくなる。
   * どうしても必要になったら、解除する仕組みとセットで実装すること。
   * （蓄積していないことは tools/listeners.js が毎回のテストで確認している） */
  on(act, handler) {
    document.querySelectorAll(`#screen [data-act="${act}"]`).forEach(el => {
      el.addEventListener('click', ev => {
        if (G.UI.busy) return;
        handler(el.dataset, el, ev);
      });
    });
  },

  /* ---------- HUD ---------- */
  updateHud() {
    const d = G.State.data;
    const hud = G.UI.el('hud');
    const nav = G.UI.el('nav');
    if (!d) { hud.classList.add('hidden'); nav.classList.add('hidden'); return; }
    hud.classList.remove('hidden');
    // 戦闘中は下部タブを出さない。
    // screen_battle.js が隠しているのに、ここが毎回戻してしまっていた。
    // （押しても「戦闘中は移動できない」と出るだけの帯が、
    //   コマンドのすぐ下に並んで誤タップの原因になっていた）
    if (G.UI.current !== 'battle') nav.classList.remove('hidden');

    const p = d.player;
    const der = G.Char.derived(p);

    // 戦闘中はキャラ側のHP/MPが戦闘終了まで更新されないので、
    // 戦闘ユニットの値を見て表示する（そうしないとHUDだけ開始時のまま固まる）。
    let curHp = p.hp, curMp = p.mp;
    if (G.UI.current === 'battle' && G.BattleUI && G.BattleUI.bs) {
      const u = G.BattleUI.bs.b.allies.find(a => a.ref === p);
      if (u) { curHp = u.hp; curMp = u.mp; }
    }

    G.UI.el('hud-player').textContent = p.name;
    G.UI.el('hud-job').textContent = G.Char.jobName(p);
    G.UI.el('hud-lv').textContent = 'Lv.' + p.level;

    const set = (fill, text, cur, max, label) => {
      G.UI.el(fill).style.width = (max > 0 ? G.util.clamp(cur / max, 0, 1) * 100 : 0) + '%';
      G.UI.el(text).textContent = label || `${Math.floor(cur)}/${max}`;
    };
    set('hud-hp-fill', 'hud-hp-text', Math.max(0, curHp), der.hp);
    set('hud-mp-fill', 'hud-mp-text', curMp, der.mp);
    const need = G.Char.expToNext(p.level);
    set('hud-xp-fill', 'hud-xp-text', p.exp, need, `次のLvまで ${G.util.g(need - p.exp)}`);

    G.UI.el('hud-gold').textContent = G.util.g(d.gold);
    G.UI.el('hud-day').textContent = d.day;
    G.UI.el('hud-ap').textContent = d.ap;
  },

  updateNav(name) {
    document.querySelectorAll('#nav button').forEach(b => {
      b.classList.toggle('active', b.dataset.nav === name);
    });
  },

  setChromeVisible(v) {
    G.UI.el('hud').classList.toggle('hidden', !v);
    G.UI.el('nav').classList.toggle('hidden', !v);
  },

  /* ---------- BGM ---------- */
  /* 画面ごとに曲を決める。同じ曲が続くときは鳴らし直さない
   * （G.Audio 側で判定しているので、ここは毎回呼んでよい）。 */
  SCREEN_BGM: {
    title: 'bgm_title',
    home: 'bgm_academy', academy: 'bgm_academy', job: 'bgm_academy', status: 'bgm_academy',
    town: 'bgm_town', guild: 'bgm_town',
    demon: 'bgm_boss',
  },

  syncBgm(name) {
    if (!G.Audio) return;
    const id = G.UI.SCREEN_BGM[name];
    if (id) G.Audio.bgm(id);
  },

  /* ---------- 戻る操作 ---------- */
  /* Androidの戻るボタン（とブラウザの戻る）から呼ばれる。
   * 戻り値 true = このアプリで処理した / false = 何もしていない
   *
   * 「閉じてよいもの」だけを閉じる。
   * 名前入力や難易度選択のように、値を返さないと話が進まないモーダルは
   * 閉じてしまうとゲームが壊れるため、対象にしない。 */
  handleBack() {
    // 1. 閉じてよいモーダルが開いていれば、それを閉じる
    if (G.UI.openModal) {
      if (G.UI.openModal.dismissable) { G.UI.openModal.close(); return true; }
      return true;                       // 閉じられないが、画面も移らない
    }
    // 2. 物語の再生中・戦闘中は動かさない
    if (G.UI.storyPlaying) return true;
    if (G.UI.current === 'battle') return true;
    // 3. 拠点以外にいるなら拠点へ戻る
    if (G.State.data && G.UI.current && G.UI.current !== 'home' && G.UI.current !== 'title') {
      G.UI.show('home');
      return true;
    }
    return false;                        // ここでは何もしない（アプリを閉じてよい）
  },

  /* ---------- トースト ---------- */
  toast(msg, type = '') {
    const wrap = G.UI.el('toast-wrap');
    // 溜まりすぎると画面下のボタンが見えなくなるので、古いものから消す
    while (wrap.children.length >= 3) wrap.firstChild.remove();
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .3s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 320);
    }, 2200);
  },

  /* ---------- モーダル ---------- */
  /* actions: [{label, cls, value}] / 戻り値は選ばれた value の Promise */
  /* bind(done) を渡すと、本文に置いた要素からも結果を返せる。
   * done(value) を呼べばモーダルが閉じて、その値で解決する。 */
  /* いま開いているモーダルの情報。戻る操作の判断に使う。
   * dismissable なものだけ、戻るで閉じてよい。 */
  openModal: null,

  modal({ title, body, actions = [{ label: G.T('common.close'), value: true }], dismissable = false, bind = null }) {
    return new Promise(resolve => {
      const m = G.UI.el('modal');
      G.UI.el('modal-title').innerHTML = title || '';
      G.UI.el('modal-body').innerHTML = body || '';
      const acts = G.UI.el('modal-actions');
      acts.innerHTML = '';

      let settled = false;
      const done = value => {
        if (settled) return;
        settled = true;
        G.UI.openModal = null;
        m.classList.add('hidden');
        m.removeEventListener('click', onBg);
        // 閉じた後も中身が残っていると、その分のDOMが居座り続ける。
        // 表示は display:none なので、ここで消しても見た目には影響しない。
        G.UI.el('modal-body').innerHTML = '';
        G.UI.el('modal-actions').innerHTML = '';
        resolve(value);
      };

      for (const a of actions) {
        const b = document.createElement('button');
        b.className = 'btn ' + (a.cls || '');
        b.textContent = a.label;
        b.addEventListener('click', () => done(a.value));
        acts.appendChild(b);
      }
      const onBg = ev => { if (dismissable && ev.target === m) done(null); };
      m.addEventListener('click', onBg);
      G.UI.openModal = { dismissable, close: () => done(null) };
      m.classList.remove('hidden');
      if (bind) bind(done);
    });
  },

  confirm(title, body, okLabel = G.T('common.yes'), ngLabel = G.T('common.cancel')) {
    return G.UI.modal({
      title, body,
      actions: [{ label: okLabel, cls: 'primary', value: true }, { label: ngLabel, cls: 'ghost', value: false }],
    });
  },

  alert(title, body) {
    return G.UI.modal({ title, body, actions: [{ label: G.T('common.ok'), cls: 'primary', value: true }] });
  },

  /* ---------- ストーリー再生 ---------- */
  /* scene: [{who, text}] を1つずつ送る。終わったら onDone。 */
  playStory(scene, onDone) {
    G.UI.storyPlaying = true;
    let i = 0;
    const host = G.UI.el('screen');
    G.UI.setChromeVisible(false);

    const draw = () => {
      const shown = scene.slice(0, i + 1);
      host.innerHTML = `
        <div class="mt">
          ${shown.map(s => `
            <div class="story">
              ${s.who ? `<div class="speaker">${G.util.esc(s.who)}</div>` : ''}
              <p class="${s.who ? '' : 'narration'}">${G.util.esc(s.text)}</p>
            </div>`).join('')}
          <button class="btn primary mt" data-act="next">
            ${i < scene.length - 1 ? '▼ つづける' : '▶ 先へ進む'}
          </button>
        </div>`;
      host.scrollTop = host.scrollHeight;
      G.UI.on('next', () => {
        if (i < scene.length - 1) { i++; draw(); }
        else { G.UI.storyPlaying = false; G.UI.setChromeVisible(!!G.State.data); onDone && onDone(); }
      });
    };
    draw();
  },

  /* ---------- レベルアップ表示 ---------- */
  /* partyExp() が返すレポートをまとめてモーダルに出す */
  async showLevelReports(reports) {
    if (!reports || !reports.length) return;
    const parts = [];
    for (const r of reports) {
      const top = r.levels[r.levels.length - 1];
      const diff = {};
      for (const lv of r.levels) {
        for (const [k, v] of Object.entries(lv.diff)) diff[k] = (diff[k] || 0) + v;
      }
      const learned = r.levels.flatMap(l => l.learned);
      parts.push(`
        <div class="card tight">
          <div class="levelup">${G.util.esc(r.char.name)} は Lv.${top.level} に上がった！</div>
          <div class="stat-grid">
            ${Object.entries(diff).filter(([, v]) => v > 0).map(([k, v]) => `
              <div class="stat-box">
                <div class="lbl">${G.STAT_LABEL[k]}</div>
                <div class="val">+${Math.round(v)}</div>
              </div>`).join('')}
          </div>
          ${learned.length ? `<p class="mt"><span class="chip gold">新しい技</span> ${
            learned.map(s => G.SKILLS[s] ? G.util.esc(G.SKILLS[s].name) : '').filter(Boolean).join('、')}</p>` : ''}
          ${r.jobs && r.jobs.length ? `<p><span class="chip ok">転職</span> ${r.jobs.map(G.util.esc).join(' → ')}</p>` : ''}
        </div>`);
    }
    await G.UI.alert('レベルアップ', parts.join(''));

    // 主人公が転職できるようになったら知らせる。
    // ただしジョブ解禁の場面(awaken)より前は、物語側が案内するのでここでは出さない。
    const p = G.State.d.player;
    if (G.State.flag('awaken') && G.Char.jobOptions(p).length) {
      const go = await G.UI.confirm('適性が開花した',
        `<p>${G.util.esc(p.name)}は新しいジョブに就けるようになった。</p>
         <p class="dim">学院の適性審査室でジョブを選べます。</p>`, '選びに行く', 'あとで');
      if (go) G.UI.show('job');
    }
  },

  /* ---------- 場所の見出し ---------- */
  /* 背景の書き割りの前にパーティが立っている帯。
   * どこに居るのかが文字だけでなく絵でも分かるようにする。 */
  placeHtml(kind) {
    const pl = G.PLACES[kind] || G.PLACES.home;
    const party = (G.State.data && G.State.data.party) || [];
    return `<div class="place">
      <div class="place-sky" style="background:${pl.sky}"></div>
      <div class="place-props">${G.Sprite.placeProps(kind)}</div>
      <div class="place-ground"></div>
      <div class="place-party">
        ${party.map(c => `<div class="unit">
          <div class="unit-sprite">${G.Sprite.hero(c)}</div>
        </div>`).join('')}
      </div>
      <div class="place-title">${G.util.esc(pl.name)}
        <span class="sub">${G.util.esc(pl.sub)}</span></div>
    </div>`;
  },

  /* 場所を移る。歩いている様子を挟んでから画面を切り替える。 */
  walkTo(name) {
    const d = G.State.data;
    if (!d || G.UI.current === name || !G.PLACES[name]) { G.UI.show(name); return; }

    const ov = document.createElement('div');
    ov.className = 'walk-over';
    ov.innerHTML = `
      <div class="walk-ground"></div>
      <div class="walk-label">${G.util.esc(G.PLACES[name].name)} へ</div>
      <div class="walk-party">
        ${d.party.map(c => `<div class="unit">
          <div class="unit-sprite">${G.Sprite.hero(c)}</div>
        </div>`).join('')}
      </div>`;
    document.body.appendChild(ov);
    ov.querySelectorAll('.chr').forEach(el => el.classList.add('is-walk'));

    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      ov.remove();
      G.UI.show(name);
    };
    const timer = setTimeout(done, 700);
    ov.addEventListener('click', done);   // 待ちたくない人はタップで飛ばせる
  },

  /* ---------- 小さな部品 ---------- */
  bar(cur, max, cls = '') {
    const pct = max > 0 ? G.util.clamp(cur / max, 0, 1) * 100 : 0;
    return `<div class="meter ${cls}"><i style="width:${pct}%"></i></div>`;
  },

  itemLine(id, n, extra = '') {
    const it = G.ITEMS[id];
    if (!it) return '';
    return `<div class="list-item">
      <div class="ico">${it.icon || '📦'}</div>
      <div class="body">
        <div class="nm">${G.util.esc(it.name)}${n > 1 ? ` <span class="dim">×${n}</span>` : ''}</div>
        <div class="ds">${G.util.esc(it.desc || '')}</div>
      </div>
      ${extra ? `<div class="act">${extra}</div>` : ''}
    </div>`;
  },

  /* 装備の補正を読みやすく並べる */
  modsText(it) {
    if (!it.mods) return '';
    return Object.entries(it.mods)
      .map(([k, v]) => `${G.STAT_LABEL[k]}${v >= 0 ? '+' : ''}${v}`).join(' ');
  },
};
