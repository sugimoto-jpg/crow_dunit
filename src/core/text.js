/* ===== 文言の取り出し =====
 * 画面に出す日本語を、コードの中に直接書かずに辞書から取り出す。
 *
 *   G.T('common.cancel')                     → 'やめる'
 *   G.T('title.newgame.overwrite')           → '既存のセーブデータは…'
 *   G.T.html('title.diff.stats', { hp: 100 })→ '敵のHP 100% ／ …'
 *
 * 2つある理由：
 *   G.T()      … そのままの文字。textContent に入れるとき（トースト・戦闘ログ）
 *   G.T.html() … 差し込む値を安全な形に直す。innerHTML に入れるとき
 * どちらも辞書の文そのものは同じ。差し込む値の扱いだけが違う。
 *
 * 辞書は src/data/strings.ja.js にある（G.STRINGS.ja）。
 * 英語を足すときは strings.en.js を作って G.STRINGS.en に入れ、
 * G.T.setLocale('en') を呼ぶ。訳が無いキーは日本語のまま出るので、
 * 翻訳が半分でも画面が空白になることはない。
 */
(function () {
'use strict';

window.G = window.G || {};

const BASE = 'ja';          // 訳が無いときに使う言語

/* 差し込む値を、HTMLとして解釈されない形に直す */
const esc = s => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* '{name} は Lv.{lv} に上がった' の {…} を置き換える */
function fill(tpl, params, escape) {
  if (!params) return tpl;
  return tpl.replace(/\{([A-Za-z0-9_]+)\}/g, (whole, k) => {
    if (!(k in params)) return whole;             // 渡し忘れは残して気づけるように
    const v = params[k];
    return escape ? esc(v) : String(v);
  });
}

const T = function (key, params) { return fill(T.lookup(key), params, false); };

T.BASE = BASE;
T.locale = BASE;
T.missing = [];             // 辞書に無かったキー（テストで拾う）

/* 差し込む値をエスケープする版。innerHTML に入れるときはこちら */
T.html = function (key, params) { return fill(T.lookup(key), params, true); };

/* 辞書から引く。見つからなければ日本語 → それも無ければキーをそのまま返す。
 * 画面が空白になるより、キーが見えたほうが原因が分かる。 */
T.lookup = function (key) {
  const all = window.G.STRINGS || {};
  const cur = all[T.locale];
  if (cur && typeof cur[key] === 'string') return cur[key];
  const base = all[BASE];
  if (base && typeof base[key] === 'string') {
    if (T.locale !== BASE) T._note('untranslated', key);
    return base[key];
  }
  T._note('missing', key);
  return key;
};

T._note = function (kind, key) {
  if (T.missing.some(m => m.key === key && m.kind === kind)) return;
  T.missing.push({ kind, key });
  if (window.G.Err && window.G.Err.dev) console.warn(`[G.T] ${kind}: ${key}`);
};

/* 言語を切り替える。辞書が無ければ切り替えない（日本語のまま） */
T.setLocale = function (code) {
  const all = window.G.STRINGS || {};
  if (!all[code]) return false;
  T.locale = code;
  return true;
};

T.locales = function () { return Object.keys(window.G.STRINGS || {}); };

/* キーが辞書にあるか（ツールとテストが使う） */
T.has = function (key) {
  const all = window.G.STRINGS || {};
  return !!(all[BASE] && typeof all[BASE][key] === 'string');
};

window.G.T = T;

})();
