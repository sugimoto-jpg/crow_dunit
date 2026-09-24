/* ===== 起動とストーリー進行 ===== */
(function () {
'use strict';
/* ↑ このファイル内で作った名前を、他のファイルから見えないように閉じ込めている。
   全ファイルは1つのスクリプトに連結されるため、包まないと名前が衝突しうる。
   中身のインデントは変えていない（差分を小さく保つため）。 */

window.G = window.G || {};

G.Story = {

  /* 新規ゲーム：プロローグから学院入学まで */
  beginNewGame(name, difficulty, look) {
    G.State.newGame(name, difficulty, look);
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
function boot(resume) {
  // フッターナビ
  document.querySelectorAll('#nav button').forEach(b => {
    b.addEventListener('click', () => {
      if (!G.State.data) return;
      if (G.UI.current === 'battle') { G.UI.toast('戦闘中は移動できない', 'bad'); return; }
      const to = b.dataset.nav;
      // 場所を移るときは歩いて向かう（状態画面などは即座に開く）
      if (G.PLACES[to]) G.UI.walkTo(to); else G.UI.show(to);
    });
  });

  /* ---------- 戻る操作（Androidの戻るボタン／ブラウザの戻る） ----------
   * Android では、戻るボタンで何も起きないとアプリがそのまま終了する。
   * 「モーダルを閉じる」「拠点へ戻る」を先に処理し、
   * 処理することが無くなったときだけ、本当に戻る（＝閉じる）ようにする。
   *
   * 仕掛けを常に張ったままにすると、ブラウザでページから出られなくなる。
   * そのため、処理したときだけ張り直す。 */
  let backArmed = false;
  const armBack = () => {
    if (backArmed) return;
    try { history.pushState({ ta: 1 }, ''); backArmed = true; } catch (e) { /* 使えない環境 */ }
  };
  window.addEventListener('popstate', () => {
    backArmed = false;
    if (G.Err.guard('戻る操作', () => G.UI.handleBack(), false)) armBack();
  });
  // 拠点以外の画面に移ったときと、モーダルを開いたときに仕掛けを張る
  const origShow = G.UI.show;
  G.UI.show = function (name, args) {
    const r = origShow.call(G.UI, name, args);
    if (name !== 'home' && name !== 'title') armBack();
    return r;
  };
  const origModal = G.UI.modal;
  G.UI.modal = function (opts) { armBack(); return origModal.call(G.UI, opts); };

  /* ---------- 音 ----------
   * スマートフォンでは、画面を1度も触っていない状態では音を鳴らせない。
   * 最初のタップで音の出口を開く（プレイヤーには何も見えない）。 */
  const unlockAudio = () => {
    if (G.Audio) G.Audio.unlock();
    /* 読み上げも同じで、一度も触っていないと喋れない端末がある。
     * 空白を1回読ませて出口を開ける（人には聞こえない）。 */
    if (G.Voice && G.Voice.supported) { try { G.Voice.speak(' ', { volume: 0 }); G.Voice.stop(); } catch (e) {} }
    document.removeEventListener('pointerdown', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
  };
  document.addEventListener('pointerdown', unlockAudio);
  document.addEventListener('keydown', unlockAudio);

  /* ボタンを押したときの効果音。押せる要素をまとめて拾う。 */
  document.addEventListener('pointerdown', ev => {
    if (!G.Audio) return;
    const el = ev.target && ev.target.closest && ev.target.closest('button, [data-act], [data-nav], [data-pick]');
    if (!el || el.disabled) return;
    const cancel = /やめる|もどる|戻る|閉じる|キャンセル/.test(el.textContent || '');
    G.Audio.se(cancel ? 'se_cancel' : 'se_ok');
  }, true);

  /* 他のアプリに切り替わったら音を止める（鳴りっぱなしは非常に嫌われる） */
  document.addEventListener('visibilitychange', () => {
    if (!G.Audio) return;
    if (document.visibilityState === 'hidden') G.Audio.suspend(); else G.Audio.resume();
  });

  /* 保存できない環境（プライベートモードなど）では、先に伝える。
   * 黙っていると「遊べたのに閉じたら全部消えた」になる。 */
  if (!G.Storage.persistent) {
    setTimeout(() => G.UI.toast('この環境では記録を保存できません。閉じると消えます', 'bad'), 1200);
  }

  // 画面を離れるときに自動セーブ
  window.addEventListener('beforeunload', () => { if (G.State.data) G.State.save(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && G.State.data) G.State.save();
  });

  // 配信中に更新が入った場合は、遊んでいた画面に戻す
  if (resume && resume.playing && G.State.load()) {
    G.UI.setChromeVisible(true);
    G.UI.show(resume.screen && G.UI.screens[resume.screen] ? resume.screen : 'home');
    return;
  }
  G.UI.show('title');
}

/* 保存先の差し替えが終わるのを待つ。
 *
 * アプリ版（端末の保存領域）も配信ページ（消えない保存領域）も、
 * 差し替えは「待つ」形でしか終わらない。
 * 待たずに始めると、まだブラウザ側を見ている状態で
 * 「セーブが無い」と判断され、タイトルに「つづきから」が出ない。
 *
 * 返事が来ない環境もあるので、上限を決めて待つ。
 * 上限を過ぎたらブラウザ側のまま始める（遊べなくなるよりよい）。 */
const STORAGE_WAIT_MS = 7000;

function storageReady() {
  const waits = [];
  if (G.Native && G.Native.ready) waits.push(G.Native.ready);
  if (G.CloudSave && G.CloudSave.ready) waits.push(G.CloudSave.ready);
  if (!waits.length) return Promise.resolve();
  return Promise.race([
    Promise.all(waits.map(p => Promise.resolve(p).catch(() => false))),
    new Promise(r => setTimeout(r, STORAGE_WAIT_MS)),
  ]);
}

window.addEventListener('DOMContentLoaded', async () => {
  await storageReady();
  const hot = (typeof window !== 'undefined' && window.claude) ? window.claude.hot : null;
  if (hot && hot.snapshot) {
    hot.snapshot(() => {
      if (G.State.data) G.State.save();
      // 戦闘中に再開すると状態が壊れるので、拠点に戻す
      const screen = G.UI.current === 'battle' ? 'home' : G.UI.current;
      return { playing: !!G.State.data, screen };
    });
  }
  if (hot && hot.ready) hot.ready(boot);
  else boot((hot && hot.data) || null);
});

/* ↓ 閉じ込めここまで */
})();
