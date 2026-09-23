/* ===== キャラクター画像の仕組みを確かめる =====
 * 一番大事なこと：
 *   ・画像が1枚も無くても、今までどおりSVGで描かれる
 *   ・画像を1枚置くと、そのキャラだけが画像に変わる（他は無傷）
 *   ・置き場所や名前を間違えても、ゲームが壊れない
 *
 * 検証用の画像は、このテストの中で作って、終わったら消す。
 * （見本の絵をリポジトリに残さないため）
 *
 *   node tools/art-test.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');
const { loadGame, scriptsFromIndex } = require('./load.js');

const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'assets/characters');

const ok = [], ng = [];
const check = (cond, label, extra) => {
  (cond ? ok : ng).push(label + (cond || !extra ? '' : ` … ${extra}`));
  console.log(`  ${cond ? '✅' : '❌'} ${label}${!cond && extra ? `  ← ${extra}` : ''}`);
};

/* 小さなPNGを作る。外部の道具に頼らず、zlib だけで組み立てる。 */
function makePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = rgba[0]; raw[o + 1] = rgba[1]; raw[o + 2] = rgba[2]; raw[o + 3] = rgba[3];
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
let TBL = null;
function crc32(buf) {
  if (!TBL) {
    TBL = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TBL[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TBL[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

const made = [];
function put(rel, rgba) {
  const full = path.join(ART, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, makePng(8, 10, rgba || [255, 0, 0, 255]));
  made.push(full);
  return full;
}
function cleanup() {
  for (const f of made) { try { fs.unlinkSync(f); } catch (e) {} }
  /* 空になったフォルダを片付ける */
  for (const f of made) {
    let d = path.dirname(f);
    while (d.startsWith(ART) && d !== ART) {
      try { if (!fs.readdirSync(d).length) fs.rmdirSync(d); else break; } catch (e) { break; }
      d = path.dirname(d);
    }
  }
  build();
}
const build = (args) => execFileSync(process.execPath,
  [path.join(ROOT, 'tools/build-art.js'), '--quiet'].concat(args || []), { cwd: ROOT });

const fresh = () => loadGame(scriptsFromIndex());

try {
  /* ---------- 1. 画像が1枚も無い状態 ---------- */
  console.log('▼ 1. 画像が1枚も無いとき\n');
  build();
  {
    const G = fresh();
    check(Object.keys(G.ART_MANIFEST).length === 0, '一覧が空である');
    check(G.Art.any === false, '「画像は無い」と判定される');
    G.State.newGame('テスト', 'normal');
    const p = G.State.d.player;
    check(G.Art.hero(p, 'battle') === null, '味方の画像は見つからない');
    check(G.Art.foe('slime', 'battle', false) === null, '敵の画像は見つからない');
    const svg = G.Sprite.hero(p);
    check(/^<svg/.test(svg), 'これまでどおりSVGで描かれる');
    check(!/<img/.test(svg), '画像タグは出てこない');
  }

  /* ---------- 2. 画像を1枚だけ置く（スライム） ---------- */
  console.log('\n▼ 2. スライムの絵を1枚だけ置く\n');
  put('monsters/slime/battle.png');
  build();
  {
    const G = fresh();
    check(G.Art.any === true, '「画像がある」と判定される');
    const url = G.Art.foe('slime', 'battle', false);
    check(!!url && /monsters\/slime\/battle\.png$/.test(url), 'スライムの絵が見つかる', String(url));

    const slime = { enemyId: 'slime', name: 'スライム', isBoss: false };
    const html = G.Sprite.enemy(slime);
    check(/^<img/.test(html), 'スライムは画像で描かれる');
    check(/class="chr art foe/.test(html), '敵として向きを反転する印が付く', html.slice(0, 70));

    /* ほかは無傷であること。ここが一番大事。 */
    const rat = G.Sprite.enemy({ enemyId: 'rat', name: '大ネズミ', isBoss: false });
    check(/^<svg/.test(rat), 'ほかの敵はSVGのまま（巻き込まれない）');
    G.State.newGame('テスト', 'normal');
    check(/^<svg/.test(G.Sprite.hero(G.State.d.player)), '味方もSVGのまま');
  }

  /* ---------- 3. 男女の描き分けと、代わりの絵 ---------- */
  console.log('\n▼ 3. 男女の描き分けと、絵が無いときの代わり\n');
  put('jobs/swordsman/battle_m.png');
  put('jobs/swordsman/battle_f.png');
  put('jobs/apprentice_knight/battle_m.png');
  build();
  {
    const G = fresh();
    G.State.newGame('テスト', 'normal');
    const c = G.State.d.player;
    c.jobId = 'swordsman';

    c.look = { sex: 'm' };
    check(/battle_m\.png$/.test(G.Art.hero(c, 'battle')), '男性なら男性の絵');
    c.look = { sex: 'f' };
    check(/battle_f\.png$/.test(G.Art.hero(c, 'battle')), '女性なら女性の絵');

    /* 女性の絵が無い職では、男性の絵で代わりにする（無いよりよい） */
    c.jobId = 'apprentice_knight';
    check(/apprentice_knight\/battle_m\.png$/.test(G.Art.hero(c, 'battle')),
      '片方の性別しか無ければ、あるほうを使う');

    /* その職に絵が無ければ、同じ系統の代表職の絵にする */
    c.jobId = 'paladin';
    const rep = G.Art.hero(c, 'battle');
    check(!!rep && /apprentice_knight/.test(rep),
      '職の絵が無ければ同じ系統の絵を使う（聖騎士 → 剣士見習い）', String(rep));

    /* 系統も違えば、絵は無い＝SVGに戻る */
    c.jobId = 'archmage';
    check(G.Art.hero(c, 'battle') === null, '系統も違えばSVGに戻る');

    /* 用途が違えば別の絵。無ければ null */
    c.jobId = 'swordsman';
    check(G.Art.hero(c, 'portrait') === null, '立ち絵はまだ無いのでSVGに戻る');
  }

  /* ---------- 4. 仲間専用の絵が職の絵より優先される ---------- */
  console.log('\n▼ 4. 仲間専用の絵\n');
  put('companions/riina/battle.png');
  put('companions/riina/battle_saint.png');
  build();
  {
    const G = fresh();
    G.State.newGame('テスト', 'normal');
    G.State.recruit('riina');
    const r = G.State.d.party.find(x => x.key === 'riina');
    r.jobId = 'saint';
    check(/battle_saint\.png$/.test(G.Art.hero(r, 'battle')),
      'その職専用の絵があればそれを使う（聖者のリィナ）');
    r.jobId = 'priest';
    check(/companions\/riina\/battle\.png$/.test(G.Art.hero(r, 'battle')),
      '職専用が無ければ、そのキャラの汎用の絵');
  }

  /* ---------- 5. 名前や置き場所を間違えたとき ---------- */
  console.log('\n▼ 5. 間違えて置いても壊れない\n');
  put('monsters/slime/せんとう.png');            // 用途名が違う
  put('monsters/slime/battle.txt');              // 画像でない
  put('jobs/swordsman/battle_x.png');            // 性別でも職でもない接尾辞
  build();
  {
    const G = fresh();
    check(!G.ART_MANIFEST['monster/slime/せんとう'], '読めない名前は一覧に入らない');
    check(!Object.keys(G.ART_MANIFEST).some(k => /\.txt/.test(k)), '画像でないファイルは無視される');
    /* battle_x は「職 x の絵」と解釈される。存在しない職なので誰にも使われない。 */
    const G2 = G;
    G2.State.newGame('テスト', 'normal');
    const c = G2.State.d.player; c.jobId = 'swordsman'; c.look = { sex: 'm' };
    check(/battle_m\.png$/.test(G2.Art.hero(c, 'battle')), '妙な名前があっても正しい絵が選ばれる');
    check(typeof G2.Sprite.hero(c) === 'string', '例外にならない');
  }

  /* ---------- 6. 存在しないIDを聞かれたとき ---------- */
  console.log('\n▼ 6. 知らないIDを聞かれても落ちない\n');
  {
    const G = fresh();
    check(G.Art.hero(null, 'battle') === null, 'キャラが無くてもnullを返す');
    check(G.Art.foe('存在しない敵', 'battle', false) === null, '知らない敵でもnullを返す');
    check(G.Art.npc('存在しないNPC', 'field') === null, '知らないNPCでもnullを返す');
    check(G.Art.hero({ key: 'x', jobId: 'x' }, 'でたらめな用途') !== undefined,
      '用途がでたらめでも例外にならない');
  }

  /* ---------- 7. 1ファイル版への埋め込み ---------- */
  console.log('\n▼ 7. 1ファイル版に埋め込まれる\n');
  build(['--inline']);
  {
    const G = fresh();
    const url = G.ART_MANIFEST['monster/slime/battle'];
    check(!!url && /^data:image\/png;base64,/.test(url), '画像が文字列として埋め込まれる');
    check(!Object.keys(G.ART_MANIFEST).some(k => /\/portrait/.test(k)),
      '立ち絵は埋め込まない（容量のため）');
  }
  build();
  {
    const G = fresh();
    check(/^assets\//.test(G.ART_MANIFEST['monster/slime/battle'] || ''),
      '作り終わったら通常版（画像へのパス）に戻る');
  }

  /* ---------- 8. セーブの互換 ---------- */
  console.log('\n▼ 8. 古いセーブでも読める\n');
  {
    const G = fresh();
    G.State.newGame('テスト', 'normal');
    G.State.recruit('riina');
    const saved = JSON.parse(JSON.stringify(G.State.d));
    for (const c of saved.party) delete c.look;          // look を足す前のセーブ
    G.State.data = G.State.migrate(saved);
    check(G.State.d.party.every(c => c.look && c.look.sex),
      'look が無いセーブでも既定値が入る');
    check(typeof G.Sprite.hero(G.State.d.player) === 'string', '絵の選択で落ちない');
  }
} finally {
  cleanup();
}

/* 後始末が効いているか */
console.log('\n▼ 9. 後始末\n');
{
  const G = fresh();
  check(Object.keys(G.ART_MANIFEST).length === 0, '検証用の画像は残っていない');
  const left = fs.existsSync(ART)
    ? fs.readdirSync(ART).filter(f => f !== 'README.md'
      && fs.statSync(path.join(ART, f)).isDirectory()
      && fs.readdirSync(path.join(ART, f)).length)
    : [];
  check(left.length === 0, '空のフォルダだけが残っている', left.join(','));
}

console.log(`\n▼ 判定：${ok.length} 件成功 / ${ng.length} 件失敗`);
if (ng.length) { for (const s of ng) console.log(`  ❌ ${s}`); process.exit(1); }
console.log('  ✅ 画像は1枚ずつ足せて、無くても壊れない');
