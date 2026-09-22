/* ===== 共通ユーティリティ ===== */
window.G = window.G || {};

G.util = {
  rand(min, max) { return Math.random() * (max - min) + min; },
  randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },
  chance(p) { return Math.random() < p; },
  choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
  // 重み付き抽選 [{w:3, ...}, ...]
  weighted(arr) {
    const total = arr.reduce((s, o) => s + (o.w || 1), 0);
    let r = Math.random() * total;
    for (const o of arr) { r -= (o.w || 1); if (r <= 0) return o; }
    return arr[arr.length - 1];
  },
  // 3桁区切り
  g(n) { return Math.floor(n).toLocaleString('ja-JP'); },
  // HTMLエスケープ（プレイヤー名などを埋め込むため）
  esc(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  // 配列を均等に n 個取り出す
  pick(arr, n) { return G.util.shuffle(arr).slice(0, n); },
};

/* 属性の表示名と色 */
G.ELEMENTS = {
  none:  { name: '無',  color: '#a79ecb', icon: '✴️' },
  fire:  { name: '火',  color: '#ff7a4d', icon: '🔥' },
  water: { name: '水',  color: '#5fa8ff', icon: '💧' },
  wind:  { name: '風',  color: '#7de8b0', icon: '🌪️' },
  earth: { name: '土',  color: '#c9a36a', icon: '🪨' },
  light: { name: '光',  color: '#ffe27a', icon: '✨' },
  dark:  { name: '闇',  color: '#b07aff', icon: '🌑' },
};

/* 状態異常の定義 */
G.STATUS = {
  poison:   { name: '毒',   icon: '🟢', dotRate: 0.07, desc: '毎ターン最大HPの7%のダメージ' },
  burn:     { name: '火傷', icon: '🔥', dotRate: 0.10, desc: '毎ターン最大HPの10%のダメージ' },
  sleep:    { name: '睡眠', icon: '💤', skip: true,    wakeOnHit: true, desc: '行動不能。攻撃を受けると解除' },
  paralyze: { name: '麻痺', icon: '⚡', skipRate: 0.5, desc: '50%の確率で行動できない' },
  silence:  { name: '沈黙', icon: '🔇', noSkill: true, desc: '魔法・スキルが使えない' },
  blind:    { name: '暗闇', icon: '🌫️', missRate: 0.45, desc: '物理攻撃が外れやすくなる' },
};

/* ステータス表示ラベル */
G.STAT_LABEL = {
  hp: 'HP', mp: 'MP', atk: '腕力', def: '守備', mag: '魔力', res: '魔防', spd: '敏捷'
};
