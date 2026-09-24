/* ===== セーブが残るかを確かめる =====
 *
 *   node tools/save-test.js
 *
 * 配信ページ（claude.ai のアーティファクト）では、ブラウザの保存領域が
 * 長く残らない。Safari はこの形の保存を数日で消すため、
 * 「セーブしたのに次に開いたら消えていた」が実際に起きた。
 *
 * 配信ページ側の保存領域は本物を用意できないので、偽物に差し替えて
 * 「どこへ書こうとしたか」「次に開いたとき読めるか」を見る。
 * 偽物の中身はテストの側で持つので、ページを開き直しても残る。
 * これが本物の配信ページで起きてほしいことと同じ形になる。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((q, r) => {
      const f = path.join(ROOT, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      r.end(fs.readFileSync(f));
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

const ok = [], ng = [];
const check = (cond, label, extra) => {
  (cond ? ok : ng).push(label);
  console.log(`  ${cond ? '✅' : '❌'} ${label}${!cond && extra ? `  ← ${extra}` : ''}`);
};

/* 配信ページの偽物。
 *   mode 'ok'     … 保存できる
 *   mode 'nouser' … 置き場所が決まらない（自分の番号が取れない）
 *   mode 'nodb'   … 保存領域が使えない
 * doc は「向こうに置いてある中身」。テスト側で持ち回るので、
 * ページを開き直しても残る＝本物の配信ページと同じ形になる。 */
const fakeClaude = (mode, doc) => `
  window.__written = 0;
  window.__docs = ${JSON.stringify(doc)};
  const db = {
    doc(p) {
      window.__lastPath = p;
      return {
        async get() {
          const d = window.__docs[p];
          return { exists: !!d, data: () => d };
        },
        async set(body) {
          window.__docs[p] = JSON.parse(JSON.stringify(body));
          window.__written++;
        },
      };
    },
  };
  const user = { async id() { return ${mode === 'nouser' ? 'null' : "'u_test'"}; } };
  window.claude = {
    async use(name) {
      if (name === 'db') return ${mode === 'nodb' ? 'null' : 'db'};
      if (name === 'user') return user;
      return null;
    },
  };
`;

(async () => {
  const { srv, port } = await serve();
  const url = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch({
    executablePath: ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
      '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => fs.existsSync(p)),
    headless: true, args: ['--no-sandbox'],
  });

  /* 1ページ開いて、渡された処理をする。偽物の中身を返す。 */
  async function visit(init, fn) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    if (init) await page.addInitScript(init);
    await page.goto(url);
    await page.waitForFunction(() => window.G && G.State && G.Storage, null, { timeout: 15000 });
    await page.waitForTimeout(400);
    const out = await fn(page);
    /* 書き込みはまとめて送るので、送り終わるのを待ってから中身を見る */
    await page.evaluate(() => { if (G.CloudSave && G.CloudSave.flush) G.CloudSave.flush(); });
    await page.waitForTimeout(300);
    const docs = await page.evaluate(() => window.__docs || null);
    const written = await page.evaluate(() => window.__written || 0);
    await ctx.close();
    return { out, docs, written, errs };
  }

  const makeSave = `(async () => {
    G.State.newGame('セーブ試験', 'normal', { sex: 'm' });
    G.State.d.gold = 12345;
    G.State.save();
    return { kind: G.Storage.kind, cloud: !!(G.CloudSave && G.CloudSave.active) };
  })()`;

  console.log('\n▼ 1. ふつうにブラウザで開いたとき（配信ページではない）\n');
  {
    const r = await visit(null, p => p.evaluate(makeSave));
    check(r.out.kind === 'browser', `保存先はブラウザ（${r.out.kind}）`);
    check(r.out.cloud === false, '配信ページの保存は使わない');
    check(r.errs.length === 0, 'JSエラーなし', r.errs.join(' / '));
  }

  console.log('\n▼ 2. 配信ページで開いたとき\n');
  let docs = {};
  {
    const r = await visit(fakeClaude('ok', {}), p => p.evaluate(makeSave));
    check(r.out.kind === 'cloud', `保存先が置き換わる（${r.out.kind}）`);
    check(r.out.cloud === true, 'G.CloudSave.active が true');
    check(r.errs.length === 0, 'JSエラーなし', r.errs.join(' / '));
    docs = r.docs;
    const key = Object.keys(docs)[0] || '';
    check(/^data\/users\/u_test\//.test(key), `自分専用の場所に置く（${key}）`);
    const body = docs[key] || {};
    check(typeof body.tensei_arcana_save_v1 === 'string', 'セーブが向こうに届いている');
    check(/12345/.test(body.tensei_arcana_save_v1 || ''), '中身が入っている（所持金 12345）');
  }

  console.log('\n▼ 3. 開き直しても続きが残っている（これが直したかったこと）\n');
  {
    /* ブラウザ側の保存領域は毎回まっさらにする。
     * Safari が消してしまった状態を、そのまま再現している。 */
    const r = await visit(fakeClaude('ok', docs), p => p.evaluate(() => ({
      kind: G.Storage.kind,
      hasSave: G.State.hasSave(),
      gold: G.State.load() ? G.State.d.gold : null,
      title: !!document.querySelector('#screen [data-act="continue"], #screen [data-act="resume"]'),
    })));
    check(r.out.kind === 'cloud', '保存先は置き換わったまま');
    check(r.out.hasSave === true, 'セーブがあると判定される');
    check(r.out.gold === 12345, `中身も同じ（所持金 ${r.out.gold}）`);
    check(r.errs.length === 0, 'JSエラーなし', r.errs.join(' / '));
  }

  console.log('\n▼ 4. ブラウザ側に残っていた記録を引き継ぐ\n');
  {
    /* 置き換わる前に遊んでいた人のデータを失わないため */
    const init = `
      ${fakeClaude('ok', {})}
      try { localStorage.setItem('tensei_arcana_save_v1', JSON.stringify({ gold: 777, party: [] })); } catch (e) {}
    `;
    const r = await visit(init, p => p.evaluate(() => ({ kind: G.Storage.kind, raw: G.Storage.get('tensei_arcana_save_v1') })));
    check(r.out.kind === 'cloud', '保存先が置き換わる');
    check(/777/.test(r.out.raw || ''), '前のセーブがそのまま読める');
    const body = r.docs[Object.keys(r.docs)[0]] || {};
    check(/777/.test(body.tensei_arcana_save_v1 || ''), '前のセーブが向こうにも送られる');
  }

  console.log('\n▼ 5. 配信ページの保存が使えない場合でも遊べる\n');
  for (const [mode, why] of [['nodb', '保存領域が使えない'], ['nouser', '置き場所が決まらない']]) {
    const r = await visit(fakeClaude(mode, {}), p => p.evaluate(makeSave));
    check(r.out.kind === 'browser', `${why} → ブラウザ側のまま（${r.out.kind}）`);
    check(r.errs.length === 0, `${why} → JSエラーなし`, r.errs.join(' / '));
  }

  console.log('\n▼ 6. 書き込みをまとめている\n');
  {
    const r = await visit(fakeClaude('ok', {}), async p => {
      await p.evaluate(() => {
        G.State.newGame('連打', 'normal', { sex: 'm' });
        for (let i = 0; i < 20; i++) { G.State.d.gold = i; G.State.save(); }
      });
      await p.waitForTimeout(1400);
      return null;
    });
    check(r.written > 0 && r.written <= 3,
      `20回の保存が ${r.written} 回の送信にまとまる`, String(r.written));
  }

  await browser.close();
  srv.close();

  console.log(`\n▼ 判定：${ok.length} 件成功 / ${ng.length} 件失敗`);
  if (ng.length) { console.log('\n  ❌ ' + ng.join('\n  ❌ ')); process.exit(1); }
  console.log('  ✅ 配信ページでもセーブが残る\n');
})().catch(e => { console.error('テストに失敗:', e); process.exit(1); });
