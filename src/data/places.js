/* ===== 探索の地点 =====
 * 村から順に繋がる「道のり」を定義する。
 * 敵は既存の G.AREAS の出現表をそのまま使うので、
 * 新しい魔物のデータは作っていない。
 *
 * 項目:
 *   id            地点の識別子
 *   name          表示名
 *   x, y          地図上の位置（%）
 *   type          town(村) / field(野外) / dungeon(洞窟) / boss(ボスの間)
 *   area          G.AREAS の鍵。出現する敵と推奨レベルの出どころ
 *   description   その場所の説明
 *   requiredLevel 推奨の下限（これより低いと警告を出す）
 *   enemies       出現する敵。省略すると G.AREAS[area].pool を使う
 *   boss          ボスの敵ID（ボスの間のみ）
 *   reward        初回到達・初回撃破の報酬
 *   links         隣接する地点（両方向に書く）
 *   steps         この地点へ入るまでの道のり（歩数）
 *   encounterRate 1歩あたりの遭遇率
 *   events        将来の宝箱・NPC・回復点などの置き場（いまは空）
 *
 * ★ 「解放済み」「攻略済み」はここに書かない。
 *    データに書くと新しく始めても解放されたままになってしまう。
 *    進み具合は d.explore（セーブ側）が持つ。
 */
window.G = window.G || {};

G.SPOTS = {

  village_01: {
    id: 'village_01', name: 'ラヴィンの村', x: 13, y: 64,
    type: 'town', area: null,
    description: '旅の始まる場所。ここから先は魔物が出る。',
    requiredLevel: 1,
    enemies: [], boss: null, reward: null,
    links: ['field_01'],
    steps: 0, encounterRate: 0,
    events: [],
  },

  field_01: {
    id: 'field_01', name: '草原の道', x: 28, y: 48,
    type: 'field', area: 'plains',
    description: '見通しのよい草原。麦畑のふちにスライムが湧く。',
    requiredLevel: 1,
    boss: null, reward: null,
    links: ['village_01', 'forest_01'],
    steps: 6, encounterRate: 0.24,
    events: [],
  },

  forest_01: {
    id: 'forest_01', name: 'ささやきの森', x: 50, y: 34,
    type: 'field', area: 'forest',
    description: '梢が日を遮り、昼でも薄暗い。獣の気配が濃い。',
    requiredLevel: 6,
    boss: null, reward: null,
    links: ['field_01', 'cave_01'],
    steps: 8, encounterRate: 0.28,
    events: [],
  },

  cave_01: {
    id: 'cave_01', name: '風鳴りの洞窟', x: 72, y: 46,
    type: 'dungeon', area: 'cave',
    description: '奥から風が鳴る。骨と土の匂いがする。',
    requiredLevel: 10,
    boss: null, reward: null,
    links: ['forest_01', 'boss_01'],
    steps: 10, encounterRate: 0.30,
    events: [],
  },

  boss_01: {
    id: 'boss_01', name: '最奥の広間', x: 87, y: 28,
    type: 'boss', area: 'cave',
    description: 'この先から、強大な魔力を感じる……',
    requiredLevel: 16,
    enemies: [],
    boss: 'boss_cave_guardian',
    reward: { gold: 1200, exp: 600, items: [{ id: 'hi_potion', n: 2 }] },
    links: ['cave_01'],
    steps: 6, encounterRate: 0.18,
    events: [],
  },

};

/* 最初にいる場所 */
G.SPOT_START = 'village_01';
