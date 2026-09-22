/* ===== 魔王城 ===== */
window.G = window.G || {};

G.UI.register('demon', {
  render() {
    const d = G.State.d;
    const floors = G.World.DEMON_FLOORS;
    const cur = d.demon.floor;

    return `
      <div class="card">
        <div class="card-head">
          <div class="ico">🌑</div>
          <div><div class="ttl">魔王城</div>
               <div class="sub">紫に淀んだ空の下、黒い尖塔がそびえている</div></div>
        </div>
        <p class="dim" style="margin-bottom:0">
          踏破した階層はいつでも戻れる。無理だと思ったら、街に引き返して鍛え直そう。</p>
      </div>

      <h2>階層</h2>
      ${floors.map((f, i) => {
        const cleared = d.demon.cleared.includes(i);
        const locked = i > cur;
        const bossName = f.boss ? G.ENEMIES[f.boss].name : null;
        return `
          <button class="btn ${i === cur ? 'danger' : ''}" data-act="floor" data-i="${i}" ${locked ? 'disabled' : ''}>
            <div class="row">
              <b>${G.util.esc(f.name)}</b>
              <span class="spacer"></span>
              ${cleared ? '<span class="chip ok">踏破</span>' : locked ? '<span class="chip">未到達</span>' : '<span class="chip gold">挑戦中</span>'}
            </div>
            <span class="btn-sub">${bossName ? `守護者：${G.util.esc(bossName)}` : '魔王軍の兵が徘徊している'}</span>
          </button>`;
      }).join('')}

      <button class="btn ghost mt" data-act="back">← ギルドへもどる</button>`;
  },

  mount() {
    G.UI.on('back', () => G.UI.show('guild'));

    G.UI.on('floor', async ds => {
      const d = G.State.d;
      const i = Number(ds.i);
      const f = G.World.DEMON_FLOORS[i];
      if (!G.State.aliveParty().length) { G.UI.toast('全員が戦闘不能です', 'bad'); return; }

      // 最上階に初めて来たら、魔王との対話を挟む
      if (f.boss === 'demon_lord_1' && !G.State.flag('met_demon_lord')) {
        G.State.setFlag('met_demon_lord');
        G.UI.playStory(G.STORY.demon_castle, () => G.UI.show('demon'));
        return;
      }

      const group = f.boss ? [f.boss] : G.util.choice(f.enemies);
      const e = G.ENEMIES[group[0]];

      const ok = await G.UI.confirm(f.name, `
        <p>${f.boss ? `<b class="gold">${G.util.esc(e.name)}</b> が待ち構えている。` :
          `${group.map(x => G.ENEMIES[x].name).join('、')} が立ちはだかった。`}</p>
        ${f.boss ? '<p class="dim">ボス戦では逃げられない。</p>' : ''}`,
        '戦う', 'ひきかえす');
      if (!ok) return;

      G.BattleUI.start(group, {
        canFlee: !f.boss,
        intro: f.boss ? (e.intro || '') : '',
        onEnd: async out => {
          if (out.result !== 'win') { G.State.save(); G.UI.show('demon'); return; }
          await G.UI.showLevelReports(out.levelReports);

          // 真魔王は魔王を倒した直後に続けて現れる。
          // 消耗したまま最難関に挑ませると、負けたときに魔王戦からやり直しになり
          // 理不尽なので、ここで女神の加護として全回復を挟む。
          if (f.second) {
            await G.UI.alert('……まだ終わっていない', `
              <p>膝をついた魔王の体から、黒い霧が噴き出す。</p>
              <p>「———— 足りぬ。まだ、足りぬのだ」</p>
              <p class="dim">魔力が膨れ上がり、空間そのものが軋んだ。</p>`);
            G.State.restParty();
            G.State.save();
            G.UI.playStory(G.STORY.goddess_blessing, () => {
              G.UI.toast('パーティのHPとMPが全回復した', 'good');
              G.BattleUI.start([f.second], {
                canFlee: false,
                intro: G.ENEMIES[f.second].intro || '',
                onEnd: async out2 => {
                  if (out2.result === 'win') {
                    await G.UI.showLevelReports(out2.levelReports);
                    G.Story.onEnding();
                  } else { G.State.save(); G.UI.show('demon'); }
                },
              });
            });
            return;
          }

          if (f.boss) {
            G.World.clearFloor(i);
            G.UI.toast('階層を突破した！', 'gold');
          } else if (!d.demon.cleared.includes(i)) {
            // 雑魚階層は3回勝てば踏破
            d.demon.clearCount = (d.demon.clearCount || {});
            d.demon.clearCount[i] = (d.demon.clearCount[i] || 0) + 1;
            if (d.demon.clearCount[i] >= 3) {
              G.World.clearFloor(i);
              G.UI.toast('階層を制圧した！', 'gold');
            } else {
              G.UI.toast(`この階層の制圧まであと ${3 - d.demon.clearCount[i]} 戦`, '');
            }
          }
          G.State.save();
          G.UI.show('demon');
        },
      });
    });
  },
});
