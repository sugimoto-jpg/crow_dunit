/* ===== 冒険者ギルド「暁の天秤」 ===== */
window.G = window.G || {};

G.UI.register('guild', {
  render() {
    const d = G.State.d;

    if (!d.guild.registered) {
      return `
        ${G.UI.placeHtml('guild')}
        <div class="card">
          <div class="card-head">
            <div class="ico">⚖️</div>
            <div><div class="ttl">冒険者ギルド「暁の天秤」</div>
                 <div class="sub">街の東門近く</div></div>
          </div>
          <p>木の掲示板に、羊皮紙の依頼書が所狭しと貼られている。</p>
          <p class="dim">登録は無料。ただし依頼は自己責任だ。</p>
        </div>
        <button class="btn primary" data-act="register">
          📋 冒険者登録をする
          <span class="btn-sub">F級から始まります。依頼をこなして階級を上げましょう</span>
        </button>`;
    }

    const rank = G.World.rank();
    const promo = G.World.promotionInfo();
    const quests = G.World.availableQuests();
    const byRank = {};
    for (const q of quests) (byRank[q.rank] = byRank[q.rank] || []).push(q);

    return `
      ${G.UI.placeHtml('guild')}
      <div class="card">
        <div class="card-head">
          <div class="ico">⚖️</div>
          <div style="flex:1">
            <div class="ttl">冒険者ギルド「暁の天秤」</div>
            <div class="sub">${rank.desc}</div>
          </div>
          <span class="chip rank gold" style="color:${rank.color};border-color:${rank.color}">${rank.name}</span>
        </div>
        <div class="kv">
          <div class="k">達成依頼</div><div class="v">${d.guild.totalClears} 件</div>
          <div class="k">残り行動力</div><div class="v">${d.ap} / ${d.apMax} AP</div>
        </div>
      </div>

      ${promo.max ? '<div class="card tight"><span class="chip gold">最高位に到達しています</span></div>' : `
        <div class="card tight">
          <div class="row"><b>${promo.next.name}への昇格</b><span class="spacer"></span>
            ${promo.ok ? '<span class="chip ok">条件達成</span>' : '<span class="chip">条件未達</span>'}</div>
          <div class="kv mt">
            <div class="k">必要な達成件数</div>
            <div class="v">${d.guild.totalClears} / ${promo.next.clears}</div>
            <div class="k">必要レベル</div>
            <div class="v">${d.player.level} / ${promo.next.minLv}</div>
          </div>
          ${promo.ok ? `
            <button class="btn gold mt" data-act="promo">
              ⚔️ 昇格試験を受ける
              <span class="btn-sub">${promo.boss
                ? '試験官が用意した魔物との実戦です'
                : '手続きのみで昇格できます'}</span>
            </button>` : `<p class="dim mt" style="margin-bottom:0">${promo.msg}</p>`}
        </div>`}

      ${d.demon.unlocked ? `
        <button class="btn danger" data-act="demon">
          🌑 魔王領へ向かう
          <span class="btn-sub">${G.World.demonFloor() ? G.World.demonFloor().name : ''}</span>
        </button>` : ''}

      <h2>依頼</h2>
      ${Object.keys(byRank).sort((a, b) => b - a).map(r => `
        <h3 style="margin-top:14px">${G.RANKS[r].name}の依頼</h3>
        ${byRank[r].map(q => `
          <button class="btn" data-act="quest" data-id="${q.id}" ${d.ap >= q.ap ? '' : 'disabled'}>
            <div class="row">
              <span style="font-size:18px">${q.icon}</span><b>${G.util.esc(q.name)}</b>
              <span class="spacer"></span>
              <span class="chip">${q.ap} AP</span>
              <span class="chip gold">${G.util.g(q.gold)} G</span>
            </div>
            <span class="btn-sub">${G.util.esc(q.desc)}<br>
              出現：${q.enemies.map(e => G.ENEMIES[e].name).join('、')}
              ${q.reward ? `／報酬品：${q.reward.map(x => `${G.ITEMS[x.id].name}×${x.n}`).join('、')}` : ''}
            </span>
          </button>`).join('')}`).join('')}
      ${quests.length ? '' : '<p class="dim">今は受けられる依頼がない。</p>'}`;
  },

  mount() {
    G.UI.on('register', () => {
      G.World.registerGuild();
      G.State.save();
      G.UI.toast('冒険者として登録された（F級）', 'good');
      G.UI.refresh();
    });

    G.UI.on('quest', async ds => {
      const d = G.State.d;
      const q = G.QUESTS.find(x => x.id === ds.id);
      if (!q) return;
      if (!G.State.aliveParty().length) { G.UI.toast('全員が戦闘不能です', 'bad'); return; }
      const ok = await G.UI.confirm(`${q.icon} ${q.name}`, `
        <p>${G.util.esc(q.desc)}</p>
        <div class="result-line"><span>消費行動力</span><b>${q.ap} AP</b></div>
        <div class="result-line"><span>報酬</span><b>${G.util.g(q.gold)} G ／ 経験値 ${G.util.g(q.exp)}</b></div>
        <div class="result-line"><span>出現する魔物</span><b>${q.enemies.map(e => G.ENEMIES[e].name).join('、')}</b></div>`,
        '受注する', G.T('common.cancel'));
      if (!ok) return;
      if (!G.World.spendAp(q.ap)) { G.UI.toast('行動力が足りません', 'bad'); return; }

      G.BattleUI.start(q.enemies, {
        canFlee: true,
        onEnd: async out => {
          if (out.result === 'win') {
            const r = G.World.completeQuest(q);
            await G.UI.alert('📋 依頼達成', `
              <p>ギルドの受付に報告を済ませた。</p>
              <div class="result-line"><span>達成報酬</span><b>${G.util.g(r.gold)} G</b></div>
              <div class="result-line"><span>追加経験値</span><b>${G.util.g(r.exp)}</b></div>
              ${r.items.length ? r.items.map(i => G.UI.itemLine(i.id, i.n)).join('') : ''}`);
            await G.UI.showLevelReports(r.levelReports);
            if (r.promoReady) G.UI.toast('昇格の条件を満たしたかもしれません', 'gold');
          }
          G.State.save();
          G.UI.show('guild');
          G.Story.check();
        },
      });
    });

    G.UI.on('promo', async () => {
      const promo = G.World.promotionInfo();
      if (!promo.ok) { G.UI.toast(promo.msg, 'bad'); return; }

      if (!promo.boss) {
        const r = G.World.promote();
        await G.UI.alert('⚔️ 昇格', `<div class="levelup">${r.rank.name}に昇格した！</div>
          <p class="dim">${G.util.esc(r.rank.desc)}</p>`);
        G.State.save();
        G.UI.refresh();
        return;
      }

      const e = G.ENEMIES[promo.boss];
      const ok = await G.UI.confirm('昇格試験', `
        <p>試験官が用意したのは <b class="gold">${G.util.esc(e.name)}</b> だ。</p>
        <p class="dim">逃げることはできない。準備はいいか？</p>`, '挑む', 'やめておく');
      if (!ok) return;

      G.BattleUI.start([promo.boss], {
        canFlee: false,
        intro: e.intro || '',
        onEnd: async out => {
          if (out.result === 'win') {
            const r = G.World.promote();
            await G.UI.alert('⚔️ 昇格', `<div class="levelup">${r.rank.name}に昇格した！</div>
              <p class="dim">${G.util.esc(r.rank.desc)}</p>`);
          }
          G.State.save();
          G.UI.show('guild');
          G.Story.check();
        },
      });
    });

    G.UI.on('demon', () => G.UI.show('demon'));
  },
});
