/* ===== 王立アルカナ魔法学院 ===== */
window.G = window.G || {};

G.ACADEMY = {
  name: '王立アルカナ魔法学院',
  TERM_DAYS: 15,      // 1学期の日数
  TERMS_PER_YEAR: 3,  // 1学年 = 3学期
  TOTAL_TERMS: 9,     // 3学年 = 9学期で卒業

  /* 学期ごとの試験合格ライン（全科目の平均習熟度） */
  passLine: [18, 28, 38, 48, 56, 64, 72, 78, 84],

  /* 学年ごとの学期あたり学費 */
  tuition: [600, 600, 600, 1200, 1200, 1200, 2400, 2400, 2400],

  /* 試験合格時の報奨金 */
  examReward: [300, 400, 550, 900, 1200, 1500, 2600, 3200, 5000],
};

/* 履修科目。gain は1コマ受講あたりの永続ステータス上昇 */
G.SUBJECTS = {
  magic_theory: {
    name:'魔術理論', icon:'📘', teacher:'フィオナ教授',
    desc:'魔力の流れと詠唱構文を学ぶ。魔力が伸びる。',
    gain:{ mag:0.9, mp:2.2 }, rate:12,
    masterSkill:'arcane_burst', masterTitle:'魔術理論首席',
  },
  swordsmanship: {
    name:'剣術実習', icon:'🤺', teacher:'ガルド教官',
    desc:'木剣を振り続ける地味な時間。腕力と体力が伸びる。',
    gain:{ atk:0.9, hp:3.0 }, rate:12,
    masterSkill:'brave_slash', masterTitle:'剣術首席',
  },
  theology: {
    name:'神聖学', icon:'⛪', teacher:'シスター・エルマ',
    desc:'祈りと加護の理論。魔防が伸びる。',
    gain:{ res:0.9, mp:1.6 }, rate:12,
    masterSkill:'sanctuary', masterTitle:'神聖学首席',
  },
  alchemy: {
    name:'錬金術', icon:'⚗️', teacher:'ドロテア講師',
    desc:'調合と魔道具作り。受講するたび素材や薬が手に入る。',
    gain:{ mag:0.4, res:0.4 }, rate:12, drop:['herb','potion','mana_crystal','ether'],
    masterSkill:'refresh', masterTitle:'錬金術首席',
  },
  monsterology: {
    name:'魔物学', icon:'🐾', teacher:'ヴァン講師',
    desc:'魔物の生態と弱点。戦闘で得る経験値とドロップ率が上がる。',
    gain:{ spd:0.5, def:0.5 }, rate:12, bonusExp:true,
    masterSkill:'analyze', masterTitle:'魔物学首席',
  },
  athletics: {
    name:'体術', icon:'🏃', teacher:'ガルド教官',
    desc:'走り込みと受け身。体力と敏捷が伸びる。',
    gain:{ hp:3.4, spd:0.9, def:0.4 }, rate:12,
    masterSkill:'focus', masterTitle:'体術首席',
  },
};

G.SUBJECT_IDS = Object.keys(G.SUBJECTS);

/* 学期 index(0始まり) → 学年(1-3) */
G.academyYear = term => Math.floor(term / G.ACADEMY.TERMS_PER_YEAR) + 1;
/* 学期 index → 学年内の何学期目か(1-3) */
G.academyTermInYear = term => (term % G.ACADEMY.TERMS_PER_YEAR) + 1;

/* 試験判定用スコア（全科目の平均習熟度） */
G.examScore = function (subjects) {
  const vals = G.SUBJECT_IDS.map(id => Math.min(100, subjects[id] || 0));
  return vals.reduce((a, b) => a + b, 0) / vals.length;
};
