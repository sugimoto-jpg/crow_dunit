/* ===== 冒険者ギルド : ランクとクエスト ===== */
window.G = window.G || {};

/* ランク定義（index がランク値） */
/* clears = 昇格に必要な累計依頼数 / minLv = 昇格に必要なレベル
 * 依頼数だけで上がると、実力不足のまま格上の昇格試験に挑めてしまうため
 * レベル条件を併せて課している。 */
G.RANKS = [
  { key:'F', name:'F級', clears:0,  minLv:1,  color:'#a79ecb',
    desc:'登録したての見習い冒険者。' },
  { key:'E', name:'E級', clears:3,  minLv:7,  color:'#8fd6a8', promo:'boss_goblin_lord',
    desc:'一人で薬草採取に行ける程度。' },
  { key:'D', name:'D級', clears:6,  minLv:12, color:'#6aa9ff', promo:null,
    desc:'常設依頼を任せられる。' },
  { key:'C', name:'C級', clears:10, minLv:19, color:'#59d8e6', promo:'boss_cave_guardian',
    desc:'一人前。ギルドの主力層。' },
  { key:'B', name:'B級', clears:15, minLv:27, color:'#9a6bff', promo:null,
    desc:'指名依頼が来るようになる。' },
  { key:'A', name:'A級', clears:21, minLv:36, color:'#f2c14e', promo:'boss_swamp_hydra',
    desc:'国が動く案件を任される。' },
  { key:'S', name:'S級', clears:28, minLv:45, color:'#ff5f6d', promo:'boss_flame_dragon',
    desc:'大陸に十人といない最高位。' },
];

/* クエストテンプレート
 * kind: subjugate(討伐) / gather(採集) / escort(連戦) / boss
 * rank: 必要ランク index
 */
G.QUESTS = [
  /* --- F --- */
  { id:'q_slime',   rank:0, kind:'subjugate', name:'スライムの駆除', icon:'🫧',
    desc:'麦畑にスライムが湧いた。3匹ほど減らしてほしい。',
    area:'plains', enemies:['slime','slime'], gold:90, exp:44, ap:1 },
  { id:'q_herb',    rank:0, kind:'gather', name:'薬草の採取', icon:'🌿',
    desc:'道具屋の在庫が心もとない。草原で薬草を摘んできて。',
    area:'plains', enemies:['rat','slime'], gold:70, exp:41, ap:1, reward:[{id:'herb',n:3}] },
  { id:'q_rat',     rank:0, kind:'subjugate', name:'倉庫のネズミ退治', icon:'🐀',
    desc:'学院の食糧庫に大ネズミが出た。生徒諸君、頼む。',
    area:'plains', enemies:['rat','rat'], gold:110, exp:47, ap:1 },
  { id:'q_goblin1', rank:0, kind:'subjugate', name:'ゴブリンの物見', icon:'👺',
    desc:'街道沿いにゴブリンの偵察。小さな群れのうちに叩く。',
    area:'plains', enemies:['goblin','goblin'], gold:150, exp:52, ap:1 },

  /* --- E --- */
  { id:'q_wolf',    rank:1, kind:'subjugate', name:'狼の群れ', icon:'🐺',
    desc:'牧場が襲われている。群れのリーダーごと。',
    area:'forest', enemies:['wild_wolf','wild_wolf','wild_wolf'], gold:280, exp:160, ap:1 },
  { id:'q_bee',     rank:1, kind:'gather', name:'蜂蜜の確保', icon:'🐝',
    desc:'学院の菓子職人からの依頼。……大蜂付きだが。',
    area:'forest', enemies:['giant_bee','giant_bee'], gold:240, exp:153, ap:1, reward:[{id:'antidote',n:2}] },
  { id:'q_treant',  rank:1, kind:'subjugate', name:'歩く樹の噂', icon:'🌳',
    desc:'森の木が動いていると木こりが怯えている。',
    area:'forest', enemies:['treant','giant_bee'], gold:350, exp:214, ap:2 },

  /* --- D --- */
  { id:'q_cave1',   rank:2, kind:'subjugate', name:'洞窟の掃除', icon:'🕳️',
    desc:'風鳴りの洞窟に魔物が住み着いた。入口付近だけでいい。',
    area:'cave', enemies:['kobold','kobold','bat_swarm'], gold:520, exp:443, ap:2 },
  { id:'q_bone',    rank:2, kind:'subjugate', name:'墓地の異変', icon:'💀',
    desc:'夜ごと骨が歩く。神官科の実習も兼ねている。',
    area:'cave', enemies:['skeleton','skeleton','skeleton'], gold:600, exp:462, ap:2 },
  { id:'q_ore',     rank:2, kind:'gather', name:'魔力結晶の採掘', icon:'💠',
    desc:'錬金術教室から。結晶を採ってきてくれれば単位もつく。',
    area:'cave', enemies:['kobold','skeleton'], gold:450, exp:427, ap:2, reward:[{id:'mana_crystal',n:2}] },
  { id:'q_orc',     rank:2, kind:'subjugate', name:'オークの野営地', icon:'🐗',
    desc:'街道を塞ぐオークたち。早めに散らしておきたい。',
    area:'cave', enemies:['orc','orc'], gold:780, exp:504, ap:2 },

  /* --- C --- */
  { id:'q_ruins1',  rank:3, kind:'subjugate', name:'遺跡の調査護衛', icon:'🏛️',
    desc:'学院の調査隊に同行し、遺跡の魔物を退ける。',
    area:'ruins', enemies:['harpy','golem','skeleton'], gold:1140, exp:830, ap:2 },
  { id:'q_darkmage',rank:3, kind:'subjugate', name:'闇術士の捕縛', icon:'🧙',
    desc:'禁呪に手を出した元学院生。……できれば生きて連れ帰れ。',
    area:'ruins', enemies:['dark_mage','skeleton','skeleton'], gold:1425, exp:887, ap:2 },
  { id:'q_golem',   rank:3, kind:'subjugate', name:'石像の暴走', icon:'🗿',
    desc:'遺跡の守護機構が暴れている。止めてくれ。',
    area:'ruins', enemies:['golem','golem'], gold:1330, exp:868, ap:2 },

  /* --- B --- */
  { id:'q_minotaur',rank:4, kind:'subjugate', name:'迷宮の牛鬼', icon:'🐂',
    desc:'高原の迷宮で行方不明者が続出している。',
    area:'highland', enemies:['minotaur','minotaur'], gold:2132, exp:1413, ap:2 },
  { id:'q_wraith',  rank:4, kind:'subjugate', name:'嘆きの亡霊', icon:'👻',
    desc:'夜通し泣き声が響く。聖職者の同行を推奨。',
    area:'highland', enemies:['wraith','wraith','skeleton'], gold:2296, exp:1444, ap:2 },
  { id:'q_chimera', rank:4, kind:'subjugate', name:'キマイラ討伐', icon:'🦁',
    desc:'合成獣が檻を破った。錬金術ギルドの不始末だ。',
    area:'highland', enemies:['chimera'], gold:2460, exp:1475, ap:2 },

  /* --- A --- */
  { id:'q_icequeen',rank:5, kind:'subjugate', name:'氷結の魔女', icon:'❄️',
    desc:'氷牙山脈の村が丸ごと凍りついた。',
    area:'frostpeak', enemies:['ice_queen','wraith'], gold:3224, exp:2154, ap:2 },
  { id:'q_dragon',  rank:5, kind:'subjugate', name:'幼竜の間引き', icon:'🐉',
    desc:'竜が増えすぎた。心苦しいが、数を減らす。',
    area:'frostpeak', enemies:['young_dragon','young_dragon'], gold:3720, exp:2244, ap:2 },
  { id:'q_border',  rank:5, kind:'subjugate', name:'境界線の偵察', icon:'🌑',
    desc:'魔王領との境で魔族の動きがある。生きて帰れ。',
    area:'borderland', enemies:['demon_soldier','hell_hound'], gold:4216, exp:2334, ap:2 },

  /* --- S --- */
  { id:'q_lich',    rank:6, kind:'subjugate', name:'不死王の討滅', icon:'☠️',
    desc:'死者の軍勢を率いるリッチ。国からの正式な指名依頼。',
    area:'borderland', enemies:['lich','skeleton','skeleton'], gold:5760, exp:2964, ap:2 },
  { id:'q_knight',  rank:6, kind:'subjugate', name:'魔騎士の撃退', icon:'⚫',
    desc:'魔王軍先遣隊。ここを抜かれれば王都まで一直線だ。',
    area:'demon_realm', enemies:['demon_knight','demon_soldier','demon_soldier'], gold:7200, exp:3147, ap:2 },
  { id:'q_archdemon',rank:6, kind:'subjugate', name:'上級魔族の排除', icon:'👹',
    desc:'魔王城の目前。ここを制すれば、いよいよだ。',
    area:'demon_realm', enemies:['archdemon','hell_hound'], gold:9600, exp:3453, ap:2 },
];

G.questsForRank = rank => G.QUESTS.filter(q => q.rank <= rank && q.rank >= Math.max(0, rank - 2));
