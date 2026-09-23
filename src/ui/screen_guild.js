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

      ${(() => {
        const q = G.Quest.active();
        if (!q) return '';
        const t = G.SPOTS[d.quest.target];
        return `<h2>受注中</h2>
          <div class="card">
            <div class="card-head">
              <div class="ico">${q.icon}</div>
              <div><div class="ttl">${G.util.esc(q.name)}</div>
                   <div class="sub">🎯 目的地：${G.util.esc(t ? t.name : '？')}</div></div>
            </div>
            <p class="dim">${d.quest.reached ? 'すでに到達しています。'
              : '村から歩いて向かってください。'}</p>
          </div>
          <button class="btn" data-act="map">🗺️ 探索に出る</button>
          <button class="btn ghost sm" data-act="abandon">依頼をやめる</button>`;
      })()}

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
      if (d.quest.active) { G.UI.toast('すでに依頼を受けています', 'bad'); return; }
      if (!G.State.aliveParty().length) { G.UI.toast('全員が戦闘不能です', 'bad'); return; }

      const target = G.SPOTS[G.Quest.targetOf(q)];
      const lvr = G.Explore.levelRange(target.id);
      const ok = await G.UI.confirm(`${q.icon} ${q.name}`, `
        <p>${G.util.esc(q.desc)}</p>
        <div class="result-line"><span>目的地</span><b>${G.util.esc(target.name)}</b></div>
        <div class="result-line"><span>推奨レベル</span><b>Lv${lvr[0]}〜${lvr[1]}</b></div>
        <div class="result-line"><span>消費行動力</span><b>${q.ap} AP</b></div>
        <div class="result-line"><span>達成報酬</span><b>${G.util.g(q.gold)} G ／ 経験値 ${G.util.g(q.exp)}</b></div>
        <p class="dim">受注すると目的地が決まります。村から歩いて向かってください。</p>`,
        '受注する', G.T('common.cancel'));
      if (!ok) return;

      const r = G.Quest.accept(q);
      if (!r.ok) { G.UI.toast(r.msg, 'bad'); return; }
      G.State.save();
      G.UI.toast(`目的地：${target.name}`, 'gold');
      G.UI.show('map');
    });

    G.UI.on('abandon', async () => {
      const ok = await G.UI.confirm('依頼をやめる',
        '<p>受注を取り消します。消費した行動力は戻りません。</p>', 'やめる', 'つづける');
      if (!ok) return;
      G.Quest.abandon();
      G.State.save();
      G.UI.refresh();
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

    G.UI.on('map', () => G.UI.show('map'));
    G.UI.on('demon', () => G.UI.show('demon'));
  },
});
