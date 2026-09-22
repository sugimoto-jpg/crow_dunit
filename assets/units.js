/* ユニットマスタ
 * price  : 標準の月額（万円）
 * months : 標準の支援期間（ヶ月）
 * members: 標準の稼働人数（組織図・総稼働リソースに使用）
 * short  : 組織図に表示する短縮名
 * items  : 実施内容・提供機能
 */
window.UNIT_MASTER = [
  {
    key: 'sales-support', name: '営業支援ユニット', short: '営業支援',
    price: 20, months: 13, members: 4,
    items: [
      '営業戦略の立案',
      'アプローチリスト作成',
      '電話/メール/フォーム台本作成',
      '営業システムの提供',
      '電話200件/月',
      'オートフォーム機能10,000件/月',
      'リストDL60,000件',
      '決裁者マッチングプラットフォーム'
    ]
  },
  {
    key: 'sales', name: 'セールスユニット', short: 'セールス',
    price: 10, months: 13, members: 2,
    items: ['商談台本作成', '料金表作成', '営業研修', 'オンライン商談']
  },
  {
    key: 'crapro', name: 'クラプロユニット', short: 'クラプロ',
    price: 20, months: 13, members: 4,
    items: [
      'Webマーケティング戦略立案',
      'HP・LP・ECサイト作成',
      'SEO・MEO対策',
      'SNS制作運用',
      'メルマガ'
    ]
  },
  {
    key: 'productivity', name: '生産性向上支援ユニット', short: '生産性向上',
    price: 12.5, months: 15, members: 6,
    items: [
      '組織図作成',
      'ワークフローマニュアル作成',
      '業務委託書作成',
      '報酬のアドバイザリー',
      '求人執筆',
      'スカウト配信',
      '書類選考',
      '1次面接',
      '面接フィードバック'
    ]
  },
  {
    key: 'management', name: 'マネジメント代行ユニット', short: 'マネジメント',
    price: 17.5, months: 15, members: 4,
    items: ['運用のマネジメント代行', 'ワークフローマニュアル改善']
  },
  {
    key: 'fieldwork', name: 'フィールドワークユニット', short: 'フィールドワーク',
    price: 10, months: 13, members: 42000,
    items: ['現場業務マニュアル作成', '47都道府県42,000人現地スタッフ']
  },
  {
    key: 'sales-system', name: '営業システムの提供', short: '営業システム',
    price: 15, months: 13, members: 2,
    items: [
      '決裁権お持ちの経営者との直面談20件',
      'フォームアプローチ2万件',
      '営業資料作成',
      'Webページ作成'
    ]
  },
  {
    key: 'hr', name: 'HRユニット', short: 'HR',
    price: 15, months: 13, members: 4,
    items: [
      '母集団形成',
      '求人SNS、HP、LP作成',
      '求人ライティング',
      'オンライン面接',
      '退職防止策',
      '人事評価制度',
      '各種人事労務書作成'
    ]
  },
  {
    key: 'media', name: 'メディアユニット', short: 'メディア',
    price: 10, months: 13, members: 2,
    items: ['For Japan出演', 'BS放送＋TVer配信', '公式SNSでの切り抜き配信']
  },
  {
    key: 'secretary', name: '秘書ユニット', short: '秘書',
    price: 10, months: 13, members: 2,
    items: [
      '役員秘書',
      '営業事務',
      '各種連絡業務',
      'リサーチ業務',
      '法務',
      'マニュアル・カリキュラム作成',
      '月次レポート作成'
    ]
  },
  {
    key: 'ai', name: 'AIユニット', short: 'AI',
    price: 15, months: 13, members: 3,
    items: [
      'フレームワーク構築',
      'AIツールの選定',
      'AIオリエンテーション',
      'ワークフロー構築',
      'データ整理',
      'マニュアル・カリキュラム作成'
    ]
  },
  {
    key: 'backoffice', name: 'バックオフィスユニット', short: 'バックオフィス',
    price: 15, months: 13, members: 4,
    items: [
      'ワークフロー構築',
      '労務業務',
      '経理',
      '採用事務',
      '営業事務',
      'コスト管理',
      '見積もり作成',
      '月次レポート作成',
      'マニュアル・カリキュラム作成'
    ]
  },
  {
    key: 'cfo', name: 'CFOユニット', short: 'CFO',
    price: 20, months: 13, members: 2,
    items: [
      '財務支援',
      '出口戦略の策定',
      '月次決算化',
      '試算表策定',
      '事業計画策定',
      'ビジネスマッチング',
      '業務支援',
      'IPO支援',
      'M＆A支援',
      '後継者支援',
      'マニュアル・カリキュラム作成'
    ]
  }
];
