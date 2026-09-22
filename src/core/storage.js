/* ===== 保存の出入口 =====
 * ゲームの保存は、必ずここを通す。
 *
 * なぜ1か所にまとめるか：
 *   スマートフォンアプリにすると、ブラウザの保存領域（localStorage）は
 *   端末の空き容量が足りなくなったときに OS に消されることがある。
 *   「アプリを開いたらセーブが消えていた」は実際に起きる。
 *   そのため、アプリ版では OS が用意する保存領域に置き換える必要がある。
 *
 *   ここを通しておけば、置き換えるのはこのファイルの中だけで済む。
 *   ゲーム側のコードは1行も変えなくてよい。
 *
 * 使いかた（ブラウザでは待たずに値が返る）:
 *   G.Storage.get('key')           → 文字列 または null
 *   G.Storage.set('key', '値')     → true / false
 *   G.Storage.remove('key')
 *   G.Storage.keys()               → キーの一覧
 *
 * アプリ版で置き換えるときは、起動時に一度だけ
 *   G.Storage.use(別の入れ物)
 * を呼ぶ。入れ物は get/set/remove/keys を持っていればよい。
 * Capacitor の Preferences は「待つ」形（Promise）なので、
 * 先に readAll() で全部読み込んでから差し替える。
 */
(function () {
'use strict';

window.G = window.G || {};

/* ブラウザの保存領域。使えない場合（プライベートモード等）もあるので、
 * そのときは「この回だけ覚えておく入れ物」に落とす。 */
function browserStore() {
  let usable = true;
  try {
    const k = '__ta_probe';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
  } catch (e) { usable = false; }

  if (usable) {
    return {
      name: 'browser',
      get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
      set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
      remove(k) { try { localStorage.removeItem(k); return true; } catch (e) { return false; } },
      keys() { try { return Object.keys(localStorage); } catch (e) { return []; } },
    };
  }
  /* 保存できない環境。遊ぶことはできるが、閉じると消える。
   * 消えることは呼び出し側（セーブ処理）が伝える。 */
  const mem = {};
  return {
    name: 'memory',
    get(k) { return (k in mem) ? mem[k] : null; },
    set(k, v) { mem[k] = String(v); return false; },   // false = 残らない
    remove(k) { delete mem[k]; return true; },
    keys() { return Object.keys(mem); },
  };
}

let store = browserStore();

G.Storage = {
  /* いまどこに保存しているか。'browser' / 'memory' / 差し替え後の名前 */
  get kind() { return store.name; },

  /* 保存が本当に残るか。false なら「閉じると消える」状態 */
  get persistent() { return store.name !== 'memory'; },

  get(k) { return store.get(k); },
  set(k, v) { return store.set(k, String(v)); },
  remove(k) { return store.remove(k); },
  keys() { return store.keys(); },

  /* 保存先を差し替える（アプリ版で使う）。
   * 差し替え前の内容は引き継がないので、
   * 必要なら呼び出し側で移してから差し替えること。 */
  use(impl) {
    if (!impl || typeof impl.get !== 'function' || typeof impl.set !== 'function') return false;
    store = Object.assign({ name: 'custom', remove() {}, keys() { return []; } }, impl);
    return true;
  },
};

})();
