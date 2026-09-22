/* ===== スキルデータ =====
 * kind : phys(腕力vs守備) / mag(魔力vs魔防) / hybrid(両方の平均)
 *        heal(回復) / buff(強化) / debuff(弱体) / special(特殊)
 * target: one(敵単体) / all(敵全体) / self / ally(味方単体) / allies(味方全体)
 */
window.G = window.G || {};

G.SKILLS = {
  /* ---------- 村人・共通 ---------- */
  strike:     { name:'渾身の一撃', kind:'phys', mp:2, power:130, target:'one', el:'none', desc:'力を込めて殴りつける。' },
  throw_rock: { name:'投石',       kind:'phys', mp:1, power:90,  target:'one', el:'none', acc:1.0, desc:'石を投げる。村人の知恵。' },
  first_aid:  { name:'手当て',     kind:'heal', mp:3, power:55,  target:'ally', desc:'小さな傷を手当てする。' },
  focus:      { name:'集中',       kind:'buff', mp:3, target:'self', buff:{crit:0.45}, turns:3, desc:'3ターンの間、会心率が大きく上がる。' },
  guard_up:   { name:'身構える',   kind:'buff', mp:3, target:'self', buff:{def:0.45}, turns:3, desc:'3ターンの間、守備が上がる。' },
  encourage:  { name:'鼓舞',       kind:'buff', mp:6, target:'allies', buff:{atk:0.20}, turns:4, desc:'味方全体の腕力を上げる。' },

  /* ---------- 魔術系 ---------- */
  fire_bolt:  { name:'ファイアボルト', kind:'mag', mp:4,  power:125, target:'one', el:'fire',  desc:'小さな火の矢を放つ。' },
  ice_needle: { name:'アイスニードル', kind:'mag', mp:4,  power:125, target:'one', el:'water', desc:'氷の針を射出する。' },
  wind_edge:  { name:'ウィンドエッジ', kind:'mag', mp:4,  power:115, target:'one', el:'wind',  desc:'風の刃で切り裂く。素早い詠唱。' },
  stone_blast:{ name:'ストーンブラスト',kind:'mag', mp:5, power:140, target:'one', el:'earth', desc:'岩塊を撃ち出す。' },
  mana_dart:  { name:'マナダート',     kind:'mag', mp:3,  power:105, target:'one', el:'none', hits:2, desc:'無属性の魔力弾を2発撃つ。' },
  fire_ball:  { name:'ファイアボール', kind:'mag', mp:11, power:115, target:'all', el:'fire',  desc:'爆炎が敵全体を包む。' },
  blizzard:   { name:'ブリザード',     kind:'mag', mp:15, power:130, target:'all', el:'water', desc:'吹雪が敵全体を凍てつかせる。' },
  thunder_storm:{name:'サンダーストーム',kind:'mag',mp:17, power:140, target:'all', el:'wind', inflict:{type:'paralyze',rate:0.25,turns:3}, desc:'雷雲を呼ぶ。稀に麻痺。' },
  gaia_press: { name:'ガイアプレス',   kind:'mag', mp:18, power:150, target:'all', el:'earth', desc:'大地が敵を押し潰す。' },
  arcane_burst:{name:'アルケインバースト',kind:'mag',mp:24,power:215, target:'one', el:'none', pierce:0.35, desc:'魔防を一部無視する純粋魔力の奔流。' },
  meteor:     { name:'メテオ',         kind:'mag', mp:42, power:265, target:'all', el:'fire',  desc:'天から隕石を降らせる禁呪。' },
  absolute_zero:{name:'アブソリュートゼロ',kind:'mag',mp:44,power:270,target:'all', el:'water', inflict:{type:'paralyze',rate:0.3,turns:2}, desc:'万物を凍結させる極致。' },
  gravity:    { name:'グラビティ',     kind:'special', mp:20, target:'all', fixedRatio:0.25, desc:'敵全体の現在HPの25%を削る。' },
  drain:      { name:'ドレイン',       kind:'mag', mp:10, power:110, target:'one', el:'dark', drain:0.6, desc:'与えたダメージの60%を吸収する。' },
  mana_drain: { name:'マナドレイン',   kind:'special', mp:0, target:'one', stealMp:0.25, desc:'敵のMPを吸い取る。' },
  meditate:   { name:'瞑想',           kind:'special', mp:0, target:'self', restoreMp:0.22, desc:'精神を統一し最大MPの22%を回復する。' },
  magic_up:   { name:'魔力増幅',       kind:'buff', mp:7, target:'self', buff:{mag:0.40}, turns:4, desc:'自身の魔力を大きく高める。' },
  barrier:    { name:'マジックバリア', kind:'buff', mp:9, target:'allies', buff:{res:0.35}, turns:4, desc:'味方全体の魔防を上げる。' },
  silence_sp: { name:'サイレス',       kind:'debuff', mp:8, target:'one', inflict:{type:'silence',rate:0.75,turns:3}, desc:'敵の詠唱を封じる。' },
  slow_sp:    { name:'スロウ',         kind:'debuff', mp:7, target:'one', buff:{spd:-0.35}, turns:4, desc:'敵の敏捷を下げる。' },

  /* ---------- 剣士・騎士系 ---------- */
  power_slash:{ name:'パワースラッシュ',kind:'phys', mp:6, power:170, target:'one', desc:'渾身の袈裟斬り。' },
  double_slash:{name:'二段斬り',       kind:'phys', mp:8, power:95, hits:2, target:'one', desc:'素早く2回斬りつける。' },
  shield_bash:{ name:'シールドバッシュ',kind:'phys',mp:7, power:110, target:'one', useDefAsAtk:true, inflict:{type:'paralyze',rate:0.35,turns:2}, desc:'盾で殴る。守備が高いほど強い。' },
  whirlwind:  { name:'旋風斬り',       kind:'phys', mp:13, power:115, target:'all', el:'wind', desc:'身を回転させ敵全体を薙ぐ。' },
  pierce:     { name:'貫き突き',       kind:'phys', mp:11, power:165, target:'one', pierce:0.45, desc:'守備の一部を無視して突く。' },
  provoke:    { name:'挑発',           kind:'buff', mp:4, target:'self', buff:{def:0.30,taunt:1}, turns:3, desc:'敵の攻撃を引きつけ、守備を上げる。' },
  iron_wall:  { name:'鉄壁',           kind:'buff', mp:9, target:'allies', buff:{def:0.35}, turns:4, desc:'味方全体の守備を上げる。' },
  armor_break:{ name:'鎧砕き',         kind:'debuff', mp:9, power:80, target:'one', buff:{def:-0.38}, turns:4, desc:'ダメージを与え守備を下げる。' },
  brave_slash:{ name:'勇気の一閃',     kind:'phys', mp:18, power:235, target:'one', desc:'渾身の力を込めた必殺の斬撃。' },
  mana_blade: { name:'マナブレード',   kind:'hybrid', mp:14, power:180, target:'one', el:'none', desc:'剣に魔力を纏わせて斬る。' },
  flame_sword:{ name:'フレイムソード', kind:'hybrid', mp:17, power:195, target:'one', el:'fire', inflict:{type:'burn',rate:0.5,turns:3}, desc:'炎を纏った刃で焼き斬る。' },
  holy_blade: { name:'聖剣技',         kind:'hybrid', mp:20, power:205, target:'one', el:'light', desc:'聖なる光を刃に宿す。' },
  dragon_fang:{ name:'竜牙閃',         kind:'phys', mp:28, power:290, target:'one', desc:'竜すら断つと伝わる大技。' },
  nine_slash: { name:'九頭龍閃',       kind:'phys', mp:40, power:80, hits:5, target:'one', desc:'残像を残す五連撃。' },
  last_stand: { name:'不屈',           kind:'buff', mp:12, target:'self', buff:{atk:0.35,def:0.35}, turns:5, desc:'限界を超え、腕力と守備を高める。' },

  /* ---------- 神官・僧侶系 ---------- */
  heal:       { name:'ヒール',     kind:'heal', mp:5,  power:85,  target:'ally',   desc:'傷を癒す初歩の神聖術。' },
  cure:       { name:'キュア',     kind:'heal', mp:11, power:165, target:'ally',   desc:'深い傷を癒す。' },
  mega_heal:  { name:'メガヒール', kind:'heal', mp:22, power:300, target:'ally',   desc:'瀕死の傷をも癒す高位神聖術。' },
  group_heal: { name:'グループヒール',kind:'heal', mp:20, power:120, target:'allies', desc:'味方全体を癒す。' },
  holy_rain:  { name:'ホーリーレイン',kind:'heal', mp:38, power:240, target:'allies', desc:'聖なる雨が味方全体を包む。' },
  refresh:    { name:'リフレッシュ', kind:'special', mp:8, target:'ally', cureStatus:true, desc:'状態異常をすべて取り除く。' },
  revive:     { name:'リザレクション',kind:'special', mp:30, target:'ally', revive:0.5, desc:'戦闘不能の味方を最大HPの50%で復活させる。' },
  holy_ray:   { name:'ホーリーレイ', kind:'mag', mp:12, power:155, target:'one', el:'light', desc:'裁きの光を放つ。' },
  judgment:   { name:'ジャッジメント',kind:'mag', mp:46, power:300, target:'all', el:'light', desc:'天の裁きが敵全体を焼く。' },
  sanctuary:  { name:'サンクチュアリ',kind:'buff', mp:16, target:'allies', buff:{def:0.28,res:0.28}, turns:5, desc:'聖域を展開し守備と魔防を上げる。' },
  bless:      { name:'ブレス',     kind:'buff', mp:10, target:'allies', buff:{atk:0.25,mag:0.25}, turns:4, desc:'神の祝福で攻撃力と魔力を高める。' },
  curse:      { name:'カース',     kind:'debuff', mp:10, target:'one', buff:{mag:-0.35,res:-0.35}, turns:4, desc:'呪いで魔力と魔防を下げる。' },
  dark_pulse: { name:'ダークパルス',kind:'mag', mp:13, power:160, target:'one', el:'dark', desc:'闇の奔流で打ち据える。' },
  abyss_gate: { name:'アビスゲート', kind:'mag', mp:46, power:300, target:'all', el:'dark', desc:'深淵の門を開き、全てを飲み込む。' },
  exorcise:   { name:'祓魔',       kind:'mag', mp:18, power:200, target:'one', el:'light', vsUndead:2.0, desc:'不死・魔族に絶大な効果を持つ。' },

  /* ---------- 斥候・盗賊系 ---------- */
  quick_stab: { name:'クイックスタブ', kind:'phys', mp:3, power:100, target:'one', acc:1.0, critBonus:0.15, desc:'決して外れない素早い刺突。会心が出やすい。' },
  steal:      { name:'盗む',           kind:'special', mp:4, target:'one', steal:true, desc:'敵から道具を盗む。' },
  mug:        { name:'かすめ取り',     kind:'phys', mp:8, power:110, target:'one', stealGold:true, desc:'斬りつけながら金を奪う。' },
  poison_edge:{ name:'ポイズンエッジ', kind:'phys', mp:7, power:115, target:'one', inflict:{type:'poison',rate:0.75,turns:5}, desc:'毒を塗った刃で斬る。' },
  smoke_bomb: { name:'煙玉',           kind:'debuff', mp:9, target:'all', inflict:{type:'blind',rate:0.7,turns:3}, desc:'敵全体を暗闇に陥れる。' },
  rapid_fire: { name:'速射',           kind:'phys', mp:10, power:72, hits:3, target:'one', desc:'矢を3連射する。' },
  haste:      { name:'ヘイスト',       kind:'buff', mp:9, target:'allies', buff:{spd:0.40}, turns:4, desc:'味方全体の敏捷を上げる。' },
  assassinate:{ name:'暗殺',           kind:'phys', mp:20, power:250, target:'one', critBonus:0.40, desc:'急所を突く。会心が出やすい。' },
  shadow_step:{ name:'シャドウステップ',kind:'buff', mp:11, target:'self', buff:{spd:0.5,eva:0.35}, turns:4, desc:'影に紛れ、敏捷と回避を高める。' },
  kunai_storm:{ name:'手裏剣乱舞',     kind:'phys', mp:16, power:95, target:'all', desc:'無数の刃を敵全体にばら撒く。' },
  shadow_flurry:{name:'影乱舞',        kind:'phys', mp:34, power:105, hits:5, target:'one', desc:'影分身による五連撃。' },
  death_scythe:{ name:'デスサイズ',     kind:'phys', mp:30, power:210, target:'one', instantKill:0.12, desc:'稀に敵を即死させる。' },
  analyze:    { name:'看破',           kind:'special', mp:2, target:'one', analyze:true, desc:'敵のステータスと弱点を調べる。' },

  /* ---------- 敵専用 ---------- */
  e_bite:     { name:'噛みつく',   kind:'phys', mp:0, power:120, target:'one', desc:'' },
  e_claw:     { name:'爪の連撃',   kind:'phys', mp:0, power:80, hits:2, target:'one', desc:'' },
  e_howl:     { name:'咆哮',       kind:'buff', mp:0, target:'self', buff:{atk:0.35}, turns:3, desc:'' },
  e_fire:     { name:'火炎の息',   kind:'mag', mp:0, power:130, target:'all', el:'fire', desc:'' },
  e_ice:      { name:'氷の息',     kind:'mag', mp:0, power:130, target:'all', el:'water', desc:'' },
  e_poison:   { name:'毒霧',       kind:'debuff', mp:0, target:'all', inflict:{type:'poison',rate:0.6,turns:4}, desc:'' },
  e_paralyze: { name:'痺れ粉',     kind:'debuff', mp:0, target:'one', inflict:{type:'paralyze',rate:0.7,turns:3}, desc:'' },
  e_sleep:    { name:'子守唄',     kind:'debuff', mp:0, target:'all', inflict:{type:'sleep',rate:0.5,turns:3}, desc:'' },
  e_drain:    { name:'生命吸収',   kind:'mag', mp:0, power:120, target:'one', el:'dark', drain:1.0, desc:'' },
  e_heal:     { name:'自己再生',   kind:'heal', mp:0, power:140, target:'self', desc:'' },
  e_dark:     { name:'暗黒波動',   kind:'mag', mp:0, power:150, target:'all', el:'dark', desc:'' },
  e_quake:    { name:'大地震',     kind:'mag', mp:0, power:160, target:'all', el:'earth', desc:'' },
  e_holy:     { name:'聖光',       kind:'mag', mp:0, power:150, target:'all', el:'light', desc:'' },
  e_crush:    { name:'叩き潰す',   kind:'phys', mp:0, power:185, target:'one', desc:'' },
  e_allslash: { name:'薙ぎ払い',   kind:'phys', mp:0, power:125, target:'all', desc:'' },
  e_curse:    { name:'呪詛',       kind:'debuff', mp:0, target:'all', buff:{atk:-0.3,mag:-0.3}, turns:4, desc:'' },
  e_meteor:   { name:'魔王のメテオ',kind:'mag', mp:0, power:230, target:'all', el:'fire', desc:'' },
  e_despair:  { name:'絶望の波動', kind:'mag', mp:0, power:210, target:'all', el:'dark', inflict:{type:'silence',rate:0.4,turns:3}, desc:'' },
  e_endgame:  { name:'終焉の宣告', kind:'special', mp:0, target:'all', fixedRatio:0.45, desc:'' },
};

/* スキル参照ヘルパー */
G.skill = id => G.SKILLS[id];
