/* ===== 拠点（学生寮） ===== */
window.G = window.G || {};

G.UI.register('home', {
  render() {
    const d = G.State.d;
    const au = (G.Audio && G.Audio.settings) || { bgm: false, se: false };
    const vo = (G.Voice && G.Voice.settings) || { shout: false, story: false };
    const notices = [];

    if (!d.graduated && !d.tuitionPaid) {
      const amt = G.World.tuitionAmount();
      notices.push({
        cls: d.gold >= amt ? '' : 'no',
        icon: '💰',
        text: `今学期の学費 ${G.util.g(amt)}G が未納です。` +
              (d.gold >= amt ? '学院の事務室で納入できます。' : '依頼をこなして工面しましょう。'),
      });
    }
    if (d.examAvailable) {
      notices.push({ cls: 'gold', icon: '📝', text: '学期末試験の時期です。学院で受験してください。' });
    }
    const promo = G.World.promotionInfo();
    if (d.guild.registered && promo.ok) {
      notices.push({ cls: 'ok', icon: '⚔️', text: `${promo.next.name}への昇格試験を受けられます。` });
    }
    if (d.demon.unlocked && !d.ending) {
      notices.push({ cls: 'gold', icon: '🌑', text: '魔王領への門が開いています。ギルドから向かえます。' });
    }

    return `
      ${G.UI.placeHtml('home')}
      <div class="card">
        <div class="card-head">
          <div class="ico">🛏️</div>
          <div>
            <div class="ttl">学生寮の自室</div>
            <div class="sub">${G.World.dateLabel()}　通算 ${d.day}日目</div>
          </div>
        </div>
        <div class="kv">
          <div class="k">残り行動力</div><div class="v">${d.ap} / ${d.apMax} AP</div>
          <div class="k">所持金</div><div class="v gold">${G.util.g(d.gold)} G</div>
          <div class="k">ギルド階級</div><div class="v">${d.guild.registered ? G.World.rank().name : '未登録'}</div>
          <div class="k">達成依頼</div><div class="v">${d.guild.totalClears} 件</div>
          <div class="k">難易度</div><div class="v">${G.DIFFICULTY[d.difficulty].name}</div>
        </div>
      </div>

      ${notices.map(n => `
        <div class="card tight">
          <div class="row"><span style="font-size:20px">${n.icon}</span>
          <span class="${n.cls === 'no' ? 'chip no' : n.cls === 'ok' ? 'chip ok' : n.cls === 'gold' ? 'chip gold' : 'chip'}"
                style="white-space:normal;text-align:left">${G.util.esc(n.text)}</span></div>
        </div>`).join('')}

      <h2>仲間たち</h2>
      ${d.party.map(c => {
        const der = G.Char.derived(c);
        return `
          <div class="card tight">
            <div class="card-head" style="margin-bottom:6px">
              <div class="ico">${c.icon}</div>
              <div style="flex:1">
                <div class="ttl">${G.util.esc(c.name)}
                  <span class="tag">${G.Char.jobName(c)}</span>
                  <span class="tag lv">Lv.${c.level}</span></div>
                <div class="sub">${c.hp <= 0 ? '<span class="chip no">戦闘不能</span>' : ''}</div>
              </div>
            </div>
            <div class="kv"><div class="k">HP</div><div class="v">${Math.max(0, c.hp)} / ${der.hp}</div></div>
            ${G.UI.bar(c.hp, der.hp, 'hp')}
            <div class="kv mt"><div class="k">MP</div><div class="v">${c.mp} / ${der.mp}</div></div>
            ${G.UI.bar(c.mp, der.mp, 'mp')}
          </div>`;
      }).join('')}

      <h2>行動</h2>
      <button class="btn gold" data-act="map">
        🗺️ 探索に出る
        <span class="btn-sub">${(() => {
          const q = G.Quest.active();
          if (q) { const t = G.SPOTS[d.quest.target]; return `🎯 目的地：${G.util.esc(t ? t.name : '？')}`; }
          return `現在地：${G.util.esc((G.Explore.here() || {}).name || '村')}`;
        })()}</span>
      </button>
      <button class="btn primary" data-act="rest">
        🌙 今日は休む
        <span class="btn-sub">HPとMPが全回復し、翌日になります（残り ${d.ap} AP を捨てます）</span>
      </button>
      <button class="btn" data-act="save">💾 セーブする<span class="btn-sub">進行状況をこの端末に保存します</span></button>

      <h2>音</h2>
      <div class="row" style="gap:8px">
        <button class="btn sm ${au.bgm ? '' : 'ghost'}" data-act="bgm">${au.bgm ? '🔊' : '🔇'} BGM</button>
        <button class="btn sm ${au.se ? '' : 'ghost'}" data-act="se">${au.se ? '🔔' : '🔕'} 効果音</button>
      </div>
      ${G.Voice && G.Voice.supported ? `
        <div class="row" style="gap:8px;margin-top:8px">
          <button class="btn sm ${vo.shout ? '' : 'ghost'}" data-act="vshout">${vo.shout ? '🗣️' : '🤐'} 掛け声</button>
          <button class="btn sm ${vo.story ? '' : 'ghost'}" data-act="vstory">${vo.story ? '📖' : '🔇'} 物語の読み上げ</button>
        </div>
        ${G.Voice.ready ? '' : `<p class="dim" style="font-size:11.5px;margin-top:4px">
          この端末には日本語の読み上げ音声が見つかりませんでした。
          端末の設定で日本語の音声を追加すると喋るようになります。</p>`}` : ''}

      <p class="dim" style="font-size:11.5px;margin-top:4px">
        音が出ないときは、端末の音量と、iPhone の場合は本体横のマナーモードをご確認ください。
        ${G.Voice && G.Voice.supported ? '声は端末の読み上げ機能を使っています。' : ''}</p>

      <button class="btn ghost" data-act="title">タイトルへもどる</button>`;
  },

  mount() {
    G.UI.on('rest', async () => {
      const d = G.State.d;
      if (d.ap > 0) {
        const ok = await G.UI.confirm('休みますか？',
          `<p>まだ <b class="gold">${d.ap} AP</b> 残っています。</p><p class="dim">休むと翌日になります。</p>`,
          '休む', G.T('common.cancel'));
        if (!ok) return;
      }
      const events = G.World.endDay(true);
      G.State.save();
      for (const e of events) G.UI.toast(e.text, e.type === 'exam' ? 'gold' : 'good');
      G.UI.refresh();
      G.Story.check();
    });

    G.UI.on('map', () => G.UI.show('map'));

    G.UI.on('vshout', () => {
      if (!G.Voice) return;
      G.Voice.setEnabled('shout', !G.Voice.settings.shout);
      G.UI.show('home');
    });

    G.UI.on('vstory', () => {
      if (!G.Voice) return;
      const on = !G.Voice.settings.story;
      G.Voice.setEnabled('story', on);
      /* 入れたときは、どんな声で読まれるか一度聞かせる */
      if (on) G.Voice.narrate('物語を読み上げます。', null);
      G.UI.show('home');
    });

    G.UI.on('bgm', () => {
      if (!G.Audio) return;
      G.Audio.setEnabled('bgm', !G.Audio.settings.bgm);
      G.UI.show('home');
    });
    G.UI.on('se', () => {
      if (!G.Audio) return;
      G.Audio.setEnabled('se', !G.Audio.settings.se);
      G.Audio.se('se_ok');
      G.UI.show('home');
    });

    G.UI.on('save', () => {
      const ok = G.State.save();
      G.UI.toast(ok ? 'セーブしました' : 'セーブに失敗しました', ok ? 'good' : 'bad');
    });

    G.UI.on('title', async () => {
      const ok = await G.UI.confirm('タイトルへもどる',
        '<p>進行状況を保存してタイトルに戻ります。</p>', G.T('common.back'), G.T('common.cancel'));
      if (!ok) return;
      G.State.save();
      G.UI.show('title');
    });
  },
});
