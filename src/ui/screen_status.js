/* ===== 状態・装備・技 ===== */
window.G = window.G || {};

G.UI.register('status', {
  render(args) {
    const d = G.State.d;
    const key = (args && args.key) || d.player.key;
    const c = d.party.find(x => x.key === key) || d.player;
    const der = G.Char.derived(c);
    const job = G.JOBS[c.jobId];

    const tabs = d.party.map(x => `
      <button class="btn sm ${x.key === c.key ? 'gold' : 'ghost'}" data-act="pick" data-id="${x.key}">
        ${x.icon} ${G.util.esc(x.name)}
      </button>`).join('');

    const slots = [['weapon', '武器', '🗡️'], ['armor', '防具', '🛡️'], ['accessory', '装飾品', '💍']];

    return `
      <div class="btn-row mb">${tabs}</div>

      <div class="card">
        <div class="card-head">
          <div class="ico">${c.icon}</div>
          <div style="flex:1">
            <div class="ttl">${G.util.esc(c.name)}
              <span class="tag">${job.icon} ${job.name}</span>
              <span class="tag lv">Lv.${c.level}</span></div>
            <div class="sub">${G.util.esc(job.desc)}</div>
          </div>
        </div>
        ${c.titles && c.titles.length ? `<div class="row wrap mb">
          ${c.titles.map(t => `<span class="chip gold">${G.util.esc(t)}</span>`).join('')}</div>` : ''}
        <div class="kv">
          <div class="k">HP</div><div class="v">${Math.max(0, c.hp)} / ${der.hp}</div>
          <div class="k">MP</div><div class="v">${c.mp} / ${der.mp}</div>
          <div class="k">経験値</div>
          <div class="v">${G.util.g(c.exp)} / ${G.util.g(G.Char.expToNext(c.level))}</div>
        </div>
        ${G.UI.bar(c.exp, G.Char.expToNext(c.level), 'g')}
        <div class="stat-grid mt">
          ${['atk', 'def', 'mag', 'res', 'spd'].map(k => {
            const base = Math.floor(c.stats[k]);
            const plus = der[k] - base;
            return `<div class="stat-box">
              <div class="lbl">${G.STAT_LABEL[k]}</div>
              <div class="val">${der[k]}</div>
              ${plus ? `<div class="plus">装備 +${plus}</div>` : '<div class="plus">&nbsp;</div>'}
            </div>`;
          }).join('')}
        </div>
      </div>

      <h2>装備</h2>
      ${slots.map(([slot, label, icon]) => {
        const id = c.equip[slot];
        const it = id ? G.ITEMS[id] : null;
        return `
          <div class="list-item">
            <div class="ico">${it ? (it.icon || icon) : icon}</div>
            <div class="body">
              <div class="nm">${label}：${it ? G.util.esc(it.name) : '<span class="dim">なし</span>'}</div>
              <div class="ds gold">${it ? G.UI.modsText(it) : ''}</div>
            </div>
            <div class="act">
              <button class="btn sm" data-act="equip" data-slot="${slot}" data-key="${c.key}">替える</button>
            </div>
          </div>`;
      }).join('')}

      <h2>おぼえている技</h2>
      ${c.skills.length ? c.skills.map(id => {
        const s = G.SKILLS[id];
        if (!s) return '';
        const el = s.el && s.el !== 'none' ? `<span class="chip">${G.ELEMENTS[s.el].icon}${G.ELEMENTS[s.el].name}</span>` : '';
        return `<div class="list-item">
          <div class="ico">✨</div>
          <div class="body">
            <div class="nm">${G.util.esc(s.name)} <span class="chip">MP ${s.mp}</span> ${el}</div>
            <div class="ds">${G.util.esc(s.desc || '')}</div>
          </div>
        </div>`;
      }).join('') : '<p class="dim">まだ何も覚えていない。</p>'}

      <h2>歩んだ道</h2>
      <div class="card tight">
        <p style="margin:0">${c.jobHistory.map(j => `${G.JOBS[j].icon} ${G.JOBS[j].name}`).join(' → ')}</p>
      </div>

      <h2>記録</h2>
      <div class="card tight">
        <div class="kv">
          <div class="k">戦闘回数</div><div class="v">${d.stats.battles}</div>
          <div class="k">勝利</div><div class="v">${d.stats.wins}</div>
          <div class="k">全滅</div><div class="v">${d.stats.wipes}</div>
          <div class="k">達成依頼</div><div class="v">${d.stats.quests}</div>
          <div class="k">受けた授業</div><div class="v">${d.stats.lessons}</div>
          <div class="k">出会った魔物</div><div class="v">${Object.keys(d.bestiary).length} / ${Object.keys(G.ENEMIES).length}</div>
        </div>
      </div>`;
  },

  mount() {
    G.UI.on('pick', ds => G.UI.show('status', { key: ds.id }));

    G.UI.on('equip', async ds => {
      const d = G.State.d;
      const c = d.party.find(x => x.key === ds.key);
      const slot = ds.slot;
      const owned = G.State.itemsByType(slot);

      // 他のキャラが装備中の物は選べないようにする
      const usedByOthers = {};
      for (const o of d.party) {
        if (o.key === c.key) continue;
        const id = o.equip[slot];
        if (id) usedByOthers[id] = (usedByOthers[id] || 0) + 1;
      }
      const choices = owned.filter(({ id, n }) => n > (usedByOthers[id] || 0));

      const body = choices.length
        ? choices.map(({ id, item }) => {
          const cur = c.equip[slot];
          return `<div class="list-item">
            <div class="ico">${item.icon || '📦'}</div>
            <div class="body">
              <div class="nm">${G.util.esc(item.name)} ${cur === id ? '<span class="chip ok">装備中</span>' : ''}</div>
              <div class="ds gold">${G.UI.modsText(item)}</div>
            </div>
            <div class="act"><button class="btn sm" data-pick="${id}">選ぶ</button></div>
          </div>`;
        }).join('')
        : '<p class="dim">替えられる品を持っていない。</p>';

      const choice = await G.UI.modal({
        title: `${c.name} の装備を替える`,
        body,
        actions: [
          ...(c.equip[slot] ? [{ label: '外す', cls: 'ghost', value: '__off' }] : []),
          { label: 'やめる', cls: 'ghost', value: null },
        ],
        // 一覧の「選ぶ」からも結果を返す
        bind: done => document.querySelectorAll('#modal [data-pick]').forEach(el =>
          el.addEventListener('click', () => done(el.dataset.pick))),
      });

      if (!choice) return;
      if (choice === '__off') G.Char.unequip(c, slot);
      else G.Char.equipItem(c, choice);
      G.State.save();
      G.UI.toast('装備を変更した', 'good');
      G.UI.show('status', { key: c.key });
    });
  },
});
