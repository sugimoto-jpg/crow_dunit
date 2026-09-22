/* ===== スマートフォンアプリとして動くときの調整 =====
 * ブラウザで開いたときは、このファイルは何もしない。
 * Capacitor で包んでアプリにしたときだけ働く。
 *
 * やること:
 *   1. 保存先を端末の正式な領域に移す
 *      （アプリ内のブラウザ領域は、空き容量が減るとOSに消されることがある）
 *   2. Androidの戻るボタンを、ゲームの「戻る」につなぐ
 *   3. 起動画面を消す・状態バーの色を合わせる
 *   4. 攻撃が当たったときなどに短く振動させる
 *
 * どれも「使えなければ黙って何もしない」形にしてある。
 * 音や振動が使えないせいでゲームが遊べなくなるのは本末転倒なため。
 */
(function () {
'use strict';

window.G = window.G || {};

const cap = window.Capacitor;
const isNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());

G.Native = {
  active: isNative,
  platform: (cap && cap.getPlatform && cap.getPlatform()) || 'web',
  ready: Promise.resolve(false),

  /* 短く振動させる。ブラウザでは何も起きない。 */
  tap(kind) {
    if (!isNative) return;
    const H = cap.Plugins && cap.Plugins.Haptics;
    if (!H) return;
    try {
      if (kind === 'heavy') H.impact({ style: 'HEAVY' });
      else if (kind === 'light') H.impact({ style: 'LIGHT' });
      else H.impact({ style: 'MEDIUM' });
    } catch (e) { /* 使えなければ何もしない */ }
  },
};

if (!isNative) return;              // ブラウザではここで終わり

const P = cap.Plugins || {};

G.Native.ready = (async function () {
  /* ---------- 1. 保存先を端末の正式な領域に移す ---------- */
  if (P.Preferences) {
    try {
      /* Preferences は「待つ」形なので、そのままでは同期的に読めない。
       * 起動時に一度すべて読み込んで手元に持ち、
       * 以降は手元から返す。書くときは手元と端末の両方に書く。 */
      const { keys } = await P.Preferences.keys();
      const cache = {};
      for (const k of keys) {
        const { value } = await P.Preferences.get({ key: k });
        if (value != null) cache[k] = value;
      }

      /* ブラウザ領域に前のデータが残っていれば、一度だけ引き継ぐ。
       * （アプリ化する前に遊んでいた人のデータを失わないため） */
      try {
        for (const k of Object.keys(localStorage)) {
          if (!(k in cache)) {
            const v = localStorage.getItem(k);
            if (v != null) { cache[k] = v; await P.Preferences.set({ key: k, value: v }); }
          }
        }
      } catch (e) { /* 読めなくても続行 */ }

      G.Storage.use({
        name: 'native',
        get(k) { return (k in cache) ? cache[k] : null; },
        set(k, v) {
          cache[k] = String(v);
          P.Preferences.set({ key: k, value: String(v) }).catch(() => {});
          return true;
        },
        remove(k) {
          delete cache[k];
          P.Preferences.remove({ key: k }).catch(() => {});
          return true;
        },
        keys() { return Object.keys(cache); },
      });
    } catch (e) {
      /* 移せなくてもブラウザ領域のまま遊べる */
    }
  }

  /* ---------- 2. Androidの戻るボタン ---------- */
  if (P.App) {
    try {
      P.App.addListener('backButton', () => {
        // ゲーム側で処理できたら、そのまま。できなければアプリを閉じる。
        const handled = G.Err ? G.Err.guard('戻る操作', () => G.UI.handleBack(), false)
          : G.UI.handleBack();
        if (!handled) {
          if (G.State.data) G.State.save();
          P.App.exitApp();
        }
      });
      /* 他のアプリに切り替わったときに保存する */
      P.App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive && G.State.data) G.State.save();
      });
    } catch (e) { /* 使えなければ何もしない */ }
  }

  /* ---------- 3. 見た目を整える ---------- */
  if (P.StatusBar) {
    try {
      P.StatusBar.setStyle({ style: 'DARK' });
      if (G.Native.platform === 'android') {
        P.StatusBar.setBackgroundColor({ color: '#120d1c' });
      }
    } catch (e) { /* 使えなければ何もしない */ }
  }
  if (P.SplashScreen) {
    /* 起動画面は「最初の絵が出てから」消す。
     * 時間で消すと、遅い端末では一瞬まっさらな画面が見えてしまう。 */
    try {
      if (document.readyState !== 'complete') {
        await new Promise(r => window.addEventListener('load', r, { once: true }));
      }
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await P.SplashScreen.hide();
    } catch (e) { /* 使えなければ何もしない */ }
  }

  return true;
})();

})();
