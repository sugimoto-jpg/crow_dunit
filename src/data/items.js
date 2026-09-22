/* ===== アイテム・装備データ =====
 * type: weapon / armor / accessory / consume / material / key
 * slotは装備のみ。mods は装備補正。
 */
window.G = window.G || {};

G.ITEMS = {
  /* ---------- 消耗品 ---------- */
  herb:        { name:'薬草',          type:'consume', icon:'🌿', price:30,   desc:'HPを60回復する。', use:{hp:60} },
  potion:      { name:'ポーション',     type:'consume', icon:'🧪', price:120,  desc:'HPを220回復する。', use:{hp:220} },
  hi_potion:   { name:'ハイポーション', type:'consume', icon:'⚗️', price:420,  desc:'HPを700回復する。', use:{hp:700} },
  elixir:      { name:'エリクサー',     type:'consume', icon:'🏺', price:2600, desc:'HPとMPを全回復する。', use:{hp:9999, mp:9999} },
  ether:       { name:'エーテル',       type:'consume', icon:'💠', price:260,  desc:'MPを50回復する。', use:{mp:50} },
  hi_ether:    { name:'ハイエーテル',   type:'consume', icon:'🔷', price:900,  desc:'MPを150回復する。', use:{mp:150} },
  antidote:    { name:'解毒草',         type:'consume', icon:'🍀', price:50,   desc:'状態異常を1つ治す。', use:{cure:true} },
  phoenix_tail:{ name:'不死鳥の尾',     type:'consume', icon:'🪶', price:800,  desc:'戦闘不能の味方をHP50%で復活させる。', use:{revive:0.5} },
  smoke:       { name:'煙玉',           type:'consume', icon:'💨', price:90,   desc:'戦闘から確実に逃走する。', use:{escape:true} },
  tonic_atk:   { name:'力の水',         type:'consume', icon:'🥃', price:1500, desc:'腕力が永続的に+3される。', use:{perm:{atk:3}} },
  tonic_mag:   { name:'知の雫',         type:'consume', icon:'🫙', price:1500, desc:'魔力が永続的に+3される。', use:{perm:{mag:3}} },
  tonic_hp:    { name:'生命の実',       type:'consume', icon:'🍎', price:1800, desc:'最大HPが永続的に+25される。', use:{perm:{hp:25}} },

  /* ---------- 武器 ---------- */
  wood_stick:  { name:'木の枝',        type:'weapon', icon:'🪵', price:0,     mods:{atk:2},              desc:'村を出る時に拾った枝。' },
  bronze_sword:{ name:'ブロンズソード', type:'weapon', icon:'🗡️', price:320,   mods:{atk:12},            desc:'新人冒険者の定番。' },
  iron_sword:  { name:'アイアンソード', type:'weapon', icon:'⚔️', price:1400,  mods:{atk:30},            desc:'手入れさえすれば長く使える。' },
  silver_sword:{ name:'シルバーソード', type:'weapon', icon:'🤍', price:5200,  mods:{atk:58, res:8},     desc:'魔物に特効を持つ銀の刃。' },
  mithril_blade:{name:'ミスリルブレード',type:'weapon',icon:'💎', price:16000, mods:{atk:95, spd:10},    desc:'軽く、硬く、折れない。' },
  flame_tongue:{ name:'フレイムタン',   type:'weapon', icon:'🔥', price:32000, mods:{atk:130, mag:25},   el:'fire', desc:'刀身が常に燃えている。' },
  excalibur:   { name:'聖剣エクスカリバー',type:'weapon',icon:'🌟',price:0, mods:{atk:210, mag:60, res:30}, el:'light', desc:'魔王を討つために鍛えられた選ばれし刃。', noShop:true, unique:true },

  oak_staff:   { name:'樫の杖',        type:'weapon', icon:'🪄', price:300,   mods:{mag:12, mp:10},     desc:'学院の入学時に配られる杖。' },
  apprentice_wand:{name:'見習いの魔杖', type:'weapon', icon:'✨', price:1300,  mods:{mag:28, mp:22},     desc:'魔力の通りが良い。' },
  crystal_rod: { name:'クリスタルロッド',type:'weapon',icon:'🔮', price:5000,  mods:{mag:55, mp:45, res:10}, desc:'結晶が詠唱を増幅する。' },
  arch_staff:  { name:'大魔道の杖',    type:'weapon', icon:'🌌', price:15500, mods:{mag:92, mp:80, res:20}, desc:'大魔道士に許される杖。' },
  world_tree_staff:{name:'世界樹の杖', type:'weapon', icon:'🌳', price:31000, mods:{mag:135, mp:130, res:38}, desc:'尽きぬ魔力が宿る。' },

  cleric_mace: { name:'僧兵の錫杖',    type:'weapon', icon:'📿', price:1200,  mods:{atk:18, mag:16},    desc:'祈りと打撃を兼ねる。' },
  holy_scepter:{ name:'聖別の錫杖',    type:'weapon', icon:'🕯️', price:6000,  mods:{atk:34, mag:52, res:16}, desc:'不死を退ける聖具。' },

  bronze_dagger:{name:'ブロンズダガー', type:'weapon', icon:'🔪', price:280,   mods:{atk:9, spd:6},      desc:'素早さ重視の短刀。' },
  assassin_edge:{name:'アサシンエッジ', type:'weapon', icon:'🗝️', price:4800,  mods:{atk:48, spd:18},    desc:'刃に薄く毒が残っている。' },
  shadow_fang: { name:'影牙',          type:'weapon', icon:'♠️', price:18000, mods:{atk:100, spd:34},   desc:'影そのものを固めた双刃。' },
  hunting_bow: { name:'ハンティングボウ',type:'weapon',icon:'🏹', price:1250,  mods:{atk:26, spd:10},    desc:'狩人の相棒。' },
  storm_bow:   { name:'ストームボウ',  type:'weapon', icon:'🌪️', price:14000, mods:{atk:88, spd:26},    el:'wind', desc:'放った矢が風を裂く。' },

  /* ---------- 防具 ---------- */
  cloth:       { name:'布の服',        type:'armor', icon:'👕', price:0,     mods:{def:2},             desc:'村で着ていた普段着。' },
  academy_robe:{ name:'学院の制服',    type:'armor', icon:'🎓', price:400,   mods:{def:10, res:12, mp:15}, desc:'アルカナ魔法学院の正装。' },
  leather_armor:{name:'レザーアーマー', type:'armor', icon:'🥋', price:900,   mods:{def:20, spd:4},     desc:'動きを妨げない革鎧。' },
  chain_mail:  { name:'チェインメイル', type:'armor', icon:'⛓️', price:3200,  mods:{def:42, res:10},    desc:'鎖を編んだ鎧。' },
  mage_robe:   { name:'魔道士のローブ', type:'armor', icon:'🧥', price:3600,  mods:{def:24, res:40, mp:45}, desc:'魔力の循環を助ける。' },
  plate_armor: { name:'プレートアーマー',type:'armor',icon:'🛡️', price:11000, mods:{def:82, res:24, spd:-6}, desc:'重いが、堅い。' },
  holy_vestment:{name:'聖衣',          type:'armor', icon:'🕊️', price:13500, mods:{def:60, res:80, mp:70}, desc:'聖別された法衣。' },
  shadow_garb: { name:'影装束',        type:'armor', icon:'🥷', price:12500, mods:{def:56, res:40, spd:24}, desc:'気配を消す黒の装束。' },
  dragon_mail: { name:'ドラゴンメイル', type:'armor', icon:'🐉', price:29000, mods:{def:135, res:60},   desc:'竜鱗を鍛え直した最高峰の鎧。' },
  star_robe:   { name:'星辰のローブ',  type:'armor', icon:'🌠', price:30000, mods:{def:70, res:140, mp:160}, desc:'星の光を織り込んだ法衣。' },

  /* ---------- 装飾品 ---------- */
  leather_band:{ name:'革の腕輪',      type:'accessory', icon:'📿', price:250,  mods:{atk:5, def:5},    desc:'ささやかな守り。' },
  power_ring:  { name:'力の指輪',      type:'accessory', icon:'💍', price:2800, mods:{atk:24},          desc:'腕力を高める指輪。' },
  wisdom_ring: { name:'知恵の指輪',    type:'accessory', icon:'💎', price:2800, mods:{mag:24},          desc:'魔力を高める指輪。' },
  guard_ring:  { name:'守りの指輪',    type:'accessory', icon:'🔰', price:2800, mods:{def:20, res:20},  desc:'守備と魔防を高める。' },
  swift_boots: { name:'疾風のブーツ',  type:'accessory', icon:'👢', price:3400, mods:{spd:28},          desc:'足取りが驚くほど軽くなる。' },
  mana_pendant:{ name:'魔力のペンダント',type:'accessory',icon:'🔵',price:4200, mods:{mp:120, mag:14},  desc:'MPの上限が大きく伸びる。' },
  life_amulet: { name:'生命のお守り',  type:'accessory', icon:'❤️', price:4200, mods:{hp:220, def:10},  desc:'最大HPが大きく伸びる。' },
  scholar_glasses:{name:'学者の眼鏡',  type:'accessory', icon:'👓', price:2000, mods:{mag:10}, study:0.35, desc:'授業での習熟度が35%上がる。' },
  lucky_coin:  { name:'幸運の金貨',    type:'accessory', icon:'🪙', price:3600, mods:{}, goldBonus:0.35, desc:'クエスト報酬が35%増える。' },
  hero_proof:  { name:'勇者の証',      type:'accessory', icon:'🏅', price:0,    mods:{atk:40,def:40,mag:40,res:40,spd:20,hp:400}, noShop:true, unique:true, desc:'魔王に挑む資格を持つ者の証。' },

  /* ---------- 素材・その他 ---------- */
  slime_gel:   { name:'スライムゼリー', type:'material', icon:'🫧', price:18,  desc:'錬金術の基礎素材。' },
  wolf_pelt:   { name:'狼の毛皮',      type:'material', icon:'🐺', price:55,  desc:'防具屋が高く買う。' },
  goblin_fang: { name:'ゴブリンの牙',  type:'material', icon:'🦷', price:40,  desc:'討伐証明にもなる。' },
  mana_crystal:{ name:'魔力結晶',      type:'material', icon:'💠', price:230, desc:'魔道具の核になる。' },
  dragon_scale:{ name:'竜の鱗',        type:'material', icon:'🐲', price:1400,desc:'極めて硬い。' },
  dark_ore:    { name:'魔鉱石',        type:'material', icon:'🪨', price:680, desc:'魔王領でのみ採れる鉱石。' },
  demon_horn:  { name:'魔族の角',      type:'material', icon:'😈', price:2200,desc:'上位魔族の証。' },
};

G.item = id => G.ITEMS[id];

/* 店ごとの品揃え（解禁条件つき） */
G.SHOPS = {
  weapon: {
    name:'武具屋「鋼の梟」', icon:'⚒️',
    lines:[
      { id:'bronze_sword', rank:0 }, { id:'bronze_dagger', rank:0 }, { id:'oak_staff', rank:0 },
      { id:'iron_sword', rank:1 }, { id:'apprentice_wand', rank:1 }, { id:'cleric_mace', rank:1 }, { id:'hunting_bow', rank:1 },
      { id:'silver_sword', rank:3 }, { id:'crystal_rod', rank:3 }, { id:'assassin_edge', rank:3 }, { id:'holy_scepter', rank:3 },
      { id:'mithril_blade', rank:4 }, { id:'arch_staff', rank:4 }, { id:'storm_bow', rank:4 },
      { id:'flame_tongue', rank:5 }, { id:'world_tree_staff', rank:5 }, { id:'shadow_fang', rank:5 },
    ],
  },
  armor: {
    name:'防具屋「銀の裁縫室」', icon:'🛡️',
    lines:[
      { id:'academy_robe', rank:0 }, { id:'leather_armor', rank:0 },
      { id:'chain_mail', rank:2 }, { id:'mage_robe', rank:2 },
      { id:'plate_armor', rank:4 }, { id:'holy_vestment', rank:4 }, { id:'shadow_garb', rank:4 },
      { id:'dragon_mail', rank:5 }, { id:'star_robe', rank:5 },
    ],
  },
  item: {
    name:'道具屋「まどろみ亭」', icon:'🧪',
    lines:[
      { id:'herb', rank:0 }, { id:'antidote', rank:0 }, { id:'smoke', rank:0 },
      { id:'potion', rank:1 }, { id:'ether', rank:1 },
      { id:'hi_potion', rank:3 }, { id:'hi_ether', rank:3 }, { id:'phoenix_tail', rank:3 },
      { id:'elixir', rank:5 },
    ],
  },
  accessory: {
    name:'魔道具店「月の抽斗」', icon:'💍',
    lines:[
      { id:'leather_band', rank:0 }, { id:'scholar_glasses', rank:0 },
      { id:'power_ring', rank:2 }, { id:'wisdom_ring', rank:2 }, { id:'guard_ring', rank:2 }, { id:'lucky_coin', rank:2 },
      { id:'swift_boots', rank:3 }, { id:'mana_pendant', rank:4 }, { id:'life_amulet', rank:4 },
    ],
  },
};
