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
const os = require('os');
const { execFileSync } = require('child_process');
const { loadGame, scriptsFromIndex } = require('./load.js');

const ROOT = path.resolve(__dirname, '..');

/* 本物の素材（assets/characters/）は触らない。
 * 検証用の画像は、使い捨てのフォルダに作って最後に消す。
 * 本物を消してしまう事故を、仕組みとして起こらないようにする。 */
const ART = path.join(os.tmpdir(), 'ta-art-test-' + process.pid);
const REAL = path.join(ROOT, 'assets/characters');

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
  return pngOf(w, h, raw);
}

function pngOf(w, h, raw) {
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

/* 検証を始める前の、本物の素材の枚数。最後に変わっていないか確かめる。 */
const realBefore = (function walk(dir) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) { n += walk(full); continue; }
    if (/\.(webp|png|jpe?g)$/i.test(f)) n++;
  }
  return n;
})(path.join(ROOT, 'assets/characters'));

/* 灰色の背景の真ん中に、指定の大きさの四角を描いたPNG。
 * 「腕を広げた絵」「縮こまった絵」の代わりに使う。 */
function makeShape(w, h, cw, ch) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  const x0 = ((w - cw) / 2) | 0, y0 = ((h - ch) / 2) | 0;
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 4 + 1) + 1 + x * 4;
      const inside = x >= x0 && x < x0 + cw && y >= y0 && y < y0 + ch;
      const c = inside ? [220, 40, 40] : [110, 110, 110];
      raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; raw[o + 3] = 255;
    }
  }
  return pngOf(w, h, raw);
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
  try { fs.rmSync(ART, { recursive: true, force: true }); } catch (e) {}
}
/* 検証用フォルダを走査して、一覧を文字列で受け取る。
 * ファイルには書き出さないので、開発中の src/data/art.js は無傷。 */
const build = (args) => JSON.parse(execFileSync(process.execPath,
  [path.join(ROOT, 'tools/build-art.js'), '--dir', ART, '--json'].concat(args || []),
  { cwd: ROOT, encoding: 'utf8' }) || '{}');

/* 一覧を差し替えたゲームを用意する */
const fresh = (manifest) => {
  const G = loadGame(scriptsFromIndex());
  G.ART_MANIFEST = manifest || {};
  return G;
};

try {
  /* ---------- 1. 画像が1枚も無い状態 ---------- */
  console.log('▼ 1. 画像が1枚も無いとき\n');
  {
    const G = fresh(build());
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
  {
    const G = fresh(build());
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
  {
    const G = fresh(build());
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

    /* 用途が違っても、1枚あれば使い回す。
     * 立ち絵を用意していなくても、戦闘の絵で代わりにする。 */
    c.jobId = 'swordsman';
    c.look = { sex: 'm' };
    check(/battle_m\.png$/.test(G.Art.hero(c, 'portrait')),
      '立ち絵が無ければ戦闘の絵で代わりにする');
    check(/battle_m\.png$/.test(G.Art.hero(c, 'field')),
      '小型の絵が無くても戦闘の絵で代わりにする');
    /* どの用途の絵も無ければ SVG */
    c.jobId = 'archmage';
    check(G.Art.hero(c, 'portrait') === null, 'どの用途の絵も無ければSVGに戻る');
  }

  /* ---------- 4. 仲間専用の絵が職の絵より優先される ---------- */
  console.log('\n▼ 4. 仲間専用の絵\n');
  put('companions/riina/battle.png');
  put('companions/riina/battle_saint.png');
  {
    const G = fresh(build());
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

  /* ---------- 4b. 動きの絵 ---------- */
  console.log('\n▼ 5. 動きの絵（手足を動かす）\n');
  put('jobs/swordsman/battle_m_walk.png');
  put('jobs/swordsman/battle_m_attack.png');
  put('monsters/slime/battle_hurt.png');
  {
    const G = fresh(build());
    G.State.newGame('テスト', 'normal');
    const c = G.State.d.player;
    c.jobId = 'swordsman'; c.look = { sex: 'm' };

    check(/battle_m_walk\.png$/.test(G.Art.hero(c, 'battle', 'walk')), '歩く絵が引ける');
    check(/battle_m_attack\.png$/.test(G.Art.hero(c, 'battle', 'attack')), '攻撃する絵が引ける');
    check(G.Art.hero(c, 'battle', 'cast') === null, '用意していない動きは無い（CSSの動きだけになる）');

    const poses = G.Art.heroPoses(c, 'battle');
    check(poses && poses.walk && poses.attack && !poses.cast,
      '用意した動きだけがまとまって返る', JSON.stringify(Object.keys(poses || {})));

    const html = G.Sprite.hero(c, 'battle');
    check(/data-pose-walk=/.test(html) && /data-pose-attack=/.test(html),
      '絵のタグに動きの絵が書き込まれる');
    check(/data-base=/.test(html), 'もとの絵に戻すための指定も入る');

    /* 差し替えと復帰（画面が無いので、最低限の作り物で試す） */
    const el = {
      tagName: 'IMG', src: 'base.png',
      dataset: { base: 'base.png', poseWalk: 'w.png', poseAttack: 'a.png' },
    };
    check(G.Art.setPose(el, 'is-walk') === true && el.src === 'w.png', '歩きに差し替わる');
    G.Art.clearPose(el);
    check(el.src === 'base.png', 'もとの絵に戻る');
    check(G.Art.setPose(el, 'is-cast') === false && el.src === 'base.png',
      '用意の無い動きでは差し替えない');

    /* 敵側 */
    check(/battle_hurt\.png$/.test(G.Art.foe('slime', 'battle', false, 'hurt')),
      '敵の動きの絵も引ける');
    const fp = G.Art.foePoses('slime', 'battle', false);
    check(fp && fp.hurt && !fp.walk, '敵も用意した動きだけ返る');
  }

  /* 番号を付けると、その順に切り替わる */
  put('jobs/ninja/battle_m.png');              // ふだんの絵（これが無いとSVGのまま）
  put('jobs/ninja/battle_m_attack1.png');
  put('jobs/ninja/battle_m_attack2.png');
  put('jobs/ninja/battle_m_attack3.png');
  put('jobs/ninja/battle_m_attack5.png');      // 4 が無いので、ここから先は拾わない
  {
    const G = fresh(build());
    G.State.newGame('テスト', 'normal');
    const c = G.State.d.player;
    c.jobId = 'ninja'; c.look = { sex: 'm' };
    const fr = G.Art.heroPoses(c, 'battle').attack;
    check(fr.length === 3, `番号の順に並ぶ（${fr.length}コマ）`,
      fr.map(u => u.split('/').pop()).join(' '));
    check(/attack1\.png$/.test(fr[0]) && /attack3\.png$/.test(fr[2]), '1から順に並ぶ');
    check(!fr.some(u => /attack5/.test(u)), '番号が飛んだら、その先は拾わない');

    const html = G.Sprite.hero(c, 'battle');
    check((html.match(/\|/g) || []).length === 2, '絵のタグに3コマが並ぶ');

    /* コマ送りの差し替え（画面が無いので最低限の作り物で試す） */
    const el = { tagName: 'IMG', src: 'b.png', isConnected: true,
      dataset: { base: 'b.png', poseAttack: '1.png|2.png|3.png' } };
    G.Art.setPose(el, 'is-attack', 300);
    check(el.src === '1.png', 'まず1コマ目になる');
    check(!!el._poseTimer, 'コマ送りが動き出す');
    G.Art.clearPose(el);
    check(!el._poseTimer && el.src === 'b.png', '止めるとコマ送りも終わり、元の絵に戻る');
  }

  /* ---------- 5b. まとめて取り込むと位置と大きさが揃う ---------- */
  console.log('\n▼ 6. まとめて取り込む（--group）\n');
  {
    const dir = path.join(os.tmpdir(), 'ta-group-' + process.pid);
    fs.mkdirSync(dir, { recursive: true });
    /* 中身の大きさが違う2枚を作る（腕を広げた絵と、縮こまった絵のつもり） */
    const wide = path.join(dir, 'wide.png');
    const slim = path.join(dir, 'slim.png');
    fs.writeFileSync(wide, makeShape(200, 200, 160, 100));
    fs.writeFileSync(slim, makeShape(200, 200, 40, 100));
    const outA = path.join(dir, 'a.png');
    const outB = path.join(dir, 'b.png');
    /* 取り込みツールが報告する「切り出し」の大きさで比べる。
     * 書き出したPNGを自前で読むと、行ごとの圧縮の種類まで
     * 扱わねばならず、測り方のほうが間違いやすい。 */
    const run = (...a) => execFileSync(process.execPath,
      [path.join(ROOT, 'tools/art-import.js'), ...a],
      { cwd: ROOT, encoding: 'utf8' });
    const cropsOf = out => [...out.matchAll(/切り出し (\d+)×(\d+)/g)].map(m => m[1] + 'x' + m[2]);

    /* 1枚ずつ入れると、それぞれのふちに合わせて切り出すので揃わない */
    const a1 = cropsOf(run(wide, outA, '--size', '100x100'))[0];
    const b1 = cropsOf(run(slim, outB, '--size', '100x100'))[0];
    check(a1 !== b1, `1枚ずつだと切り出し方が違う（${a1} / ${b1}）`);

    /* まとめて入れると同じ切り出し方になる */
    const grp = cropsOf(run('--group', wide, outA, slim, outB, '--size', '100x100'));
    check(grp.length === 2 && grp[0] === grp[1],
      `まとめて入れると切り出し方が揃う（${grp.join(' / ')}）`);
    check(fs.existsSync(outA) && fs.existsSync(outB), '2枚とも書き出される');

    fs.rmSync(dir, { recursive: true, force: true });
  }

  /* ---------- 5. 名前や置き場所を間違えたとき ---------- */
  console.log('\n▼ 7. 間違えて置いても壊れない\n');
  put('monsters/slime/せんとう.png');            // 用途名が違う
  put('monsters/slime/battle.txt');              // 画像でない
  put('jobs/swordsman/battle_x.png');            // 性別でも職でもない接尾辞
  {
    const G = fresh(build());
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
  console.log('\n▼ 8. 知らないIDを聞かれても落ちない\n');
  {
    const G = fresh(build());
    check(G.Art.hero(null, 'battle') === null, 'キャラが無くてもnullを返す');
    check(G.Art.foe('存在しない敵', 'battle', false) === null, '知らない敵でもnullを返す');
    check(G.Art.npc('存在しないNPC', 'field') === null, '知らないNPCでもnullを返す');
    check(G.Art.hero({ key: 'x', jobId: 'x' }, 'でたらめな用途') !== undefined,
      '用途がでたらめでも例外にならない');
  }

  /* ---------- 7. 1ファイル版への埋め込み ---------- */
  console.log('\n▼ 9. 1ファイル版に埋め込まれる\n');
  {
    const G = fresh(build(['--inline']));
    const url = G.ART_MANIFEST['monster/slime/battle'];
    check(!!url && /^data:image\/png;base64,/.test(url), '画像が文字列として埋め込まれる');
    check(!Object.keys(G.ART_MANIFEST).some(k => /\/portrait/.test(k)),
      '立ち絵は埋め込まない（容量のため）');
  }
  {
    const G = fresh(build());
    check(/^\S+\.png$/.test(G.ART_MANIFEST['monster/slime/battle'] || ''),
      '通常版では画像へのパスが入る');
  }

  /* ---------- 8. セーブの互換 ---------- */
  console.log('\n▼ 10. 古いセーブでも読める\n');
  {
    const G = fresh(build());
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
console.log('\n▼ 11. 後始末と、本物の素材への影響\n');
{
  check(!fs.existsSync(ART), '検証用のフォルダは残っていない', ART);
  /* 本物の素材は1枚も増えていない・減っていない */
  const realCount = (function walk(dir) {
    if (!fs.existsSync(dir)) return 0;
    let n = 0;
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) { n += walk(full); continue; }
      if (/\.(webp|png|jpe?g)$/i.test(f)) n++;
    }
    return n;
  })(REAL);
  check(realCount === realBefore,
    `本物の素材は触っていない（${realBefore}枚のまま）`, `いま${realCount}枚`);

  /* 実際に置いてある素材で、ゲームが問題なく動く */
  const G = loadGame(scriptsFromIndex());
  G.State.newGame('テスト', 'normal');
  for (const k of ['riina', 'velt', 'noa']) G.State.recruit(k);
  let imgs = 0, svgs = 0;
  for (const c of G.State.d.party) {
    const h = G.Sprite.hero(c);
    if (/^<img/.test(h)) imgs++; else if (/^<svg/.test(h)) svgs++;
  }
  check(imgs + svgs === G.State.d.party.length,
    `いまの素材で全員が描ける（画像${imgs}人 / SVG${svgs}人）`);
}

console.log(`\n▼ 判定：${ok.length} 件成功 / ${ng.length} 件失敗`);
if (ng.length) { for (const s of ng) console.log(`  ❌ ${s}`); process.exit(1); }
console.log('  ✅ 画像は1枚ずつ足せて、無くても壊れない');
