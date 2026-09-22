/* ===== タイトル画面 ===== */
window.G = window.G || {};

G.UI.register('title', {
  render() {
    const has = G.State.hasSave();
    return `
      <div class="title-screen">
        <div class="title-crest">🏰</div>
        <div class="title-logo">転生魔法学院譚</div>
        <div class="title-sub">〜 村人から始まる魔王討伐 〜</div>
        ${has ? '<button class="btn gold" data-act="continue">▶ つづきから</button>' : ''}
        <button class="btn primary" data-act="new">✦ はじめから</button>
        <button class="btn ghost" data-act="about">このゲームについて</button>
      </div>`;
  },
  mount() {
    G.UI.setChromeVisible(false);

    G.UI.on('continue', () => {
      if (G.State.load()) { G.UI.setChromeVisible(true); G.UI.show('home'); }
      else G.UI.toast('セーブデータを読み込めませんでした', 'bad');
    });

    G.UI.on('new', async () => {
      if (G.State.hasSave()) {
        const ok = await G.UI.confirm('新しく始める',
          '<p>既存のセーブデータは上書きされます。よろしいですか？</p>', '始める', 'やめる');
        if (!ok) return;
      }
      let name = 'アルト';
      await G.UI.modal({
        title: '名前をつけてください',
        body: `<p class="dim">転生した後の、あなたの名前です。</p>
               <input id="name-in" class="btn" style="font-weight:700"
                      maxlength="8" placeholder="アルト" value="アルト">`,
        actions: [{ label: 'この名前で始める', cls: 'primary', value: 'ok' }],
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
        title: '難易度を選んでください',
        body: `<p class="dim">敵の強さが変わります。あとから変更はできません。</p>
          ${Object.entries(G.DIFFICULTY).map(([k, v]) => `
            <div class="list-item">
              <div class="ico">${k === 'easy' ? '🌱' : k === 'normal' ? '⚔️' : '🔥'}</div>
              <div class="body">
                <div class="nm">${v.name}</div>
                <div class="ds">敵のHP ${Math.round(v.hp * 100)}% ／ 攻撃力 ${Math.round(v.atk * 100)}%</div>
              </div>
              <div class="act"><button class="btn sm" data-pick="${k}">選ぶ</button></div>
            </div>`).join('')}`,
        actions: [{ label: 'ふつうで始める', cls: 'primary', value: 'normal' }],
        bind: done => document.querySelectorAll('#modal [data-pick]').forEach(el =>
          el.addEventListener('click', () => done(el.dataset.pick))),
      });
      G.Story.beginNewGame(name, diff);
    });

    G.UI.on('about', () => G.UI.alert('このゲームについて', `
      <p>転生した主人公が魔法学院に通いながらレベルを上げ、冒険者ギルドで稼ぎ、
         やがて魔王に挑むRPGです。</p>
      <div class="divider"></div>
      <p><b class="gold">1日は3AP</b>。授業・自習・訓練・依頼で消費します。使い切ったら休んで翌日へ。</p>
      <p><b class="gold">15日ごとに学期末試験</b>。全科目の平均習熟度が合格ラインを超えれば進級します。
         受験には学費の納入が必要です。</p>
      <p><b class="gold">レベルが上がるとジョブを選べます</b>。村人から4系統に分かれ、
         Lv15・Lv30・Lv50でさらに分岐して全25職。選択は積み重なります。</p>
      <p><b class="gold">3年間で卒業</b>すると魔王領が解禁されます。</p>
      <div class="divider"></div>
      <p class="dim">進行状況はこの端末に自動保存されます。</p>`));
  },
});
