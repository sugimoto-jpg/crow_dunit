/* ===== キャラクター画像の索引 =====
 * 「このキャラの、この用途の絵はどれか」を答えるだけの層。
 *
 * ここが、絵を差し替える人とゲームのコードの境目になる。
 *   絵を足す人   … assets/characters/ に画像を置く
 *   ゲームの側   … G.Art.of(...) を呼ぶ
 * この2つが直接つながらないので、画像を入れ替えてもゲームは壊れない。
 *
 * 一番大事な約束：
 *   **絵が1枚も無くても、ゲームはいままでどおり動く。**
 *   of() が null を返したら、呼んだ側は今までの SVG 描画を使う。
 *   だから画像は1枚ずつ足していける。
 *
 * 置き場所について：
 *   画像の在処（URL）は画面の都合なので ui 層に置く。
 *   core は画面を知らない層として保つ。
 */
(function () {
'use strict';

window.G = window.G || {};

const USES = ['battle', 'field', 'portrait', 'face'];

/* 職業 -> 同じ系統の代表職。
 * その職の絵がまだ無いとき、系統の絵で代わりにする。
 * G.SPRITE_ARCH（5系統）と同じ分け方にしてあるので、
 * 職業が増えてもそちらを直せばここは追従する。 */
const ARCH_REP = {
  villager: 'villager',
  mage: 'apprentice_mage',
  knight: 'apprentice_knight',
  cleric: 'apprentice_cleric',
  scout: 'apprentice_scout',
};

G.Art = {
  USES,

  get manifest() { return G.ART_MANIFEST || {}; },

  /* 画像が1枚でもあるか。無ければ何も探さずに済む。 */
  get any() { return Object.keys(G.Art.manifest).length > 0; },

  /* 鍵から URL を引く。無ければ null。 */
  url(key) {
    const m = G.Art.manifest;
    return (key && Object.prototype.hasOwnProperty.call(m, key)) ? m[key] : null;
  },

  /* 候補を上から順に試して、最初に見つかった URL を返す。 */
  first(keys) {
    for (const k of keys) { const u = G.Art.url(k); if (u) return u; }
    return null;
  },

  /* ---------- 味方（主人公・仲間） ---------- */
  /* 探す順番（README と同じ）
   *   1. そのキャラ専用で、いまの職の絵
   *   2. 職の絵（性別あり）
   *   3. 職の絵（性別なし）
   *   4. そのキャラ専用の汎用の絵
   *   5. 同じ系統の代表職の絵
   * 見つからなければ null（＝ SVG で描く）
   */
  heroKeys(c, use) {
    if (!c) return [];
    const kind = c.isPlayer ? 'player' : 'companion';
    const id = c.isPlayer ? 'player' : c.key;
    const sex = (c.look && c.look.sex) || 'm';
    const other = sex === 'm' ? 'f' : 'm';
    const job = c.jobId || 'villager';
    const arch = (G.SPRITE_ARCH && G.SPRITE_ARCH[job]) || 'villager';
    const rep = ARCH_REP[arch] || 'villager';

    const keys = [
      `${kind}/${id}/${use}_${job}`,
      `job/${job}/${use}_${sex}`,
      `job/${job}/${use}`,
      `job/${job}/${use}_${other}`,
      `${kind}/${id}/${use}_${sex}`,
      `${kind}/${id}/${use}`,
      `${kind}/${id}/${use}_${other}`,
    ];
    if (rep !== job) {
      keys.push(`job/${rep}/${use}_${sex}`, `job/${rep}/${use}`, `job/${rep}/${use}_${other}`);
    }
    return keys;
  },

  hero(c, use) {
    if (!G.Art.any) return null;
    return G.Art.first(G.Art.heroKeys(c, USES.includes(use) ? use : 'battle'));
  },

  /* ---------- 敵 ---------- */
  /* 探す順番
   *   1. その敵の絵
   *   2. 同じ見た目の型の絵（wolf / bone など）
   */
  foeKeys(enemyId, use, isBoss) {
    if (!enemyId) return [];
    const kind = isBoss ? 'boss' : 'monster';
    /* ボスの絵は bosses/ に置くが、monsters/ にあっても拾う。
     * 置き間違いで絵が出ないより、拾えたほうがよい。 */
    const keys = [`${kind}/${enemyId}/${use}`, `monster/${enemyId}/${use}`,
      `boss/${enemyId}/${use}`];
    const look = G.Sprite && G.Sprite.ENEMY_LOOK && G.Sprite.ENEMY_LOOK[enemyId];
    if (look && look[0]) keys.push(`monster/${look[0]}/${use}`);
    return keys;
  },

  foe(enemyId, use, isBoss) {
    if (!G.Art.any) return null;
    return G.Art.first(G.Art.foeKeys(enemyId, USES.includes(use) ? use : 'battle', isBoss));
  },

  /* ---------- NPC ---------- */
  npc(id, use) {
    if (!G.Art.any) return null;
    return G.Art.url(`npc/${id}/${USES.includes(use) ? use : 'field'}`);
  },

  /* ---------- 画像タグ ---------- */
  /* 画像でもSVGでも同じ class を付ける。
   * CSS 側の動き（歩く・攻撃・被弾）が、どちらでもそのまま効くようにするため。 */
  img(url, name, extra) {
    return `<img class="chr art ${extra || ''}" src="${url}"`
      + ` alt="${G.util.esc(name || '')}" draggable="false">`;
  },
};

})();
