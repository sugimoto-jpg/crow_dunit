/* ===== 配信ページでの保存 =====
 * claude.ai で配信しているページ（アーティファクト）専用の保存先。
 * ふつうにファイルを開いたときや、アプリ版では何もしない。
 *
 * なぜ必要か：
 *   配信ページは claude.ai の中に「別サイトの枠」として置かれている。
 *   Safari はこの形の保存領域を数日で消す（他サイト追跡を防ぐ仕組み）。
 *   そのため「セーブしたのに、次に開いたら消えていた」が起きる。
 *   実際に報告されたのもこの形。
 *
 *   配信ページ側には、消えない保存領域が用意されている。
 *   そちらに置き換えれば、端末を変えても同じ続きから遊べる。
 *
 * やりかたは src/native.js（アプリ版）と同じ。
 *   起動時に一度だけ全部読み込んで手元に持ち、以降は手元から返す。
 *   書くときは手元と向こうの両方に書く。
 *   G.Storage が「待たない」形なので、この段取りが要る。
 *
 * 読み込みが終わるまで、ゲームを始めてはいけない。
 * 先に始めると「セーブが無い」と判断され、タイトルに
 * 「つづきから」が出ない。main.js が G.CloudSave.ready を待つ。
 */
(function () {
'use strict';

window.G = window.G || {};

/* 1つの文書にまとめて入れる。
 * 文書1つあたり 256KB まで。セーブは数十KBなので収まる。 */
const DOC = 'save';
const LIMIT = 200 * 1024;

G.CloudSave = {
  /* 置き換えに成功したか。起動後に確かめる用。 */
  active: false,
  /* 置き換えなかった理由（配信ページでないときは 'not_artifact'） */
  reason: 'not_artifact',
  /* 置き換えが終わるまでの待ち合わせ。必ず解決する（失敗しても false） */
  ready: Promise.resolve(false),
};

const claude = (typeof window !== 'undefined') ? window.claude : null;
if (!claude || typeof claude.use !== 'function') return;   // 配信ページではない

G.CloudSave.ready = (async function () {
  let db, user;
  try {
    /* どちらも、使えないときは null が返る（例外にはならない）。
     * 使えない理由は分からない作りになっている。 */
    [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
  } catch (e) {
    G.CloudSave.reason = 'no_capability';
    return false;
  }
  if (!db || !user) { G.CloudSave.reason = 'no_capability'; return false; }

  /* 自分専用の置き場所を指す番号。これが無いと置き場所が決まらない。 */
  let uid = null;
  try { uid = await user.id(); } catch (e) { uid = null; }
  if (!uid) { G.CloudSave.reason = 'no_user'; return false; }

  const ref = db.doc('data/users/' + uid + '/' + DOC);

  /* ---------- 1. 向こうにあるものを読み込む ---------- */
  const cache = {};
  try {
    const snap = await ref.get();
    if (snap.exists) {
      const body = snap.data() || {};
      for (const k of Object.keys(body)) {
        if (typeof body[k] === 'string') cache[k] = body[k];
      }
    }
  } catch (e) {
    G.CloudSave.reason = 'read_failed';
    return false;
  }

  /* ---------- 2. ブラウザ側に残っていれば引き継ぐ ----------
   * 置き換える前に遊んでいた記録を失わないため。
   * 向こうに同じ鍵があれば、向こうを優先する（そちらが新しい）。 */
  let carried = 0;
  try {
    for (const k of G.Storage.keys()) {
      if (k in cache) continue;
      const v = G.Storage.get(k);
      if (v != null) { cache[k] = String(v); carried++; }
    }
  } catch (e) { /* 読めなくても続行 */ }

  /* ---------- 3. 書き込みをまとめる ----------
   * ゲームは場面が変わるたびに保存を呼ぶ（46か所ある）。
   * そのたびに送ると、書き込みが重なって遅くなる。
   * 少し待ってから、1回にまとめて送る。 */
  let timer = null;
  let dirty = false;
  let writing = false;

  function send() {
    if (writing || !dirty) return;
    const body = Object.assign({}, cache);
    const size = JSON.stringify(body).length;
    if (size > LIMIT) {
      /* 収まらない。ブラウザ側には書けているので、遊ぶことはできる。 */
      G.CloudSave.reason = 'too_big';
      dirty = false;
      return;
    }
    dirty = false;
    writing = true;
    ref.set(body)
      .catch(() => { dirty = true; })      /* 失敗したら次の機会に送り直す */
      .then(() => { writing = false; if (dirty) send(); });
  }

  function schedule() {
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(send, 700);
  }

  /* 画面を閉じるときは、待たずにすぐ送る。
   * 間に合わない場合もあるが、送らないよりよい。 */
  G.CloudSave.flush = function () { clearTimeout(timer); send(); };
  window.addEventListener('pagehide', G.CloudSave.flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') G.CloudSave.flush();
  });

  G.Storage.use({
    name: 'cloud',
    get(k) { return (k in cache) ? cache[k] : null; },
    set(k, v) { cache[k] = String(v); schedule(); return true; },
    remove(k) { delete cache[k]; schedule(); return true; },
    keys() { return Object.keys(cache); },
  });

  /* 引き継いだものがあれば、すぐ向こうへ送る */
  if (carried) schedule();

  G.CloudSave.active = true;
  G.CloudSave.reason = '';
  return true;
})().catch(() => {
  G.CloudSave.reason = 'failed';
  return false;
});

})();
