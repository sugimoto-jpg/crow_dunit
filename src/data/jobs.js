/* ===== ジョブ（職業）データ =====
 * tier    : 0=村人 1=見習い(Lv5) 2=一人前(Lv15) 3=上級(Lv30) 4=極(Lv50)
 * req     : 転職に必要なレベル
 * from    : 前提ジョブID（tier0 は null）
 * growth  : レベルアップ毎の成長値（小数で蓄積）
 * learn   : { レベル: スキルID } その職で到達したレベルで習得
 * bonus   : 転職時の一時ボーナス
 */
window.G = window.G || {};

G.JOBS = {
  /* ---------- Tier 0 ---------- */
  villager: {
    name:'村人', icon:'🧑‍🌾', tier:0, req:1, from:null,
    desc:'何者でもない者。だが、全ての可能性がここから始まる。',
    growth:{ hp:5.0, mp:2.0, atk:1.2, def:1.1, mag:1.0, res:1.0, spd:1.1 },
    learn:{ 1:'strike', 2:'throw_rock', 3:'first_aid', 4:'guard_up' },
  },

  /* ---------- Tier 1 : Lv5 ---------- */
  apprentice_mage: {
    name:'魔術師見習い', icon:'🪄', tier:1, req:5, from:['villager'],
    desc:'アルカナ魔法学院の基礎課程。杖と詠唱を学ぶ者。',
    growth:{ hp:4.0, mp:6.0, atk:0.8, def:0.9, mag:2.6, res:1.9, spd:1.2 },
    learn:{ 5:'fire_bolt', 6:'ice_needle', 8:'meditate', 10:'wind_edge', 12:'mana_dart' },
  },
  apprentice_knight: {
    name:'剣士見習い', icon:'🗡️', tier:1, req:5, from:['villager'],
    desc:'剣術実習の優等生。まっすぐな刃に己を託す。',
    growth:{ hp:8.5, mp:2.0, atk:2.4, def:2.1, mag:0.6, res:1.0, spd:1.3 },
    learn:{ 5:'power_slash', 7:'provoke', 9:'double_slash', 12:'armor_break' },
  },
  apprentice_cleric: {
    name:'神官見習い', icon:'⛪', tier:1, req:5, from:['villager'],
    desc:'神聖学の徒。癒やしの光を人に向ける者。',
    growth:{ hp:6.0, mp:4.5, atk:1.1, def:1.6, mag:2.1, res:2.4, spd:1.0 },
    learn:{ 5:'heal', 7:'holy_ray', 9:'refresh', 12:'bless' },
  },
  apprentice_scout: {
    name:'斥候見習い', icon:'🗺️', tier:1, req:5, from:['villager'],
    desc:'影と地図を読む者。ギルドで最も重宝される才。',
    growth:{ hp:5.5, mp:3.0, atk:1.9, def:1.3, mag:1.1, res:1.2, spd:2.6 },
    learn:{ 5:'quick_stab', 6:'analyze', 8:'steal', 10:'poison_edge', 12:'haste' },
  },

  /* ---------- Tier 2 : Lv15 ---------- */
  sorcerer: {
    name:'魔道士', icon:'🔮', tier:2, req:15, from:['apprentice_mage'],
    desc:'攻性魔術を極める道。一撃で戦場を変える。',
    growth:{ hp:6.0, mp:9.0, atk:1.0, def:1.3, mag:4.2, res:2.8, spd:1.6 },
    learn:{ 15:'fire_ball', 18:'magic_up', 21:'blizzard', 25:'drain' },
  },
  elementalist: {
    name:'精霊術師', icon:'🧚', tier:2, req:15, from:['apprentice_mage'],
    desc:'精霊と契約し、自然そのものを借り受ける。',
    growth:{ hp:6.5, mp:8.5, atk:1.1, def:1.5, mag:3.8, res:3.4, spd:1.8 },
    learn:{ 15:'stone_blast', 17:'barrier', 20:'thunder_storm', 24:'gaia_press' },
  },
  swordsman: {
    name:'剣士', icon:'⚔️', tier:2, req:15, from:['apprentice_knight'],
    desc:'速さと手数で押し切る前衛の花形。',
    growth:{ hp:12.0, mp:3.0, atk:4.0, def:3.0, mag:0.8, res:1.4, spd:2.2 },
    learn:{ 15:'whirlwind', 18:'pierce', 22:'focus', 26:'brave_slash' },
  },
  guardian: {
    name:'重騎士', icon:'🛡️', tier:2, req:15, from:['apprentice_knight'],
    desc:'仲間の盾となる者。決して退かぬ意志。',
    growth:{ hp:15.0, mp:3.0, atk:3.0, def:4.4, mag:0.8, res:2.4, spd:1.2 },
    learn:{ 15:'shield_bash', 17:'iron_wall', 21:'last_stand', 26:'encourage' },
  },
  priest: {
    name:'僧侶', icon:'📿', tier:2, req:15, from:['apprentice_cleric'],
    desc:'癒やしを極める道。パーティの生命線。',
    growth:{ hp:8.0, mp:7.5, atk:1.3, def:2.2, mag:3.4, res:3.8, spd:1.3 },
    learn:{ 15:'cure', 18:'group_heal', 22:'sanctuary', 26:'revive' },
  },
  exorcist: {
    name:'祓魔師', icon:'🕯️', tier:2, req:15, from:['apprentice_cleric'],
    desc:'魔を祓う戦う聖職者。魔族に対し無類の強さ。',
    growth:{ hp:9.0, mp:6.5, atk:2.2, def:2.4, mag:3.2, res:3.4, spd:1.6 },
    learn:{ 15:'exorcise', 18:'curse', 21:'dark_pulse', 26:'sanctuary' },
  },
  thief: {
    name:'盗賊', icon:'🗝️', tier:2, req:15, from:['apprentice_scout'],
    desc:'戦場の実利主義者。奪い、躱し、生き延びる。',
    growth:{ hp:9.0, mp:4.5, atk:3.2, def:2.0, mag:1.4, res:1.8, spd:4.2 },
    learn:{ 15:'mug', 17:'smoke_bomb', 21:'shadow_step', 25:'assassinate' },
  },
  ranger: {
    name:'狩人', icon:'🏹', tier:2, req:15, from:['apprentice_scout'],
    desc:'遠く、確実に。魔物の生態を知り尽くす射手。',
    growth:{ hp:10.0, mp:4.5, atk:3.4, def:2.2, mag:1.8, res:2.0, spd:3.6 },
    learn:{ 15:'rapid_fire', 18:'haste', 22:'poison_edge', 26:'kunai_storm' },
  },

  /* ---------- Tier 3 : Lv30 ---------- */
  archmage: {
    name:'大魔道士', icon:'🌌', tier:3, req:30, from:['sorcerer'],
    desc:'学院が百年に一人と認める到達点。',
    growth:{ hp:9.0, mp:13.0, atk:1.4, def:2.0, mag:6.2, res:4.2, spd:2.2 },
    learn:{ 30:'arcane_burst', 34:'gravity', 38:'mana_drain', 44:'meteor' },
  },
  spirit_lord: {
    name:'精霊王の巫子', icon:'🌿', tier:3, req:30, from:['elementalist'],
    desc:'四大精霊の王に名を呼ばれた者。',
    growth:{ hp:10.0, mp:12.0, atk:1.5, def:2.4, mag:5.6, res:5.2, spd:2.6 },
    learn:{ 30:'absolute_zero', 33:'barrier', 37:'gravity', 44:'holy_rain' },
  },
  magic_swordsman: {
    name:'魔法剣士', icon:'🔥', tier:3, req:30, from:['swordsman','sorcerer'],
    desc:'剣と魔の両道。学院とギルド双方の誇り。',
    growth:{ hp:16.0, mp:7.0, atk:5.0, def:4.0, mag:4.0, res:3.0, spd:3.2 },
    learn:{ 30:'mana_blade', 33:'flame_sword', 37:'magic_up', 43:'dragon_fang' },
  },
  paladin: {
    name:'聖騎士', icon:'✝️', tier:3, req:30, from:['guardian','apprentice_cleric','priest'],
    desc:'誓いを鎧とする者。倒れる者を決して見捨てない。',
    growth:{ hp:20.0, mp:6.0, atk:4.6, def:6.0, mag:3.0, res:4.4, spd:2.0 },
    learn:{ 30:'holy_blade', 33:'sanctuary', 37:'cure', 43:'last_stand' },
  },
  bishop: {
    name:'司祭', icon:'👑', tier:3, req:30, from:['priest'],
    desc:'大聖堂に名を連ねる高位聖職者。',
    growth:{ hp:12.0, mp:11.0, atk:1.8, def:3.2, mag:5.2, res:5.6, spd:1.8 },
    learn:{ 30:'mega_heal', 33:'revive', 37:'bless', 44:'holy_rain' },
  },
  inquisitor: {
    name:'審問官', icon:'⚖️', tier:3, req:30, from:['exorcist'],
    desc:'魔王軍を追う教会の刃。慈悲なき正義。',
    growth:{ hp:14.0, mp:9.0, atk:3.6, def:3.6, mag:5.0, res:5.0, spd:2.6 },
    learn:{ 30:'judgment', 34:'curse', 38:'abyss_gate', 43:'mega_heal' },
  },
  ninja: {
    name:'忍者', icon:'🥷', tier:3, req:30, from:['thief'],
    desc:'影の技を極めし者。誰よりも速く、誰よりも静かに。',
    growth:{ hp:14.0, mp:7.0, atk:5.0, def:3.0, mag:3.0, res:2.8, spd:6.4 },
    learn:{ 30:'kunai_storm', 33:'shadow_step', 37:'shadow_flurry', 43:'death_scythe' },
  },
  sniper: {
    name:'狙撃手', icon:'🎯', tier:3, req:30, from:['ranger'],
    desc:'一矢必中。魔王城の尖塔からでも心臓を射抜く。',
    growth:{ hp:15.0, mp:6.0, atk:5.4, def:3.2, mag:2.6, res:2.8, spd:5.2 },
    learn:{ 30:'assassinate', 33:'focus', 38:'rapid_fire', 43:'death_scythe' },
  },

  /* ---------- Tier 4 : Lv50 ---------- */
  sage: {
    name:'賢者', icon:'📚', tier:4, req:50, from:['archmage','spirit_lord'],
    desc:'全ての魔術を統べ、癒やしすら操る。学院史上の頂点。',
    growth:{ hp:14.0, mp:18.0, atk:2.2, def:3.4, mag:8.4, res:6.4, spd:3.4 },
    learn:{ 50:'meteor', 52:'holy_rain', 55:'absolute_zero', 58:'judgment' },
  },
  sword_saint: {
    name:'剣聖', icon:'🌟', tier:4, req:50, from:['magic_swordsman','paladin'],
    desc:'刃の理に至った者。その一閃は世界を分かつ。',
    growth:{ hp:26.0, mp:9.0, atk:7.6, def:6.4, mag:4.0, res:4.4, spd:4.6 },
    learn:{ 50:'nine_slash', 53:'holy_blade', 56:'last_stand', 59:'dragon_fang' },
  },
  saint: {
    name:'聖者', icon:'🕊️', tier:4, req:50, from:['bishop','inquisitor'],
    desc:'死の淵から幾度でも仲間を呼び戻す、生命の体現者。',
    growth:{ hp:18.0, mp:15.0, atk:3.0, def:4.6, mag:7.2, res:7.6, spd:3.0 },
    learn:{ 50:'holy_rain', 52:'revive', 55:'judgment', 58:'sanctuary' },
  },
  shadow_emperor: {
    name:'影皇', icon:'♠️', tier:4, req:50, from:['ninja','sniper'],
    desc:'影の頂に立つ者。魔王ですらその位置を掴めない。',
    growth:{ hp:20.0, mp:10.0, atk:7.2, def:4.4, mag:4.0, res:4.0, spd:8.4 },
    learn:{ 50:'shadow_flurry', 53:'death_scythe', 56:'assassinate', 59:'kunai_storm' },
  },
};

G.job = id => G.JOBS[id];

/* 指定キャラが今転職できるジョブID一覧 */
G.availableJobs = function (jobId, level) {
  return Object.keys(G.JOBS).filter(id => {
    const j = G.JOBS[id];
    if (id === jobId) return false;
    if (!j.from) return false;
    if (level < j.req) return false;
    return j.from.includes(jobId);
  });
};

/* そのジョブが到達レベルまでに覚えるスキル一覧 */
G.jobSkillsUpTo = function (jobId, level) {
  const j = G.JOBS[jobId];
  if (!j || !j.learn) return [];
  return Object.entries(j.learn)
    .filter(([lv]) => Number(lv) <= level)
    .map(([, sk]) => sk);
};
