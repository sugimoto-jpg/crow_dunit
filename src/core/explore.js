/* ===== 探索 =====
 * 地点のあいだを歩き、途中で魔物と遭遇し、目的地に着く——という進行を扱う。
 *
 * ★ この層は画面を一切知らない（battle.js と同じ方針）。
 *   「いま何歩目か」「遭遇するか」「到達したか」を計算して返すだけ。
 *   絵を描くのは src/ui/screen_map.js と screen_travel.js の仕事。
 *   npm test の DOM非依存チェックが、この約束を毎回確かめる。
 *
 * 進み具合はセーブ（d.explore）が持つ:
 *   at        いまいる地点
 *   visited   到達したことのある地点
 *   cleared   ボスを倒した地点
 *   trip      移動中の状態（null なら移動していない）
 */
(function () {
'use strict';

window.G = window.G || {};

/* 道中の魔物からもらう報酬の倍率。
 *
 * 依頼1件=1AP=戦闘1回 だったところに、道中の戦闘が4〜6回入る。
 * そのまま足すと 1APあたりの経験値が約5倍になり、
 * 学院の3年間（1日3AP・135日）という時間設計が崩れる。
 * そこで道中の取り分を下げ、依頼1件ぶんの総取得が
 * これまでと同じくらいになるようにしている。
 *
 * この値は tools/balance.js と tools/playthrough.js で測って決める。
 * 変えるのはここ1か所でよい。 */
G.EXPLORE_REWARD = { exp: 0.35, gold: 0.35 };

/* 遭遇の偏りを抑える値 */
const RUN_MAX = 3;      // これだけ続けて遭遇したら、次は必ず安全
const DRY_MAX = 5;      // これだけ出なかったら、次は必ず遭遇

G.Explore = {

  /* ---------- 進み具合 ---------- */
  data() {
    const d = G.State.data;
    if (!d) return null;
    if (!d.explore) {
      d.explore = { at: G.SPOT_START, visited: [G.SPOT_START], cleared: [], trip: null, run: 0, dry: 0 };
    }
    return d.explore;
  },

  spot(id) { return G.SPOTS[id] || null; },
  here() { const e = G.Explore.data(); return e ? G.SPOTS[e.at] : null; },
  visited(id) { const e = G.Explore.data(); return !!e && e.visited.includes(id); },
  cleared(id) { const e = G.Explore.data(); return !!e && e.cleared.includes(id); },

  /* その地点で出る魔物。地点に指定が無ければエリアの出現表を使う。 */
  enemyPool(id) {
    const s = G.SPOTS[id];
    if (!s) return [];
    if (s.enemies && s.enemies.length) return s.enemies.slice();
    const a = s.area && G.AREAS[s.area];
    return a ? a.pool.slice() : [];
  },

  /* 推奨レベルの範囲。エリアの設定をそのまま使う。 */
  levelRange(id) {
    const s = G.SPOTS[id];
    if (!s) return null;
    const a = s.area && G.AREAS[s.area];
    return a ? a.lvRange.slice() : [s.requiredLevel, s.requiredLevel + 5];
  },

  /* いる場所から行ける先 */
  exits() {
    const h = G.Explore.here();
    if (!h) return [];
    return h.links.map(id => {
      const s = G.SPOTS[id];
      const lv = G.State.d.player.level;
      return {
        id, spot: s,
        steps: s.steps || 0,
        visited: G.Explore.visited(id),
        /* 行くことは止めない。推奨より大きく低いときだけ警告する。 */
        warn: lv < (s.requiredLevel || 1) - 2,
      };
    });
  },

  /* ---------- 移動 ---------- */
  /* 出発する。戻り値は移動の状態。 */
  depart(toId) {
    const e = G.Explore.data();
    const h = G.Explore.here();
    if (!e || !h || !h.links.includes(toId)) return null;
    const s = G.SPOTS[toId];
    e.trip = { from: h.id, to: toId, total: s.steps || 1, step: 0 };
    return e.trip;
  },

  /* 1歩進める。
   * 戻り値:
   *   { done:true, at }                 到着した
   *   { encounter:[敵ID...], step, total } 魔物が出た
   *   { step, total }                   何も起きずに進んだ
   */
  step() {
    const e = G.Explore.data();
    const t = e && e.trip;
    if (!t) return null;

    t.step++;
    const s = G.SPOTS[t.to];

    if (t.step >= t.total) {
      /* 到着。ボスの間でも、着いただけでは戦わない（先に演出を挟む） */
      e.at = t.to;
      if (!e.visited.includes(t.to)) e.visited.push(t.to);
      e.trip = null;
      return { done: true, at: t.to };
    }

    /* 遭遇の判定。最初の1歩は必ず安全にして、出発直後の不意打ちを防ぐ。
     *
     * 連続／不発の数えは移動ごとではなく探索全体で持つ。
     * 移動ごとに戻すと、短い区間を行き来するあいだ仕掛けが働かず、
     * 30歩以上まったく出ない、ということが起きる（実測で確認）。 */
    if (typeof e.run !== 'number') e.run = 0;
    if (typeof e.dry !== 'number') e.dry = 0;

    let hit = false;
    if (t.step > 1) {
      if (e.run >= RUN_MAX) hit = false;
      else if (e.dry >= DRY_MAX) hit = true;
      else hit = G.util.chance(s.encounterRate || 0);
    }

    if (!hit) {
      e.run = 0;
      /* 数えるのは「判定した歩」だけ。
       * 出発直後の1歩や到着の歩は判定していないので数に入れない。
       * 入れてしまうと、短い区間を行き来するあいだ数えだけが増えて、
       * 仕掛けが働く前に上限へ達してしまう。 */
      if (t.step > 1) e.dry++;
      return { step: t.step, total: t.total };
    }

    e.run++; e.dry = 0;
    return { encounter: G.Explore.rollEnemies(t.to), step: t.step, total: t.total };
  },

  /* 出てくる魔物を決める。1〜3体。 */
  rollEnemies(spotId) {
    const pool = G.Explore.enemyPool(spotId);
    if (!pool.length) return [];
    const n = G.util.randInt(1, Math.min(3, pool.length + 1));
    const out = [];
    for (let i = 0; i < n; i++) out.push(G.util.choice(pool));
    return out;
  },

  /* 引き返す（移動を取りやめて、出発地点に戻る） */
  abort() {
    const e = G.Explore.data();
    if (!e || !e.trip) return false;
    e.at = e.trip.from;
    e.trip = null;
    return true;
  },

  /* ---------- ボス ---------- */
  bossOf(id) {
    const s = G.SPOTS[id];
    return (s && s.boss) || null;
  },

  /* ボスを倒したときの記録と報酬。画面側から呼ぶ。 */
  clearBoss(id) {
    const e = G.Explore.data();
    const s = G.SPOTS[id];
    if (!e || !s) return null;
    const first = !e.cleared.includes(id);
    if (first) e.cleared.push(id);
    const r = { first, gold: 0, exp: 0, items: [], levelReports: [] };
    if (first && s.reward) {
      if (s.reward.gold) { G.State.addGold(s.reward.gold); r.gold = s.reward.gold; }
      for (const it of (s.reward.items || [])) { G.State.addItem(it.id, it.n || 1); r.items.push(it); }
      if (s.reward.exp) { r.exp = s.reward.exp; r.levelReports = G.State.partyExp(s.reward.exp); }
    }
    return r;
  },

  /* ---------- 全滅したとき ---------- */
  /* 村まで戻される。持ち物と経験値は残る（罰を重くしすぎない）。 */
  retreat() {
    const e = G.Explore.data();
    if (!e) return;
    e.trip = null;
    e.at = G.SPOT_START;
  },

  /* ---------- 依頼との連動 ---------- */
  /* いま受けている依頼の目的地 */
  questTarget() {
    const d = G.State.data;
    return (d && d.quest && d.quest.target) || null;
  },

  /* 目的地に着いているか */
  atTarget() {
    const e = G.Explore.data();
    const t = G.Explore.questTarget();
    return !!(e && t && e.at === t);
  },

  /* 目的地までの道順（地図で光らせるため）。
   * 地点が数個なので、素直に幅優先で探す。 */
  routeTo(toId) {
    const e = G.Explore.data();
    if (!e || !G.SPOTS[toId]) return [];
    if (e.at === toId) return [toId];
    const seen = { [e.at]: null };
    const q = [e.at];
    while (q.length) {
      const cur = q.shift();
      for (const nx of (G.SPOTS[cur].links || [])) {
        if (nx in seen) continue;
        seen[nx] = cur;
        if (nx === toId) {
          const path = [nx];
          let p = cur;
          while (p) { path.unshift(p); p = seen[p]; }
          return path;
        }
        q.push(nx);
      }
    }
    return [];
  },
};

})();
