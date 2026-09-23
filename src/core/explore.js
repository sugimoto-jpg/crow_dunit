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

  /* いま実際に出てくる魔物。主人公より格上は出さない。
   *
   * エリアの出現表は、そのエリアを歩く全レベル帯ぶんをまとめて持っている。
   * 草原（推奨 Lv1〜8）の表には荒野の狼（Lv6）も入っていて、
   * 村を出たばかりの Lv1 でも出てきていた。実測すると
   *
   *   Lv1 二人 vs 荒野の狼×1 … 勝率  2%
   *   Lv5 二人 vs 荒野の狼×1 … 勝率 60%
   *   Lv1 二人 vs ゴブリン×2 … 勝率 11%（ゴブリンは Lv4）
   *
   * 最初の草原で、何もできずに全滅する形になっていた。
   * 主人公のレベル以下の魔物だけを出すようにすると、
   * 狼は Lv6 から、ゴブリンは Lv4 から出るようになる。
   * どちらも、その相手と戦う依頼が出るレベルと一致する。
   *
   * 全部が格上のときは、いちばん弱い1種だけを残す。
   * 推奨レベルより下の地点へ踏み込んだときに、
   * 何も出てこなくなってしまわないようにするため。 */
  /* 何体も出るときは、その分だけ格下にする。
   *
   *   1体 … 主人公のレベルまで
   *   2体 … 2下まで
   *   3体 … 4下まで
   *
   * 数が増えると、こちらが1体倒すあいだに何発も殴られる。
   * 1体なら互角の相手でも、2体そろうと手も足も出なくなる。
   *   Lv6 二人 vs 荒野の狼×1 … 勝率 89%
   *   Lv6 二人 vs 荒野の狼×2 … 勝率  0%
   * 格上が群れで出ないようにすれば、この形は起きない。 */
  GROUP_SLACK: [0, 0, 2, 4],

  encounterPool(id, n, strict) {
    const raw = G.Explore.enemyPool(id);
    if (!raw.length) return [];
    const lv = (G.State.d && G.State.d.player && G.State.d.player.level) || 1;
    const slack = G.Explore.GROUP_SLACK[n || 1] || 0;
    const fit = raw.filter(e => G.ENEMIES[e] && G.ENEMIES[e].lv <= lv - slack);
    if (fit.length) return fit;
    /* 群れの数に見合う格下がいないときは、空で返す。
     * 呼び出し側が数を減らす。いちばん弱いので埋めると、
     * その1種だけが群れて出ることになってしまう。
     *   Lv13 三人 vs コボルト×3 … 勝率 18% */
    if (strict) return [];
    return [raw.slice().sort((a, b) =>
      ((G.ENEMIES[a] || {}).lv || 99) - ((G.ENEMIES[b] || {}).lv || 99))[0]];
  },

  /* 推奨レベルの範囲。エリアの設定をそのまま使う。 */
  /* その地点の推奨レベル。
   * 地点に lvRange があればそれを使う。
   * ボスの間は同じ洞窟エリアでも求められる強さが違うので、
   * エリアの値をそのまま出すと実態と合わない案内になってしまう。 */
  levelRange(id) {
    const s = G.SPOTS[id];
    if (!s) return null;
    if (s.lvRange) return s.lvRange.slice();
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

  /* 出てくる魔物を決める。1〜3体。
   *
   * 数は等確率にしない。
   * 3体同時が3回に1回出ると、道中の回復手段がない探索では
   * 「運が悪いと何もできずに全滅する」形になってしまう。
   * 大群はたまに出るくらいがちょうどよい。 */
  GROUP: [{ n: 1, w: 45 }, { n: 2, w: 40 }, { n: 3, w: 15 }],

  rollEnemies(spotId) {
    const pool = G.Explore.encounterPool(spotId);
    if (!pool.length) return [];
    /* 仲間の人数より多い群れは出さない。
     *
     * 序盤は主人公とリィナの二人しかいない。
     * この二人でゴブリン3体に当たると、実測で勝率 11% だった。
     * 同じ相手でも2体なら問題なく勝てる（Lv4の依頼がその形）。
     * 数の差がそのまま手数の差になるので、人数を超えた群れは
     * 「運が悪いと何もできずに負ける」形になってしまう。
     * ヴェルト（Lv8）ノア（Lv14）が加わるほど大群も出るようになる。 */
    const party = Math.max(1, (G.State.d.party || []).length);
    const max = Math.min(3, pool.length + 1, party);
    const n = Math.min(max, G.util.weighted(G.Explore.GROUP).n);
    /* 数が決まってから、その数に見合った表を引き直す。
     * 見合う相手がいなければ、数のほうを減らす。 */
    let k = n, sized = [];
    while (k > 1) {
      sized = G.Explore.encounterPool(spotId, k, true);
      if (sized.length) break;
      k--;
    }
    if (k <= 1) { k = 1; sized = G.Explore.encounterPool(spotId, 1); }
    const out = [];
    for (let i = 0; i < k; i++) out.push(G.util.choice(sized));
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

  /* ---------- 野営 ---------- */
  /* 中間地点では、いつでも無料で休める。
   *
   * なぜ無料か：
   *   道中に回復手段がないと、運の悪い遭遇が続いただけでボスの前に力尽き、
   *   村からやり直しになってしまう。
   *   消耗しながら進む手応えは「1区間のあいだ」で十分に出るので、
   *   区間のつなぎ目では立て直せるようにする。
   *
   * 村（拠点で休める）とボスの間（ここは正念場）では野営できない。
   * 移動の途中でも野営できない。 */
  canCamp(id) {
    const e = G.Explore.data();
    if (!e || e.trip) return false;                 // 歩いている最中は休めない
    const s = G.SPOTS[id || (e && e.at)];
    return !!(s && s.camp);
  },

  /* 休む。戻り値は回復した人数（0なら休めなかった）。 */
  camp() {
    const e = G.Explore.data();
    if (!e || !G.Explore.canCamp()) return 0;
    let n = 0;
    for (const c of G.State.d.party) {
      if (c.hp >= G.Char.maxHp(c) && c.mp >= G.Char.maxMp(c)) continue;
      G.Char.fullRestore(c);
      n++;
    }
    return n;
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
