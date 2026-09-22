/* ===== 起動とストーリー進行 ===== */
window.G = window.G || {};

G.Story = {

  /* 新規ゲーム：プロローグから学院入学まで */
  beginNewGame(name, difficulty) {
    G.State.newGame(name, difficulty);
    G.UI.setChromeVisible(false);
    G.UI.playStory(G.STORY.prologue, () => {
      G.UI.playStory(G.STORY.village, () => {
        G.UI.playStory(G.STORY.academy_enter, () => {
          // リィナが仲間に加わる。二人とも学院生なので制服が支給される
          const riina = G.State.recruit('riina');
          G.State.setFlag('riina_joined');
          G.State.addItem('academy_robe', 2);
          G.Char.equipItem(G.State.d.player, 'academy_robe');
          if (riina) {
            G.Char.equipItem(riina, 'academy_robe');
            G.Char.equipItem(riina, 'oak_staff');
            G.State.addItem('oak_staff');
            G.Char.fullRestore(riina);
          }
          G.Char.fullRestore(G.State.d.player);
          G.UI.setChromeVisible(true);
          G.UI.playStory(G.STORY.guild_intro, () => {
            G.State.setFlag('guild_intro');
            G.State.save();
            G.UI.show('home');
            G.UI.toast('リィナが仲間になった', 'good');
          });
        });
      });
    });
  },

  /* 条件を満たしたイベントを1つ再生する。再生したら true */
  check() {
    const d = G.State.data;
    if (!d || d.ending) return false;
    const p = d.player;

    // Lv5：適性審査でジョブ解禁
    if (p.level >= 5 && !G.State.flag('awaken')) {
      G.State.setFlag('awaken');
      G.State.save();
      G.UI.playStory(G.STORY.awaken, () => G.UI.show('job'));
      return true;
    }
    // ヴェルト加入
    if (p.level >= 8 && !d.roster.velt) {
      G.State.recruit('velt');
      G.State.save();
      G.UI.playStory(G.STORY.velt_join, () => {
        G.UI.toast('ヴェルトが仲間になった', 'good');
        G.UI.refresh();
      });
      return true;
    }
    // ノア加入
    if (p.level >= 14 && d.guild.totalClears >= 6 && !d.roster.noa) {
      G.State.recruit('noa');
      G.State.save();
      G.UI.playStory(G.STORY.noa_join, () => {
        G.UI.toast('ノアが仲間になった', 'good');
        G.UI.refresh();
      });
      return true;
    }
    return false;
  },

  onGraduate() {
    G.State.save();
    G.UI.playStory(G.STORY.graduation, async () => {
      await G.UI.alert('🎓 卒業', `
        <div class="levelup">${G.util.esc(G.State.d.player.name)}は学院を卒業した！</div>
        <p>学院と冒険者ギルドの連名で、二つの品が贈られた。</p>
        ${G.UI.itemLine('excalibur', 1)}
        ${G.UI.itemLine('hero_proof', 1)}
        <p class="mt dim">ギルドから魔王領へ向かえるようになりました。装備を整えてから挑みましょう。</p>`);
      G.State.save();
      G.UI.show('home');
    });
  },

  onEnding() {
    G.State.d.ending = true;
    G.State.save();
    G.UI.playStory(G.STORY.ending, async () => {
      const d = G.State.d;
      await G.UI.alert('🏆 おめでとうございます', `
        <div class="levelup">魔王を討伐しました</div>
        <div class="result-line"><span>かかった日数</span><b>${d.day} 日</b></div>
        <div class="result-line"><span>最終レベル</span><b>Lv.${d.player.level}</b></div>
        <div class="result-line"><span>最終ジョブ</span><b>${G.Char.jobName(d.player)}</b></div>
        <div class="result-line"><span>ギルド階級</span><b>${G.World.rank().name}</b></div>
        <div class="result-line"><span>達成依頼</span><b>${d.stats.quests} 件</b></div>
        <div class="result-line"><span>戦闘回数</span><b>${d.stats.battles} 回</b></div>
        <div class="result-line"><span>出会った魔物</span><b>${Object.keys(d.bestiary).length} 種</b></div>
        <p class="mt dim">このまま世界を歩き続けることもできます。</p>`);
      G.UI.show('home');
    });
  },
};

/* ---------- 起動 ---------- */
window.addEventListener('DOMContentLoaded', () => {
  // フッターナビ
  document.querySelectorAll('#nav button').forEach(b => {
    b.addEventListener('click', () => {
      if (!G.State.data) return;
      if (G.UI.current === 'battle') { G.UI.toast('戦闘中は移動できない', 'bad'); return; }
      G.UI.show(b.dataset.nav);
    });
  });

  // 画面を離れるときに自動セーブ
  window.addEventListener('beforeunload', () => { if (G.State.data) G.State.save(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && G.State.data) G.State.save();
  });

  G.UI.show('title');
});
