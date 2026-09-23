/* ===== キャラクター画像の一覧を作る =====
 * assets/characters/ を走査して src/data/art.js を書き出す。
 *
 *   node tools/build-art.js            通常（画像へのパスを書く）
 *   node tools/build-art.js --inline   1ファイル版用（画像を埋め込む）
 *
 * 画像が1枚も無くても動く。そのとき一覧は空になり、
 * ゲームはいままでどおり SVG でキャラクターを描く。
 *
 * ファイル名の決まりは assets/characters/README.md を参照。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'assets/characters');
const OUT = path.join(ROOT, 'src/data/art.js');

/* フォルダ名 → 種別。README と同じ並び。 */
const KINDS = {
  player: 'player', companions: 'companion', jobs: 'job',
  npc: 'npc', monsters: 'monster', bosses: 'boss',
};
const USES = ['battle', 'field', 'portrait', 'face'];
const EXT = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

/* 1ファイル版に入れる用途。
 * 立ち絵(portrait)は大きいので入れない。
 * 全部入れると16MBの上限に近づき、公開できなくなる。 */
const INLINE_USES = ['battle', 'face'];

const inline = process.argv.includes('--inline');
const quiet = process.argv.includes('--quiet');

/* ファイル名 → { use, sex, job }。読めなければ null。 */
function parseName(base) {
  const m = /^([a-z]+)(?:_([a-z0-9_]+))?$/.exec(base);
  if (!m || !USES.includes(m[1])) return null;
  const suf = m[2] || null;
  if (suf === 'm' || suf === 'f') return { use: m[1], sex: suf, job: null };
  return { use: m[1], sex: null, job: suf };   // 例 battle_saint（仲間の職別）
}

const entries = {};
const skipped = [];
let bytes = 0, inlined = 0;

function addFile(kind, id, file, full) {
  const ext = path.extname(file).toLowerCase();
  if (!EXT[ext]) { skipped.push(`${file}（対応していない形式）`); return; }
  const p = parseName(path.basename(file, ext));
  if (!p) { skipped.push(`${file}（名前の決まりに合わない）`); return; }

  const key = [kind, id, p.use].join('/')
    + (p.sex ? '_' + p.sex : '') + (p.job ? '_' + p.job : '');
  const size = fs.statSync(full).size;
  bytes += size;

  if (inline && INLINE_USES.includes(p.use)) {
    entries[key] = `data:${EXT[ext]};base64,` + fs.readFileSync(full).toString('base64');
    inlined++;
  } else if (inline) {
    return;                       // 1ファイル版に入れない用途は一覧からも外す
  } else {
    entries[key] = path.relative(ROOT, full).split(path.sep).join('/');
  }
}

function scan() {
  if (!fs.existsSync(DIR)) return;
  for (const folder of Object.keys(KINDS)) {
    const base = path.join(DIR, folder);
    if (!fs.existsSync(base)) continue;
    const kind = KINDS[folder];

    if (folder === 'player') {
      /* player だけは ID の階層を持たない */
      for (const f of fs.readdirSync(base)) {
        const full = path.join(base, f);
        if (fs.statSync(full).isFile()) addFile(kind, 'player', f, full);
      }
      continue;
    }
    for (const id of fs.readdirSync(base)) {
      const sub = path.join(base, id);
      if (!fs.statSync(sub).isDirectory()) continue;
      for (const f of fs.readdirSync(sub)) {
        const full = path.join(sub, f);
        if (fs.statSync(full).isFile()) addFile(kind, id, f, full);
      }
    }
  }
}

scan();

const keys = Object.keys(entries).sort();
const body = keys.length
  ? keys.map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(entries[k])},`).join('\n')
  : '';

const src = `/* ===== キャラクター画像の一覧（自動生成） =====
 * tools/build-art.js が assets/characters/ を見て作ります。
 * 直接書き換えないでください。画像を足したら
 *   npm run art
 * を走らせると作り直されます。
 *
 * 空でも問題ありません。そのときは今までどおり SVG で描きます。
 */
window.G = window.G || {};

G.ART_MANIFEST = {
${body}
};
`;

fs.writeFileSync(OUT, src);

if (!quiet) {
  console.log(`\n═══ キャラクター画像の一覧 ═══\n`);
  console.log(`  走査先: assets/characters/`);
  console.log(`  見つけた画像: ${keys.length} 件`
    + (inline ? `（うち埋め込み ${inlined} 件）` : '')
    + (bytes ? ` / 合計 ${(bytes / 1024).toFixed(0)}KB` : ''));
  if (skipped.length) {
    console.log(`\n  ⚠ 読み飛ばした ${skipped.length} 件`);
    for (const s of skipped.slice(0, 10)) console.log(`     ${s}`);
  }
  console.log(`\n  書き出し: src/data/art.js`);
  if (!keys.length) {
    console.log(`\n  画像はまだ1枚もありません。`);
    console.log(`  いままでどおり SVG でキャラクターを描きます（正常です）。`);
  }
  console.log('');
}

module.exports = { parseName, KINDS, USES, INLINE_USES };
