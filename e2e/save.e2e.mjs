// セーブシステムの E2E テスト（Playwright / Chromium）
//   前提: `npm run dev` で http://localhost:5173 が起動していること
//   実行: node e2e/save.e2e.mjs
import { createRequire } from 'module';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
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
const ARGS = ['--use-gl=swiftshader', '--ignore-gpu-blocklist'];
const results = [];
let failed = 0;

async function test(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  const dir = mkdtempSync(join(tmpdir(), 'aq-e2e-'));
  const ctxs = [];
  const open = async () => {
    const ctx = await chromium.launchPersistentContext(dir, { args: ARGS, viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
    // フォント取得で待たされないよう Google Fonts は空で返す
    await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    ctxs.push(ctx);
    return ctx;
  };
  const errors = [];
  try {
    await fn({ open, errors });
    if (errors.length) throw new Error('ページエラー: ' + errors.join(' / '));
    results.push(['PASS', name]);
  } catch (e) {
    failed++;
    results.push(['FAIL', name, e.message.split('\n').slice(0, 3).join(' | ')]);
    if (process.env.DEBUG_SHOT) for (const c of ctxs) for (const pg of c.pages()) await pg.screenshot({ path: `/tmp/e2e-fail-${results.length}.png` }).catch(() => {});
  } finally {
    for (const c of ctxs) await c.close().catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }
}

async function page(ctx, errors) {
  const p = ctx.pages()[0] ?? (await ctx.newPage());
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(URL_);
  await ready(p);
  return p;
}
const ready = (p) => p.waitForFunction(() => !document.body.innerText.includes('冒険の記録を読み込み中'), null, { timeout: 15000 });
const text = (p) => p.evaluate(() => document.body.innerText);
const expectText = async (p, s, msg) => {
  const t = await text(p);
  if (!t.includes(s)) throw new Error(`${msg ?? ''}「${s}」が見つかりません`);
};

/** IndexedDB / localStorage の中身を読む・書く */
const idb = (p, fn, arg) =>
  p.evaluate(
    ([fnSrc, a]) =>
      new Promise((res, rej) => {
        const req = indexedDB.open('aidma-sales-quest', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => {
          const db = req.result;
          const f = new Function('db', 'a', 'res', 'rej', fnSrc);
          f(db, a, res, rej);
        };
        req.onerror = () => rej(req.error);
      }),
    [fn, arg],
  );
const idbGet = (p, key) =>
  idb(p, `const r=db.transaction('kv').objectStore('kv').get(a); r.onsuccess=()=>{res(r.result??null); db.close();}; r.onerror=()=>rej(r.error);`, key);
const idbSet = (p, key, val) =>
  idb(p, `const t=db.transaction('kv','readwrite'); t.objectStore('kv').put(a[1],a[0]); t.oncomplete=()=>{res(true); db.close();}; t.onerror=()=>rej(t.error);`, [key, val]);

async function startGame(p, name = 'テスト太郎') {
  await p.locator('#onboarding-name').fill(name);
  await p.getByText('冒険をはじめる').click();
  await p.waitForTimeout(400);
}

/** 講義1を読了して EXP を得る */
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

// ------------------------------------------------------------------
await test('10. 新規ゲーム開始（初回起動の判定）', async ({ open, errors }) => {
  const p = await page(await open(), errors);
  await expectText(p, '冒険をはじめる', '初回は名前入力画面が出るはず:');
  await startGame(p);
  await expectText(p, 'テスト太郎');
});

await test('1〜5. セーブ → リロード → ブラウザ終了・再起動 → ロード', async ({ open, errors }) => {
  let ctx = await open();
  let p = await page(ctx, errors);
  await startGame(p, 'ケンスケ');
  await finishLecture(p, 0);
  await p.waitForTimeout(400); // 自動セーブ（150ms まとめ）
  const gold1 = await p.locator('header').innerText();
  await p.reload();
  await ready(p);
  await expectText(p, 'ケンスケ', 'リロード後:');
  if ((await p.locator('header').innerText()) !== gold1) throw new Error('リロードで HUD の値が変わった');
  await ctx.close();
  ctx = await open(); // ブラウザを終了→再起動（同じプロフィール）
  p = await page(ctx, errors);
  await expectText(p, 'ケンスケ', '再起動後:');
  await expectText(p, '習得済み', '再起動後の講義:');
});

await test('6〜7. 複数回セーブ・セーブ直後のロード（冒険の書）', async ({ open, errors }) => {
  const p = await page(await open(), errors);
  await startGame(p, 'スロット');
  await p.getByLabel('冒険の書（セーブ・ロード）').click();
  await p.locator('button:has-text("冒険の書 1")').click();
  await p.getByText('冒険の書1にセーブしました').first().waitFor();
  await p.locator('button:has-text("冒険の書 1")').click();
  await p.getByRole('button', { name: '上書きする' }).click();
  await p.getByText('冒険の書1にセーブしました').first().waitFor();
  await p.getByRole('tab', { name: /ロード/ }).click();
  await p.locator('button:has-text("冒険の書 1")').click();
  await p.getByRole('button', { name: '再開する' }).click();
  await p.getByText('冒険の書1から再開しました').first().waitFor();
  await expectText(p, 'スロット');
});

await test('8. セーブ破損（current）→ バックアップから復旧', async ({ open, errors }) => {
  const p = await page(await open(), errors);
  await startGame(p, 'フッキュウ');
  await finishLecture(p, 0);
  await p.waitForTimeout(500);
  await idbSet(p, 'aq:auto:current', '{"saveVersion":2,"checksum":"0","data":{');
  await p.evaluate(() => localStorage.setItem('aq:auto:current', 'garbage'));
  await p.reload();
  await ready(p);
  await expectText(p, 'バックアップから復旧しました');
  await expectText(p, 'フッキュウ');
});

await test('8b. current も backup も破損 → 復旧画面（自動で初期化しない）→ 保存コードで復元', async ({ open, errors }) => {
  const p = await page(await open(), errors);
  await startGame(p, 'コード');
  await finishLecture(p, 0);
  await p.waitForTimeout(500);
  // 念のための控え（保存コード）を取る
  await p.getByLabel('冒険の書（セーブ・ロード）').click();
  await p.getByRole('tab', { name: /保存コード/ }).click();
  await p.getByText('保存コードを書き出す').click();
  const code = await p.locator('#save-code-export').inputValue();
  for (const k of ['aq:auto:current', 'aq:auto:backup']) {
    await idbSet(p, k, 'garbage');
    await p.evaluate((kk) => localStorage.setItem(kk, 'garbage'), k);
  }
  await p.reload();
  await ready(p);
  await expectText(p, 'セーブデータを読み込めません');
  if ((await idbGet(p, 'aq:auto:current')) !== 'garbage') throw new Error('壊れたデータが上書きされた');
  await p.locator('#save-code-import').fill(code);
  await p.getByText('このコードで復元する').click();
  await p.getByText('保存コードから復元しました').first().waitFor();
  await expectText(p, 'コード');
});

await test('9. 古い saveVersion（旧 localStorage 形式）からの Migration', async ({ open, errors }) => {
  const ctx = await open();
  const p0 = ctx.pages()[0] ?? (await ctx.newPage());
  await p0.goto(URL_);
  await p0.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      'aidma-sales-quest-v1',
      JSON.stringify({
        state: { onboarded: true, playerName: 'キュウデータ', exp: 760, gold: 420, gender: 'female', jobId: 'paladin', completedLectures: ['lec-opening'], questRecords: { 'it-ses': { clears: 1, bestTurns: 3, perfect: true } }, soundOn: false, bgmOn: false, tab: 'hero', guildIndustry: 'it' },
        version: 0,
      }),
    );
  });
  const p = await page(ctx, errors);
  await expectText(p, 'キュウデータ');
  await expectText(p, 'Lv.5');
  const raw = await idbGet(p, 'aq:auto:current');
  if (!raw || JSON.parse(raw).saveVersion !== 2) throw new Error('新形式で保存されていない');
  if (!(await idbGet(p, 'aq:legacy-backup'))) throw new Error('旧データが退避されていない');
});

await test('11. 既存ゲームから新規ゲーム（直前の記録を控えとして残す）', async ({ open, errors }) => {
  const p = await page(await open(), errors);
  await startGame(p, 'マエノデータ');
  await p.waitForTimeout(400);
  // 冒険の書にも記録しておく（新規ゲーム後に「冒険の書から再開」が出ることも確認）
  await p.getByLabel('冒険の書（セーブ・ロード）').click();
  await p.locator('button:has-text("冒険の書 1")').click();
  await p.getByText('冒険の書1にセーブしました').first().waitFor();
  await p.getByLabel('閉じる').first().click();
  await p.getByRole('button', { name: /勇者・転職/ }).click();
  await p.getByText('冒険の記録を消去する').click();
  await p.getByRole('button', { name: '消去する', exact: true }).click();
  await p.getByText('冒険をはじめる').waitFor();
  await p.getByText('冒険の書から再開する').waitFor();
  const pre = await idbGet(p, 'aq:pre-reset');
  if (!pre || !pre.includes('マエノデータ')) throw new Error('pre-reset が残っていない');
  await p.reload();
  await ready(p);
  await expectText(p, '冒険をはじめる', 'リロード後も新規状態のはず:');
});

await test('12・14. 戦闘終了（クエスト達成）直後にリロードしても保存されている', async ({ open, errors }) => {
  const ctx = await open();
  const p0 = ctx.pages()[0] ?? (await ctx.newPage());
  await p0.goto(URL_);
  await p0.evaluate(() =>
    localStorage.setItem(
      'aidma-sales-quest-v1',
      JSON.stringify({ state: { onboarded: true, playerName: 'バトル', exp: 1300, gold: 500, gender: 'male', jobId: 'paladin', completedLectures: [], questRecords: {}, soundOn: false, bgmOn: false, tab: 'guild', guildIndustry: 'it' }, version: 0 }),
    ),
  );
  const p = await page(ctx, errors);
  await p.getByRole('button', { name: /出撃/ }).first().click();
  await p.waitForTimeout(2000);
  for (let step = 0; step < 24; step++) {
    if (await p.getByText('討伐完了').count()) break;
    const b = p.locator('footer .grid button:not([disabled])');
    if ((await b.count()) && (await p.getByText('PHASE').count())) {
      await b.first().click();
      await p.waitForTimeout(1300);
    }
    const next = p.locator('footer button', { hasText: /次のフェーズ|とどめ|体勢/ });
    if (await next.count()) {
      await next.click();
      await p.waitForTimeout(1700);
    }
  }
  await p.getByText('討伐完了').waitFor({ timeout: 5000 });
  await p.reload(); // 勝利画面のまま即リロード
  await ready(p);
  await p.getByRole('button', { name: '冒険者ギルド', exact: true }).click();
  await expectText(p, '討伐済×1', '討伐記録:');
});

await test('13. エリア移動（画面・業界の切り替え）後の保存', async ({ open, errors }) => {
  const ctx = await open();
  const p0 = ctx.pages()[0] ?? (await ctx.newPage());
  await p0.goto(URL_);
  await p0.evaluate(() =>
    localStorage.setItem(
      'aidma-sales-quest-v1',
      JSON.stringify({ state: { onboarded: true, playerName: 'イドウ', exp: 300, gold: 100, gender: 'male', jobId: 'warrior', completedLectures: [], questRecords: {}, soundOn: false, bgmOn: false, tab: 'academy', guildIndustry: 'it' }, version: 0 }),
    ),
  );
  const p = await page(ctx, errors);
  await p.getByRole('button', { name: '冒険者ギルド', exact: true }).click();
  await p.getByRole('tab', { name: /金融/ }).click();
  await p.waitForTimeout(1400); // 画面移動は1秒まとめて保存
  await p.reload();
  await ready(p);
  await expectText(p, 'BtoB決済', '金融の依頼が開いているはず:');
});

await test('12b. バックグラウンド移行時（visibilitychange）に即保存', async ({ open, errors }) => {
  const p = await page(await open(), errors);
  await startGame(p, 'バックグラウンド');
  await p.waitForTimeout(400);
  await p.getByRole('button', { name: '冒険者ギルド', exact: true }).click().catch(() => {});
  await p.getByRole('button', { name: /勇者・転職/ }).click();
  // 1秒まとめの前にアプリを隠す
  await p.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await p.waitForTimeout(150);
  await p.reload();
  await ready(p);
  await expectText(p, '転職の神殿へ', '勇者画面のまま復帰するはず:');
});

await test('複数タブ：古いタブは上書きせずに停止・通知', async ({ open, errors }) => {
  const ctx = await open();
  const a = await page(ctx, errors);
  await startGame(a, 'タブ');
  await a.waitForTimeout(400);
  const b = await ctx.newPage();
  b.on('pageerror', (e) => errors.push(e.message));
  await b.goto(URL_);
  await ready(b);
  await finishLecture(b, 0); // タブBで進める
  await b.waitForTimeout(500);
  await a.getByRole('button', { name: /勇者・転職/ }).click(); // 古いタブAで操作
  await a.waitForTimeout(1500);
  await expectText(a, '別のタブ', 'タブAに警告が出るはず:');
  await b.reload();
  await ready(b);
  await expectText(b, '習得済み', 'タブBの進行が残っているはず:');
});

await test('保存領域が使えない環境では「保存されません」と表示', async ({ open, errors }) => {
  const ctx = await open();
  await ctx.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
    Object.defineProperty(window, 'indexedDB', { get() { return undefined; } });
  });
  const p = await page(ctx, errors);
  await expectText(p, '進行が保存されません');
});

console.table(results.map(([s, n, e]) => ({ 結果: s, テスト: n, 詳細: e ?? '' })));
console.log(failed ? `${failed} 件失敗` : 'すべて成功');
process.exit(failed ? 1 : 0);
