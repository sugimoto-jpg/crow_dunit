/* ===== ゲーム状態とセーブデータ ===== */
window.G = window.G || {};

G.SAVE_KEY = 'tensei_arcana_save_v1';

G.State = {
  data: null,

  /* ---------- 新規ゲーム ---------- */
  newGame(playerName, difficulty) {
    const name = (playerName || '').trim() || G.T('title.name.default');
    const player = G.Char.create({ key: 'player', name, icon: '🧑', isPlayer: true });
    player.equip.weapon = 'wood_stick';
    player.equip.armor = 'cloth';
    G.Char.fullRestore(player);

    const subjects = {};
    for (const id of G.SUBJECT_IDS) subjects[id] = 0;

    G.State.data = {
      version: 1,
      createdAt: Date.now(),
      difficulty: G.DIFFICULTY[difficulty] ? difficulty : 'normal',
      battleSpeed: 2,          // 1=ふつう 2=はやい 3=とてもはやい
      player,
      party: [player],
      roster: {},                       // 加入済み仲間 key -> char
      gold: 150,
      inventory: { herb: 3 },
      day: 1,
      ap: 3,
      apMax: 3,
      term: 0,                          // 0..8
      termDay: 1,                       // 1..TERM_DAYS
      graduated: false,
      subjects,
      tuitionPaid: false,
      tuitionDue: G.ACADEMY.tuition[0],
      examAvailable: false,
      guild: { registered: false, rank: 0, clears: 0, totalClears: 0, promoReady: false },
      demon: { unlocked: false, floor: 0, cleared: [] },
      /* 探索の進み具合。地点の解放条件はデータ側から毎回計算するので、
       * ここには「行ったことがある」「倒した」だけを持つ。 */
      explore: { at: G.SPOT_START, visited: [G.SPOT_START], cleared: [], trip: null, run: 0, dry: 0 },
      /* 受注中の依頼。目的地はここから読む。 */
      quest: { active: null, target: null, reached: false },
      flags: {},
      bestiary: {},
      log: [],
      stats: { battles: 0, wins: 0, escapes: 0, wipes: 0, quests: 0, lessons: 0, gold: 0 },
      ending: false,
    };
    return G.State.data;
  },

  get d() { return G.State.data; },

  /* ---------- セーブ / ロード ---------- */
  /* 保存は G.Storage を通す。
   * アプリ化したときに保存先を差し替えられるようにするため
   * （localStorage を直接呼ぶと、32か所すべてを書き換えることになる）。 */
  save() {
    try {
      return G.Storage.set(G.SAVE_KEY, JSON.stringify(G.State.data));
    } catch (e) {
      return false;
    }
  },

  hasSave() {
    try { return !!G.Storage.get(G.SAVE_KEY); } catch (e) { return false; }
  },

  load() {
    try {
      const raw = G.Storage.get(G.SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!d || !d.player) return false;
      G.State.data = G.State.migrate(d);
      return true;
    } catch (e) {
      console.warn('ロードに失敗しました', e);
      return false;
    }
  },

  /* 旧セーブ / 壊れたセーブの補正 */
  migrate(d) {
    d.version = d.version || 1;
    if (!G.DIFFICULTY[d.difficulty]) d.difficulty = 'normal';
    if (![1, 2, 3].includes(d.battleSpeed)) d.battleSpeed = 2;
    d.inventory = d.inventory || {};
    d.flags = d.flags || {};
    d.roster = d.roster || {};
    d.bestiary = d.bestiary || {};
    /* 見た目の指定（look）を足す前のセーブには無い。
     * 無いままだと絵を選ぶときに落ちるので、既定値を補う。 */
    for (const c of (d.party || [])) {
      c.look = Object.assign({ sex: 'm' }, c.look || {});
    }
    d.stats = Object.assign(
      { battles: 0, wins: 0, escapes: 0, wipes: 0, quests: 0, lessons: 0, gold: 0 }, d.stats || {});
    d.guild = Object.assign({ registered: false, rank: 0, clears: 0, totalClears: 0, promoReady: false }, d.guild || {});
    d.demon = Object.assign({ unlocked: false, floor: 0, cleared: [] }, d.demon || {});

    /* 探索のデータ。無いセーブ（探索の追加より前のもの）でも読めるようにする。 */
    d.explore = Object.assign({ at: G.SPOT_START, visited: [], cleared: [], trip: null, run: 0, dry: 0 }, d.explore || {});
    if (!G.SPOTS[d.explore.at]) d.explore.at = G.SPOT_START;
    if (!Array.isArray(d.explore.visited)) d.explore.visited = [];
    if (!Array.isArray(d.explore.cleared)) d.explore.cleared = [];
    d.explore.visited = d.explore.visited.filter(x => G.SPOTS[x]);
    d.explore.cleared = d.explore.cleared.filter(x => G.SPOTS[x]);
    if (!d.explore.visited.includes(G.SPOT_START)) d.explore.visited.unshift(G.SPOT_START);
    /* 移動の途中で終了したセーブは、その場に留めず出発地点に戻す。
     * 中途半端な歩数を復元しても、遊ぶ人には何が起きたか分からないため。 */
    if (d.explore.trip) {
      const from = d.explore.trip.from;
      d.explore.at = G.SPOTS[from] ? from : d.explore.at;
      d.explore.trip = null;
    }

    d.quest = Object.assign({ active: null, target: null, reached: false }, d.quest || {});
    if (d.quest.active && !G.QUESTS.some(q => q.id === d.quest.active)) {
      d.quest = { active: null, target: null, reached: false };
    }
    if (d.quest.target && !G.SPOTS[d.quest.target]) d.quest.target = null;
    d.subjects = d.subjects || {};
    for (const id of G.SUBJECT_IDS) if (typeof d.subjects[id] !== 'number') d.subjects[id] = 0;

    // party は player と同一オブジェクトを参照させ直す
    const fix = c => {
      c.equip = Object.assign({ weapon: null, armor: null, accessory: null }, c.equip || {});
      c.skills = (c.skills || []).filter(s => G.SKILLS[s]);
      c.jobHistory = c.jobHistory || [c.jobId || 'villager'];
      c.growthBonus = c.growthBonus || {};
      c.titles = c.titles || [];
      if (!G.JOBS[c.jobId]) c.jobId = 'villager';
      G.Char.clampVitals(c);
      return c;
    };
    fix(d.player);
    d.party = (d.party || []).map(c => (c.key === 'player' ? d.player : fix(c)));
    if (!d.party.some(c => c.key === 'player')) d.party.unshift(d.player);
    for (const k of Object.keys(d.roster)) {
      d.roster[k] = d.party.find(c => c.key === k) || fix(d.roster[k]);
    }
    return d;
  },

  deleteSave() {
    try { G.Storage.remove(G.SAVE_KEY); return true; } catch (e) { return false; }
  },

  /* ---------- 所持品 ---------- */
  addItem(id, n = 1) {
    if (!G.ITEMS[id]) return false;
    const inv = G.State.d.inventory;
    inv[id] = (inv[id] || 0) + n;
    return true;
  },

  removeItem(id, n = 1) {
    const inv = G.State.d.inventory;
    if (!inv[id] || inv[id] < n) return false;
    inv[id] -= n;
    if (inv[id] <= 0) delete inv[id];
    return true;
  },

  countItem(id) { return G.State.d.inventory[id] || 0; },

  /* 所持品を種別で取得 */
  itemsByType(type) {
    return Object.entries(G.State.d.inventory)
      .filter(([id, n]) => n > 0 && G.ITEMS[id] && (!type || G.ITEMS[id].type === type))
      .map(([id, n]) => ({ id, n, item: G.ITEMS[id] }));
  },

  /* ---------- 所持金 ---------- */
  addGold(n) {
    G.State.d.gold = Math.max(0, G.State.d.gold + Math.floor(n));
    if (n > 0) G.State.d.stats.gold += Math.floor(n);
  },
  spendGold(n) {
    if (G.State.d.gold < n) return false;
    G.State.d.gold -= Math.floor(n);
    return true;
  },

  /* ---------- 仲間 ---------- */
  recruit(key) {
    const t = G.COMPANIONS[key];
    const d = G.State.d;
    if (!t || d.roster[key]) return null;
    const c = G.Char.create({
      key, name: t.name, icon: t.icon, growthBonus: t.growthBonus, jobPath: t.jobPath,
    });
    // 主人公より少し低いレベルで加入し、すぐ追いつく
    const target = Math.max(1, d.player.level - 1);
    while (c.level < target) {
      G.Char.levelUp(c);
      let guard = 0;
      while (G.Char.autoJob(c) && guard++ < 6) { /* 経路上の転職を進める */ }
    }
    G.Char.syncSkills(c);
    G.Char.fullRestore(c);
    d.roster[key] = c;
    d.party.push(c);
    return c;
  },

  /* パーティ全員に経験値。レベルアップ報告を返す */
  partyExp(amount) {
    const reports = [];
    for (const c of G.State.d.party) {
      const r = G.Char.gainExp(c, amount);
      if (r.levels.length) {
        // 仲間は自動で転職ルートを進む
        const jobs = [];
        if (!c.isPlayer) {
          let guard = 0, j;
          while ((j = G.Char.autoJob(c)) && guard++ < 6) jobs.push(j.job.name);
        }
        reports.push({ char: c, levels: r.levels, jobs });
      }
    }
    return reports;
  },

  aliveParty() { return G.State.d.party.filter(c => c.hp > 0); },
  restParty() { for (const c of G.State.d.party) G.Char.fullRestore(c); },

  /* ---------- 図鑑 ---------- */
  recordEnemy(id) {
    const b = G.State.d.bestiary;
    b[id] = (b[id] || 0) + 1;
  },

  /* ---------- フラグ ---------- */
  flag(k) { return !!G.State.d.flags[k]; },
  setFlag(k, v = true) { G.State.d.flags[k] = v; },
};
