/* ===== 適性審査室（転職） ===== */
window.G = window.G || {};

G.UI.register('job', {
  render() {
    const p = G.State.d.player;
    const cur = G.JOBS[p.jobId];
    const opts = G.Char.jobOptions(p);

    // これから先に繋がるジョブ（見通しを示す）
    const future = Object.entries(G.JOBS)
      .filter(([id, j]) => j.from && j.from.includes(p.jobId) && !opts.includes(id));

    // そのジョブに就いたときの見た目を、選ぶ前に見せる
    const preview = id => G.Sprite.hero(Object.assign({}, p, { jobId: id }));

    const card = (id, j, state) => {
      const learn = Object.entries(j.learn || {})
        .map(([lv, s]) => `Lv${lv} ${G.SKILLS[s] ? G.SKILLS[s].name : s}`).join('　');
      return `
        <div class="job-card ${state}" ${state === 'locked' ? '' : `data-act="pick" data-id="${id}"`}>
          <div class="job-row">
            <div class="portrait sm">${preview(id)}</div>
            <div style="flex:1;min-width:0">
              <div class="jn">${j.icon} ${j.name}
                ${state === 'locked' ? `<span class="chip no">Lv${j.req}から</span>` : '<span class="chip ok">転職可能</span>'}</div>
              <div class="jd">${G.util.esc(j.desc)}</div>
              <div class="growth">
                ${Object.entries(j.growth).map(([k, v]) => `<span>${G.STAT_LABEL[k]} +${v}</span>`).join('')}
              </div>
            </div>
          </div>
          ${learn ? `<div class="jd" style="margin-top:6px">習得：${G.util.esc(learn)}</div>` : ''}
        </div>`;
    };

    return `
      <div class="card">
        <div class="card-head">
          <div class="ico">🧭</div>
          <div><div class="ttl">適性審査室</div>
               <div class="sub">フィオナ教授が水晶を撫でている</div></div>
        </div>
        <div class="job-row mb">
          <div class="portrait">${G.Sprite.hero(p)}</div>
          <p style="flex:1;margin:0">現在のジョブは <b class="gold">${cur.icon} ${cur.name}</b>（Lv.${p.level}）。</p>
        </div>
        <p class="dim" style="margin-bottom:0">
          転職すると、そのジョブの成長率で伸びるようになります。これまでに覚えた技は失われません。</p>
      </div>

      <h2>歩んできた道</h2>
      <div class="card tight">
        <p style="margin:0">${p.jobHistory.map(j => `${G.JOBS[j].icon} ${G.JOBS[j].name}`).join(' → ')}</p>
      </div>

      ${opts.length ? `<h2>いま選べるジョブ</h2>
        ${opts.map(id => card(id, G.JOBS[id], '')).join('')}` : `
        <h2>いま選べるジョブ</h2>
        <p class="dim">条件を満たすジョブはまだない。レベルを上げよう。</p>`}

      ${future.length ? `<h2>この先に続く道</h2>
        ${future.map(([id, j]) => card(id, j, 'locked')).join('')}` : ''}

      <button class="btn ghost mt" data-act="back">← もどる</button>`;
  },

  mount() {
    G.UI.on('back', () => G.UI.show('academy'));

    G.UI.on('pick', async ds => {
      const p = G.State.d.player;
      const j = G.JOBS[ds.id];
      const ok = await G.UI.confirm(`${j.icon} ${j.name} になる`, `
        <div class="job-row mb"><div class="portrait">${
          G.Sprite.hero(Object.assign({}, p, { jobId: ds.id }))}</div>
          <p style="flex:1;margin:0">${G.util.esc(j.desc)}</p></div>
        <div class="divider"></div>
        <p class="dim">レベルアップ時の成長：</p>
        <div class="growth">${Object.entries(j.growth)
          .map(([k, v]) => `<span>${G.STAT_LABEL[k]} +${v}</span>`).join('')}</div>
        <p class="mt dim">転職ボーナスで能力が底上げされ、HPとMPが全回復します。</p>`,
        'このジョブになる', 'まだ決めない');
      if (!ok) return;

      const r = G.Char.changeJob(p, ds.id);
      if (!r) { G.UI.toast('転職できませんでした', 'bad'); return; }

      await G.UI.alert('転職', `
        <div class="levelup">${r.job.icon} ${r.job.name} になった！</div>
        <div class="stat-grid">
          ${Object.entries(r.bonus).filter(([, v]) => v > 0).map(([k, v]) => `
            <div class="stat-box"><div class="lbl">${G.STAT_LABEL[k]}</div>
            <div class="val">+${Math.round(v)}</div></div>`).join('')}
        </div>
        ${r.learned.length ? `<p class="mt"><span class="chip gold">習得</span>
          ${r.learned.map(s => G.util.esc(G.SKILLS[s].name)).join('、')}</p>` : ''}`);

      G.State.save();
      G.UI.refresh();
    });
  },
});
