/* ===== 画面に出す文言（日本語） =====
 * コードの中に直接書かず、ここにまとめる。
 * 取り出しかたは src/core/text.js（G.T）を見てください。
 *
 * キーの付けかた：
 *   common.*  … どの画面でも使う共通の語（ボタンなど）
 *   title.*   … タイトル画面
 *   画面ごとに接頭辞を分け、同じ語は common に置いて重複させない。
 *
 * 差し込む値は {name} のように書く。
 *   'title.diff.stats': '敵のHP {hp}% ／ 攻撃力 {atk}%'
 *
 * 英語を足すときは、このファイルを複製して strings.en.js を作り、
 * G.STRINGS.en に同じキーで英語を入れる。
 * 訳が無いキーは日本語のまま出るので、途中まででも動きます。
 *
 * ★ ここはデータだけを置く場所です。処理（関数）は書かないでください。
 */
window.G = window.G || {};
G.STRINGS = G.STRINGS || {};

G.STRINGS.ja = {

  /* ---------- 共通 ---------- */
  'common.cancel':   'やめる',
  'common.close':    '閉じる',
  'common.ok':       'わかった',
  'common.yes':      'はい',
  'common.back':     'もどる',

  /* ---------- タイトル画面 ---------- */
  'title.logo':      '転生魔法学院譚',
  'title.sub':       '〜 村人から始まる魔王討伐 〜',
  'title.continue':  '▶ つづきから',
  'title.new':       '✦ はじめから',
  'title.about':     'このゲームについて',
  'title.loadFail':  'セーブデータを読み込めませんでした',

  /* 上書き確認 */
  'title.overwrite.title': '新しく始める',
  'title.overwrite.body':  '<p>既存のセーブデータは上書きされます。よろしいですか？</p>',
  'title.overwrite.ok':    '始める',

  /* 名前を決める */
  'title.name.default': 'アルト',
  'title.name.title':   '名前をつけてください',
  'title.name.lead':    '転生した後の、あなたの名前です。',
  'title.name.ok':      'この名前で始める',

  /* 難易度を決める */
  'title.sex.title': '主人公の姿',
  'title.sex.lead': 'どちらの姿で旅を始めますか。あとから変えることはできません。',
  'title.sex.m': '少年',
  'title.sex.f': '少女',
  'title.diff.title':  '難易度を選んでください',
  'title.diff.lead':   '敵の強さが変わります。あとから変更はできません。',
  'title.diff.stats':  '敵のHP {hp}% ／ 攻撃力 {atk}%',
  'title.diff.pick':   '選ぶ',
  'title.diff.ok':     'ふつうで始める',

  /* 遊びかたの説明 */
  'title.about.title': 'このゲームについて',
  'title.about.intro': '転生した主人公が魔法学院に通いながらレベルを上げ、冒険者ギルドで稼ぎ、やがて魔王に挑むRPGです。',
  'title.about.ap':    '<b class="gold">1日は3AP</b>。授業・自習・訓練・依頼で消費します。使い切ったら休んで翌日へ。',
  'title.about.exam':  '<b class="gold">15日ごとに学期末試験</b>。全科目の平均習熟度が合格ラインを超えれば進級します。受験には学費の納入が必要です。',
  'title.about.job':   '<b class="gold">レベルが上がるとジョブを選べます</b>。村人から4系統に分かれ、Lv15・Lv30・Lv50でさらに分岐して全25職。選択は積み重なります。',
  'title.about.goal':  '<b class="gold">3年間で卒業</b>すると魔王領が解禁されます。',
  'title.about.save':  '進行状況はこの端末に自動保存されます。',

};
