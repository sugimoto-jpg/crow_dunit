/* ===== 王立アルカナ魔法学院 ===== */
window.G = window.G || {};

G.UI.register('academy', {
  render() {
    const d = G.State.d;

    if (d.graduated) {
      return `
        <div class="card">
          <div class="card-head">
            <div class="ico">🎓</div>
            <div><div class="ttl">${G.ACADEMY.name}</div>
                 <div class="sub">卒業生として迎えられている</div></div>
          </div>
          <p>三年間の課程はすべて修了した。今はもう、通う理由はない。</p>
          <p class="dim">それでも訓練場だけは、いつでも使わせてもらえる。</p>
        </div>
        <h2>訓練場</h2>
        <button class="btn primary" data-act="train">
          🤺 鍛錬する <span class="chip">1 AP</span>
          <span class="btn-sub">パーティ全員が経験値を得て、MPが少し回復します</span>
        </button>
        <button class="btn" data-act="job">🧭 適性審査室へ<span class="btn-sub">ジョブの確認と転職</span></button>`;
    }

    const score = G.examScore(d.subjects);
    const line = G.ACADEMY.passLine[Math.min(d.term, 8)];
    const tuition = G.World.tuitionAmount();
    const opts = G.Char.jobOptions(d.player);

    return `
      <div class="card">
        <div class="card-head">
          <div class="ico">🏫</div>
          <div><div class="ttl">${G.ACADEMY.name}</div>
               <div class="sub">${G.World.dateLabel()}</div></div>
        </div>
        <div class="kv">
          <div class="k">学年</div><div class="v">${G.academyYear(d.term)}年生（全${G.ACADEMY.TOTAL_TERMS}学期中 ${d.term + 1}学期目）</div>
          <div class="k">平均習熟度</div><div class="v ${score >= line ? 'gold' : ''}">${score.toFixed(1)} / 合格 ${line}</div>
          <div class="k">今学期の学費</div><div class="v">${d.tuitionPaid
            ? '<span class="chip ok">納入済み</span>'
            : `<span class="chip no">未納 ${G.util.g(tuition)}G</span>`}</div>
        </div>
        ${G.UI.bar(score, 100, 'g')}
        <p class="dim mt" style="margin-bottom:0">
          合格ラインまで ${score >= line ? '到達しています' : `あと ${(line - score).toFixed(1)}`}
        </p>
      </div>

      ${!d.tuitionPaid ? `
        <button class="btn ${d.gold >= tuition ? 'gold' : ''}" data-act="pay" ${d.gold >= tuition ? '' : 'disabled'}>
          💰 学費を納入する（${G.util.g(tuition)} G）
          <span class="btn-sub">${d.gold >= tuition
            ? '納入しないと学期末試験を受けられません'
            : `所持金が ${G.util.g(tuition - d.gold)}G 足りません`}</span>
        </button>` : ''}

      ${d.examAvailable ? `
        <button class="btn primary" data-act="exam" ${d.tuitionPaid ? '' : 'disabled'}>
          📝 学期末試験を受ける
          <span class="btn-sub">${d.tuitionPaid
            ? `平均 ${score.toFixed(1)} で挑みます（合格ライン ${line}）`
            : '学費が未納のため受験できません'}</span>
        </button>` : ''}

      ${opts.length ? `
        <button class="btn gold" data-act="job">
          🧭 適性審査室へ
          <span class="btn-sub">新しいジョブに就けます（${opts.length}件）</span>
        </button>` : `
        <button class="btn" data-act="job">🧭 適性審査室へ<span class="btn-sub">ジョブの確認</span></button>`}

      <h2>授業を受ける</h2>
      <p class="dim" style="margin-top:-4px">1コマ 1AP。習熟度が上がり、能力が伸び、経験値も入ります。</p>
      ${G.SUBJECT_IDS.map(id => {
        const s = G.SUBJECTS[id];
        const v = d.subjects[id];
        const done = v >= 100;
        return `
          <button class="btn" data-act="lesson" data-id="${id}" ${d.ap > 0 && !done ? '' : 'disabled'}>
            <div class="row">
              <span style="font-size:18px">${s.icon}</span>
              <b>${s.name}</b>
              ${done ? '<span class="chip gold">首席</span>' : ''}
              <span class="spacer"></span>
              <span class="chip">${Math.floor(v)} / 100</span>
            </div>
            ${G.UI.bar(v, 100)}
            <span class="btn-sub">${s.teacher}　—　${s.desc}</span>
          </button>`;
      }).join('')}

      <h2>そのほか</h2>
      <button class="btn" data-act="study" ${d.ap > 0 ? '' : 'disabled'}>
        📚 図書館で自習する <span class="chip">1 AP</span>
        <span class="btn-sub">全科目の習熟度が少しずつ上がります（経験値は入りません）</span>
      </button>
      <button class="btn" data-act="train" ${d.ap > 0 ? '' : 'disabled'}>
        🤺 訓練場で鍛える <span class="chip">1 AP</span>
        <span class="btn-sub">パーティ全員が経験値を得て、MPが少し回復します</span>
      </button>`;
  },

  mount() {
    G.UI.on('job', () => G.UI.show('job'));

    G.UI.on('pay', () => {
      const r = G.World.payTuition();
      G.UI.toast(r.ok ? `学費 ${G.util.g(r.amount)}G を納入した` : r.msg, r.ok ? 'good' : 'bad');
      if (r.ok) G.State.save();
      G.UI.refresh();
    });

    G.UI.on('lesson', async ds => {
      const r = G.World.takeLesson(ds.id);
      if (!r.ok) { G.UI.toast(r.msg, 'bad'); return; }
      const ups = Object.entries(r.statUp)
        .map(([k, v]) => `${G.STAT_LABEL[k]} +${v.toFixed(1)}`).join('　');
      await G.UI.alert(`${r.subject.icon} ${r.subject.name}の授業`, `
        <p>${G.util.esc(r.subject.teacher)}の講義を受けた。</p>
        <div class="result-line"><span>習熟度</span><b>+${r.gain.toFixed(1)}（${Math.floor(r.proficiency)}/100）</b></div>
        <div class="result-line"><span>獲得経験値</span><b>${G.util.g(r.exp)}</b></div>
        ${ups ? `<div class="result-line"><span>能力上昇</span><b>${ups}</b></div>` : ''}
        ${r.items.length ? `<div class="mt">${r.items.map(i => G.UI.itemLine(i, 1)).join('')}</div>` : ''}
        ${r.mastered.length ? `<p class="mt"><span class="chip gold">首席</span>
          ${r.mastered.map(s => G.util.esc(G.SKILLS[s].name)).join('、')} を習得した！</p>` : ''}`);
      await G.UI.showLevelReports(r.levelReports);
      G.State.save();
      G.UI.refresh();
      G.Story.check();
    });

    G.UI.on('study', async () => {
      const r = G.World.selfStudy();
      if (!r.ok) { G.UI.toast(r.msg, 'bad'); return; }
      await G.UI.alert('📚 自習', `
        <p>図書館で手を動かした。派手さはないが、確実に身につく。</p>
        ${G.SUBJECT_IDS.map(id => `<div class="result-line">
          <span>${G.SUBJECTS[id].name}</span><b>+${r.gains[id].toFixed(1)}</b></div>`).join('')}`);
      G.State.save();
      G.UI.refresh();
      G.Story.check();
    });

    G.UI.on('train', async () => {
      const r = G.World.train();
      if (!r.ok) { G.UI.toast(r.msg, 'bad'); return; }
      G.UI.toast(`鍛錬した。経験値 ${G.util.g(r.exp)} を獲得`, 'good');
      await G.UI.showLevelReports(r.levelReports);
      G.State.save();
      G.UI.refresh();
      G.Story.check();
    });

    G.UI.on('exam', async () => {
      const r = G.World.takeExam();
      if (!r.ok) { G.UI.toast(r.msg, 'bad'); return; }

      if (r.pass) {
        await G.UI.alert('📝 合格', `
          <div class="levelup">合格！</div>
          <div class="result-line"><span>成績</span><b>${r.score} / ${r.line}</b></div>
          <div class="result-line"><span>奨学金</span><b>${G.util.g(r.reward)} G</b></div>
          <div class="result-line"><span>獲得経験値</span><b>${G.util.g(r.exp)}</b></div>`);
        await G.UI.showLevelReports(r.levelReports);
      } else {
        await G.UI.alert('📝 不合格', `
          <div class="result-line"><span>成績</span><b>${r.score} / ${r.line}</b></div>
          <p class="mt">力及ばず、進級はならなかった。</p>
          <p class="dim">同じ学期をもう一度やり直すことになる。授業を受けて習熟度を上げよう。</p>`);
      }
      G.State.save();
      if (r.graduated) { G.Story.onGraduate(); return; }
      G.UI.refresh();
      G.Story.check();
    });
  },
});
