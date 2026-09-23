/* ===== 地図と地点 =====
 * いる場所・行ける先・目的地を見せ、出発の入口になる画面。
 * 判定はすべて G.Explore（画面を知らない層）が持っている。
 */
window.G = window.G || {};

G.UI.register('map', {
  render() {
    const d = G.State.d;
    const here = G.Explore.here();
    if (!here) return '<div class="card"><p>探索のデータを読み込めませんでした。</p></div>';

    const target = G.Explore.questTarget();
    const route = target ? G.Explore.routeTo(target) : [];
    const lvr = G.Explore.levelRange(here.id);
    const pool = G.Explore.enemyPool(here.id);

    /* 出現する魔物。まだ戦ったことのないものは伏せる（図鑑と連動） */
    const foes = pool.length
      ? pool.map(id => (d.bestiary[id] ? G.util.esc(G.ENEMIES[id].name) : '？？？')).join('、')
      : 'なし';

    return `
      ${G.UI.placeHtml ? '' : ''}
      <div class="card">
        <div class="card-head">
          <div class="ico">${G.spotIcon(here.id)}</div>
          <div>
            <div class="ttl">${G.util.esc(here.name)}</div>
            <div class="sub">${lvr ? `推奨 Lv${lvr[0]}〜${lvr[1]}` : ''}</div>
          </div>
        </div>
        <p>${G.util.esc(here.description)}</p>
        ${here.type === 'town' ? '' :
          `<p class="dim">出現する魔物：${foes}</p>`}
      </div>

      <h2>地図</h2>
      ${G.MapUI.boardHtml(here.id, route, target)}

      ${G.Explore.canCamp() ? `
        <h2>野営</h2>
        ${G.MapUI.campHtml()}` : ''}

      <h2>行き先</h2>
      ${G.MapUI.exitsHtml(target, route)}

      ${here.type === 'town'
        ? '<button class="btn ghost" data-act="back">🏰 拠点へもどる</button>'
        : '<button class="btn ghost" data-act="home">🏘️ 村まで引き返す</button>'}`;
  },

  mount() {
    G.UI.on('go', ds => G.MapUI.depart(ds.to));
    G.UI.on('camp', () => {
      const n = G.Explore.camp();
      if (!n) { G.UI.toast('全員すでに万全です', 'good'); return; }
      if (G.Audio) G.Audio.se('se_heal');
      G.UI.toast(`焚き火で休んだ。${n}人が回復した`, 'good');
      G.State.save();
      G.UI.show('map');
    });
    G.UI.on('boss', () => G.MapUI.bossPrompt());
    G.UI.on('back', () => G.UI.show('home'));
    G.UI.on('home', async () => {
      const ok = await G.UI.confirm('村まで引き返す',
        '<p>いま来た道を戻ります。進んだ分はやり直しになります。</p>', '戻る', G.T('common.cancel'));
      if (!ok) return;
      G.Explore.retreat();
      G.State.save();
      G.UI.show('map');
    });
  },
});

/* 地点の絵文字。
 * 種類（野外・洞窟…）だけだと、森も草原も同じ絵になってしまう。
 * その土地（エリア）の絵文字があればそちらを使う。 */
G.SPOT_ICON = { town: '🏘️', field: '🌾', dungeon: '🕳️', boss: '💀' };

G.spotIcon = function (id) {
  const s = G.SPOTS[id];
  if (!s) return '📍';
  if (s.type === 'boss' || s.type === 'town') return G.SPOT_ICON[s.type];
  const a = s.area && G.AREAS[s.area];
  return (a && a.icon) || G.SPOT_ICON[s.type] || '📍';
};

G.MapUI = {

  /* ---------- 地図 ---------- */
  /* 地点を線で結んだ図。SVGで描くので外部画像を使わない。 */
  boardHtml(atId, route, target) {
    const ids = Object.keys(G.SPOTS);
    const lines = [];
    const done = {};
    for (const id of ids) {
      for (const to of G.SPOTS[id].links) {
        const key = [id, to].sort().join('|');
        if (done[key]) continue;
        done[key] = 1;
        const a = G.SPOTS[id], b = G.SPOTS[to];
        const onRoute = route.includes(id) && route.includes(to)
          && Math.abs(route.indexOf(id) - route.indexOf(to)) === 1;
        lines.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
          class="mp-link ${onRoute ? 'is-route' : ''}"/>`);
      }
    }

    const nodes = ids.map(id => {
      const s = G.SPOTS[id];
      const cls = [
        'mp-node',
        id === atId ? 'is-here' : '',
        G.Explore.visited(id) ? 'is-seen' : '',
        id === target ? 'is-target' : '',
        G.Explore.cleared(id) ? 'is-clear' : '',
      ].filter(Boolean).join(' ');
      return `<div class="${cls}" style="left:${s.x}%;top:${s.y}%">
          <span class="mp-ico">${G.spotIcon(id)}</span>
          <span class="mp-name">${G.util.esc(
            (G.Explore.visited(id) || id === target) ? s.name : '？？？')}</span>
          ${id === target ? '<span class="mp-star">★</span>' : ''}
        </div>`;
    }).join('');

    return `<div class="mapboard">
        <svg class="mp-lines" viewBox="0 0 100 100" preserveAspectRatio="none"
             aria-hidden="true">${lines.join('')}</svg>
        ${nodes}
      </div>`;
  },

  /* ---------- 行き先のボタン ---------- */
  exitsHtml(target, route) {
    const here = G.Explore.here();
    const lv = G.State.d.player.level;

    /* ボスの間にいるなら、まず「挑む」を出す */
    const bossBtn = (here.type === 'boss' && G.Explore.bossOf(here.id))
      ? `<button class="btn primary" data-act="boss">
           ⚔️ 奥へ進む<span class="btn-sub">${G.Explore.cleared(here.id)
             ? 'もう一度挑む' : 'この先から強大な魔力を感じる……'}</span>
         </button>` : '';

    const list = G.Explore.exits().map(x => {
      const s = x.spot;
      const next = route.length && route.indexOf(here.id) >= 0
        && route[route.indexOf(here.id) + 1] === x.id;
      const lvr = G.Explore.levelRange(x.id);
      const known = x.visited || x.id === target;
      /* ★ だけだと「ここが目的地」と読めてしまう。
       * 通り道なのか目的地そのものなのかを、言葉で分けて出す。 */
      const guide = x.id === target ? '★ ここが目的地'
        : next ? '★ 目的地はこの先' : '';
      return `<button class="btn ${next ? 'gold' : ''}" data-act="go" data-to="${x.id}">
          ${G.spotIcon(x.id)} ${G.util.esc(known ? s.name : '未踏の道')}
          <span class="btn-sub">
            ${guide ? `<b class="gold">${guide}</b> ／ ` : ''}${x.steps}歩${lvr ? ` ／ 推奨 Lv${lvr[0]}〜${lvr[1]}` : ''}
            ${x.warn ? ' ／ <b class="bad">危険：レベルが足りていません</b>' : ''}
          </span>
        </button>`;
    }).join('');

    return bossBtn + list;
  },

  /* ---------- 野営 ---------- */
  /* 何度でも無料で休める。道中の消耗を区間ごとに立て直すための場所。 */
  campHtml() {
    const party = G.State.d.party;
    const hurt = party.filter(c => c.hp < G.Char.maxHp(c) || c.mp < G.Char.maxMp(c));
    const hp = party.reduce((a, c) => a + Math.max(0, c.hp), 0);
    const max = party.reduce((a, c) => a + G.Char.maxHp(c), 0);
    return `<button class="btn ${hurt.length ? 'primary' : ''}" data-act="camp">
        🔥 焚き火で休む<span class="btn-sub">
          無料・何度でも ／ パーティHP ${Math.round(hp / Math.max(1, max) * 100)}%
          ${hurt.length ? ` ／ ${hurt.length}人が消耗している` : ' ／ 全員が万全'}
        </span>
      </button>`;
  },

  /* ---------- 出発 ---------- */
  async depart(toId) {
    const s = G.SPOTS[toId];
    if (!s) return;
    if (!G.State.aliveParty().length) { G.UI.toast('全員が戦闘不能です', 'bad'); return; }

    const lv = G.State.d.player.level;
    if (lv < (s.requiredLevel || 1) - 2) {
      const ok = await G.UI.confirm('本当に進みますか？', `
        <p><b class="bad">${G.util.esc(s.name)}</b> の推奨レベルに届いていません。</p>
        <p class="dim">全滅すると村まで戻されます。</p>`, '進む', 'やめる');
      if (!ok) return;
    }
    if (!G.Explore.depart(toId)) { G.UI.toast('そこへは行けません', 'bad'); return; }
    G.UI.show('travel');
  },

  /* ---------- ボス戦 ---------- */
  async bossPrompt() {
    const here = G.Explore.here();
    const bossId = G.Explore.bossOf(here.id);
    if (!bossId) return;
    if (!G.State.aliveParty().length) { G.UI.toast('全員が戦闘不能です', 'bad'); return; }

    const e = G.ENEMIES[bossId];
    const ok = await G.UI.confirm(`${G.util.esc(here.name)}`, `
      <p>${G.util.esc(here.description)}</p>
      <p>奥に <b class="gold">${G.util.esc(e.name)}</b> が待ち構えている。</p>
      <p class="dim">ここから先は逃げられません。</p>`, '進む', '引き返す');
    if (!ok) return;

    G.BattleUI.start([bossId], {
      canFlee: false,
      intro: e.intro || '',
      onEnd: async out => {
        if (out.result !== 'win') {
          G.Explore.retreat();
          G.State.save();
          await G.UI.alert('撤退', '<p>やむなく村まで引き返した。</p>');
          G.UI.show('map');
          return;
        }
        const r = G.Explore.clearBoss(here.id);
        if (r.first) {
          await G.UI.alert('💀 撃破', `
            <div class="levelup">${G.util.esc(e.name)} を倒した！</div>
            ${r.gold ? `<div class="result-line"><span>報酬</span><b>${G.util.g(r.gold)} G</b></div>` : ''}
            ${r.exp ? `<div class="result-line"><span>追加経験値</span><b>${G.util.g(r.exp)}</b></div>` : ''}
            ${r.items.map(i => G.UI.itemLine(i.id, i.n)).join('')}`);
          await G.UI.showLevelReports(r.levelReports);
        }
        await G.Quest.onBossCleared(here.id);
        G.State.save();
        G.UI.show('map');
      },
    });
  },
};

/* ===== 依頼の進行のうち、画面を伴う部分 =====
 * 判定は G.Quest（画面を知らない層）にあり、ここは表示だけを足す。
 * 探索の各所から呼ばれるので、地図の画面と一緒に置いている。 */
G.Quest.ui = {};

/* 目的地に着いたとき */
G.Quest.onReachedTarget = async function (spotId) {
  const d = G.State.d;
  if (!d.quest.active || d.quest.target !== spotId) return;
  d.quest.reached = true;
  const q = G.Quest.active();

  if (G.Quest.needsBoss()) {
    await G.UI.alert('🎯 目的地に到着', `
      <p>${G.util.esc(q.name)} の目的地にたどり着いた。</p>
      <p class="dim">この先に目当てのものがいる。準備を整えて奥へ進もう。</p>`);
    G.State.save();
    return;
  }

  const r = G.Quest.complete();
  await G.UI.alert('📋 依頼達成', `
    <p>目的を果たした。ギルドに報告しよう。</p>
    <div class="result-line"><span>達成報酬</span><b>${G.util.g(r.gold)} G</b></div>
    <div class="result-line"><span>追加経験値</span><b>${G.util.g(r.exp)}</b></div>
    ${r.items.map(i => G.UI.itemLine(i.id, i.n)).join('')}`);
  await G.UI.showLevelReports(r.levelReports);
  if (r.promoReady) G.UI.toast('昇格の条件を満たしたかもしれません', 'gold');
  G.State.save();
  G.UI.show('map');
};

/* ボスを倒したとき */
G.Quest.onBossCleared = async function (spotId) {
  const d = G.State.d;
  if (!d.quest.active || d.quest.target !== spotId) return;
  const r = G.Quest.complete();
  await G.UI.alert('📋 依頼達成', `
    <p>目的を果たした。ギルドに報告しよう。</p>
    <div class="result-line"><span>達成報酬</span><b>${G.util.g(r.gold)} G</b></div>
    <div class="result-line"><span>追加経験値</span><b>${G.util.g(r.exp)}</b></div>
    ${r.items.map(i => G.UI.itemLine(i.id, i.n)).join('')}`);
  await G.UI.showLevelReports(r.levelReports);
  if (r.promoReady) G.UI.toast('昇格の条件を満たしたかもしれません', 'gold');
  G.State.save();
};
