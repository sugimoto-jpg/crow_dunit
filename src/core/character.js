/* ===== キャラクター : 成長・転職・装備 ===== */
window.G = window.G || {};

G.Char = {

  /* 次のレベルまでに必要な経験値 */
  expToNext(level) {
    return Math.floor(18 * Math.pow(level, 1.75) + 26 * level);
  },

  /* 新規キャラ生成 */
  create({ key, name, icon = '🧑', isPlayer = false, growthBonus = null, jobPath = null }) {
    const c = {
      key, name, icon, isPlayer,
      level: 1,
      exp: 0,
      jobId: 'villager',
      jobHistory: ['villager'],
      jobPath,                                   // 仲間キャラの自動転職ルート
      growthBonus: growthBonus || {},
      stats: { hp: 42, mp: 12, atk: 9, def: 7, mag: 7, res: 6, spd: 7 },
      hp: 42, mp: 12,
      skills: [],
      equip: { weapon: null, armor: null, accessory: null },
      titles: [],
    };
    G.Char.syncSkills(c);
    G.Char.fullRestore(c);
    return c;
  },

  /* 装備込みの実ステータス */
  derived(c) {
    const d = {
      hp: Math.floor(c.stats.hp), mp: Math.floor(c.stats.mp),
      atk: Math.floor(c.stats.atk), def: Math.floor(c.stats.def),
      mag: Math.floor(c.stats.mag), res: Math.floor(c.stats.res),
      spd: Math.floor(c.stats.spd),
    };
    for (const slot of ['weapon', 'armor', 'accessory']) {
      const id = c.equip[slot];
      if (!id) continue;
      const it = G.ITEMS[id];
      if (!it || !it.mods) continue;
      for (const [k, v] of Object.entries(it.mods)) d[k] = (d[k] || 0) + v;
    }
    for (const k of Object.keys(d)) d[k] = Math.max(1, d[k]);
    return d;
  },

  /* 装備に乗っている特殊効果を合算（study / goldBonus など） */
  equipBonus(c, field) {
    let sum = 0;
    for (const slot of ['weapon', 'armor', 'accessory']) {
      const it = G.ITEMS[c.equip[slot]];
      if (it && it[field]) sum += it[field];
    }
    return sum;
  },

  maxHp(c) { return G.Char.derived(c).hp; },
  maxMp(c) { return G.Char.derived(c).mp; },

  isAlive(c) { return c.hp > 0; },

  fullRestore(c) {
    c.hp = G.Char.maxHp(c);
    c.mp = G.Char.maxMp(c);
  },

  clampVitals(c) {
    c.hp = G.util.clamp(c.hp, 0, G.Char.maxHp(c));
    c.mp = G.util.clamp(c.mp, 0, G.Char.maxMp(c));
  },

  /* 現在のジョブ履歴から、覚えているべきスキルを補充する */
  syncSkills(c) {
    const set = new Set(c.skills);
    for (const jid of c.jobHistory) {
      for (const s of G.jobSkillsUpTo(jid, c.level)) set.add(s);
    }
    c.skills = [...set].filter(s => G.SKILLS[s]);
    return c.skills;
  },

  /* 経験値付与。レベルアップ内容を返す */
  gainExp(c, amount) {
    const res = { gained: Math.floor(amount), levels: [] };
    if (res.gained <= 0) return res;
    c.exp += res.gained;
    let guard = 0;
    while (c.exp >= G.Char.expToNext(c.level) && c.level < 99 && guard++ < 200) {
      c.exp -= G.Char.expToNext(c.level);
      res.levels.push(G.Char.levelUp(c));
    }
    return res;
  },

  /* 1レベル上昇 */
  levelUp(c) {
    c.level++;
    const job = G.JOBS[c.jobId] || G.JOBS.villager;
    const before = G.Char.derived(c);
    const gains = {};
    for (const [k, v] of Object.entries(job.growth)) {
      const mult = c.growthBonus[k] || 1;
      const add = v * mult;
      c.stats[k] += add;
      gains[k] = add;
    }
    // そのジョブでこのレベルに覚えるスキル
    const learned = [];
    if (job.learn && job.learn[c.level] && !c.skills.includes(job.learn[c.level])) {
      c.skills.push(job.learn[c.level]);
      learned.push(job.learn[c.level]);
    }
    const after = G.Char.derived(c);
    // レベルアップでHP/MPの増えた分だけ現在値も回復
    c.hp += Math.max(0, after.hp - before.hp);
    c.mp += Math.max(0, after.mp - before.mp);
    G.Char.clampVitals(c);
    return { level: c.level, gains, learned, diff: {
      hp: after.hp - before.hp, mp: after.mp - before.mp,
      atk: after.atk - before.atk, def: after.def - before.def,
      mag: after.mag - before.mag, res: after.res - before.res, spd: after.spd - before.spd,
    } };
  },

  /* 転職可能なジョブID一覧 */
  jobOptions(c) { return G.availableJobs(c.jobId, c.level); },

  /* 転職。成功時に習得スキル配列を返す */
  changeJob(c, jobId) {
    const job = G.JOBS[jobId];
    if (!job) return null;
    if (!G.availableJobs(c.jobId, c.level).includes(jobId)) return null;

    c.jobId = jobId;
    if (!c.jobHistory.includes(jobId)) c.jobHistory.push(jobId);

    // 転職ボーナス：ティアに応じてステータスが底上げされる
    const tierBonus = [0, 1, 2, 3, 4][job.tier] || 0;
    const bonus = {
      hp: 12 * tierBonus, mp: 6 * tierBonus,
      atk: 2 * tierBonus, def: 2 * tierBonus,
      mag: 2 * tierBonus, res: 2 * tierBonus, spd: 1.5 * tierBonus,
    };
    for (const [k, v] of Object.entries(bonus)) c.stats[k] += v;

    // 新ジョブで現在レベルまでに覚えるスキルを一括習得
    const before = new Set(c.skills);
    G.Char.syncSkills(c);
    const learned = c.skills.filter(s => !before.has(s));

    G.Char.fullRestore(c);
    return { job, learned, bonus };
  },

  /* 仲間キャラの自動転職（jobPath に沿って条件を満たしたら進む） */
  autoJob(c) {
    if (!c.jobPath) return null;
    const idx = c.jobPath.indexOf(c.jobId);
    const next = c.jobPath[idx + 1];
    if (!next) return null;
    if (c.level < G.JOBS[next].req) return null;
    // 仲間はルートが固定なので前提チェックを迂回して進める
    c.jobId = next;
    if (!c.jobHistory.includes(next)) c.jobHistory.push(next);
    const tierBonus = G.JOBS[next].tier;
    for (const [k, v] of Object.entries({ hp: 12, mp: 6, atk: 2, def: 2, mag: 2, res: 2, spd: 1.5 })) {
      c.stats[k] += v * tierBonus;
    }
    const before = new Set(c.skills);
    G.Char.syncSkills(c);
    G.Char.fullRestore(c);
    return { job: G.JOBS[next], learned: c.skills.filter(s => !before.has(s)) };
  },

  /* 装備する。外れた装備IDを返す */
  equipItem(c, itemId) {
    const it = G.ITEMS[itemId];
    if (!it || !['weapon', 'armor', 'accessory'].includes(it.type)) return null;
    const slot = it.type;
    const prev = c.equip[slot];
    c.equip[slot] = itemId;
    G.Char.clampVitals(c);
    return prev;
  },

  unequip(c, slot) {
    const prev = c.equip[slot];
    c.equip[slot] = null;
    G.Char.clampVitals(c);
    return prev;
  },

  /* 表示用 */
  jobName(c) { return (G.JOBS[c.jobId] || {}).name || '―'; },
  jobIcon(c) { return (G.JOBS[c.jobId] || {}).icon || '🧑'; },
  expPercent(c) {
    const need = G.Char.expToNext(c.level);
    return G.util.clamp(c.exp / need, 0, 1);
  },
};
