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

/* 動きごとの絵。
 * 1枚絵は腕や脚を別々に動かせないので、手足を動かすにはこれを用意する。
 * 無ければ、体ごとを傾けたり跳ねさせたりする動き（CSS）だけになる。 */
const POSES = ['walk', 'attack', 'cast', 'hurt', 'down'];

/* 画面側のクラス名 → 動きの名前 */
const CLASS_POSE = {
  'is-walk': 'walk', 'is-attack': 'attack', 'is-cast': 'cast',
  'is-hurt': 'hurt', 'is-down': 'down',
};

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

  /* 用途が無いときの代わり。
   * 1枚の絵をいくつもの画面で使い回せるようにする。
   * 立ち絵だけ用意した、戦闘の絵だけ用意した、どちらでも成立する。 */
  USE_CHAIN: {
    battle: ['battle', 'portrait'],
    field: ['field', 'battle', 'portrait'],
    portrait: ['portrait', 'battle'],
    face: ['face', 'portrait', 'battle'],
  },

  /* ---------- 味方（主人公・仲間） ---------- */
  /* 探す順番
   *   1. そのキャラ専用で、いまの職の絵   例 companion/riina/battle_saint
   *   2. そのキャラ専用の絵               例 companion/riina/battle
   *   3. 職の絵（性別あり → 性別なし）    例 job/swordsman/battle_m
   *   4. 同じ系統の代表職の絵
   * それぞれで用途の代わり（USE_CHAIN）も順に試す。
   * 見つからなければ null（＝ SVG で描く）
   *
   * キャラ専用を職より先に見るのは、
   * 仲間には固有の姿があるため。リィナが村人の絵にならないようにする。
   * 主人公の絵は jobs/villager/ に置くので、転職すればその職の絵になる。
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
    const uses = G.Art.USE_CHAIN[use] || [use];

    const keys = [];
    for (const u of uses) keys.push(`${kind}/${id}/${u}_${job}`);
    for (const u of uses) {
      keys.push(`${kind}/${id}/${u}_${sex}`, `${kind}/${id}/${u}`, `${kind}/${id}/${u}_${other}`);
    }
    for (const u of uses) {
      keys.push(`job/${job}/${u}_${sex}`, `job/${job}/${u}`, `job/${job}/${u}_${other}`);
    }
    if (rep !== job) {
      for (const u of uses) {
        keys.push(`job/${rep}/${u}_${sex}`, `job/${rep}/${u}`, `job/${rep}/${u}_${other}`);
      }
    }
    return keys;
  },

  hero(c, use, pose) {
    if (!G.Art.any) return null;
    const keys = G.Art.heroKeys(c, USES.includes(use) ? use : 'battle');
    if (pose) return G.Art.first(keys.map(k => k + ':' + pose));
    return G.Art.first(keys);
  },

  /* そのキャラで用意されている動きの絵を、まとめて返す。
   * 画面側はこれを <img> に付けておき、動くときに src を差し替える。
   *
   * 番号付き（attack1, attack2 …）があれば、その順に並べて返す。
   * 無ければ番号なしの1枚。どちらも無ければその動きは返らない。 */
  frames(pick) {
    const out = [];
    for (let i = 1; i <= 8; i++) {
      const u = pick(i);
      if (!u) break;
      out.push(u);
    }
    if (out.length) return out;
    const one = pick(null);
    return one ? [one] : [];
  },

  heroPoses(c, use) {
    if (!G.Art.any) return null;
    let found = null;
    for (const p of POSES) {
      const fr = G.Art.frames(i => G.Art.hero(c, use, i ? p + i : p));
      if (fr.length) (found = found || {})[p] = fr;
    }
    return found;
  },

  /* ---------- 敵 ---------- */
  /* 探す順番
   *   1. その敵の絵
   *   2. 同じ見た目の型の絵（wolf / bone など）
   */
  foeKeys(enemyId, use, isBoss) {
    if (!enemyId) return [];
    const kind = isBoss ? 'boss' : 'monster';
    const uses = G.Art.USE_CHAIN[use] || [use];
    /* ボスの絵は bosses/ に置くが、monsters/ にあっても拾う。
     * 置き間違いで絵が出ないより、拾えたほうがよい。 */
    const keys = [];
    for (const u of uses) {
      keys.push(`${kind}/${enemyId}/${u}`, `monster/${enemyId}/${u}`, `boss/${enemyId}/${u}`);
    }
    const look = G.Sprite && G.Sprite.ENEMY_LOOK && G.Sprite.ENEMY_LOOK[enemyId];
    if (look && look[0]) for (const u of uses) keys.push(`monster/${look[0]}/${u}`);
    return keys;
  },

  foe(enemyId, use, isBoss, pose) {
    if (!G.Art.any) return null;
    const keys = G.Art.foeKeys(enemyId, USES.includes(use) ? use : 'battle', isBoss);
    if (pose) return G.Art.first(keys.map(k => k + ':' + pose));
    return G.Art.first(keys);
  },

  foePoses(enemyId, use, isBoss) {
    if (!G.Art.any) return null;
    let found = null;
    for (const p of POSES) {
      const fr = G.Art.frames(i => G.Art.foe(enemyId, use, isBoss, i ? p + i : p));
      if (fr.length) (found = found || {})[p] = fr;
    }
    return found;
  },

  /* ---------- NPC ---------- */
  npc(id, use) {
    if (!G.Art.any) return null;
    return G.Art.url(`npc/${id}/${USES.includes(use) ? use : 'field'}`);
  },

  /* ---------- 画像タグ ---------- */
  /* 画像でもSVGでも同じ class を付ける。
   * CSS 側の動き（歩く・攻撃・被弾）が、どちらでもそのまま効くようにするため。 */
  img(url, name, extra, poses) {
    /* 動きの絵は data- に持たせておく。
     * 画面側は、どのキャラかを調べ直さずに差し替えられる。 */
    /* コマが複数あるときは | で並べる。絵の場所に | は出てこない。 */
    const extra2 = poses
      ? Object.keys(poses).map(k =>
        ` data-pose-${k}="${G.util.esc([].concat(poses[k]).join('|'))}"`).join('')
      : '';
    return `<img class="chr art ${extra || ''}" src="${url}" data-base="${G.util.esc(url)}"${extra2}`
      + ` alt="${G.util.esc(name || '')}" draggable="false">`;
  },

  /* ---------- 動きの絵に差し替える ---------- */
  /* cls は 'is-walk' などの画面側のクラス名。
   * その動きの絵が無ければ何もしない（CSSの動きだけになる）。
   *
   * ms を渡すと、その時間でコマを1周して最後の絵で止まる（攻撃など）。
   * 渡さないと、コマを繰り返し続ける（歩きなど）。 */
  setPose(el, cls, ms) {
    if (!el || el.tagName !== 'IMG' || !el.dataset) return false;
    const pose = CLASS_POSE[cls];
    const raw = pose && el.dataset['pose' + pose.charAt(0).toUpperCase() + pose.slice(1)];
    if (!raw) return false;

    G.Art._stopFrames(el);
    const urls = raw.split('|');
    el.src = urls[0];
    if (urls.length < 2) return true;

    const step = Math.max(70, (ms || 480) / urls.length);
    let i = 0;
    el._poseTimer = setInterval(() => {
      /* 画面が作り直されて、この絵がもう使われていないなら止める */
      if (!el.isConnected) { G.Art._stopFrames(el); return; }
      i++;
      if (i >= urls.length) {
        if (ms) { G.Art._stopFrames(el); return; }   // 1周して止める
        i = 0;                                        // 繰り返す
      }
      el.src = urls[i];
    }, step);
    return true;
  },

  _stopFrames(el) {
    if (el && el._poseTimer) { clearInterval(el._poseTimer); el._poseTimer = null; }
  },

  /* もとの絵に戻す */
  clearPose(el) {
    if (!el || el.tagName !== 'IMG' || !el.dataset) return;
    G.Art._stopFrames(el);
    if (el.dataset.base && el.src !== el.dataset.base) el.src = el.dataset.base;
  },
};

})();
