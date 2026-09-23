/* ===== 依頼の進行 =====
 * 依頼を「戦闘を始めるもの」から「冒険の目的を与えるもの」に変える。
 *
 *   受注 → 目的地が決まる → 歩いて向かう → 到達 →（ボスがいれば）撃破 → 達成
 *
 * 既存の G.QUESTS（23件）はそのまま使う。削除も作り直しもしていない。
 * 報酬の確定は今までどおり G.World.completeQuest() に任せる。
 *
 * ★ この層も画面を知らない。表示は呼び出し側が行う。
 */
(function () {
'use strict';

window.G = window.G || {};

/* 依頼の area（8種）を、探索の地点に割り当てる。
 * いまは5地点しか無いので、遠いエリアはいちばん奥に寄せている。
 * 地点を増やしたら、この表を足すだけでよい。 */
const AREA_SPOT = {
  plains: 'field_01',
  forest: 'forest_01',
  cave: 'cave_01',
  ruins: 'boss_01',
  highland: 'boss_01',
  frostpeak: 'boss_01',
  borderland: 'boss_01',
  demon_realm: 'boss_01',
};

G.Quest = {

  /* その依頼の目的地 */
  targetOf(q) {
    if (!q) return null;
    if (q.target && G.SPOTS[q.target]) return q.target;
    return AREA_SPOT[q.area] || 'field_01';
  },

  active() {
    const d = G.State.data;
    if (!d || !d.quest || !d.quest.active) return null;
    return G.QUESTS.find(q => q.id === d.quest.active) || null;
  },

  /* 受注する。戦闘は始めない。 */
  accept(q) {
    const d = G.State.d;
    if (!q) return { ok: false, msg: '依頼が見つかりません' };
    if (d.quest.active) return { ok: false, msg: 'すでに依頼を受けています' };
    if (!G.World.spendAp(q.ap || 1)) return { ok: false, msg: '行動力が足りません' };
    d.quest = { active: q.id, target: G.Quest.targetOf(q), reached: false };
    return { ok: true, target: d.quest.target };
  },

  /* 受注を取り消す。消費した行動力は戻さない。 */
  abandon() {
    const d = G.State.d;
    if (!d.quest.active) return false;
    d.quest = { active: null, target: null, reached: false };
    return true;
  },

  /* 目的地に着いたときに満たされるか。
   * ボスのいる地点なら、ボスを倒すまでは達成にしない。 */
  needsBoss() {
    const t = G.State.d.quest.target;
    return !!(t && G.Explore.bossOf(t));
  },

  /* 達成の判定と、報酬の確定。
   * 報酬は既存の G.World.completeQuest() をそのまま使う。 */
  complete() {
    const q = G.Quest.active();
    if (!q) return null;
    const r = G.World.completeQuest(q);
    G.State.d.quest = { active: null, target: null, reached: false };
    return r;
  },
};

})();
