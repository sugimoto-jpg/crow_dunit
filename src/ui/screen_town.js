/* ===== 街（商店街） ===== */
window.G = window.G || {};

G.UI.register('town', {
  render(args) {
    const d = G.State.d;
    const shopKey = args && args.shop;

    if (!shopKey) {
      return `
        ${G.UI.placeHtml('town')}
        <div class="card">
          <div class="card-head">
            <div class="ico">🏪</div>
            <div><div class="ttl">王都アルカディア 商店街</div>
                 <div class="sub">所持金 ${G.util.g(d.gold)} G</div></div>
          </div>
          <p class="dim" style="margin-bottom:0">
            品揃えはギルド階級によって変わる。階級が上がれば、店の奥から良い品が出てくる。</p>
        </div>
        ${Object.entries(G.SHOPS).map(([k, s]) => {
          const n = G.World.shopStock(k).length;
          return `<button class="btn" data-act="shop" data-id="${k}">
            <div class="row"><span style="font-size:18px">${s.icon}</span><b>${G.util.esc(s.name)}</b>
              <span class="spacer"></span><span class="chip">${n}品</span></div>
          </button>`;
        }).join('')}
        <h2>手持ち</h2>
        <button class="btn" data-act="sell">💱 売却する<span class="btn-sub">不要な品を店に引き取ってもらう</span></button>
        <button class="btn" data-act="bag">🎒 持ち物を確認する</button>`;
    }

    if (shopKey === 'sell') {
      const list = Object.entries(d.inventory)
        .filter(([id, n]) => n > 0 && G.ITEMS[id] && G.ITEMS[id].type !== 'key')
        .map(([id, n]) => ({ id, n, item: G.ITEMS[id] }));
      return `
        <h2>売却</h2>
        <p class="dim" style="margin-top:-4px">買取価格は定価の4割です。</p>
        ${list.length ? list.map(({ id, n, item }) => `
          <div class="list-item">
            <div class="ico">${item.icon || '📦'}</div>
            <div class="body">
              <div class="nm">${G.util.esc(item.name)} <span class="dim">×${n}</span></div>
              <div class="ds">1つ ${G.util.g(G.World.sellPrice(id))} G</div>
            </div>
            <div class="act"><button class="btn sm" data-act="dosell" data-id="${id}">売る</button></div>
          </div>`).join('') : '<p class="dim">売れる物がない。</p>'}
        <button class="btn ghost mt" data-act="back">← もどる</button>`;
    }

    if (shopKey === 'bag') {
      const groups = [['consume', '消耗品'], ['weapon', '武器'], ['armor', '防具'],
        ['accessory', '装飾品'], ['material', '素材']];
      return `
        <h2>持ち物</h2>
        ${groups.map(([t, label]) => {
          const list = G.State.itemsByType(t);
          if (!list.length) return '';
          return `<h3 style="margin-top:14px">${label}</h3>
            ${list.map(({ id, n }) => G.UI.itemLine(id, n,
              G.ITEMS[id].use ? `<button class="btn sm" data-act="use" data-id="${id}">使う</button>` : ''
            )).join('')}`;
        }).join('')}
        <button class="btn ghost mt" data-act="back">← もどる</button>`;
    }

    const shop = G.SHOPS[shopKey];
    const stock = G.World.shopStock(shopKey);
    return `
      <div class="card">
        <div class="card-head">
          <div class="ico">${shop.icon}</div>
          <div><div class="ttl">${G.util.esc(shop.name)}</div>
               <div class="sub">所持金 ${G.util.g(d.gold)} G</div></div>
        </div>
      </div>
      ${stock.map(({ id, item, price }) => `
        <div class="list-item">
          <div class="ico">${item.icon || '📦'}</div>
          <div class="body">
            <div class="nm">${G.util.esc(item.name)}</div>
            <div class="ds">${G.util.esc(item.desc)}</div>
            ${item.mods ? `<div class="ds gold">${G.UI.modsText(item)}</div>` : ''}
            <div class="ds">所持 ${G.State.countItem(id)}</div>
          </div>
          <div class="act">
            <button class="btn sm ${d.gold >= price ? 'gold' : ''}" data-act="buy" data-id="${id}"
              ${d.gold >= price ? '' : 'disabled'}>${G.util.g(price)}G</button>
          </div>
        </div>`).join('')}
      <button class="btn ghost mt" data-act="back">← もどる</button>`;
  },

  mount(args) {
    G.UI.on('shop', ds => G.UI.show('town', { shop: ds.id }));
    G.UI.on('sell', () => G.UI.show('town', { shop: 'sell' }));
    G.UI.on('bag', () => G.UI.show('town', { shop: 'bag' }));
    G.UI.on('back', () => G.UI.show('town'));

    G.UI.on('buy', ds => {
      const r = G.World.buy(ds.id, 1);
      if (!r.ok) { G.UI.toast(r.msg, 'bad'); return; }
      G.UI.toast(`${G.ITEMS[ds.id].name} を購入した`, 'good');
      G.State.save();
      G.UI.show('town', args);
    });

    G.UI.on('dosell', ds => {
      const r = G.World.sell(ds.id, 1);
      if (!r.ok) { G.UI.toast(r.msg, 'bad'); return; }
      G.UI.toast(`${G.util.g(r.gain)}G で売却した`, 'good');
      G.State.save();
      G.UI.show('town', args);
    });

    G.UI.on('use', async ds => {
      const d = G.State.d;
      const target = await G.UI.modal({
        title: `${G.ITEMS[ds.id].name} を使う`,
        body: '<p class="dim">誰に使いますか？</p>',
        actions: d.party.map(c => ({
          label: `${c.icon} ${c.name}（HP ${Math.max(0, c.hp)}）`, value: c.key,
        })).concat([{ label: 'やめる', cls: 'ghost', value: null }]),
      });
      if (!target) return;
      const r = G.World.useItemOutside(ds.id, target);
      G.UI.toast(r.msg, r.ok ? 'good' : 'bad');
      if (r.ok) G.State.save();
      G.UI.show('town', args);
    });
  },
});
