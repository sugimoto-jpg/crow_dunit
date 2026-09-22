/* ===== エラーの捕捉と復帰 =====
 * 例外が起きたとき、これまでは何も表示されずゲームが固まっていた。
 * 特に戦闘の演出は非同期で動いているため、途中で例外が出ると
 * コマンドが出ないまま操作不能になる。
 *
 * ここでは次の3つを行う。
 *   1. 起きたエラーを記録する（開発時に原因を追えるように）
 *   2. 遊んでいる人には、技術的な内容を見せずに復帰の手段を示す
 *   3. 同じエラーで何度もモーダルが出ないように抑制する
 *
 * このファイルは他のどのファイルよりも先に読み込む。
 * 読み込み中に起きたエラーも拾うため。
 *
 * 置き場所について：
 *   画面に出す都合で G.UI を使うため core/ には置かない。
 *   core/ は「画面を知らない層」として保っておきたいので、
 *   アプリ全体にかかる仕組みとして main.js と同じ src/ 直下に置く。
 */
(function () {
'use strict';

window.G = window.G || {};

/* 開発モードの判定。
 *
 * 「localhost なら開発中」という判定にしてはいけない。
 * ・ダウンロード版は file:// で開かれる（遊ぶ人の環境）
 * ・スマホアプリ化（Capacitor）すると、アプリ内は localhost として動く
 * どちらも遊ぶ人の環境なのに、開発中と誤判定してしまう。
 *
 * そこで「置かれた場所」ではなく「開発者が自分で入れたかどうか」で決める。
 *   ?debug=1 を付けて開く                    … その回だけ
 *   localStorage の 'ta_debug' を '1' にする … 次からずっと
 * 誤って本番で有効になることがない。 */
const isDev = (function () {
  try {
    if (/[?&]debug=1(&|$)/.test(location.search)) {
      try { localStorage.setItem('ta_debug', '1'); } catch (e) { /* 使えなくてもよい */ }
      return true;
    }
  } catch (e) { /* location が無い環境（テスト用の実行など） */ }
  try { return localStorage.getItem('ta_debug') === '1'; } catch (e) { return false; }
})();

/* エラー文をそのまま innerHTML に入れると、中の < > がタグとして働いてしまう。
 * G.util.esc と同じ処理だが、util.js より先に読み込まれるファイルなので
 * ここでは何にも頼らず自前で持つ。 */
const escHtml = s => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

G.Err = {
  dev: isDev,
  log: [],            // 直近のエラー（新しいものが先頭）
  MAX: 30,
  installed: false,

  /* モーダルの多重表示・連続表示を防ぐ */
  _showing: false,
  _lastShownAt: 0,
  QUIET_MS: 8000,     // 一度表示したら、この時間は出さない

  /* ---------- 記録 ---------- */
  capture(kind, message, detail) {
    const entry = {
      at: new Date().toISOString(),
      kind,                                  // 'error' | 'promise' | 'game'
      message: String(message || '(内容不明)'),
      detail: detail ? String(detail) : '',
      screen: (G.UI && G.UI.current) || '(未起動)',
      day: (G.State && G.State.data) ? G.State.data.day : null,
    };
    G.Err.log.unshift(entry);
    if (G.Err.log.length > G.Err.MAX) G.Err.log.length = G.Err.MAX;

    // 開発時はコンソールにも出す（本番では出さない）
    if (G.Err.dev) console.error('[G.Err]', entry.kind, entry.message, entry.detail);
    return entry;
  },

  /* 同じ内容が短時間に繰り返されていないか */
  _isRepeat(entry) {
    const prev = G.Err.log[1];
    return prev && prev.message === entry.message && prev.kind === entry.kind;
  },

  /* ---------- 表示 ---------- */
  /* 遊んでいる人には原因を見せない。見せても対処できないため。
   * 代わりに「やり直す手段」を示す。 */
  report(kind, message, detail) {
    let entry;
    try {
      entry = G.Err.capture(kind, message, detail);
    } catch (e) {
      return;                                // 記録自体が失敗しても巻き込まれない
    }
    const now = Date.now();
    if (G.Err._showing) return;
    if (G.Err._isRepeat(entry) && now - G.Err._lastShownAt < G.Err.QUIET_MS) return;
    if (now - G.Err._lastShownAt < 1500) return;

    G.Err._showing = true;
    G.Err._lastShownAt = now;
    try {
      G.Err._present(entry);
    } catch (e) {
      G.Err._showing = false;
      G.Err._fallback(entry);                // モーダル自体が壊れている場合
    }
  },

  _present(entry) {
    const body = `
      <p>申し訳ありません。ゲームの処理中に問題が発生しました。</p>
      <p class="dim">タイトルに戻ると、最後に保存された時点から再開できます。</p>
      ${G.Err.dev ? `
        <div class="divider"></div>
        <p class="dim" style="margin-bottom:4px">開発者向けの情報</p>
        <pre style="white-space:pre-wrap;word-break:break-all;font-size:11px;
                    background:rgba(0,0,0,.3);padding:8px;border-radius:8px;
                    max-height:180px;overflow:auto">${
          escHtml(entry.kind + ': ' + entry.message + (entry.detail ? '\n' + entry.detail : ''))
        }</pre>` : ''}`;

    // G.UI が使えるならモーダルで、駄目なら素のDOMで出す
    if (G.UI && typeof G.UI.modal === 'function' && document.getElementById('modal')) {
      G.UI.modal({
        title: '⚠️ 問題が発生しました',
        body,
        actions: [
          { label: 'タイトルに戻る', cls: 'primary', value: 'reload' },
          { label: 'このまま続ける', cls: 'ghost', value: 'stay' },
        ],
      }).then(v => {
        G.Err._showing = false;
        if (v === 'reload') G.Err.restart();
      });
    } else {
      G.Err._showing = false;
      G.Err._fallback(entry);
    }
  },

  /* G.UI がまだ無い／壊れているときの最終手段 */
  _fallback(entry) {
    try {
      if (document.getElementById('err-fallback')) return;
      const d = document.createElement('div');
      d.id = 'err-fallback';
      d.setAttribute('style', [
        'position:fixed', 'inset:0', 'z-index:9999',
        'background:#15101f', 'color:#ece7ff', 'padding:24px',
        'font:15px/1.8 system-ui,sans-serif', 'overflow:auto',
      ].join(';'));
      d.innerHTML = `
        <h2 style="color:#f2c14e;margin:0 0 12px">⚠️ 問題が発生しました</h2>
        <p>申し訳ありません。ゲームを読み込めませんでした。</p>
        <p style="opacity:.75">下のボタンで読み込み直すと、
           最後に保存された時点から再開できます。</p>
        <button id="err-reload" style="margin-top:16px;padding:12px 20px;font-size:15px;
          border-radius:10px;border:1px solid #9a6bff;background:#5b3aa8;color:#fff;
          font-weight:700;cursor:pointer">もう一度読み込む</button>
        ${G.Err.dev ? `<pre style="margin-top:20px;white-space:pre-wrap;word-break:break-all;
          font-size:11px;opacity:.8">${escHtml(entry.kind + ': ' + entry.message
            + (entry.detail ? '\n' + entry.detail : ''))}</pre>` : ''}`;
      document.body.appendChild(d);
      const b = document.getElementById('err-reload');
      if (b) b.addEventListener('click', () => G.Err.restart());
    } catch (e) { /* ここで失敗したら打つ手なし */ }
  },

  /* 読み直して最初からやり直す。セーブは残っているので続きから再開できる。 */
  restart() {
    try { location.reload(); } catch (e) { /* 何もできない */ }
  },

  /* ---------- 任意の処理を守る ---------- */
  /* 戦闘の演出など、失敗しても致命傷にしたくない処理を包む。
   * 例外が出たら記録・表示したうえで fallback を返す。 */
  guard(label, fn, fallback) {
    try {
      const r = fn();
      // 非同期なら、その失敗も拾う
      if (r && typeof r.then === 'function') {
        return r.catch(e => {
          G.Err.report('game', `${label}: ${e && e.message}`, e && e.stack);
          return fallback;
        });
      }
      return r;
    } catch (e) {
      G.Err.report('game', `${label}: ${e && e.message}`, e && e.stack);
      return fallback;
    }
  },

  /* ---------- 設置 ---------- */
  install() {
    if (G.Err.installed) return;
    G.Err.installed = true;

    window.addEventListener('error', ev => {
      // 画像や外部ファイルの読み込み失敗は対象外（本作では外部ファイルを使わない）
      if (ev && ev.message) {
        const where = ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : '';
        G.Err.report('error', ev.message,
          (ev.error && ev.error.stack) || where);
      }
    });

    window.addEventListener('unhandledrejection', ev => {
      const r = ev && ev.reason;
      G.Err.report('promise',
        (r && r.message) || String(r),
        (r && r.stack) || '');
    });
  },

  /* 記録の書き出し（不具合の報告用。開発時のみ使う想定） */
  dump() {
    return G.Err.log.map(e =>
      `[${e.at}] ${e.kind} @${e.screen} ${e.day ? 'day' + e.day : ''}\n  ${e.message}`
      + (e.detail ? `\n  ${e.detail.split('\n').slice(0, 3).join('\n  ')}` : '')
    ).join('\n\n');
  },
};

G.Err.install();

})();
