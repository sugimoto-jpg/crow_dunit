/* ===== 敵データ =====
 * weak/resist : 属性配列  drops: [{id, rate}]
 * skills: 使用スキルID配列（weight付き）
 * tags: undead / demon など
 */
window.G = window.G || {};

G.ENEMIES = {
  /* ---------- 森・草原（Fランク帯 Lv1-8） ---------- */
  slime:      { name:'スライム', icon:'🫧', lv:1, hp:31, mp:0, atk:12, def:4, mag:11, res:4, spd:4,
                exp:23, gold:11, weak:['fire'], resist:[], skills:[], drops:[{id:'slime_gel',rate:.55}] },
  rat:        { name:'大ネズミ', icon:'🐀', lv:2, hp:31, mp:0, atk:10, def:5, mag:10, res:5, spd:9,
                exp:23, gold:11, weak:['fire'], resist:[], skills:[{id:'e_bite',w:2}], drops:[{id:'herb',rate:.3}] },
  goblin:     { name:'ゴブリン', icon:'👺', lv:4, hp:38, mp:6, atk:13, def:10, mag:12, res:10, spd:8,
                exp:23, gold:11, weak:[], resist:[], skills:[{id:'e_claw',w:2}], drops:[{id:'goblin_fang',rate:.5}] },
  wild_wolf:  { name:'荒野の狼', icon:'🐺', lv:6, hp:126, mp:0, atk:31, def:17, mag:31, res:12, spd:16,
                exp:54, gold:25, weak:['fire'], resist:['wind'], skills:[{id:'e_bite',w:3},{id:'e_howl',w:1}],
                drops:[{id:'wolf_pelt',rate:.5}] },
  giant_bee:  { name:'大蜂', icon:'🐝', lv:7, hp:163, mp:10, atk:48, def:18, mag:48, res:19, spd:22,
                exp:67, gold:31, weak:['wind'], resist:[], skills:[{id:'e_poison',w:2}], drops:[{id:'antidote',rate:.3}] },
  treant:     { name:'トレント', icon:'🌳', lv:8, hp:222, mp:14, atk:27, def:28, mag:27, res:22, spd:4,
                exp:95, gold:45, weak:['fire'], resist:['water','earth'], skills:[{id:'e_crush',w:2}],
                drops:[{id:'herb',rate:.6}] },

  /* ---------- 洞窟・遺跡（E〜Dランク Lv9-20） ---------- */
  kobold:     { name:'コボルト', icon:'🐕', lv:10, hp:278, mp:12, atk:114, def:26, mag:93, res:26, spd:14,
                exp:122, gold:57, weak:[], resist:[], skills:[{id:'e_claw',w:3},{id:'e_howl',w:1}],
                drops:[{id:'goblin_fang',rate:.4},{id:'potion',rate:.15}] },
  skeleton:   { name:'スケルトン', icon:'💀', lv:12, hp:323, mp:10, atk:51, def:33, mag:41, res:29, spd:12,
                tags:['undead'], exp:122, gold:57, weak:['light'], resist:['dark','water'],
                skills:[{id:'e_crush',w:2}], drops:[{id:'mana_crystal',rate:.2}] },
  bat_swarm:  { name:'吸血蝙蝠', icon:'🦇', lv:13, hp:269, mp:20, atk:68, def:24, mag:56, res:33, spd:28,
                exp:122, gold:57, weak:['light','wind'], resist:['dark'], skills:[{id:'e_drain',w:3}],
                drops:[{id:'ether',rate:.2}] },
  orc:        { name:'オーク', icon:'🐗', lv:15, hp:529, mp:8, atk:107, def:47, mag:87, res:37, spd:10,
                exp:184, gold:86, weak:['wind'], resist:['earth'], skills:[{id:'e_crush',w:3},{id:'e_howl',w:1}],
                drops:[{id:'iron_sword',rate:.05},{id:'potion',rate:.25}] },
  harpy:      { name:'ハーピー', icon:'🦅', lv:16, hp:522, mp:30, atk:168, def:39, mag:129, res:58, spd:34,
                exp:196, gold:92, weak:['wind'], resist:[], skills:[{id:'e_sleep',w:2},{id:'e_claw',w:3}],
                drops:[{id:'ether',rate:.25}] },
  golem:      { name:'ストーンゴーレム', icon:'🗿', lv:19, hp:556, mp:0, atk:40, def:68, mag:31, res:46, spd:5,
                exp:196, gold:92, weak:['water'], resist:['earth','fire','wind'],
                skills:[{id:'e_quake',w:2},{id:'e_crush',w:3}], drops:[{id:'mana_crystal',rate:.45}] },
  dark_mage:  { name:'闇術士', icon:'🧙', lv:20, hp:356, mp:120, atk:48, def:39, mag:37, res:57, spd:22,
                exp:230, gold:107, weak:['light'], resist:['dark'],
                skills:[{id:'e_dark',w:3},{id:'e_curse',w:1},{id:'e_drain',w:2}],
                drops:[{id:'mana_crystal',rate:.4},{id:'mage_robe',rate:.04}] },

  /* ---------- 魔物領（C〜Bランク Lv21-38） ---------- */
  minotaur:   { name:'ミノタウロス', icon:'🐂', lv:24, hp:1385, mp:20, atk:258, def:57, mag:218, res:40, spd:20,
                exp:578, gold:270, weak:['wind'], resist:[],
                skills:[{id:'e_crush',w:3},{id:'e_allslash',w:2},{id:'e_howl',w:1}],
                drops:[{id:'power_ring',rate:.06},{id:'hi_potion',rate:.3}] },
  wraith:     { name:'レイス', icon:'👻', lv:26, hp:677, mp:180, atk:99, def:43, mag:84, res:68, spd:38,
                tags:['undead'], exp:385, gold:180, weak:['light'], resist:['dark','earth'],
                skills:[{id:'e_drain',w:3},{id:'e_dark',w:2},{id:'e_curse',w:1}],
                drops:[{id:'mana_crystal',rate:.5},{id:'hi_ether',rate:.2}] },
  chimera:    { name:'キマイラ', icon:'🦁', lv:30, hp:2558, mp:120, atk:421, def:94, mag:356, res:54, spd:34,
                exp:1155, gold:539, weak:[], resist:['fire'],
                skills:[{id:'e_fire',w:2},{id:'e_claw',w:3},{id:'e_poison',w:1}],
                drops:[{id:'dragon_scale',rate:.25},{id:'hi_potion',rate:.4}] },
  ice_queen:  { name:'氷結の魔女', icon:'❄️', lv:33, hp:1534, mp:300, atk:158, def:52, mag:168, res:80, spd:44,
                exp:898, gold:419, weak:['fire'], resist:['water'],
                skills:[{id:'e_ice',w:3},{id:'e_curse',w:1},{id:'e_drain',w:1}],
                drops:[{id:'crystal_rod',rate:.08},{id:'mana_crystal',rate:.6}] },
  young_dragon:{name:'幼竜ワイバーン', icon:'🐉', lv:36, hp:2024, mp:160, atk:157, def:91, mag:167, res:74, spd:38,
                exp:898, gold:419, weak:['water'], resist:['fire','earth'],
                skills:[{id:'e_fire',w:3},{id:'e_crush',w:2},{id:'e_allslash',w:1}],
                drops:[{id:'dragon_scale',rate:.7}] },
  demon_soldier:{name:'魔族の兵士', icon:'😈', lv:38, hp:1097, mp:200, atk:112, def:81, mag:118, res:84, spd:48,
                tags:['demon'], exp:598, gold:279, weak:['light'], resist:['dark'],
                skills:[{id:'e_allslash',w:3},{id:'e_dark',w:2},{id:'e_curse',w:1}],
                drops:[{id:'demon_horn',rate:.35},{id:'dark_ore',rate:.4}] },

  /* ---------- 魔王領（A〜Sランク Lv40-55） ---------- */
  hell_hound: { name:'ヘルハウンド', icon:'🔥', lv:42, hp:1787, mp:180, atk:323, def:96, mag:342, res:107, spd:72,
                tags:['demon'], exp:898, gold:419, weak:['water'], resist:['fire','dark'],
                skills:[{id:'e_fire',w:3},{id:'e_bite',w:3},{id:'e_howl',w:1}],
                drops:[{id:'dark_ore',rate:.5}] },
  lich:       { name:'リッチ', icon:'☠️', lv:45, hp:1467, mp:600, atk:264, def:103, mag:276, res:138, spd:56,
                tags:['undead','demon'], exp:850, gold:397, weak:['light'], resist:['dark','water'],
                skills:[{id:'e_dark',w:3},{id:'e_drain',w:2},{id:'e_curse',w:2},{id:'e_heal',w:1}],
                drops:[{id:'demon_horn',rate:.5},{id:'hi_ether',rate:.6}] },
  demon_knight:{name:'魔騎士', icon:'⚫', lv:48, hp:1726, mp:260, atk:288, def:110, mag:300, res:83, spd:66,
                tags:['demon'], exp:850, gold:397, weak:['light'], resist:['dark','fire'],
                skills:[{id:'e_allslash',w:3},{id:'e_crush',w:3},{id:'e_dark',w:1}],
                drops:[{id:'demon_horn',rate:.6},{id:'dark_ore',rate:.6}] },
  archdemon:  { name:'上級魔族', icon:'👹', lv:52, hp:2201, mp:500, atk:303, def:118, mag:317, res:118, spd:78,
                tags:['demon'], exp:1275, gold:595, weak:['light'], resist:['dark'],
                skills:[{id:'e_despair',w:2},{id:'e_dark',w:3},{id:'e_allslash',w:2},{id:'e_heal',w:1}],
                drops:[{id:'demon_horn',rate:.9}] },

  /* ---------- ボス ---------- */
  boss_goblin_lord:{ name:'ゴブリンロード', icon:'👺', boss:true, lv:9, hp:360, mp:40, atk:29, def:24, mag:29, res:24, spd:14,
                exp:1086, gold:398, weak:['fire'], resist:[],
                skills:[{id:'e_allslash',w:2},{id:'e_howl',w:1},{id:'e_claw',w:3}],
                drops:[{id:'leather_armor',rate:1}],
                intro:'洞窟の奥、ひときわ大きな影が立ち上がる。' },
  boss_cave_guardian:{ name:'遺跡の守護者', icon:'🗿', boss:true, lv:18, hp:1800, mp:60, atk:82, def:44, mag:63, res:44, spd:12,
                exp:5886, gold:2158, weak:['water'], resist:['earth','fire'],
                skills:[{id:'e_quake',w:3},{id:'e_crush',w:3}],
                drops:[{id:'chain_mail',rate:1}],
                intro:'遺跡の最奥。石像が、ゆっくりと目を開けた。' },
  boss_swamp_hydra:{ name:'沼のヒュドラ', icon:'🐍', boss:true, lv:28, hp:5536, mp:200, atk:384, def:66, mag:406, res:66, spd:30,
                exp:16430, gold:6024, weak:['fire'], resist:['water','earth'],
                skills:[{id:'e_poison',w:2},{id:'e_bite',w:3},{id:'e_allslash',w:2}],
                drops:[{id:'swift_boots',rate:1}],
                intro:'水面が割れ、三つの首が同時に持ち上がった。' },
  boss_flame_dragon:{ name:'紅蓮竜イグナート', icon:'🐲', boss:true, lv:40, hp:6069, mp:400, atk:537, def:67, mag:560, res:74, spd:52,
                exp:23732, gold:8702, weak:['water'], resist:['fire'],
                skills:[{id:'e_fire',w:3},{id:'e_crush',w:3},{id:'e_allslash',w:2},{id:'e_howl',w:1}],
                drops:[{id:'dragon_mail',rate:1},{id:'dragon_scale',rate:1}],
                intro:'山が吼えた。――否、山だと思っていたものが、翼を広げた。' },

  /* ---------- 魔王城 ---------- */
  gate_keeper:{ name:'門番ガルヴァス', icon:'🚪', boss:true, lv:46, hp:8456, mp:300, atk:813, def:105, mag:849, res:105, spd:50,
                tags:['demon'], exp:25505, gold:9352, weak:['light'], resist:['dark','earth'],
                skills:[{id:'e_crush',w:3},{id:'e_allslash',w:3},{id:'e_curse',w:1}],
                drops:[], intro:'「学院の小僧が。門をくぐる資格があるか、試してやろう」' },
  four_general_1:{ name:'四天王・氷刃のセレス', icon:'🧊', boss:true, lv:50, hp:10291, mp:800, atk:1030, def:95, mag:1234, res:114, spd:88,
                tags:['demon'], exp:28268, gold:10365, weak:['fire'], resist:['water','dark'],
                skills:[{id:'e_ice',w:3},{id:'e_despair',w:1},{id:'e_curse',w:1},{id:'e_heal',w:1}],
                drops:[], intro:'「あなたの温度、ここで止めてあげる」' },
  four_general_2:{ name:'四天王・業火のバルガ', icon:'🌋', boss:true, lv:52, hp:13224, mp:500, atk:1200, def:118, mag:1426, res:97, spd:62,
                tags:['demon'], exp:30176, gold:11064, weak:['water'], resist:['fire','dark'],
                skills:[{id:'e_fire',w:3},{id:'e_crush',w:3},{id:'e_allslash',w:2}],
                drops:[], intro:'「燃えろ。何もかも、灰になれば平等だ」' },
  demon_lord_1:{ name:'魔王ヴァルドレア', icon:'😈', boss:true, lv:55, hp:15654, mp:1200, atk:606, def:125, mag:749, res:125, spd:90,
                tags:['demon'], exp:32136, gold:11783, weak:['light'], resist:['dark','fire','water'],
                skills:[{id:'e_meteor',w:2},{id:'e_despair',w:2},{id:'e_allslash',w:2},{id:'e_dark',w:2},{id:'e_heal',w:1}],
                drops:[], intro:'「よく来た、転生者よ。……お前の“前の世界”の話を、少し聞かせてくれ」' },
  demon_lord_2:{ name:'真魔王ヴァルドレア', icon:'👑', boss:true, lv:60, hp:20127, mp:2000, atk:629, def:136, mag:766, res:136, spd:105,
                tags:['demon'], exp:35174, gold:12897, weak:['light'], resist:['dark','fire','water','wind','earth'],
                skills:[{id:'e_endgame',w:1},{id:'e_meteor',w:3},{id:'e_despair',w:3},{id:'e_dark',w:2},{id:'e_allslash',w:2},{id:'e_heal',w:1}],
                drops:[], intro:'「――ならば見せてみろ。お前が選び取ってきた、その全てを」' },
};

/* ===== 難易度設定 =====
 * 敵の素の数値は tools/retune-enemies.js で実測パーティ火力に合わせて設計済み。
 * ここはプレイヤーが選べる難易度の倍率のみを持つ。
 */
/* むずかしい の補正について（2回目の調整）
 *   以前は hp 1.35 / atk 1.22 だったが、序盤が成立していなかった。
 *   低レベルではHPが薄く装備も無いため、攻撃力の補正が致命的に効き、
 *   F級の最初の依頼（Lv2 スライム×3）の勝率が 8% しかなかった。
 *   実際、自動プレイでは400日回しても卒業できず、全滅516回だった。
 *
 *   hp 1.25 / atk 1.12 に緩めた結果（tools/balance.js で実測）:
 *     Lv2 スライム×3   8% → 53%
 *     Lv3 大ネズミ×3  14% → 54%
 *     Lv62 真魔王      30% → 47%（ふつうは73%なので歯応えは残る）
 */
G.DIFFICULTY = {
  easy:   { name:'やさしい', hp: 0.78, atk: 0.78 },
  normal: { name:'ふつう',   hp: 1.00, atk: 1.00 },
  hard:   { name:'むずかしい', hp: 1.25, atk: 1.12 },
};

/* 難易度キーを受け取って補正値を返す。
 * データ層はゲームの進行状態を知らないので、難易度は呼び出し側から渡す。
 * （以前は G.State を直接読んでいたが、data → core の逆流になるため改めた） */
G.enemyScale = function (difficultyKey) {
  const d = G.DIFFICULTY[difficultyKey] || G.DIFFICULTY.normal;
  return { hp: d.hp, atk: d.atk, mag: d.atk };
};

G.enemy = id => G.ENEMIES[id];
