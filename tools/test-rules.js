/* ===== ルールの検証 =====
 * ブラウザ操作では踏みにくい境界条件（学費未納・留年・装備中の売却など）を
 * ヘッドレスで直接確かめる。
 */
const { loadGame, scriptsFromIndex } = require('./load.js');

/* 読み込むファイルは index.html から取る。
 * 以前はここに一覧を手書きしていたが、
 * 新しいファイルを足したときに書き足し忘れ、
 * 「セーブが読めない」という実際には起きない失敗が出た。 */
const FILES = scriptsFromIndex();

let pass = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) { pass++; return; }
  fails.push(`${name}${detail ? ' … ' + detail : ''}`);
}

const G = loadGame(FILES);
const fresh = (diff) => { G.State.newGame('検証', diff); return G.State.d; };

/* ---------- 暦と行動力 ---------- */
{
  const d = fresh();
  check('初日は1日目', d.day === 1, `day=${d.day}`);
  check('行動力は3から始まる', d.ap === 3);
  check('行動力が足りなければ消費できない', G.World.spendAp(4) === false);
  G.World.spendAp(3);
  check('使い切ると0になる', d.ap === 0);
  G.World.endDay(true);
  check('休むと翌日になり行動力が戻る', d.day === 2 && d.ap === 3, `day=${d.day} ap=${d.ap}`);

  // 学期末まで進めると試験が受けられるようになる
  for (let i = 0; i < G.ACADEMY.TERM_DAYS; i++) G.World.endDay(true);
  check('学期末に試験が解禁される', d.examAvailable === true);
  check('学期の日数が正しい', d.day === 2 + G.ACADEMY.TERM_DAYS, `day=${d.day}`);
}

/* ---------- 学費と試験 ---------- */
{
  const d = fresh();
  d.examAvailable = true;
  d.gold = 0;
  check('学費が未納なら受験できない', G.World.canTakeExam().ok === false);
  check('所持金が足りなければ納入できない', G.World.payTuition().ok === false);

  d.gold = G.World.tuitionAmount();
  check('学費を納入できる', G.World.payTuition().ok === true);
  check('納入後の所持金は0', d.gold === 0, `gold=${d.gold}`);
  check('二重には払えない', G.World.payTuition().ok === false);

  // 習熟度0なので不合格 → 留年
  const bad = G.World.takeExam();
  check('習熟度が足りなければ不合格', bad.ok && bad.pass === false);
  check('不合格なら学期はそのまま', d.term === 0, `term=${d.term}`);
  check('不合格なら学費は再請求される', d.tuitionPaid === false);
  check('不合格なら学期の日数が戻る', d.termDay === 1);

  // 習熟度を満たして再挑戦
  for (const id of G.SUBJECT_IDS) d.subjects[id] = 100;
  d.examAvailable = true;
  d.gold = G.World.tuitionAmount();
  G.World.payTuition();
  const good = G.World.takeExam();
  check('条件を満たせば合格', good.ok && good.pass === true, `score=${good && good.score}`);
  check('合格すると次の学期へ進む', d.term === 1, `term=${d.term}`);
  check('合格すると奨学金が入る', d.gold > 0);
}

/* ---------- 卒業 ---------- */
{
  const d = fresh();
  for (const id of G.SUBJECT_IDS) d.subjects[id] = 100;
  d.term = G.ACADEMY.TOTAL_TERMS - 1;
  d.examAvailable = true;
  d.gold = 100000;
  G.World.payTuition();
  const r = G.World.takeExam();
  check('最終学期に合格すると卒業する', r.graduated === true);
  check('卒業で魔王領が解禁される', d.demon.unlocked === true);
  check('卒業で聖剣を受け取る', G.State.countItem('excalibur') === 1);
  check('卒業で勇者の証を受け取る', G.State.countItem('hero_proof') === 1);
  check('卒業後は授業を受けられない', G.World.takeLesson('magic_theory').ok === false);
}

/* ---------- ギルドの昇格 ---------- */
{
  const d = fresh();
  G.World.registerGuild();
  check('登録すると依頼を受けられる', G.World.availableQuests().length > 0);
  check('二重登録はできない', G.World.registerGuild().ok === false);

  // 件数だけ満たしてもレベルが足りなければ昇格できない
  d.guild.totalClears = 99;
  check('レベルが足りなければ昇格できない', G.World.promotionInfo().ok === false);
  while (d.player.level < G.RANKS[1].minLv) G.Char.levelUp(d.player);
  check('件数とレベルを満たせば昇格試験を受けられる', G.World.promotionInfo().ok === true);

  // 逆に、レベルだけ高くても件数が足りなければ不可
  d.guild.totalClears = 0;
  check('件数が足りなければ昇格できない', G.World.promotionInfo().ok === false);
}

/* ---------- 店 ---------- */
{
  const d = fresh();
  d.gold = 1000;
  check('所持金が足りなければ買えない', G.World.buy('elixir').ok === false);
  check('買えば所持品が増える', G.World.buy('herb').ok && G.State.countItem('herb') === 4);
  check('買うと所持金が減る', d.gold === 1000 - G.ITEMS.herb.price, `gold=${d.gold}`);

  const before = d.gold;
  const sold = G.World.sell('herb');
  check('売ると所持金が増える', sold.ok && d.gold === before + G.World.sellPrice('herb'));

  // 装備中の最後の1つは売れない
  G.State.addItem('bronze_sword');
  G.Char.equipItem(d.player, 'bronze_sword');
  check('装備中の品は売れない', G.World.sell('bronze_sword').ok === false);
  G.State.addItem('bronze_sword');
  check('予備があれば売れる', G.World.sell('bronze_sword').ok === true);
  check('売っても装備は外れない', d.player.equip.weapon === 'bronze_sword');

  // 階級が上がると品揃えが増える
  const low = G.World.shopStock('weapon').length;
  d.guild.rank = 6;
  check('階級が上がると品揃えが増える', G.World.shopStock('weapon').length > low);
}

/* ---------- 道具の使用 ---------- */
{
  const d = fresh();
  const p = d.player;
  p.hp = 1;
  G.State.addItem('potion');
  check('戦闘外でHPを回復できる', G.World.useItemOutside('potion', p.key).ok && p.hp > 1);
  check('使うと所持品から減る', G.State.countItem('potion') === 0);

  p.hp = G.Char.maxHp(p);
  G.State.addItem('potion');
  check('満タンなら回復薬は使えない', G.World.useItemOutside('potion', p.key).ok === false);
  check('使えなければ所持品は減らない', G.State.countItem('potion') === 1);

  // 能力を永続的に上げる品
  const atkBefore = G.Char.derived(p).atk;
  G.State.addItem('tonic_atk');
  check('力の水で腕力が上がる',
    G.World.useItemOutside('tonic_atk', p.key).ok && G.Char.derived(p).atk === atkBefore + 3);

  // 戦闘不能の相手には不死鳥の尾だけが効く
  p.hp = 0;
  G.State.addItem('potion'); G.State.addItem('phoenix_tail');
  check('戦闘不能には回復薬が効かない', G.World.useItemOutside('potion', p.key).ok === false);
  check('不死鳥の尾で復活する', G.World.useItemOutside('phoenix_tail', p.key).ok && p.hp > 0);
  check('煙玉は戦闘外では使えない',
    (G.State.addItem('smoke'), G.World.useItemOutside('smoke', p.key).ok === false));
}

/* ---------- 全滅 ---------- */
{
  const d = fresh();
  d.gold = 1000;
  d.ap = 3;
  for (const c of d.party) c.hp = 0;
  const r = G.World.onDefeat();
  check('全滅で所持金の2割を失う', d.gold === 800 && r.lost === 200, `gold=${d.gold}`);
  check('全滅でその日は行動できなくなる', d.ap === 0);
  check('全滅しても回復して再開できる', d.party.every(c => c.hp > 0));
  const day = d.day;
  G.World.endDay(false);
  check('全滅処理では日付を進めない（呼び出し側が進める）', d.day === day + 1, `day=${d.day}`);
}

/* ---------- 魔王城の階層 ---------- */
{
  const d = fresh();
  G.World.clearFloor(0);
  G.World.clearFloor(1);
  check('順に攻略すると先へ進む', d.demon.floor === 2, `floor=${d.demon.floor}`);
  G.World.clearFloor(0);
  check('踏破済みを再攻略しても先へは進まない', d.demon.floor === 2, `floor=${d.demon.floor}`);
  check('踏破記録が重複しない', d.demon.cleared.length === 2, JSON.stringify(d.demon.cleared));
}

/* ---------- 難易度 ---------- */
{
  const hp = key => {
    fresh(key);
    return G.Battle.init(['orc']).enemies[0].maxHp;
  };
  check('やさしいは敵が弱い', hp('easy') < hp('normal'));
  check('むずかしいは敵が強い', hp('hard') > hp('normal'));
  fresh('bogus');
  check('不正な難易度はふつうに落ちる', G.State.d.difficulty === 'normal');
}

/* ---------- セーブデータの復元 ---------- */
{
  const d = fresh();
  G.State.recruit('riina');
  G.Char.gainExp(d.player, 5000);
  d.gold = 4321;
  G.State.save();
  const lv = d.player.level;
  G.State.data = null;
  check('セーブを読み込める', G.State.load() === true);
  check('レベルが復元される', G.State.d.player.level === lv);
  check('所持金が復元される', G.State.d.gold === 4321);
  check('主人公とパーティ先頭が同一の参照', G.State.d.party[0] === G.State.d.player);
  check('仲間も復元される', G.State.d.party.length === 2);

  // 壊れたセーブでも落ちない
  G.State.data = G.State.migrate({ player: G.Char.create({ key: 'player', name: '壊', isPlayer: true }) });
  check('欠けたセーブを補正できる',
    !!G.State.d.subjects && !!G.State.d.guild && Array.isArray(G.State.d.party));
  G.State.data.player.jobId = '存在しない職';
  G.State.data = G.State.migrate(G.State.data);
  check('不正なジョブは村人に戻す', G.State.d.player.jobId === 'villager');
}

console.log(`検証項目 ${pass + fails.length} 件中 ${pass} 件が成功`);
if (fails.length) {
  console.log('\n❌ 失敗:\n' + fails.map(f => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log('✅ すべて成功');
