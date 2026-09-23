/* ===== 序盤の手応えを測る =====
 *
 *   node tools/early-balance.js
 *
 * 実際に遊ぶ順番どおりに測る。
 *   ・リィナは最初の物語で必ず仲間になるので、単騎の場面は無い
 *   ・依頼の中身は src/data/quests.js のとおり
 *
 * 見るところは勝率だけではない。
 * 序盤の「強すぎる」という手応えは、負けることではなく
 * 1戦ごとにHPが大きく削られることから来る。
 * 残HPが5割を切る戦いが続くと、宿に戻る以外の選択肢が無くなる。
 */
const { trial, setupParty, runBattle } = require('./balance.js');

const START = { weapon: 'wood_stick', armor: 'academy_robe' };
const BRONZE = { weapon: ['bronze_sword', 'oak_staff', 'bronze_dagger'], armor: 'academy_robe' };
const R = ['riina'];

console.log('\n═══ 序盤：依頼どおりの組み合わせ（リィナ同行） ═══\n');
trial('Lv1 スライムの駆除（スライム×2）', { level: 1, jobPath: [], companions: R, equip: START }, ['slime', 'slime']);
trial('Lv2 薬草の採取（大ネズミ+スライム）', { level: 2, jobPath: [], companions: R, equip: START }, ['rat', 'slime']);
trial('Lv3 倉庫のネズミ退治（大ネズミ×2）', { level: 3, jobPath: [], companions: R, equip: START }, ['rat', 'rat']);
trial('Lv4 ゴブリンの物見（ゴブリン×2）', { level: 4, jobPath: [], companions: R, equip: BRONZE }, ['goblin', 'goblin']);

console.log('\n═══ 序盤：探索で出会う数（1〜3体） ═══\n');
trial('Lv1 スライム×1', { level: 1, jobPath: [], companions: R, equip: START }, ['slime']);
trial('Lv1 スライム×3', { level: 1, jobPath: [], companions: R, equip: START }, ['slime', 'slime', 'slime']);
trial('Lv3 ゴブリン×3', { level: 3, jobPath: [], companions: R, equip: START }, ['goblin', 'goblin', 'goblin']);
trial('Lv5 ゴブリン×3', { level: 5, jobPath: [], companions: R, equip: BRONZE }, ['goblin', 'goblin', 'goblin']);

/* 連戦：回復なしで何戦もつか。
 * 探索では宿に戻らずに歩き続けるので、こちらが実際の手応えに近い。 */
console.log('\n═══ 回復なしの連戦（何戦目で倒れるか／200回） ═══\n');
function streak(name, setup, pool, n = 200) {
  const counts = [];
  for (let i = 0; i < n; i++) {
    setupParty(setup);
    let k = 0;
    for (; k < 12; k++) {
      const foes = pool[Math.floor(Math.random() * pool.length)];
      if (runBattle(foes).result !== 'win') break;
    }
    counts.push(k);
  }
  counts.sort((a, b) => a - b);
  const avg = counts.reduce((a, b) => a + b, 0) / n;
  console.log(`${name.padEnd(30, '　')} 平均 ${avg.toFixed(1)}戦  `
    + `下位25% ${counts[Math.floor(n * 0.25)]}戦  中央 ${counts[Math.floor(n * 0.5)]}戦`);
  return avg;
}
streak('Lv2 草原（スライム・ネズミ）', { level: 2, jobPath: [], companions: R, equip: START },
  [['slime'], ['rat'], ['slime', 'slime'], ['rat', 'slime']]);
streak('Lv5 草原（ゴブリン混じり）', { level: 5, jobPath: [], companions: R, equip: BRONZE },
  [['goblin'], ['rat', 'rat'], ['goblin', 'slime'], ['goblin', 'goblin']]);
console.log('');
