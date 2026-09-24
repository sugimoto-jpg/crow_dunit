// クラウド保存（claude.ai アーティファクトの db）の E2E テスト
//   window.claude を偽物に差し替え、サーバー側のドキュメントはこのスクリプト内の Map に持つ。
//   毎回まっさらなブラウザ（保存領域が空）で開き直し、クラウドから続きが読めるかを確かめる。
//   前提: `npm run dev` で http://localhost:5173 が起動していること
//   実行: node e2e/cloud.e2e.mjs
import { createRequire } from 'module';
import { join } from 'path';
import { execSync } from 'child_process';

const require = createRequire(import.meta.url);
let pw;
try {
  pw = require('playwright');
} catch {
  pw = require(join(execSync('npm root -g').toString().trim(), 'playwright'));
}
const { chromium } = pw;
const URL_ = process.env.APP_URL ?? 'http://localhost:5173/';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
let failed = 0;

/** サーバー側のドキュメント（path → body） */
const server = new Map();
let serverDown = false;

async function freshPage({ uid = 'u1', noUser = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.exposeBinding('__cloud', (_src, op, path, body) => {
    if (serverDown && op !== 'list') throw new Error('unavailable');
    if (op === 'get') return server.get(path) ?? null;
    if (op === 'set') return void server.set(path, body);
    if (op === 'delete') return void server.delete(path);
    if (op === 'list') return [...server.entries()].filter(([k]) => k.startsWith(path + '/')).map(([k, v]) => [k.slice(path.length + 1), v]);
  });
  await ctx.addInitScript(
    ([uid, noUser]) => {
      const snap = (id, body) => ({ id, exists: body != null, data: () => body ?? undefined });
      const db = {
        collection: (path) => ({
          doc: (id) => ({
            get: async () => snap(id, await window.__cloud('get', `${path}/${id}`)),
            set: (b) => window.__cloud('set', `${path}/${id}`, b),
            delete: () => window.__cloud('delete', `${path}/${id}`),
          }),
          limit: () => ({ get: async () => ({ docs: (await window.__cloud('list', path)).map(([id, b]) => snap(id, b)) }) }),
        }),
      };
      const user = { id: async () => (noUser ? null : uid) };
      window.claude = { use: async (n) => (n === 'db' ? db : n === 'user' ? user : null) };
    },
    [uid, noUser],
  );
  const errors = [];
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(URL_);
  await p.waitForFunction(() => !document.body.innerText.includes('冒険の記録を読み込み中'), null, { timeout: 15000 });
  return { p, ctx, errors };
}
const text = (p) => p.evaluate(() => document.body.innerText);
const expectText = async (p, s, msg) => {
  if (!(await text(p)).includes(s)) throw new Error(`${msg ?? ''}「${s}」が見つかりません`);
};
async function test(name, fn) {
  try {
    await fn();
    results.push(['PASS', name]);
  } catch (e) {
    failed++;
    results.push(['FAIL', name, e.message.split('\n').slice(0, 3).join(' | ')]);
  }
}
async function startGame(p, name) {
  await p.locator('#onboarding-name').fill(name);
  await p.getByText('冒険をはじめる').click();
  await p.waitForTimeout(400);
}
async function finishLecture(p, n = 0) {
  await p.locator('button:has-text("虎の巻 其の")').nth(n).click();
  for (let i = 0; i < 4; i++) await p.getByRole('button', { name: /次へ|確認問題へ/ }).click();
  const btns = p.locator('div.fixed section button');
  for (let i = 0; i < 3; i++) {
    await btns.nth(i).click();
    if (await p.getByText('学園に戻る').count()) break;
  }
  await p.getByText('学園に戻る').click();
  await p.waitForTimeout(300);
}

await test('自動保存がクラウドに届き、空のブラウザで開き直しても続きから', async () => {
  const a = await freshPage();
  await startGame(a.p, 'くらうど');
  await finishLecture(a.p);
  await a.p.waitForTimeout(2000); // まとめて送る間隔を待つ
  if (![...server.keys()].some((k) => k === 'data/users/u1/aq:auto:current')) throw new Error('クラウドに保存されていない: ' + [...server.keys()].join(','));
  await a.ctx.close();
  const b = await freshPage();
  await expectText(b.p, 'くらうど', '名前が引き継がれるはず:');
  await expectText(b.p, '習得済み', '講義の進行が引き継がれるはず:');
  if (b.errors.length) throw new Error(b.errors.join(' / '));
  await b.ctx.close();
});

await test('画面を閉じる（非表示になる）と待たずに送る', async () => {
  const a = await freshPage({ uid: 'u2' });
  await startGame(a.p, 'すぐとじる');
  // アプリを切り替えた（画面が隠れた）状態にする。まとめて送る間隔（0.8秒）より短い時間で確認する
  await a.p.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await a.p.waitForTimeout(300);
  await a.ctx.close();
  const b = await freshPage({ uid: 'u2' });
  await expectText(b.p, 'すぐとじる');
  await b.ctx.close();
});

await test('冒険の書（手動セーブ）もクラウドに残る', async () => {
  const a = await freshPage({ uid: 'u3' });
  await startGame(a.p, 'しょもつ');
  await a.p.getByRole('button', { name: /冒険の書/ }).first().click();
  await a.p.getByText('冒険の書 1').click();
  await a.p.waitForTimeout(800);
  await expectText(a.p, '冒険の書1にセーブしました');
  await a.ctx.close();
  const b = await freshPage({ uid: 'u3' });
  await b.p.getByRole('button', { name: /冒険の書/ }).first().click();
  await b.p.waitForTimeout(500);
  await expectText(b.p, 'しょもつ', 'スロット1が見えるはず:');
  await b.ctx.close();
});

await test('別の利用者のデータは見えない', async () => {
  const b = await freshPage({ uid: 'someone-else' });
  await expectText(b.p, '冒険をはじめる');
  await b.ctx.close();
});

await test('通信できないときは端末に保存し、その旨を伝える', async () => {
  const a = await freshPage({ uid: 'u4' });
  await startGame(a.p, 'おふらいん');
  serverDown = true;
  await a.p.getByRole('button', { name: /冒険の書/ }).first().click();
  await a.p.getByText('冒険の書 1').click();
  await a.p.waitForTimeout(1500);
  await expectText(a.p, 'クラウドへは通信が戻り次第送ります');
  serverDown = false;
  await a.ctx.close();
});

await test('ログインしていない場合は端末保存のみで起動し、案内を出す', async () => {
  const a = await freshPage({ noUser: true });
  await expectText(a.p, 'ログインしていないため');
  await expectText(a.p, '冒険をはじめる');
  await a.ctx.close();
});

await browser.close();
console.table(results.map(([s, n, e]) => ({ 結果: s, テスト: n, 詳細: e ?? '' })));
console.log(failed ? `${failed} 件失敗` : 'すべて成功');
process.exit(failed ? 1 : 0);
