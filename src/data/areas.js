/* ===== エリア（マップ）定義 =====
 * もとは enemies.js に同居していたが、「どこで戦うか」は「誰と戦うか」とは
 * 別の関心事なので分離した。自由探索システム（Phase 0 STEP 9 で設計）が
 * この pool を使う予定。
 *
 * name    表示名
 * icon    一覧に出す絵文字
 * lvRange 推奨レベルの範囲 [下限, 上限]
 * pool    そのエリアに出現する敵ID（G.ENEMIES のキー）
 */
window.G = window.G || {};

G.AREAS = {
  plains:   { name:'ラヴィン近郊の草原', icon:'🌾', lvRange:[1,8],   pool:['slime','rat','goblin','wild_wolf'] },
  forest:   { name:'ささやきの森',       icon:'🌲', lvRange:[5,14],  pool:['wild_wolf','giant_bee','treant','goblin'] },
  cave:     { name:'風鳴りの洞窟',       icon:'🕳️', lvRange:[9,18],  pool:['kobold','skeleton','bat_swarm','orc'] },
  ruins:    { name:'古代遺跡ヴェルナ',   icon:'🏛️', lvRange:[15,24], pool:['skeleton','golem','harpy','dark_mage'] },
  highland: { name:'嘆きの高原',         icon:'⛰️', lvRange:[22,32], pool:['minotaur','wraith','chimera','golem'] },
  frostpeak:{ name:'氷牙山脈',           icon:'🏔️', lvRange:[30,40], pool:['ice_queen','chimera','young_dragon','wraith'] },
  borderland:{name:'魔王領境界',         icon:'🌑', lvRange:[36,46], pool:['demon_soldier','hell_hound','young_dragon','lich'] },
  demon_realm:{name:'魔界・黒曜の荒野',  icon:'🔥', lvRange:[44,55], pool:['demon_knight','lich','archdemon','hell_hound'] },
};
