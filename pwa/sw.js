/* ===== オフラインで遊べるようにする =====
 * 一度開いたら、次からは通信なしで起動できるようにする。
 * このゲームは元から通信を行わないので、
 * 必要なファイルを最初に取り込んでしまえば完全にオフラインで動く。
 *
 * 更新の考え方：
 *   ・起動時はキャッシュから出す（速い・オフラインでも動く）
 *   ・裏で新しいものを取りに行き、次回の起動から新しくなる
 *   ・古いキャッシュは、新しい版が有効になった時点で消す
 */
const VERSION = 'ta-v2';

/* 取り込むファイル。
 * 公開する dist/pwa/ に実在するものだけを書く。
 * （CSSとJSは index.html に埋め込まれているので、別ファイルは無い）
 * ここに存在しないファイルを書くと、取り込み全体が失敗して
 * 「オフラインでは何も出ない」状態になる。 */
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
];

self.addEventListener('install', ev => {
  // 新しい版をすぐ使えるようにする
  self.skipWaiting();
  ev.waitUntil((async () => {
    const c = await caches.open(VERSION);
    /* 1つずつ入れる。まとめて入れると、1件でも失敗したとき
     * すべてが入らなくなるため。 */
    for (const f of FILES) {
      try { await c.add(new Request(f, { cache: 'reload' })); } catch (e) { /* 個別に見送る */ }
    }
  })());
});

self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  // 別のサイトへの通信は扱わない（このゲームは行わないが、念のため）
  if (new URL(req.url).origin !== self.location.origin) return;

  ev.respondWith((async () => {
    const cached = await caches.match(req);
    const network = fetch(req).then(res => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => null);

    // キャッシュがあればそれを返し、裏で新しいものを取りに行く
    return cached || (await network) || new Response('オフラインです', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  })());
});
