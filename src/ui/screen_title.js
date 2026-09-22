/* ===== タイトル画面 =====
 * 画面に出す日本語は src/data/strings.ja.js にまとめてある。
 * ここでは G.T('キー') で取り出す。
 *   G.T()      … そのままの文字（ボタンのラベルなど）
 *   G.T.html() … 差し込む値を安全な形に直す（innerHTML に入れるとき）
 */
window.G = window.G || {};

G.UI.register('title', {
  render() {
    const has = G.State.hasSave();
    return `
      <div class="title-screen">
        <div class="title-crest">🏰</div>
        <div class="title-logo">${G.T('title.logo')}</div>
        <div class="title-sub">${G.T('title.sub')}</div>
        ${has ? `<button class="btn gold" data-act="continue">${G.T('title.continue')}</button>` : ''}
        <button class="btn primary" data-act="new">${G.T('title.new')}</button>
        <button class="btn ghost" data-act="about">${G.T('title.about')}</button>
      </div>`;
  },
  mount() {
    G.UI.setChromeVisible(false);

    G.UI.on('continue', () => {
      if (G.State.load()) { G.UI.setChromeVisible(true); G.UI.show('home'); }
      else G.UI.toast(G.T('title.loadFail'), 'bad');
    });

    G.UI.on('new', async () => {
      if (G.State.hasSave()) {
        const ok = await G.UI.confirm(G.T('title.overwrite.title'),
          G.T('title.overwrite.body'), G.T('title.overwrite.ok'), G.T('common.cancel'));
        if (!ok) return;
      }
      const defName = G.T('title.name.default');
      let name = defName;
      await G.UI.modal({
        title: G.T('title.name.title'),
        body: `<p class="dim">${G.T('title.name.lead')}</p>
               <input id="name-in" class="btn" style="font-weight:700"
                      maxlength="8" placeholder="${G.util.esc(defName)}" value="${G.util.esc(defName)}">`,
        actions: [{ label: G.T('title.name.ok'), cls: 'primary', value: 'ok' }],
        bind: done => {
          const el = document.getElementById('name-in');
          if (!el) return;
          el.focus();
          el.select();
          // 入力途中の値を拾えるよう、閉じる直前まで反映し続ける
          el.addEventListener('input', () => { name = el.value; });
          el.addEventListener('keydown', ev => { if (ev.key === 'Enter') { name = el.value; done('ok'); } });
        },
      });
      const diff = await G.UI.modal({
        title: G.T('title.diff.title'),
        body: `<p class="dim">${G.T('title.diff.lead')}</p>
          ${Object.entries(G.DIFFICULTY).map(([k, v]) => `
            <div class="list-item">
              <div class="ico">${k === 'easy' ? '🌱' : k === 'normal' ? '⚔️' : '🔥'}</div>
              <div class="body">
                <div class="nm">${v.name}</div>
                <div class="ds">${G.T.html('title.diff.stats', {
                  hp: Math.round(v.hp * 100), atk: Math.round(v.atk * 100),
                })}</div>
              </div>
              <div class="act"><button class="btn sm" data-pick="${k}">${G.T('title.diff.pick')}</button></div>
            </div>`).join('')}`,
        actions: [{ label: G.T('title.diff.ok'), cls: 'primary', value: 'normal' }],
        bind: done => document.querySelectorAll('#modal [data-pick]').forEach(el =>
          el.addEventListener('click', () => done(el.dataset.pick))),
      });
      G.Story.beginNewGame(name, diff);
    });

    G.UI.on('about', () => G.UI.alert(G.T('title.about.title'), `
      <p>${G.T('title.about.intro')}</p>
      <div class="divider"></div>
      <p>${G.T('title.about.ap')}</p>
      <p>${G.T('title.about.exam')}</p>
      <p>${G.T('title.about.job')}</p>
      <p>${G.T('title.about.goal')}</p>
      <div class="divider"></div>
      <p class="dim">${G.T('title.about.save')}</p>`));
  },
});
