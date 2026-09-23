/* ===== 取り込んだ画像の並べて確認 =====
 *
 *   node tools/art-preview.js [出力先.png]
 *
 * 敵とボスを1枚に並べて書き出す。
 * 取り込みのあと、背景が残っていないか、隣の絵が混ざっていないか、
 * 大小関係がおかしくないかを目で見て確かめるためのもの。
 * ゲーム本体には影響しない。
 *
 * 画像が無いキャラクターは、これまでどおり SVG で描かれる。
 * （どちらで描かれているかも、この1枚で見分けられる）
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = process.argv[2] || 'art-preview.png';
const EXE = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => fs.existsSync(p));

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 400 }, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve('index.html'));
  await page.waitForTimeout(800);

  const size = await page.evaluate(() => {
    /* ボスかどうかは、敵の設定の boss で決まる（src/data/enemies.js） */
    const ids = Object.keys(G.ENEMIES).filter(id => G.ENEMIES[id].name);
    const wrap = document.createElement('div');
    wrap.id = 'art-preview';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#241a3a;'
      + 'display:flex;flex-wrap:wrap;align-content:flex-start;gap:2px;padding:10px';
    for (const id of ids) {
      const boss = !!G.ENEMIES[id].boss;
      const col = document.createElement('div');
      col.style.cssText = 'width:110px';
      const box = document.createElement('div');
      box.className = 'unit foe' + (boss ? ' is-boss' : '');
      box.style.cssText = 'height:130px;display:flex;align-items:flex-end;justify-content:center';
      box.innerHTML = G.Sprite.enemy({ enemyId: id, name: G.ENEMIES[id].name, isBoss: boss }, 'battle');
      const cap = document.createElement('div');
      const art = G.Art && G.Art.foe(id, 'battle', boss);
      cap.style.cssText = `color:${art ? '#9ee' : '#997'};font-size:10px;text-align:center`;
      cap.textContent = `${G.ENEMIES[id].name}${art ? '' : '（SVG）'}`;
      col.appendChild(box); col.appendChild(cap); wrap.appendChild(col);
    }
    document.body.appendChild(wrap);
    return { n: ids.length, h: wrap.scrollHeight };
  });

  await page.setViewportSize({ width: 1000, height: Math.max(200, size.h + 20) });
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT });
  await browser.close();

  console.log(`\n  ${size.n} 体を書き出しました: ${OUT}`);
  if (errs.length) { console.error('画面のエラー:\n' + errs.join('\n')); process.exit(1); }
})().catch(e => { console.error('確認用の書き出しに失敗:', e.message); process.exit(1); });
