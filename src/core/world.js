/* ===== 世界の進行 : 暦・学院・ギルド・店 ===== */
window.G = window.G || {};

G.World = {

  /* ================= 暦と行動力 ================= */

  apCost(n) { return G.State.d.ap >= n; },

  spendAp(n) {
    const d = G.State.d;
    if (d.ap < n) return false;
    d.ap -= n;
    return true;
  },

  /* 休息して翌日へ。発生した出来事を配列で返す */
  endDay(full = true) {
    const d = G.State.d;
    const events = [];

    if (full) {
      G.State.restParty();
      events.push({ type: 'rest', text: '宿舎でぐっすり眠った。HPとMPが全回復した。' });
    } else {
      for (const c of d.party) {
        c.hp = Math.min(G.Char.maxHp(c), c.hp + Math.floor(G.Char.maxHp(c) * 0.5));
        c.mp = Math.min(G.Char.maxMp(c), c.mp + Math.floor(G.Char.maxMp(c) * 0.5));
      }
    }

    d.day++;
    d.ap = d.apMax;

    if (!d.graduated) {
      d.termDay++;
      if (d.termDay > G.ACADEMY.TERM_DAYS && !d.examAvailable) {
        d.examAvailable = true;
        events.push({ type: 'exam', text: `学期末です。${G.ACADEMY.name}で定期試験を受けてください。` });
      }
    }
    return events;
  },

  /* 今日の日付表示 */
  dateLabel() {
    const d = G.State.d;
    if (d.graduated) return `卒業後 ${d.day}日目`;
    return `${G.academyYear(d.term)}年 第${G.academyTermInYear(d.term)}学期 ${Math.min(d.termDay, G.ACADEMY.TERM_DAYS)}日目`;
  },

  /* ================= 学院 ================= */

  /* 授業を受ける（1AP） */
  takeLesson(subjectId) {
    const d = G.State.d;
    const sub = G.SUBJECTS[subjectId];
    if (!sub) return { ok: false, msg: 'そんな科目はない。' };
    if (d.graduated) return { ok: false, msg: 'もう卒業している。' };
    if (!G.World.spendAp(1)) return { ok: false, msg: '今日はもう時間がない。' };

    const glasses = d.party.reduce((s, c) => s + G.Char.equipBonus(c, 'study'), 0);
    const before = d.subjects[subjectId] || 0;
    const gain = sub.rate * (1 + glasses) * G.util.rand(0.85, 1.15);
    d.subjects[subjectId] = Math.min(100, before + gain);
    const realGain = d.subjects[subjectId] - before;

    // 永続ステータス上昇（主人公のみ。仲間は依頼で伸びる）
    const statUp = {};
    for (const [k, v] of Object.entries(sub.gain)) {
      const add = v * (realGain / sub.rate);
      d.player.stats[k] += add;
      statUp[k] = (statUp[k] || 0) + add;
    }
    d.player.hp = Math.min(G.Char.maxHp(d.player), d.player.hp + Math.floor(sub.gain.hp || 0));

    // 経験値（学年が上がるほど授業内容も高度になる）
    const year = G.academyYear(d.term);
    const exp = Math.floor(G.Char.expToNext(d.player.level) * (0.08 + 0.02 * year));
    const levelReports = G.State.partyExp(exp);

    // 錬金術は成果物が手に入る
    const items = [];
    if (sub.drop && G.util.chance(0.55)) {
      const got = G.util.choice(sub.drop);
      G.State.addItem(got);
      items.push(got);
    }

    // 習熟100で首席スキルを習得
    const mastered = [];
    if (before < 100 && d.subjects[subjectId] >= 100) {
      if (sub.masterSkill && !d.player.skills.includes(sub.masterSkill)) {
        d.player.skills.push(sub.masterSkill);
        mastered.push(sub.masterSkill);
      }
      if (sub.masterTitle && !d.player.titles.includes(sub.masterTitle)) {
        d.player.titles.push(sub.masterTitle);
      }
    }

    d.stats.lessons++;
    return { ok: true, subject: sub, gain: realGain, statUp, exp, levelReports, items, mastered,
             proficiency: d.subjects[subjectId] };
  },

  /* 自習（1AP）：全科目を少しずつ、経験値なし */
  selfStudy() {
    const d = G.State.d;
    if (d.graduated) return { ok: false, msg: 'もう卒業している。' };
    if (!G.World.spendAp(1)) return { ok: false, msg: '今日はもう時間がない。' };
    const glasses = d.party.reduce((s, c) => s + G.Char.equipBonus(c, 'study'), 0);
    const gains = {};
    for (const id of G.SUBJECT_IDS) {
      const before = d.subjects[id];
      d.subjects[id] = Math.min(100, before + 4.5 * (1 + glasses) * G.util.rand(0.8, 1.2));
      gains[id] = d.subjects[id] - before;
    }
    d.stats.lessons++;
    return { ok: true, gains };
  },

  /* 訓練場（1AP）：経験値のみ */
  train() {
    const d = G.State.d;
    if (!G.World.spendAp(1)) return { ok: false, msg: '今日はもう時間がない。' };
    const exp = Math.floor(G.Char.expToNext(d.player.level) * 0.16);
    const levelReports = G.State.partyExp(exp);
    for (const c of d.party) c.mp = Math.min(G.Char.maxMp(c), c.mp + Math.floor(G.Char.maxMp(c) * 0.3));
    return { ok: true, exp, levelReports };
  },

  /* ---- 学費 ---- */
  tuitionAmount() {
    const d = G.State.d;
    return G.ACADEMY.tuition[Math.min(d.term, G.ACADEMY.tuition.length - 1)];
  },

  payTuition() {
    const d = G.State.d;
    if (d.tuitionPaid) return { ok: false, msg: '今学期の学費は納入済みです。' };
    const amount = G.World.tuitionAmount();
    if (!G.State.spendGold(amount)) return { ok: false, msg: `所持金が足りません（必要 ${G.util.g(amount)}G）。` };
    d.tuitionPaid = true;
    return { ok: true, amount };
  },

  /* ---- 定期試験 ---- */
  canTakeExam() {
    const d = G.State.d;
    if (d.graduated) return { ok: false, msg: 'すでに卒業しています。' };
    if (!d.examAvailable) return { ok: false, msg: 'まだ学期末ではありません。' };
    if (!d.tuitionPaid) return { ok: false, msg: '学費が未納です。受験できません。' };
    return { ok: true };
  },

  takeExam() {
    const d = G.State.d;
    const chk = G.World.canTakeExam();
    if (!chk.ok) return { ok: false, msg: chk.msg };

    const score = G.examScore(d.subjects);
    const line = G.ACADEMY.passLine[Math.min(d.term, G.ACADEMY.passLine.length - 1)];
    const pass = score >= line;

    const res = { ok: true, score: Math.round(score * 10) / 10, line, pass, term: d.term,
                  reward: 0, graduated: false, events: [] };

    if (pass) {
      res.reward = G.ACADEMY.examReward[Math.min(d.term, G.ACADEMY.examReward.length - 1)];
      G.State.addGold(res.reward);
      const exp = Math.floor(G.Char.expToNext(d.player.level) * 2.2);
      res.exp = exp;
      res.levelReports = G.State.partyExp(exp);

      d.term++;
      d.termDay = 1;
      d.examAvailable = false;
      d.tuitionPaid = false;

      if (d.term >= G.ACADEMY.TOTAL_TERMS) {
        d.graduated = true;
        res.graduated = true;
        G.State.addItem('excalibur');
        G.State.addItem('hero_proof');
        d.demon.unlocked = true;
      }
    } else {
      // 不合格は留年。同じ学期をやり直す
      d.termDay = 1;
      d.examAvailable = false;
      d.tuitionPaid = false;
      res.retake = true;
    }
    return res;
  },

  /* ================= 冒険者ギルド ================= */

  rank() { return G.RANKS[G.State.d.guild.rank]; },
  rankKey() { return G.World.rank().key; },

  registerGuild() {
    const d = G.State.d;
    if (d.guild.registered) return { ok: false, msg: 'すでに登録済みです。' };
    d.guild.registered = true;
    return { ok: true };
  },

  availableQuests() {
    const d = G.State.d;
    if (!d.guild.registered) return [];
    return G.QUESTS.filter(q => q.rank <= d.guild.rank);
  },

  /* 依頼の成功報酬（戦闘の報酬とは別枠） */
  completeQuest(quest) {
    const d = G.State.d;
    const bonus = d.party.reduce((s, c) => s + G.Char.equipBonus(c, 'goldBonus'), 0);
    const gold = Math.floor(quest.gold * (1 + bonus));
    G.State.addGold(gold);
    const levelReports = G.State.partyExp(quest.exp);

    const items = [];
    for (const r of (quest.reward || [])) {
      G.State.addItem(r.id, r.n || 1);
      items.push(r);
    }
    d.guild.clears++;
    d.guild.totalClears++;
    d.stats.quests++;

    // 昇格条件のチェック
    const next = G.RANKS[d.guild.rank + 1];
    let promoReady = false;
    if (next && d.guild.totalClears >= next.clears) {
      d.guild.promoReady = true;
      promoReady = true;
    }
    return { gold, exp: quest.exp, levelReports, items, promoReady };
  },

  /* 昇格試験に挑めるか */
  promotionInfo() {
    const d = G.State.d;
    const next = G.RANKS[d.guild.rank + 1];
    if (!next) return { ok: false, msg: 'すでに最高位です。', max: true };
    const need = next.clears - d.guild.totalClears;
    const lvShort = (next.minLv || 1) - d.player.level;
    if (need > 0 && lvShort > 0)
      return { ok: false, msg: `あと${need}件の依頼達成と、レベル${next.minLv}への到達が必要です。`, next, need, lvShort };
    if (need > 0) return { ok: false, msg: `あと${need}件の依頼達成が必要です。`, next, need };
    if (lvShort > 0) return { ok: false, msg: `レベル${next.minLv}に達していません。`, next, lvShort };
    return { ok: true, next, boss: next.promo };
  },

  /* 昇格（試験ボスがいる場合は勝利後に呼ぶ） */
  promote() {
    const d = G.State.d;
    const info = G.World.promotionInfo();
    if (!info.ok) return { ok: false, msg: info.msg };
    d.guild.rank++;
    d.guild.promoReady = false;
    return { ok: true, rank: G.RANKS[d.guild.rank] };
  },

  /* ================= 店 ================= */

  shopStock(shopKey) {
    const d = G.State.d;
    const shop = G.SHOPS[shopKey];
    if (!shop) return [];
    return shop.lines
      .filter(l => l.rank <= d.guild.rank)
      .map(l => ({ id: l.id, item: G.ITEMS[l.id], price: G.ITEMS[l.id].price }));
  },

  buy(itemId, n = 1) {
    const it = G.ITEMS[itemId];
    if (!it) return { ok: false, msg: 'その品は置いていない。' };
    const cost = it.price * n;
    if (!G.State.spendGold(cost)) return { ok: false, msg: '所持金が足りません。' };
    G.State.addItem(itemId, n);
    return { ok: true, cost, n };
  },

  sellPrice(itemId) { return Math.floor((G.ITEMS[itemId].price || 0) * 0.4); },

  sell(itemId, n = 1) {
    if (G.State.countItem(itemId) < n) return { ok: false, msg: '持っていません。' };
    // 装備中の品は売れないようにする
    for (const c of G.State.d.party) {
      for (const slot of ['weapon', 'armor', 'accessory']) {
        if (c.equip[slot] === itemId && G.State.countItem(itemId) <= n) {
          return { ok: false, msg: `${c.name}が装備中です。` };
        }
      }
    }
    G.State.removeItem(itemId, n);
    const gain = G.World.sellPrice(itemId) * n;
    G.State.addGold(gain);
    return { ok: true, gain };
  },

  /* ================= 戦闘外での道具使用 ================= */
  useItemOutside(itemId, charKey) {
    const it = G.ITEMS[itemId];
    if (!it || !it.use) return { ok: false, msg: 'ここでは使えない。' };
    const c = G.State.d.party.find(x => x.key === charKey);
    if (!c) return { ok: false, msg: '対象がいない。' };

    if (it.use.escape) return { ok: false, msg: '戦闘中にしか使えない。' };
    if (it.use.revive) {
      if (c.hp > 0) return { ok: false, msg: `${c.name}は倒れていない。` };
      G.State.removeItem(itemId);
      c.hp = Math.floor(G.Char.maxHp(c) * it.use.revive);
      return { ok: true, msg: `${c.name}が起き上がった。` };
    }
    if (c.hp <= 0) return { ok: false, msg: `${c.name}は戦闘不能だ。` };

    if (it.use.perm) {
      G.State.removeItem(itemId);
      const parts = [];
      for (const [k, v] of Object.entries(it.use.perm)) {
        c.stats[k] += v;
        parts.push(`${G.STAT_LABEL[k]}+${v}`);
      }
      G.Char.clampVitals(c);
      return { ok: true, msg: `${c.name}の${parts.join('、')}。` };
    }

    const msgs = [];
    let used = false;
    if (it.use.hp) {
      const before = c.hp;
      c.hp = Math.min(G.Char.maxHp(c), c.hp + it.use.hp);
      if (c.hp > before) { msgs.push(`HPが${c.hp - before}回復`); used = true; }
    }
    if (it.use.mp) {
      const before = c.mp;
      c.mp = Math.min(G.Char.maxMp(c), c.mp + it.use.mp);
      if (c.mp > before) { msgs.push(`MPが${c.mp - before}回復`); used = true; }
    }
    if (it.use.cure) {
      msgs.push('気分が良くなった');
      used = true;
    }
    if (!used) return { ok: false, msg: '……効果がなさそうだ。' };
    G.State.removeItem(itemId);
    return { ok: true, msg: `${c.name}の${msgs.join('、')}。` };
  },

  /* ================= 全滅 ================= */
  /* 全滅しても「やり直し」にはせず、代償を払って学院に送り返される。
   * 無償だと負けても損がなく、戦闘の緊張感がなくなるため。 */
  /* 注意: ここでは日付を進めない。呼び出し側が endDay() を呼ぶ。
   * 両方で進めると1回の全滅で2日経過してしまう。 */
  onDefeat() {
    const d = G.State.d;
    const lost = Math.floor(d.gold * 0.2);
    d.gold -= lost;
    d.ap = 0;              // その日はもう行動できない
    G.State.restParty();
    return { lost };
  },

  /* ================= 魔王城 ================= */
  DEMON_FLOORS: [
    { name:'第一層 黒曜の回廊', enemies:[['demon_soldier','hell_hound'],['demon_knight'],['hell_hound','hell_hound']] },
    { name:'第二層 慟哭の広間', enemies:[['lich','demon_soldier'],['demon_knight','hell_hound']] },
    { name:'第三層 門番の間', boss:'gate_keeper' },
    { name:'第四層 氷の玉座', boss:'four_general_1' },
    { name:'第五層 業火の闘技場', boss:'four_general_2' },
    { name:'最上階 魔王の間', boss:'demon_lord_1', second:'demon_lord_2' },
  ],

  demonFloor() { return G.World.DEMON_FLOORS[G.State.d.demon.floor] || null; },

  clearFloor() {
    const d = G.State.d;
    if (!d.demon.cleared.includes(d.demon.floor)) d.demon.cleared.push(d.demon.floor);
    d.demon.floor = Math.min(d.demon.floor + 1, G.World.DEMON_FLOORS.length - 1);
    return G.World.demonFloor();
  },
};
