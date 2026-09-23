/* ===== 移動中 =====
 * 地点から地点へ歩く。1歩ごとに遭遇の判定が入り、
 * 出れば戦闘へ、勝てば同じ歩数から再開する。
 *
 * 歩数を進めるかどうかは G.Explore（画面を知らない層）が決める。
 * ここは「見せかた」と「戦闘への出入り」だけを担当する。
 */
window.G = window.G || {};

G.UI.register('travel', {
  render() {
    const e = G.Explore.data();
    const t = e && e.trip;
    if (!t) return '<div class="card"><p>移動していません。</p></div>';
    const to = G.SPOTS[t.to];

    return `
      <div class="trip">
        <div class="trip-head">
          <div class="trip-to">${G.spotIcon(to.id)} ${G.util.esc(to.name)} へ</div>
          <div class="trip-count"><b id="trip-now">${t.step}</b> / ${t.total} 歩</div>
        </div>
        <div class="trip-bar"><i id="trip-fill" style="width:${t.step / t.total * 100}%"></i></div>

        <div class="trip-scene ${to.type === 'dungeon' || to.type === 'boss' ? 'is-dark' : ''}">
          <div class="trip-sky"></div>
          <div class="trip-far" id="trip-far"></div>
          <div class="trip-ground" id="trip-ground"></div>
          <div class="trip-party">
            ${G.State.d.party.map(c => `<div class="unit">
              <div class="unit-sprite">${G.Sprite.hero(c)}</div>
            </div>`).join('')}
          </div>
        </div>

        <div class="trip-msg" id="trip-msg">歩いている……</div>
      </div>

      <button class="btn primary" data-act="skip">⏩ 一気に進む</button>
      <button class="btn ghost" data-act="back">🏘️ 引き返す</button>`;
  },

  mount() {
    G.TravelUI.start();
    G.UI.on('skip', () => { G.TravelUI.fast = true; });
    G.UI.on('back', async () => {
      G.TravelUI.stop();
      const ok = await G.UI.confirm('引き返す',
        '<p>出発した地点まで戻ります。</p>', '戻る', 'つづける');
      if (!ok) { G.TravelUI.start(); return; }
      G.Explore.abort();
      G.State.save();
      G.UI.show('map');
    });
  },
});

G.TravelUI = {
  timer: null,
  fast: false,

  /* 1歩あたりの間。戦闘の「演出の速さ」設定に合わせる。 */
  pace() {
    const sp = (G.State.data && G.State.data.battleSpeed) || 2;
    const base = { 1: 620, 2: 420, 3: 260 }[sp] || 420;
    return G.TravelUI.fast ? 90 : base;
  },

  start() {
    G.TravelUI.stop();
    G.TravelUI.fast = false;
    const party = document.querySelectorAll('#screen .trip-party .chr');
    party.forEach(el => {
      el.classList.add('is-walk');
      if (G.Art) G.Art.setPose(el, 'is-walk');   // 歩いている絵があれば使う
    });
    G.TravelUI.tick();
  },

  stop() {
    if (G.TravelUI.timer) { clearTimeout(G.TravelUI.timer); G.TravelUI.timer = null; }
  },

  tick() {
    G.TravelUI.stop();
    G.TravelUI.timer = setTimeout(() => {
      G.Err.guard('移動', () => G.TravelUI.step());
    }, G.TravelUI.pace());
  },

  step() {
    const r = G.Explore.step();
    if (!r) { G.UI.show('map'); return; }

    const now = G.UI.el('trip-now');
    const fill = G.UI.el('trip-fill');
    const msg = G.UI.el('trip-msg');
    const e = G.Explore.data();
    const total = (e.trip && e.trip.total) || r.total || 1;
    if (now) now.textContent = r.step || total;
    if (fill) fill.style.width = `${Math.min(100, (r.step || total) / total * 100)}%`;

    /* 背景を少し動かして、進んでいる感じを出す */
    const far = G.UI.el('trip-far');
    const gr = G.UI.el('trip-ground');
    const p = (r.step || total) / total;
    if (far) far.style.backgroundPositionX = `${-p * 240}px`;
    if (gr) gr.style.backgroundPositionX = `${-p * 620}px`;

    if (r.done) {
      const s = G.SPOTS[r.at];
      if (msg) msg.textContent = `${s.name} に着いた`;
      G.State.save();
      setTimeout(() => G.Err.guard('到着', () => G.TravelUI.arrive(r.at)), 420);
      return;
    }

    if (r.encounter && r.encounter.length) {
      G.TravelUI.encounter(r.encounter);
      return;
    }

    if (msg) msg.textContent = G.util.choice([
      '歩いている……', 'あたりを警戒しながら進む', '風が吹き抜けた',
      '足もとに気をつけて進む', '遠くで何かの声がした',
    ]);
    G.TravelUI.tick();
  },

  /* ---------- 遭遇 ---------- */
  encounter(ids) {
    G.TravelUI.stop();
    const msg = G.UI.el('trip-msg');
    if (msg) msg.textContent = '⚔ 魔物が現れた！';
    if (G.Audio) G.Audio.se('se_alert');

    const scene = document.querySelector('#screen .trip-scene');
    if (scene) scene.classList.add('is-encounter');

    setTimeout(() => G.Err.guard('遭遇', () => {
      G.BattleUI.start(ids, {
        canFlee: true,
        onEnd: async out => {
          if (out.result === 'lose') {
            G.Explore.retreat();
            G.State.save();
            await G.UI.alert('全滅', `
              <p>気を失い、気づけば村の宿で寝かされていた。</p>
              <p class="dim">持ち物と経験は失っていない。</p>`);
            G.UI.show('map');
            return;
          }
          /* 勝っても逃げても、同じ場所から探索を続ける */
          G.State.save();
          G.UI.show('travel');
        },
      });
    }), 480);
  },

  /* ---------- 到着 ---------- */
  async arrive(spotId) {
    G.TravelUI.stop();
    const s = G.SPOTS[spotId];
    const first = !G.State.d.explore.visited.includes(spotId);

    G.UI.show('map');
    if (G.Explore.atTarget()) await G.Quest.onReachedTarget(spotId);
    else if (first) G.UI.toast(`${s.name} に到達した`, 'gold');
  },
};
