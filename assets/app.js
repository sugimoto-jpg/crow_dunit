/* 特別料金表ビルダー ------------------------------------------------------- */
(function () {
  'use strict';

  var STORE = 'tokubetsu-ryokin-v1';
  var PLAN_KEYS = ['A', 'B', 'C', 'D'];

  /* ---------- 初期値 ---------- */
  function defaultPlan(key) {
    var d = {
      A: {
                units: ['productivity', 'management', 'fieldwork'], unitMonths: 13, normalMonthly: 120, recommended: true
      },
      B: {
                units: ['productivity', 'management'], unitMonths: 15, normalMonthly: 80, recommended: false
      },
      C: {
                units: ['productivity'], unitMonths: 15, normalMonthly: 40, recommended: false
      },
      D: {
                units: [], normalMonthly: '', recommended: false
      }
    }[key];
    return {
      enabled: key !== 'D',
      label: 'プラン' + key,
      nickname: '',
      structureTop: '',
      structureNote: '',
      unitsCaption: '',
      summary: '',
      recommended: d.recommended,
      normalMonthly: d.normalMonthly,
      normalMonths: 13,
      monthly: '', months: '', total: '', lumpSum: '',
      units: d.units.map(function (k) {
        var m = master(k);
        return { key: k, price: m.price, months: d.unitMonths || m.months, members: m.members };
      })
    };
  }

  function defaults() {
    var s = {
      meta: {
        badge: '期首限定・特別営業推進パートナーシップ',
        company: '', contact: '',
        planTitle: '営業組織構築 特別料金ご提案書',
        subtitle: '自社雇用リスクを極小化し、即戦力チームで成果を最大化する特別プラン',
        deadline: '', startPeriod: '',
        provider: '株式会社アイドマ・ホールディングス',
        taxNote: '※表記の金額はすべて税抜き価格です',
        lead: '通常は月額40万円〜の包括サポートを、御社の事業拡大に合わせスモールスタート可能な特別枠として設計しました。\n採用費や教育期間、退職リスクを負うことなく、初月から複数名規模の即戦力プロチームが稼働する盤石な体制を提供します。',
        scopeLabel: '専用枠',
        closing: '事業成長を強固な組織力で支え続けます'
      },
      basic: {
        title: '料金プラン',
        unitNote: '1ユニット分の料金表です',
        note: '貴社には、じっくり関係を築く「通常プラン」を推奨いたします。',
        badge: '推奨',
        recommend: 1,
        rows: [
          { name: 'システムプラン', months: 13, price: 25 },
          { name: '通常プラン', months: 13, price: 40 },
          { name: '通常マルチチャネル', months: 13, price: 60 },
          { name: '快速プラン', months: 7, price: 80 },
          { name: '特急プラン', months: 4, price: 150 }
        ]
      },
      hire: {
        recruit: 150, salary: 314, side: 100,
        risks: '教育・育成の工数コスト|戦力化までに既存社員の業務時間が大幅に奪われる\n成果創出の不確実性|多額の投資を行っても期待通りの成果が出るかは未知数\n早期退職・離職リスク|投資回収前に退職された場合、採用・教育費が完全損失に\n労務管理・雇用維持トラブル|業績に左右されず給与支払い義務と管理負担が継続'
      },
      roadmap: [
        { title: 'お申込み・契約締結', period: '', desc: '特別条件での枠確保とお手続きを迅速に完了します。', foot: '電子契約対応' },
        { title: 'キックオフ・要件定義', period: '', desc: '専任チームと顔合わせを行い、ターゲットや方針を策定。', foot: '組織図・マニュアル着手' },
        { title: '実動チーム稼働開始', period: 'キックオフ後 順次開始', desc: 'スカウト配信・選考代行・フィールド実動を開始します。', foot: '最短スピード立ち上げ' },
        { title: '定例改善・成果創出', period: '週次／月次PDCA', desc: '数値検証を重ね、御社専任の最強体制を確立します。', foot: '継続的な成果最大化' }
      ],
      schema: 2,
      pages: { cover: true, background: true, cost: true, org: true, basic: true, table: true, details: true, roadmap: true, closing: true },
      unitMaster: JSON.parse(JSON.stringify(window.UNIT_MASTER)),
      plans: {}
    };
    state = s; /* master() から参照するため先に代入 */
    PLAN_KEYS.forEach(function (k) { s.plans[k] = defaultPlan(k); });
    return s;
  }

  /* ---------- 状態 ---------- */
  var state = { unitMaster: JSON.parse(JSON.stringify(window.UNIT_MASTER)) };

  function master(key) {
    var list = state.unitMaster || window.UNIT_MASTER;
    for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
    for (var j = 0; j < window.UNIT_MASTER.length; j++) if (window.UNIT_MASTER[j].key === key) return window.UNIT_MASTER[j];
    return { key: key, name: key, short: key, price: 0, months: 13, members: 0, items: [] };
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(STORE); } catch (e) { }
    if (!raw) { defaults(); return; }
    try {
      var saved = JSON.parse(raw);
      var base = defaults();
      var prev = N(saved.schema);
      state = merge(base, saved);
      mergeMaster();
      migrateAutoText();
      if (prev < 2) { migrateRoadmap(); state.schema = 2; save(); }
    } catch (e) { defaults(); }
  }

  function merge(base, over) {
    if (Array.isArray(base)) return Array.isArray(over) ? over : base;
    if (base && typeof base === 'object' && over && typeof over === 'object') {
      var out = {};
      Object.keys(base).forEach(function (k) { out[k] = merge(base[k], over[k]); });
      Object.keys(over).forEach(function (k) { if (!(k in out)) out[k] = over[k]; });
      return out;
    }
    return over === undefined ? base : over;
  }

  /* 旧版で固定文だった文言は、初期文のままなら空にして自動生成に戻す */
  var LEGACY_TEXT = [
    '全国現場実行完結', 'マネジメント連動', '単独機能特化', 'ピンポイント支援',
    '管理から全国現地稼働までフルカバー', '運用管理代行＋基盤構築の2層体制',
    'マニュアル作成・採用基盤の構築', '必要な機能のみを厳選',
    '企画・採用・管理代行に加え、全国現地での実動まで全てを外部化できる最上位包括プランです。',
    '社内の管理負担をゼロにし、プロのマネージャーが実動部隊の品質と進捗を徹底コントロールします。',
    'ミニマムコストで採用マニュアルの標準化と優秀な人材の確保基盤を一気に構築します。',
    '課題が明確な領域にリソースを集中投下する、ピンポイント型の特別プランです。',
    'フルスペック実行支援', '組織構築＋運用マネジメント代行', '生産性向上・採用基盤構築', 'スモールスタート'
  ];
  function migrateAutoText() {
    PLAN_KEYS.forEach(function (k) {
      var p = state.plans[k];
      ['nickname', 'structureTop', 'structureNote', 'summary'].forEach(function (f) {
        if (LEGACY_TEXT.indexOf(p[f]) >= 0) p[f] = '';
      });
    });
  }

  /* 旧版は契約開始時期をSTEP03に出していた。初期文のままならSTEP02へ移す */
  function migrateRoadmap() {
    var r = state.roadmap;
    if (!r || r.length < 3) return;
    if (r[1].period === '契約後 即時実施') r[1].period = '';
    if (or(r[2].period, '') === '') r[2].period = 'キックオフ後 順次開始';
  }

  function mergeMaster() {
    if (!Array.isArray(state.unitMaster)) state.unitMaster = [];
    window.UNIT_MASTER.forEach(function (m) {
      var cur = null;
      state.unitMaster.forEach(function (u) { if (u.key === m.key) cur = u; });
      if (!cur) { state.unitMaster.push(JSON.parse(JSON.stringify(m))); return; }
      Object.keys(m).forEach(function (f) { if (cur[f] === undefined) cur[f] = m[f]; });
    });
  }

  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { } }

  /* ---------- ユーティリティ ---------- */
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nl2br(v) { return esc(v).replace(/\n/g, '<br>'); }
  function N(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function or(v, alt) { return (v == null || String(v).trim() === '') ? alt : v; }
  function num(v) { return N(v).toLocaleString('ja-JP', { maximumFractionDigits: 2 }); }
  function man(v) { return num(v) + '万円'; }

  function get(path) {
    return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, state);
  }
  function set(path, val) {
    var parts = path.split('.'), o = state;
    for (var i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = val;
  }

  /* ---------- 計算 ---------- */
  function autoMonthly(p) {
    return p.units.reduce(function (s, u) { return s + N(u.price); }, 0);
  }
  function autoMonths(p) {
    var a = p.units.map(function (u) { return N(u.months); }).filter(function (x) { return x > 0; });
    return a.length ? Math.max.apply(null, a) : 13;
  }
  function monthly(p) { return p.monthly !== '' && p.monthly != null ? N(p.monthly) : autoMonthly(p); }
  function months(p) { return p.months !== '' && p.months != null ? N(p.months) : autoMonths(p); }
  function autoTotal(p) {
    if ((p.monthly !== '' && p.monthly != null) || (p.months !== '' && p.months != null) || !p.units.length) {
      return monthly(p) * months(p);
    }
    return p.units.reduce(function (s, u) { return s + N(u.price) * N(u.months); }, 0);
  }
  function total(p) { return p.total !== '' && p.total != null ? N(p.total) : autoTotal(p); }
  function autoLump(p) { return Math.max(0, total(p) - monthly(p)); }
  function lump(p) { return p.lumpSum !== '' && p.lumpSum != null ? N(p.lumpSum) : autoLump(p); }
  function normalTotal(p) { return N(p.normalMonthly) * N(p.normalMonths || 13); }
  function members(p) { return p.units.reduce(function (s, u) { return s + N(u.members); }, 0); }
  function mixedMonths(p) {
    var a = p.units.map(function (u) { return N(u.months); });
    return a.length > 1 && a.some(function (x) { return x !== a[0]; });
  }
  function hireTotal() { return N(state.hire.recruit) + N(state.hire.salary) + N(state.hire.side); }

  function livePlans() {
    return PLAN_KEYS.filter(function (k) { return state.plans[k].enabled; });
  }
  /* 安い順（料金表・組織図の並び） */
  function planOrderByPrice() {
    return livePlans().slice().sort(function (a, b) { return total(state.plans[a]) - total(state.plans[b]); });
  }
  /* 下位プラン（自プランのユニットを完全に含まれる側で最大のもの） */
  function basePlan(key) {
    var p = state.plans[key], keys = p.units.map(function (u) { return u.key; }), best = null;
    livePlans().forEach(function (k) {
      if (k === key) return;
      var q = state.plans[k], qk = q.units.map(function (u) { return u.key; });
      if (!qk.length || qk.length >= keys.length) return;
      var sub = qk.every(function (x) { return keys.indexOf(x) >= 0; });
      if (sub && (!best || state.plans[best].units.length < qk.length)) best = k;
    });
    return best;
  }
  function unitItems(p) {
    var out = [];
    p.units.forEach(function (u) {
      master(u.key).items.forEach(function (it) { if (out.indexOf(it) < 0) out.push(it); });
    });
    return out;
  }
  function unitRoles(p) {
    return p.units.map(function (u) {
      var m = master(u.key);
      return or(m.role, m.short);
    });
  }
  /* プラン副題（詳細ページの題名） */
  function autoNickname(p) {
    var r = unitRoles(p), n = r.length;
    if (!n) return '';
    if (n === 1) return r[0];
    if (n === 2) return r[0] + '＋' + r[1];
    if (p.units.some(function (u) { return u.key === 'fieldwork'; })) return 'フルスペック実行支援';
    return n + 'ユニット統合支援';
  }
  /* 体制キャッチ（組織図の小見出し） */
  function autoStructureTop(p) {
    var keys = p.units.map(function (u) { return u.key; });
    if (!keys.length) return '';
    if (keys.indexOf('fieldwork') >= 0) return '全国現場実行完結';
    if (keys.indexOf('management') >= 0) return 'マネジメント連動';
    if (keys.length === 1) return '単独機能特化';
    return keys.length + 'ユニット複合';
  }
  /* 組織図の補足（総稼働リソースの下）— 三角形の上から下の順に合わせる */
  function autoStructureNote(p) {
    var sorted = { units: p.units.slice().sort(function (a, b) { return N(a.members) - N(b.members); }) };
    var r = unitRoles(sorted), n = r.length;
    if (!n) return '';
    if (n === 1) return r[0] + 'に特化';
    if (n === 2) return r[0] + '＋' + r[1] + 'の2層体制';
    return r[0] + 'から' + r[n - 1] + 'までの' + n + '層体制';
  }
  /* プラン説明文（詳細ページ下部） */
  function autoSummary(key) {
    var p = state.plans[key];
    if (!p.units.length) return '';
    var base = basePlan(key), lead;
    if (base) {
      var bp = state.plans[base];
      var delta = p.units.filter(function (u) {
        return !bp.units.some(function (v) { return v.key === u.key; });
      });
      var dr = delta.map(function (u) { var m = master(u.key); return or(m.role, m.short); });
      var drTxt = dr.length <= 3 ? dr.join('・')
        : dr.slice(0, 2).join('・') + 'ほか' + (dr.length - 2) + '機能';
      lead = bp.label + 'の全支援機能に加え、' + drTxt + 'まで対応する上位プランです。';
    } else if (p.units.length === 1) {
      var m1 = master(p.units[0].key);
      lead = or(m1.desc, m1.name) + 'を一括でご提供します。';
    } else {
      var r = unitRoles(p);
      var rTxt = r.length <= 3 ? r.join('・')
        : r.slice(0, 3).join('・') + 'ほか' + (r.length - 3) + '機能';
      lead = rTxt + 'を一体で担う' + r.length + 'ユニット構成です。';
    }
    var keys = p.units.map(function (u) { return u.key; }), tail;
    if (keys.indexOf('fieldwork') >= 0) tail = '採用から現場実行までを一つの窓口で完結できます。';
    else if (keys.indexOf('management') >= 0) tail = '社内の管理負担をかけずに運用まで任せられます。';
    else tail = '専任チームが初月から稼働します。';
    return lead + tail;
  }
  function nicknameOf(p) { return or(p.nickname, '') !== '' ? p.nickname : autoNickname(p); }
  function structureTopOf(p) { return or(p.structureTop, '') !== '' ? p.structureTop : autoStructureTop(p); }
  function structureNoteOf(p) { return or(p.structureNote, '') !== '' ? p.structureNote : autoStructureNote(p); }
  function summaryOf(key) {
    var p = state.plans[key];
    return or(p.summary, '') !== '' ? p.summary : autoSummary(key);
  }

  function captionOf(p) {
    if (or(p.unitsCaption, '') !== '') return p.unitsCaption;
    if (!p.units.length) return '';
    if (p.units.length <= 2) {
      return p.units.map(function (u) {
        return master(u.key).short + num(u.members) + '名';
      }).join(' ＋ ');
    }
    return p.units.length + 'ユニット構成 / 総稼働 ' + num(members(p)) + '名';
  }

  /* ====================================================================== */
  /*  フォーム                                                              */
  /* ====================================================================== */
  function fText(path, label, ph, hint) {
    return '<div class="field"><label>' + esc(label) +
      (hint ? '<span class="hint">' + esc(hint) + '</span>' : '') + '</label>' +
      '<input type="text" data-path="' + path + '" data-type="text" value="' + esc(get(path)) +
      '" placeholder="' + esc(ph || '') + '"></div>';
  }
  function fArea(path, label, ph, hint) {
    return '<div class="field"><label>' + esc(label) +
      (hint ? '<span class="hint">' + esc(hint) + '</span>' : '') + '</label>' +
      '<textarea data-path="' + path + '" data-type="text" placeholder="' + esc(ph || '') + '">' +
      esc(get(path)) + '</textarea></div>';
  }
  function fNum(path, label, ph, hint) {
    return '<div class="field"><label>' + esc(label) +
      (hint ? '<span class="hint">' + esc(hint) + '</span>' : '') + '</label>' +
      '<input type="number" step="any" min="0" data-path="' + path + '" data-type="num" data-ph="' + path +
      '" value="' + esc(get(path)) + '" placeholder="' + esc(ph || '') + '"></div>';
  }
  function fChk(path, label, rerender) {
    return '<label class="chk"><input type="checkbox" data-path="' + path + '" data-type="bool"' +
      (get(path) ? ' checked' : '') + (rerender ? ' data-rerender="1"' : '') + '>' + esc(label) + '</label>';
  }

  function renderForm() {
    var h = [];

    /* 使い方 */
    h.push('<details class="sec"><summary>使い方 / PDFの作り方</summary><div class="sec-body">' +
      '<p class="note">1. 下の項目を入力すると、右のプレビューが自動で更新されます。<br>' +
      '2. 「PDF / 印刷」を押し、送信先を「PDFに保存」、用紙を横向き、<b>余白を「なし」</b>、' +
      '<b>「背景のグラフィック」にチェック</b>を入れて保存してください。<br>' +
      '3. 「HTMLで書き出し」を使うと、そのまま送れる1枚のHTMLファイルになります。<br>' +
      '4. 入力内容はこのブラウザに自動保存されます。別のPCで使う場合は「入力内容を保存」でJSONを持ち出してください。</p>' +
      '</div></details>');

    /* 基本情報 */
    h.push('<details class="sec" open><summary>1. 基本情報</summary><div class="sec-body">' +
      fText('meta.company', '会社名', '例）シンジホーム株式会社') +
      fText('meta.contact', '先方名', '例）山田 太郎（空欄可）') +
      fText('meta.planTitle', '特別プラン名', '例）営業組織構築 特別料金ご提案書') +
      '<div class="row">' +
      '<div class="field"><label>申込期日</label><input type="text" data-path="meta.deadline" data-type="text" value="' + esc(state.meta.deadline) + '" placeholder="例）9月1日〜9月18日"></div>' +
      '<div class="field"><label>契約開始時期</label><input type="text" data-path="meta.startPeriod" data-type="text" value="' + esc(state.meta.startPeriod) + '" placeholder="例）9月14日〜10月15日"></div>' +
      '</div>' +
      fText('meta.badge', '表紙リード（小見出し）', '例）期首限定・特別営業推進パートナーシップ') +
      fText('meta.subtitle', '表紙サブタイトル', '') +
      fText('meta.provider', '提案元（自社名）', '') +
      fArea('meta.lead', '特別提案の背景・趣旨', '', '2ページ目に表示') +
      fText('meta.closing', '最終ページのメッセージ', '') +
      fText('meta.taxNote', '注記', '') +
      '</div></details>');

    /* 自社雇用コスト */
    h.push('<details class="sec"><summary>2. 自社雇用コストの比較<span class="tag">合計 ' + man(hireTotal()) + '</span></summary><div class="sec-body">' +
      '<div class="row">' +
      '<div class="field"><label>採用経費<span class="hint">万円</span></label><input type="number" step="any" data-path="hire.recruit" data-type="num" value="' + esc(state.hire.recruit) + '"></div>' +
      '<div class="field"><label>給料報酬<span class="hint">万円</span></label><input type="number" step="any" data-path="hire.salary" data-type="num" value="' + esc(state.hire.salary) + '"></div>' +
      '<div class="field"><label>側面経費<span class="hint">万円</span></label><input type="number" step="any" data-path="hire.side" data-type="num" value="' + esc(state.hire.side) + '"></div>' +
      '</div>' +
      fArea('hire.risks', '雇用リスク項目', 'タイトル|説明 を1行ずつ', '「|」で区切り') +
      '</div></details>');

    /* 基本プラン表 */
    h.push(basicForm());

    /* プラン */
    PLAN_KEYS.forEach(function (k, i) { h.push(planForm(k, i)); });

    /* ロードマップ */
    var rm = ['<details class="sec"><summary>8. 導入までのフロー</summary><div class="sec-body">'];
    state.roadmap.forEach(function (s, i) {
      rm.push('<div class="urow"><div class="un">STEP 0' + (i + 1) + '</div>' +
        fText('roadmap.' + i + '.title', '項目名', '') +
        fText('roadmap.' + i + '.period', '時期', i === 0 ? '空欄なら申込期日' : (i === 1 ? '空欄なら契約開始時期' : '')) +
        fArea('roadmap.' + i + '.desc', '説明', '') +
        fText('roadmap.' + i + '.foot', '補足タグ', '') +
        '</div>');
    });
    rm.push('</div></details>');
    h.push(rm.join(''));

    /* ページ構成 */
    h.push('<details class="sec"><summary>9. ページ構成</summary><div class="sec-body">' +
      [['cover', '表紙'], ['background', '特別提案の背景'], ['cost', '自社雇用コスト'], ['org', 'プラン別 組織図'],
      ['basic', '基本プラン表'], ['table', '特別料金表'], ['details', 'プラン詳細'],
      ['roadmap', '導入フロー'], ['closing', '最終ページ']]
        .map(function (p) { return '<div style="margin-bottom:6px">' + fChk('pages.' + p[0], p[1], true) + '</div>'; }).join('') +
      '</div></details>');

    /* ユニットマスタ */
    var um = ['<details class="sec"><summary>10. ユニットマスタ編集<span class="tag">' + state.unitMaster.length + 'ユニット</span></summary><div class="sec-body">' +
      '<p class="note">標準の料金・期間・人数・実施内容を変更できます。ここでの変更は次に選択したときの初期値になります。</p>'];
    state.unitMaster.forEach(function (u, i) {
      um.push('<details class="sec" style="margin-bottom:8px"><summary>' + esc(u.name) + '</summary><div class="sec-body">' +
        '<div class="row">' +
        fText('unitMaster.' + i + '.name', 'ユニット名', '') +
        fText('unitMaster.' + i + '.short', '短縮名', '') +
        '</div>' +
        fText('unitMaster.' + i + '.role', '役割', '例）採用基盤の構築', '組織図の補足文に使用') +
        fArea('unitMaster.' + i + '.desc', '説明', '', 'プラン説明文に使用') +
        '<div class="row">' +
        '<div class="field"><label>標準月額<span class="hint">万円</span></label><input type="number" step="any" data-path="unitMaster.' + i + '.price" data-type="num" value="' + esc(u.price) + '"></div>' +
        '<div class="field"><label>標準期間<span class="hint">ヶ月</span></label><input type="number" step="any" data-path="unitMaster.' + i + '.months" data-type="num" value="' + esc(u.months) + '"></div>' +
        '<div class="field"><label>標準人数<span class="hint">名</span></label><input type="number" step="any" data-path="unitMaster.' + i + '.members" data-type="num" value="' + esc(u.members) + '"></div>' +
        '</div>' +
        '<div class="field"><label>実施内容<span class="hint">1行1項目</span></label><textarea data-path="unitMaster.' + i + '.items" data-type="lines" style="min-height:120px">' + esc(u.items.join('\n')) + '</textarea></div>' +
        '</div></details>');
    });
    um.push('</div></details>');
    h.push(um.join(''));

    document.getElementById('form').innerHTML = h.join('');
  }

  function basicForm() {
    var b = state.basic, rows = b.rows || [];
    var h = ['<details class="sec"><summary>3. 基本プラン表<span class="tag">' + rows.length + 'プラン</span></summary><div class="sec-body">' +
      '<p class="note">アイドマ・ホールディングスの基本プラン表（組織図の次のページ）です。</p>' +
      fText('basic.title', 'ページ見出し', '料金プラン') +
      fText('basic.unitNote', '単位の注記', '1ユニット分の料金表です', '見出しの下にバッジで表示・空欄で非表示') +
      fArea('basic.note', '前置きの一文', '', '推奨プランを変えたら文章も見直してください') +
      fText('basic.badge', '推奨バッジの文字', '推奨') +
      '<div class="field"><label>プラン<span class="hint">推奨したいプランを選択</span></label>'];
    rows.forEach(function (r, i) {
      var base = 'basic.rows.' + i + '.';
      h.push('<div class="urow"><div class="un">' +
        '<label class="chk" style="font-size:11px;gap:5px"><input type="radio" name="bp-rec" data-act="basic-rec" data-i="' + i + '"' +
        (i === N(b.recommend) ? ' checked' : '') + '>推奨</label>' +
        '<span class="k">総額 ' + man(N(r.price) * N(r.months)) + '</span>' +
        '<button type="button" class="ghost mini-btn" data-act="basic-del" data-i="' + i + '">削除</button></div>' +
        '<div style="margin-bottom:6px"><span class="mini">プラン名</span>' +
        '<input type="text" data-path="' + base + 'name" data-type="text" value="' + esc(r.name) + '"></div>' +
        '<div class="row">' +
        '<div><span class="mini">月額（万円）</span><input type="number" step="any" min="0" data-path="' + base + 'price" data-type="num" value="' + esc(r.price) + '"></div>' +
        '<div><span class="mini">期間（ヶ月）</span><input type="number" step="any" min="0" data-path="' + base + 'months" data-type="num" value="' + esc(r.months) + '"></div>' +
        '</div></div>');
    });
    h.push('<button type="button" class="ghost" data-act="basic-add">＋ プランを追加</button>');
    h.push('<label class="chk" style="margin-top:10px"><input type="radio" name="bp-rec" data-act="basic-rec" data-i="-1"' +
      (N(b.recommend) < 0 ? ' checked' : '') + '>推奨なし（全プランを同じ体裁で表示）</label>');
    h.push('</div></div></details>');
    return h.join('');
  }

  function planForm(k, i) {
    var p = state.plans[k], n = i + 4;
    var h = ['<details class="sec"' + (p.enabled ? ' open' : '') + '><summary>' + n + '. ' + esc(p.label) +
      '<span class="tag">' + (p.enabled ? man(monthly(p)) + ' × ' + num(months(p)) + 'ヶ月' : '未使用') + '</span></summary>' +
      '<div class="sec-body' + (p.enabled ? '' : ' plan-off') + '">'];

    h.push('<div style="margin-bottom:10px">' + fChk('plans.' + k + '.enabled', 'このプランを料金表に表示する', true) +
      (k === 'D' ? '<p class="note">Dプランを活用しない場合はチェックを外してください（料金表に一切表示されません）。</p>' : '') +
      '</div>');

    h.push(fText('plans.' + k + '.label', 'プラン表示名', 'プラン' + k, '料金表・組織図に出る名前'));

    /* ユニット選択 */
    h.push('<div class="field"><label>このプランに入れるユニット</label><div class="unit-pick">');
    state.unitMaster.forEach(function (u) {
      var on = p.units.some(function (x) { return x.key === u.key; });
      h.push('<label><input type="checkbox" data-plan="' + k + '" data-unit="' + u.key + '"' + (on ? ' checked' : '') + '>' + esc(u.name.replace('ユニット', '')) + '</label>');
    });
    h.push('</div></div>');

    /* ユニットごとの料金・期間 */
    if (!p.units.length) {
      h.push('<p class="empty">ユニットを選択すると、料金と支援期間を入力できます。</p>');
    } else {
      p.units.forEach(function (u, ui) {
        var base = 'plans.' + k + '.units.' + ui + '.';
        h.push('<div class="urow"><div class="un">' + esc(master(u.key).name) +
          '<span class="k">' + master(u.key).items.length + '項目</span></div>' +
          '<div class="row">' +
          '<div><span class="mini">料金（万円/月）</span><input type="number" step="any" min="0" data-path="' + base + 'price" data-type="num" value="' + esc(u.price) + '"></div>' +
          '<div><span class="mini">支援期間（ヶ月）</span><input type="number" step="any" min="0" data-path="' + base + 'months" data-type="num" value="' + esc(u.months) + '"></div>' +
          '<div><span class="mini">人数（名）</span><input type="number" step="any" min="0" data-path="' + base + 'members" data-type="num" value="' + esc(u.members) + '"></div>' +
          '</div></div>');
      });
    }

    /* 価格設定 */
    h.push('<div class="row">' +
      '<div class="field"><label>通常月額<span class="hint">万円・空欄で非表示</span></label><input type="number" step="any" data-path="plans.' + k + '.normalMonthly" data-type="num" value="' + esc(p.normalMonthly) + '"></div>' +
      '<div class="field"><label>通常期間<span class="hint">ヶ月</span></label><input type="number" step="any" data-path="plans.' + k + '.normalMonths" data-type="num" value="' + esc(p.normalMonths) + '"></div>' +
      '</div>');
    h.push('<div class="row">' +
      fNum('plans.' + k + '.monthly', '特別月額', '自動: ' + num(autoMonthly(p)), '万円') +
      fNum('plans.' + k + '.months', '支援期間', '自動: ' + num(autoMonths(p)), 'ヶ月') +
      '</div>');
    h.push('<div class="row">' +
      fNum('plans.' + k + '.total', '分割総額', '自動: ' + num(autoTotal(p)), '万円') +
      fNum('plans.' + k + '.lumpSum', '一括特別価格', '自動: ' + num(autoLump(p)), '万円') +
      '</div>');
    h.push('<div class="calc" data-calc="' + k + '">' + calcHtml(k) + '</div>');

    /* 文言 */
    h.push('<div style="margin-top:10px">' +
      '<p class="note">下の5項目は選んだユニットから自動で作成されます。文章を変えたいときだけ入力してください（入力すると自動生成より優先されます）。</p>' +
      fText('plans.' + k + '.nickname', 'プラン副題', '自動: ' + (autoNickname(p) || '—'), '自動生成・詳細ページの題名') +
      fText('plans.' + k + '.structureTop', '体制キャッチ', '自動: ' + (autoStructureTop(p) || '—'), '自動生成') +
      fText('plans.' + k + '.unitsCaption', '構成メモ', '自動: ' + (captionOf(p) || '—'), '自動生成') +
      fText('plans.' + k + '.structureNote', '組織図の補足', '自動: ' + (autoStructureNote(p) || '—'), '自動生成') +
      fArea('plans.' + k + '.summary', 'プラン説明文', autoSummary(k) || '', '自動生成') +
      '<div style="margin-top:4px">' + fChk('plans.' + k + '.recommended', 'おすすめプランとして強調表示', false) + '</div>' +
      '</div>');

    h.push('</div></details>');
    return h.join('');
  }

  function calcHtml(k) {
    var p = state.plans[k];
    if (!p.enabled) return 'このプランは表示されません。';
    var out = '特別月額 <b>' + man(monthly(p)) + '</b> × <b>' + num(months(p)) + 'ヶ月</b>' +
      '／分割総額 <b>' + man(total(p)) + '</b><br>' +
      '一括特別価格 <b>' + man(lump(p)) + '</b>（' + man(Math.max(0, total(p) - lump(p))) + ' お得）<br>' +
      '総稼働リソース <b>' + num(members(p)) + '名</b>／実施内容 <b>' + unitItems(p).length + '項目</b>';
    if (N(p.normalMonthly) > 0) {
      out += '<br>通常価格 ' + man(N(p.normalMonthly)) + ' × ' + num(p.normalMonths || 13) + 'ヶ月 = ' + man(normalTotal(p));
    }
    if (mixedMonths(p)) out += '<br>※ユニットごとに支援期間が異なります（総額は各期間で計算）';
    return out;
  }

  function refreshCalc() {
    PLAN_KEYS.forEach(function (k) {
      var box = document.querySelector('[data-calc="' + k + '"]');
      if (box) box.innerHTML = calcHtml(k);
      var p = state.plans[k], phs = {
        monthly: autoMonthly(p), months: autoMonths(p), total: autoTotal(p), lumpSum: autoLump(p)
      };
      Object.keys(phs).forEach(function (f) {
        var el = document.querySelector('[data-ph="plans.' + k + '.' + f + '"]');
        if (el) el.placeholder = '自動: ' + num(phs[f]);
      });
    });
  }

  /* ====================================================================== */
  /*  スライド                                                              */
  /* ====================================================================== */
  function head(eyebrow, title) {
    return '<header class="s-head"><p class="eyebrow">' + esc(eyebrow) + '</p><h2>' + esc(title) + '</h2>' +
      '<span class="tax">' + esc(state.meta.taxNote) + '</span></header>';
  }
  function clientName() {
    var c = or(state.meta.company, '御社名'), n = or(state.meta.contact, '');
    return n ? c + ' ' + n + ' 様' : c + ' 様';
  }

  function slideCover() {
    var m = state.meta, meta = [];
    if (or(m.deadline, '')) meta.push('申込期日: ' + m.deadline);
    if (or(m.startPeriod, '')) meta.push('開始時期: ' + m.startPeriod);
    if (or(m.provider, '')) meta.push(m.provider);
    return '<section class="slide s-cover"><div>' +
      (or(m.badge, '') ? '<p class="cover-badge">' + esc(m.badge) + '</p>' : '') +
      '<h1 class="cover-client">' + esc(clientName()) + '</h1>' +
      '<h2 class="cover-title">' + esc(or(m.planTitle, '特別料金ご提案書')) + '</h2>' +
      (or(m.subtitle, '') ? '<p class="cover-sub">' + esc(m.subtitle) + '</p>' : '') +
      '<div class="cover-rule"></div>' +
      '<div class="cover-meta">' + meta.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' +
      '</div></section>';
  }

  function infoCard(no, label, value, desc) {
    return '<div class="ic"><div class="no">' + no + '</div>' +
      '<div class="lb">' + esc(label) + '</div><div class="vl">' + esc(value) + '</div>' +
      '<div class="dsc">' + esc(desc) + '</div></div>';
  }

  function slideBackground() {
    var m = state.meta;
    return '<section class="slide">' + head('BACKGROUND & OBJECTIVE', '特別ご提案の背景と趣旨') +
      '<div class="s-body bg-body">' +
      '<p class="lead">' + nl2br(or(m.lead, '')) + '</p>' +
      '<div class="info3">' +
      infoCard('01', 'お申込み受付期間', or(m.deadline, '個別にご案内'), 'この期間内のご契約に限り、特別価格を適用いたします。') +
      infoCard('02', '稼働開始スケジュール', or(m.startPeriod, '個別にご案内'), 'ご契約後すぐにキックオフ、最短で実動チームが稼働します。') +
      infoCard('03', '適用対象', or(m.company, '御社') + ' ' + or(m.scopeLabel, '専用枠'), '本ご提案の条件は、' + or(m.company, '御社') + '専用にご用意したものです。') +
      '</div>' +
      '<div class="pills"><span class="pill">特別枠のご提供</span><span class="pill alt">雇用リスクの極小化</span></div>' +
      '</div></section>';
  }

  function slideCost() {
    var h = state.hire, t = hireTotal();
    var risks = String(h.risks || '').split('\n').filter(function (l) { return l.trim(); }).map(function (l) {
      var p = l.split('|');
      return '<div class="risk"><div class="rt">' + esc(p[0].trim()) + '</div>' +
        (p[1] ? '<div class="rd">' + esc(p[1].trim()) + '</div>' : '') + '</div>';
    }).join('');
    return '<section class="slide">' + head('COST & RISK ANALYSIS', '自社で社員を1名採用・雇用する場合の実態') +
      '<div class="s-body">' +
      '<div class="card warn" style="flex:1">' +
      '<div class="cost-total">社員1名あたりの年間総コスト</div>' +
      '<div class="cost-num">約' + num(t) + '万円</div>' +
      '<p class="cost-desc">固定給与に加え、初期採用費や社会保険・インフラ費が必須。<br>月額換算で約' + num(Math.round(t / 12 * 10) / 10) + '万円の固定負担となります。</p>' +
      '<div class="cost-break">' +
      '<div><span>採用経費（求人広告・エージェント）</span><b>' + man(h.recruit) + '</b></div>' +
      '<div><span>給料報酬（基本給・賞与）</span><b>' + man(h.salary) + '</b></div>' +
      '<div><span>側面経費（社会保険・PC・交通費）</span><b>' + man(h.side) + '</b></div>' +
      '</div></div>' +
      '<div class="card" style="flex:1"><h3 class="card-ttl">見落とされがちな雇用リスク</h3>' +
      '<div class="risks">' + risks + '</div></div>' +
      '</div></section>';
  }

  function triangle(p) {
    if (!p.units.length) return '<div class="tri"><span class="tri-empty">ユニット未設定</span></div>';
    var us = p.units.slice().sort(function (a, b) { return N(a.members) - N(b.members); });
    var n = us.length;
    var hgt = n <= 3 ? 42 : (n === 4 ? 36 : (n === 5 ? 31 : (n <= 7 ? 27 : 23)));
    var fs = n <= 5 ? 11.5 : (n <= 7 ? 10.5 : 9.5);
    return '<div class="tri" style="gap:' + (n > 6 ? 5 : 7) + 'px">' + us.map(function (u, i) {
      var w = n === 1 ? 70 : 48 + i * (92 - 48) / (n - 1);
      return '<div class="bar l' + (n === 1 ? 1 : Math.min(i, 5)) + '" style="width:' + w.toFixed(1) +
        '%;max-height:' + hgt + 'px;font-size:' + fs + 'px">' +
        esc(master(u.key).short) + ' ' + num(u.members) + '名</div>';
    }).join('') + '</div>';
  }

  function slideOrg() {
    var order = planOrderByPrice();
    if (!order.length) return '';
    return '<section class="slide">' + head('ORGANIZATION STRUCTURE', '導入プラン別 組織図（サポート体制の構造）') +
      '<div class="s-body"><div class="orgs" style="grid-template-columns:repeat(' + order.length + ',1fr);width:100%">' +
      order.map(function (k) {
        var p = state.plans[k];
        var top = structureTopOf(p), note = structureNoteOf(p);
        return '<div class="org' + (p.recommended ? ' hl' : '') + '">' +
          '<div class="oh">' + (top ? '<div class="os">' + esc(top) + '</div>' : '') +
          '<div class="on">' + esc(p.label) + ' 体制</div></div>' +
          triangle(p) +
          '<div class="of"><div class="r1">総稼働リソース: ' + num(members(p)) + '名</div>' +
          (note ? '<div class="r2">' + esc(note) + '</div>' : '') + '</div></div>';
      }).join('') + '</div></div></section>';
  }

  function slideBasic() {
    var b = state.basic, rows = b.rows || [];
    if (!rows.length) return '';
    var cards = rows.map(function (r, i) {
      var rec = i === N(b.recommend);
      return '<div class="bp-card' + (rec ? ' rec' : '') + '">' +
        (rec && or(b.badge, '') ? '<div class="bp-badge">' + esc(b.badge) + '</div>' : '') +
        '<div class="bp-name">' + esc(r.name) + '</div>' +
        '<div class="bp-mon">' + num(r.months) + 'ヶ月</div>' +
        '<div class="bp-price">' + man(r.price) + '</div>' +
        '<div class="bp-per">／月</div>' +
        '<div class="bp-total">総額 ' + man(N(r.price) * N(r.months)) + '</div>' +
        '</div>';
    }).join('');
    return '<section class="slide">' + head('STANDARD PRICE PLAN', or(b.title, '料金プラン')) +
      '<div class="s-body" style="flex-direction:column;gap:0">' +
      (or(b.unitNote, '') ? '<div class="bp-unit"><span>' + esc(b.unitNote) + '</span></div>' : '') +
      (or(b.note, '') ? '<p class="bp-note">' + nl2br(b.note) + '</p>' : '') +
      '<div class="bp-cards" style="grid-template-columns:repeat(' + rows.length + ',1fr)">' + cards + '</div>' +
      '</div></section>';
  }

  function tableBullets(k) {
    var p = state.plans[k], base = basePlan(k), out = [];
    if (base) {
      var bp = state.plans[base];
      out.push({ t: bp.label + 'の全支援機能', st: true });
      var delta = p.units.filter(function (u) {
        return !bp.units.some(function (v) { return v.key === u.key; });
      });
      var picks = [];
      if (delta.length && delta.length <= 2) {
        delta.forEach(function (u) { master(u.key).items.slice(0, 2).forEach(function (i) { picks.push(i); }); });
      } else {
        picks = delta.map(function (u) { return master(u.key).name; });
      }
      picks.slice(0, 3).forEach(function (t) { out.push({ t: t }); });
      return out;
    }
    if (p.units.length === 1) {
      return master(p.units[0].key).items.slice(0, 4).map(function (t) { return { t: t }; });
    }
    return p.units.slice(0, 4).map(function (u) { return { t: master(u.key).name }; });
  }

  function slideTable() {
    var order = planOrderByPrice();
    if (!order.length) return '';
    var t = hireTotal(), cols = order.length + 1;
    var self = '<div class="pcol self">' +
      '<div class="ph"><div class="pn">自社で社員1名雇用</div><div class="pu">一般的な中途採用</div></div>' +
      '<div class="pp"><div class="tt" style="font-size:11px;color:#93a1b2;font-weight:400">年間目安総額</div>' +
      '<div class="sp">約' + num(t) + '万円</div>' +
      '<div class="tt" style="font-weight:400;color:#6b7a8d;font-size:11px">月額換算: 約' + num(Math.round(t / 12 * 10) / 10) + '万円</div></div>' +
      '<ul class="pf"><li>採用費: ' + man(state.hire.recruit) + '</li><li>給料: ' + man(state.hire.salary) +
      '</li><li>側面経費: ' + man(state.hire.side) + '</li><li class="rk">※退職・教育リスク有</li></ul>' +
      '<div class="pl"><div class="ll">一括支払い設定</div><div class="lv" style="font-size:17px;color:#54637a">該当なし</div></div>' +
      '</div>';

    var plans = order.map(function (k) {
      var p = state.plans[k], nm = N(p.normalMonthly) > 0
        ? '<div class="nm">通常: ' + num(p.normalMonthly) + '万×' + num(p.normalMonths || 13) + 'ヶ月 (' + num(normalTotal(p)) + '万)</div>' : '';
      return '<div class="pcol' + (p.recommended ? ' hl' : '') + '">' +
        '<div class="ph"><div class="pn">' + esc(p.label) + '</div>' +
        (captionOf(p) ? '<div class="pu">' + esc(captionOf(p)) + '</div>' : '') + '</div>' +
        '<div class="pp">' + nm +
        '<div class="sp">' + num(monthly(p)) + '万×' + num(months(p)) + 'ヶ月</div>' +
        '<div class="tt">総額 ' + man(total(p)) + '</div></div>' +
        '<ul class="pf">' + tableBullets(k).map(function (b) {
          return '<li' + (b.st ? ' class="st"' : '') + '>' + esc(b.t) + '</li>';
        }).join('') + '</ul>' +
        '<div class="pl"><div class="ll">ご一括特別価格</div><div class="lv">' + man(lump(p)) + '</div>' +
        '<div class="ld">（' + man(Math.max(0, total(p) - lump(p))) + ' お得）</div></div>' +
        '</div>';
    }).join('');

    return '<section class="slide">' + head('SPECIAL PRICING TABLE', '【特別料金表】プラン別機能・価格比較') +
      '<div class="s-body"><div class="ptable' + (cols >= 5 ? ' c5' : '') +
      '" style="grid-template-columns:repeat(' + cols + ',1fr);width:100%">' + self + plans + '</div></div></section>';
  }

  function slideDetail(k) {
    var p = state.plans[k], items = unitItems(p), base = basePlan(k);
    var baseItems = base ? unitItems(state.plans[base]) : [];
    var deltaN = base ? items.filter(function (it) { return baseItems.indexOf(it) < 0; }).length : 0;
    var starOn = base && deltaN > 0 && deltaN <= 6;
    var nI = items.length, cls, colN, cap;
    if (nI <= 12) { cls = 'feats'; colN = 2; cap = 12; }
    else if (nI <= 18) { cls = 'feats sm'; colN = 2; cap = 18; }
    else if (nI <= 30) { cls = 'feats sm'; colN = 3; cap = 30; }
    else if (nI <= 45) { cls = 'feats xs'; colN = 3; cap = 45; }
    else { cls = 'feats xs'; colN = 4; cap = 60; }
    var rest = Math.max(0, nI - cap);
    var shown = rest ? items.slice(0, cap - 1) : items;
    var nm = N(p.normalMonthly) > 0
      ? '<div class="nm">通常: ' + num(p.normalMonthly) + '万円×' + num(p.normalMonths || 13) + 'ヶ月 (' + num(normalTotal(p)) + '万円)</div>' : '';
    var bk = p.units.length > 1 ? '<div class="ubk">' + p.units.map(function (u) {
      return '<div><span>' + esc(master(u.key).short) + '</span><span>' + num(u.price) + '万円 × ' + num(u.months) + 'ヶ月</span></div>';
    }).join('') + '</div>' : '';
    var showTri = p.units.length > 0 && p.units.length <= 6;

    return '<section class="slide">' +
      head('PLAN DETAILS', p.label + '：詳細' + (nicknameOf(p) ? '（' + nicknameOf(p) + '）' : '')) +
      '<div class="s-body">' +
      '<div class="card tint dl"><h3 class="card-ttl">' + esc(p.label) + (showTri ? ' 組織図' : ' 構成・特別価格') + '</h3>' +
      (showTri ? '<div class="dtri">' + triangle(p) + '</div>' : '') +
      '<div class="price-box">' + nm +
      '<div class="sp">特別月額: ' + num(monthly(p)) + '万円×' + num(months(p)) + 'ヶ月</div>' +
      '<div class="tt">分割総額: ' + man(total(p)) + '</div>' +
      '<div class="hr"></div>' +
      '<div class="lp">ご一括特別価格:<b>' + man(lump(p)) + '</b></div>' +
      bk + '</div></div>' +
      '<div class="card dr"><h3 class="card-ttl">' + esc(p.label) + ' 実施内容・提供機能（' + items.length + '項目）</h3>' +
      '<ul class="' + cls + '" style="grid-template-columns:repeat(' + colN + ',1fr)">' +
      shown.map(function (it) {
        var isNew = starOn && baseItems.indexOf(it) < 0;
        return '<li' + (isNew ? ' class="st"' : '') + '>' + esc(it) + '</li>';
      }).join('') + (rest ? '<li class="more">ほか ' + (rest + 1) + '項目</li>' : '') + '</ul>' +
      (summaryOf(k) ? '<div class="summary">' + nl2br(summaryOf(k)) + '</div>' : '') +
      '</div></div></section>';
  }

  function slideRoadmap() {
    var m = state.meta;
    return '<section class="slide">' + head('ONBOARDING ROADMAP', 'ご契約から稼働・成果創出までのフロー') +
      '<div class="s-body"><div class="steps" style="width:100%">' +
      state.roadmap.map(function (s, i) {
        var per = or(s.period, i === 0 ? or(m.deadline, '') : (i === 1 ? or(m.startPeriod, '') : ''));
        return '<div class="step' + (i === state.roadmap.length - 1 ? ' last' : '') + '">' +
          '<span class="sn">STEP 0' + (i + 1) + '</span>' +
          '<div class="st">' + esc(s.title) + '</div>' +
          (per ? '<div class="sp">' + esc(per) + '</div>' : '') +
          '<div class="sd">' + nl2br(s.desc) + '</div>' +
          (or(s.foot, '') ? '<div class="sf">' + esc(s.foot) + '</div>' : '') +
          '</div>';
      }).join('') + '</div></div></section>';
  }

  function slideClosing() {
    var m = state.meta;
    return '<section class="slide s-closing"><div>' +
      '<p class="cl-kicker">PARTNERSHIP FOR SUCCESS</p>' +
      '<h1>' + esc(clientName()) + 'の<br>' + esc(or(m.closing, '事業成長を支え続けます')) + '</h1>' +
      (or(m.deadline, '') ? '<div class="cl-dead">特別枠のお申込み期日は【 ' + esc(m.deadline) + ' 】までです</div>' : '') +
      '<div class="cl-foot"><span>担当コンサルタント直通窓口</span><span>' + esc(or(m.provider, '')) + '</span></div>' +
      '</div></section>';
  }

  function buildSlides() {
    var pg = state.pages, out = [];
    if (pg.cover) out.push(slideCover());
    if (pg.background) out.push(slideBackground());
    if (pg.cost) out.push(slideCost());
    if (pg.org) out.push(slideOrg());
    if (pg.basic) out.push(slideBasic());
    if (pg.table) out.push(slideTable());
    if (pg.details) PLAN_KEYS.forEach(function (k) { if (state.plans[k].enabled) out.push(slideDetail(k)); });
    if (pg.roadmap) out.push(slideRoadmap());
    if (pg.closing) out.push(slideClosing());
    return out.filter(function (s) { return s; });
  }


  /* ---------- はみ出し自動調整 ---------- */
  function moreRow(box, tag, label, n) {
    var el = box.querySelector(tag + '.more');
    if (!el) {
      el = document.createElement(tag === 'li' ? 'li' : 'div');
      el.className = 'more';
      box.appendChild(el);
    }
    el.textContent = 'ほか ' + n + label;
    return el;
  }
  function trimLast(box, tag, label) {
    var rows = [], i;
    for (i = 0; i < box.children.length; i++) {
      if (!box.children[i].classList.contains('more')) rows.push(box.children[i]);
    }
    if (rows.length <= 1) return false;
    var cur = box.querySelector('.more'), n = cur ? N(cur.getAttribute('data-n')) : 0;
    rows[rows.length - 1].remove();
    n += 1;
    var el = moreRow(box, tag, label, n);
    el.setAttribute('data-n', n);
    return true;
  }
  function fitBox(box, tag, label) {
    var guard = 0;
    while (box.scrollHeight > box.clientHeight + 1 && guard++ < 120) {
      if (!trimLast(box, tag, label)) break;
    }
  }
  function fitTri(tri) {
    var card = tri.closest('.dl'), guard = 0;
    /* 横方向: ラベルがバー幅を超える場合は文字を縮小 */
    Array.prototype.forEach.call(tri.querySelectorAll('.bar'), function (b) {
      var g = 0, fs = parseFloat(getComputedStyle(b).fontSize);
      while (b.scrollWidth > b.clientWidth + 1 && fs > 6.5 && g++ < 24) {
        fs -= 0.5; b.style.fontSize = fs + 'px';
      }
    });
    while (tri.scrollHeight > tri.clientHeight + 1 && guard++ < 60) {
      var ubk = card ? card.querySelector('.ubk') : null;
      if (ubk && trimLast(ubk, 'div', 'ユニット')) continue;
      var bars = tri.querySelectorAll('.bar');
      if (!bars.length) break;
      var fs = parseFloat(getComputedStyle(bars[0]).fontSize);
      if (fs <= 7.5) break;
      Array.prototype.forEach.call(bars, function (b) {
        b.style.fontSize = (fs - 0.5) + 'px';
        var mh = parseFloat(b.style.maxHeight) || 24;
        b.style.maxHeight = Math.max(11, mh - 1.5) + 'px';
      });
      var g = parseFloat(getComputedStyle(tri).rowGap || getComputedStyle(tri).gap) || 7;
      tri.style.gap = Math.max(2, g - 1) + 'px';
    }
  }
  function shrinkText(el, sel, floor) {
    var list = el.querySelectorAll(sel), guard = 0;
    if (!list.length) return;
    while (el.scrollHeight > el.clientHeight + 1 && guard++ < 40) {
      var changed = false;
      Array.prototype.forEach.call(list, function (t) {
        var fs = parseFloat(getComputedStyle(t).fontSize);
        if (fs > floor) { t.style.fontSize = Math.max(floor, fs - 1.5) + 'px'; changed = true; }
      });
      if (!changed) break;
    }
  }
  function fitSlide(el) {
    Array.prototype.forEach.call(el.querySelectorAll('.feats'), function (u) { fitBox(u, 'li', '項目'); });
    Array.prototype.forEach.call(el.querySelectorAll('.pf'), function (u) { fitBox(u, 'li', '項目'); });
    Array.prototype.forEach.call(el.querySelectorAll('.risks'), function (u) { fitBox(u, 'div', '件'); });
    Array.prototype.forEach.call(el.querySelectorAll('.ubk'), function (u) { fitBox(u, 'div', 'ユニット'); });
    Array.prototype.forEach.call(el.querySelectorAll('.tri'), function (u) { fitTri(u); });
    /* 最終手段: スライド全体がはみ出す場合は見出し・本文を縮小 */
    Array.prototype.forEach.call(el.querySelectorAll('.bp-price'), function (t) {
      var g = 0, fs = parseFloat(getComputedStyle(t).fontSize);
      while (t.scrollWidth > t.clientWidth + 1 && fs > 14 && g++ < 30) {
        fs -= 1; t.style.fontSize = fs + 'px';
      }
    });
    shrinkText(el, '.cover-client, .cover-title, .s-closing h1', 15);
    shrinkText(el, '.lead', 11);
    shrinkText(el, '.s-head h2', 17);
  }
  /* 計測用コンテナで実寸レイアウトを確定させてから書き出す */
  function fittedSlides() {
    var box = document.getElementById('measure');
    if (!box) return buildSlides();
    var out = buildSlides().map(function (html) {
      box.innerHTML = html;
      if (box.firstElementChild) fitSlide(box.firstElementChild);
      return box.innerHTML;
    });
    box.innerHTML = '';
    return out;
  }

  /* ---------- プレビュー ---------- */
  var zoom = 100;
  function renderPreview() {
    var wrap = document.getElementById('preview');
    var slides = fittedSlides();
    var avail = wrap.clientWidth - 48;
    var scale = Math.min(1, avail / 960) * (zoom / 100);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    wrap.innerHTML = slides.map(function (s, i) {
      return '<div class="stage" style="width:' + (960 * scale) + 'px;height:' + (540 * scale) + 'px">' +
        '<span class="pno">' + (i + 1) + ' / ' + slides.length + '</span>' +
        s.replace('<section class="slide', '<section style="transform:scale(' + scale + ');transform-origin:top left" class="slide') +
        '</div>';
    }).join('');
    refreshCalc();
  }
  function renderAll() { renderForm(); renderPreview(); }

  /* ---------- 入出力 ---------- */
  function fileName(ext) {
    var c = or(state.meta.company, '料金表').replace(/[\\/:*?"<>|]/g, '');
    return c + '_特別料金表.' + ext;
  }
  function download(text, name, mime) {
    var b = new Blob([text], { type: mime + ';charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportHtml() {
    var css = document.getElementById('slide-css').textContent;
    var body = fittedSlides().map(function (s) { return '<div class="stage">' + s + '</div>'; }).join('\n');
    download('<!doctype html>\n<html lang="ja"><head><meta charset="utf-8"><title>' +
      esc(clientName() + ' ' + or(state.meta.planTitle, '特別料金ご提案書')) + '</title><style>\n' +
      'body{margin:0;background:#eef1f5;display:flex;flex-direction:column;align-items:center;padding:24px 0;gap:24px}\n' +
      '.stage{box-shadow:0 4px 20px rgba(16,42,69,.16);width:960px;height:540px}\n' +
      '@media print{html,body{background:#fff;padding:0;gap:0;margin:0;display:block}\n' +
      '.stage{box-shadow:none;margin:0 auto;height:539px;overflow:hidden;break-after:auto;page-break-after:auto}\n' +
      '.stage+.stage{break-before:page;page-break-before:always}}\n' +
      css + '\n</style></head><body>\n' + body + '\n</body></html>', fileName('html'), 'text/html');
  }

  /* ---------- イベント ---------- */
  function onFieldChange(el) {
    var path = el.getAttribute('data-path'), type = el.getAttribute('data-type');
    if (!path) return;
    var v;
    if (type === 'bool') v = el.checked;
    else if (type === 'num') v = el.value === '' ? '' : N(el.value);
    else if (type === 'lines') v = el.value.split('\n').map(function (s) { return s.trim(); }).filter(function (s) { return s; });
    else v = el.value;
    set(path, v);
    save();
    if (el.getAttribute('data-rerender')) renderAll(); else renderPreview();
  }

  function onUnitToggle(el) {
    var k = el.getAttribute('data-plan'), key = el.getAttribute('data-unit'), p = state.plans[k];
    if (el.checked) {
      if (!p.units.some(function (u) { return u.key === key; })) {
        var m = master(key);
        p.units.push({ key: key, price: m.price, months: m.months, members: m.members });
        p.units.sort(function (a, b) {
          var oa = state.unitMaster.findIndex(function (u) { return u.key === a.key; });
          var ob = state.unitMaster.findIndex(function (u) { return u.key === b.key; });
          return oa - ob;
        });
      }
    } else {
      p.units = p.units.filter(function (u) { return u.key !== key; });
    }
    save(); renderAll();
  }

  function onAction(el) {
    var act = el.getAttribute('data-act'), i = parseInt(el.getAttribute('data-i'), 10);
    if (act === 'basic-add') {
      state.basic.rows.push({ name: '新しいプラン', months: 13, price: 0 });
    } else if (act === 'basic-del') {
      if (state.basic.rows.length <= 1) { alert('プランは1つ以上必要です。'); return; }
      state.basic.rows.splice(i, 1);
      var r = N(state.basic.recommend);
      state.basic.recommend = r === i ? -1 : (r > i ? r - 1 : r);
    } else if (act === 'basic-rec') {
      state.basic.recommend = i;
    } else { return; }
    save(); renderAll();
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (el && el.closest('#form') && el.getAttribute('data-act').indexOf('basic-') === 0
      && el.tagName === 'BUTTON') onAction(el);
  });

  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.closest && el.closest('#form') && el.getAttribute('data-path')) onFieldChange(el);
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!el.closest || !el.closest('#form')) return;
    if (el.getAttribute('data-unit')) onUnitToggle(el);
    else if (el.getAttribute('data-act')) onAction(el);
    else if (el.getAttribute('data-path')) onFieldChange(el);
  });

  window.addEventListener('DOMContentLoaded', function () {
    load();
    renderAll();

    document.getElementById('btn-print').addEventListener('click', function () { window.print(); });
    document.getElementById('btn-html').addEventListener('click', exportHtml);
    document.getElementById('btn-save').addEventListener('click', function () {
      download(JSON.stringify(state, null, 2), fileName('json'), 'application/json');
    });
    document.getElementById('file-load').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          state = merge(defaults(), JSON.parse(r.result));
          mergeMaster(); save(); renderAll();
        } catch (err) { alert('読み込めませんでした: ' + err.message); }
        e.target.value = '';
      };
      r.readAsText(f, 'utf-8');
    });
    document.getElementById('btn-reset').addEventListener('click', function () {
      if (!confirm('入力内容をすべて初期状態に戻します。よろしいですか？')) return;
      defaults(); save(); renderAll();
    });
    var z = document.getElementById('zoom');
    z.addEventListener('input', function () {
      zoom = N(z.value); document.getElementById('zoom-v').textContent = zoom + '%'; renderPreview();
    });
    var t;
    window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(renderPreview, 120); });
  });
})();
