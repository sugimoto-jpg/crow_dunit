// ============================================================================
// アイドマ・ホールディングスのサービス（ユニット）紹介スライド
// head.js（配色 C・ヘルパー txt/card/iconCircle/numCircle/contentSlide/table/icon/shadow）の後に連結して使う。
// 内容は社内資料「営業支援・商談支援・WEBマーケティング&制作支援・人事支援・フィールドワーク支援」の各1枚から転記。
// ============================================================================

const UNITS = {
  mitok: {
    short: "MiTok", name: "AI対話・動画", bracket: "MiTok", icon: "FaVideo",
  },
  sp: {
    short: "営業支援", name: "営業支援", bracket: "セールスプラットフォーム", icon: "FaPhoneAlt",
    tags: ["営業", "リード獲得", "アウトソーシング型"], cost: true,
    catch: "当社の「人のチカラ」×「テクノロジー」が営業の成功パターンを見つけ、「再現性のある営業の仕組み」として納品します。",
    left: { title: "人のチカラ", desc: "8名の外付け営業部隊を活用し、営業の仕組み化を実行。外付け営業部隊が戦略から実行までサポート。", levels: ["外付け専属チーム", "コンサルティングチーム", "マーケティングチーム"] },
    right: {
      type: "sp", title: "テクノロジー", desc: "テクノロジーで見込み顧客開拓を実行。運用担当は不要。営業データの蓄積・活用が可能。",
      items: [["FaDesktop", "オンラインセールス®ツール"], ["FaCogs", "マーケティング\nオートメーションツール"], ["FaChartBar", "SFA\n（セールスフォースオートメーション）"], ["FaPhoneVolume", "アプローチシステム\n（電話・メール・FAX・DM・手紙）"]],
    },
  },
  sales: {
    short: "商談支援", name: "商談支援", bracket: "セールスユニット", icon: "FaHandshake",
    tags: ["営業", "受注率向上", "アウトソーシング型"], cost: true,
    catch: "当社の「商談チーム」×「スペシャリスト」が商談の成功パターンを見つけ、「再現性のある商談の仕組み」として納品します。",
    left: { title: "商談チーム", desc: "外付け商談部隊を活用し、商談の仕組み化を実行。外付け商談部隊が戦略から実行までサポート。", levels: ["外付け専属チーム", "営業マネージャー", "商談チーム"] },
    right: {
      type: "grid", title: "スペシャリスト", desc: "商談における各業務のスペシャリストをチームにアサインし、業務を運用",
      items: [["FaFileSignature", "商談台本作成"], ["FaVideo", "オンライン商談"], ["FaComments", "ロープレ"], ["FaSearchPlus", "競合調査"], ["FaHandshake", "ビジネスマッチング"], ["FaBook", "マニュアル・カリキュラム作成"], ["FaPhoneVolume", "失注先へのフォローアプローチ"], ["FaYenSign", "料金表修正"], ["FaChalkboardTeacher", "営業研修"], ["FaClipboardList", "商談レポート作成"]],
    },
  },
  crapro: {
    short: "WEB・制作", name: "WEBマーケティング&制作支援", bracket: "クラプロ", icon: "FaLaptopCode",
    tags: ["営業", "クリエイティブ", "リード獲得", "受注率向上", "アウトソーシング型"], cost: true,
    catch: "当社の「WEBディレクター」×「スペシャリスト」が、貴社の課題にあわせたWEBマーケティング戦略立案からチーム組成、制作までを実行いたします。",
    left: { title: "WEBディレクター", desc: "貴社専属のディレクターが、戦略立案からチーム組成・管理までを実行。", levels: ["外付け専属チーム", "専属WEBディレクター", "クリエイティブスペシャリストチーム"] },
    right: {
      type: "grid", title: "スペシャリスト", desc: "各マーケティング施策に精通したメンバーを、戦略に合わせてアサイン",
      items: [["FaLaptopCode", "HP・LP制作／ECサイト"], ["FaImage", "広告バナー・チラシ"], ["FaGoogle", "Google広告／Yahoo!広告"], ["FaSearch", "SEO"], ["FaYoutube", "YouTube運用代行・広告"], ["FaTiktok", "TikTok運用代行・広告"], ["FaInstagram", "Instagram運用代行・広告"], ["FaMapMarkerAlt", "MEO"], ["FaLink", "アフィリエイト"], ["FaEnvelope", "メルマガ"]],
    },
  },
  hr: {
    short: "人事支援", name: "人事支援", bracket: "HRユニット", icon: "FaUserTie",
    tags: ["人事", "アウトソーシング型"], cost: true,
    catch: "当社の「人事チーム」×「スペシャリスト」が人事業務の成功パターンを見つけ、「再現性のある人事業務の仕組み」として納品します。",
    left: { title: "人事チーム", desc: "貴社専属の人事マネージャーが、課題解決のために戦略立案、実務チームを組成。", levels: ["外付け専属チーム", "人事マネージャー", "人事スペシャリストチーム"] },
    right: {
      type: "grid", title: "スペシャリスト", desc: "人事業務における各業務のスペシャリストをチームにアサインし、業務を運用",
      items: [["FaUsers", "母集団形成"], ["FaVideo", "オンライン面接"], ["FaChalkboardTeacher", "オリエンテーション"], ["FaPenFancy", "求人ライティング"], ["FaShareAlt", "求人SNS作成〜運用"], ["FaBook", "マニュアル・カリキュラム作成"], ["FaUserShield", "退職防止策"], ["FaStar", "評価制度"], ["FaGraduationCap", "研修制度の構築・導入"], ["FaFileAlt", "各種人事労務書類作成"]],
    },
  },
  field: {
    short: "フィールドワーク", name: "フィールドワーク支援", bracket: "フィールドワークチームユニット", sb: "フィールドワークチーム", icon: "FaRunning",
    tags: ["営業", "アウトソーシング型"], cost: false,
    catch: "当社の「フィールドワークチーム」×「スペシャリスト」が業務の成功パターンを見つけ、「再現性のある業務の仕組み」として納品します。",
    left: { title: "フィールドワークチーム", desc: "貴社専属のフィールドワークマネージャーが、課題解決のために業務分析、戦略立案、実務チームを組成。", levels: ["外付け専属チーム", "フィールドセールスマネージャー", "実行スタッフ・事務スタッフ"] },
    right: {
      type: "steps", title: "スペシャリスト",
      steps: [
        ["業務分析", "業務内容のヒアリングと視察から、業務の棚卸しと改善案を作成", [["FaMicrophone", "業務ヒアリング"], ["FaMapMarkedAlt", "現地視察"], ["FaTasks", "業務棚卸"]]],
        ["フィールドワーク", "現地スタッフへのレクチャー、スタッフアサイン、管理を実行", [["FaBookOpen", "業務マニュアルの作成"], ["FaChalkboardTeacher", "事前レクチャー"], ["FaUserPlus", "人材アサイン"], ["FaRunning", "業務実施"], ["FaChartPie", "結果報告"]]],
        ["マニュアル改善", "実行結果から、業務の改善点などをマニュアルにまとめて納品", [["FaSearch", "イレギュラー対応の抽出"], ["FaEdit", "マニュアル改善"], ["FaBook", "マニュアル作成"], ["FaChalkboardTeacher", "マニュアルレクチャー"]]],
      ],
    },
  },
};

const UNIT_LABEL = (k) => (UNITS[k].bracket === "MiTok" ? "MiTok" : `${UNITS[k].name}［${UNITS[k].bracket}］`);

// 三角形（ピラミッド）の組織図：貴社 → 外付け専属チーム → マネージャー層 → 実務チーム
async function pyramid(s, cx, top, width, labels, clientLabel) {
  const triW = width * 0.3, triH = 0.5;
  s.addShape(pres.shapes.ISOSCELES_TRIANGLE, { x: cx - triW / 2, y: top, w: triW, h: triH, fill: { color: C.primary }, line: { color: C.primary, width: 0 } });
  txt(s, clientLabel, { x: cx - triW / 2, y: top + triH * 0.45, w: triW, h: triH * 0.55, fontSize: 11, bold: true, color: C.white, align: "center", valign: "middle" });
  s.addShape(pres.shapes.LINE, { x: cx, y: top + triH, w: 0, h: 0.1, line: { color: C.primary, width: 2 } });
  const rows = [
    { t: labels[0], w: width * 0.52, fill: C.primary, fc: C.white, dash: false },
    { t: labels[1], w: width * 0.76, fill: C.light, fc: C.primary, dash: false },
    { t: labels[2], w: width * 1.0, fill: C.accentLight, fc: C.dark, dash: true },
  ];
  let y = top + triH + 0.1;
  const hs = [0.36, 0.38, 0.44];
  for (let i = 0; i < 3; i++) {
    const r = rows[i], h = hs[i];
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx - r.w / 2, y, w: r.w, h, rectRadius: 0.06, fill: { color: r.fill }, line: { color: r.dash ? C.accent : r.fill, width: r.dash ? 1.25 : 0, dashType: r.dash ? "dash" : "solid" } });
    txt(s, r.t, { x: cx - r.w / 2, y, w: r.w, h, fontSize: i === 0 ? 11.5 : 11, bold: true, color: r.fc, align: "center", valign: "middle" });
    y += h + 0.07;
  }
  return y;
}

// ---------------------------------------------------------------------------
// ユニット紹介スライド（1ユニット1枚）
// usage: 「貴社での活用イメージ」1〜2文（顧客ごとに書く）
// ---------------------------------------------------------------------------
async function unitSlide(key, no, clientLabel, usage) {
  const u = UNITS[key];
  const s = contentSlide(`AIDMA SERVICE ${no}`, `${u.name}［${u.bracket}］`);
  // tags
  let tx = MX;
  for (const t of u.tags) {
    const w = 0.35 + t.length * 0.16;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: tx, y: 1.36, w, h: 0.3, rectRadius: 0.08, fill: { color: C.light }, line: { color: C.light, width: 0 } });
    txt(s, "☑ " + t, { x: tx, y: 1.36, w, h: 0.3, fontSize: 10, bold: true, color: C.primary, align: "center", valign: "middle" });
    tx += w + 0.12;
  }
  txt(s, u.catch, { x: MX, y: 1.76, w: CW, h: 0.55, fontSize: 13, bold: true, color: C.dark, align: "center", valign: "middle" });
  // 仕組化 → 運用
  const lw = 4.7, rx = MX + lw + 0.25, rw = W - MX - rx;
  s.addShape(pres.shapes.PENTAGON, { x: MX, y: 2.38, w: lw + 0.3, h: 0.4, fill: { color: C.primary }, line: { color: C.primary, width: 0 } });
  txt(s, "仕組化", { x: MX, y: 2.38, w: lw, h: 0.4, fontSize: 13, bold: true, color: C.white, align: "center", valign: "middle" });
  s.addShape(pres.shapes.CHEVRON, { x: rx - 0.05, y: 2.38, w: rw + 0.05, h: 0.4, fill: { color: C.accent }, line: { color: C.accent, width: 0 } });
  txt(s, "運用", { x: rx, y: 2.38, w: rw, h: 0.4, fontSize: 13, bold: true, color: C.white, align: "center", valign: "middle" });

  // left: team + pyramid
  const top = 2.95, bottom = 6.12;
  card(s, MX, top, lw, bottom - top, C.light2, false);
  txt(s, `「${u.left.title}」`, { x: MX + 0.15, y: top + 0.1, w: lw - 0.3, h: 0.36, fontSize: 14.5, bold: true, color: C.primary, align: "center" });
  txt(s, u.left.desc, { x: MX + 0.25, y: top + 0.48, w: lw - 0.5, h: 0.5, fontSize: 10, color: C.text, align: "center" });
  await pyramid(s, MX + lw / 2, top + 1.0, lw - 0.6, u.left.levels, "貴社");
  if (u.cost) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX + 0.12, y: top + 1.05, w: 1.05, h: 0.62, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.accent, width: 1 } });
    txt(s, [{ text: "雇用コスト", options: { fontSize: 8.5, breakLine: true } }, { text: "1名分", options: { fontSize: 15, bold: true, color: C.accent } }], { x: MX + 0.12, y: top + 1.05, w: 1.05, h: 0.62, align: "center", valign: "middle", color: C.dark });
  }

  // right: specialists
  card(s, rx, top, rw, bottom - top, C.accentLight, false);
  const R = u.right;
  txt(s, `「${R.title}」`, { x: rx + 0.2, y: top + 0.1, w: rw - 0.4, h: 0.36, fontSize: 14.5, bold: true, color: C.accent, align: "center" });
  if (R.type === "grid") {
    txt(s, R.desc, { x: rx + 0.3, y: top + 0.48, w: rw - 0.6, h: 0.3, fontSize: 10.5, align: "center" });
    const cols = 2, gw = (rw - 0.6 - 0.15) / cols, gh = 0.4;
    for (let i = 0; i < R.items.length; i++) {
      const x = rx + 0.3 + (i % cols) * (gw + 0.15), y = top + 0.88 + Math.floor(i / cols) * (gh + 0.07);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: gw, h: gh, rectRadius: 0.05, fill: { color: C.white }, line: { color: C.white, width: 0 } });
      s.addImage({ data: await icon(R.items[i][0], C.primary), x: x + 0.12, y: y + 0.08, w: 0.24, h: 0.24 });
      txt(s, R.items[i][1], { x: x + 0.45, y, w: gw - 0.5, h: gh, fontSize: 10.5, bold: true, color: C.dark, valign: "middle" });
    }
  } else if (R.type === "sp") {
    txt(s, R.desc, { x: rx + 0.3, y: top + 0.48, w: rw - 1.6, h: 0.5, fontSize: 10.5 });
    s.addShape(pres.shapes.OVAL, { x: rx + rw - 1.25, y: top + 0.35, w: 1.0, h: 1.0, fill: { color: C.accent }, line: { color: C.accent, width: 0 } });
    txt(s, "マンパワー\nゼロ", { x: rx + rw - 1.25, y: top + 0.35, w: 1.0, h: 1.0, fontSize: 11, bold: true, color: C.white, align: "center", valign: "middle" });
    txt(s, "SalesCrowd", { x: rx + 0.3, y: top + 1.0, w: 3, h: 0.3, fontSize: 12, bold: true, color: C.primary });
    const cols = 2, gw = (rw - 0.6 - 0.15) / cols, gh = 0.48;
    for (let i = 0; i < R.items.length; i++) {
      const x = rx + 0.3 + (i % cols) * (gw + 0.15), y = top + 1.35 + Math.floor(i / cols) * (gh + 0.07);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: gw, h: gh, rectRadius: 0.05, fill: { color: C.white }, line: { color: C.white, width: 0 } });
      s.addImage({ data: await icon(R.items[i][0], C.primary), x: x + 0.12, y: y + 0.11, w: 0.26, h: 0.26 });
      txt(s, R.items[i][1], { x: x + 0.48, y, w: gw - 0.53, h: gh, fontSize: 9.5, bold: true, color: C.dark, valign: "middle" });
    }
    const by = top + 1.35 + 2 * (gh + 0.07);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: rx + 0.3, y: by, w: rw - 0.6, h: 0.55, rectRadius: 0.05, fill: { color: C.white }, line: { color: C.white, width: 0 } });
    s.addImage({ data: await icon("FaDatabase", C.primary), x: rx + 0.42, y: by + 0.14, w: 0.27, h: 0.27 });
    txt(s, [{ text: "BIZMAPS", options: { bold: true, color: C.primary, fontSize: 13 } }, { text: "　国内最大級 法人データベース", options: { fontSize: 10.5, color: C.dark } }], { x: rx + 0.8, y: by, w: rw - 3.2, h: 0.55, valign: "middle" });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: rx + rw - 2.25, y: by + 0.07, w: 1.85, h: 0.41, rectRadius: 0.05, fill: { color: C.accent }, line: { color: C.accent, width: 0 } });
    txt(s, [{ text: "格納営業リスト ", options: { fontSize: 9 } }, { text: "680万件", options: { fontSize: 14, bold: true } }], { x: rx + rw - 2.25, y: by + 0.07, w: 1.85, h: 0.41, color: C.white, align: "center", valign: "middle" });
  } else if (R.type === "steps") {
    const n = R.steps.length, sw = (rw - 0.5 - 0.2 * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const [ttl, desc, items] = R.steps[i];
      const x = rx + 0.25 + i * (sw + 0.2);
      numCircle(s, i + 1, x, top + 0.55, 0.32, C.accent, C.white, 11);
      txt(s, ttl, { x: x + 0.38, y: top + 0.55, w: sw - 0.38, h: 0.32, fontSize: 12, bold: true, color: C.dark, valign: "middle" });
      txt(s, desc, { x, y: top + 0.92, w: sw, h: 0.6, fontSize: 9, color: C.text });
      for (let k = 0; k < items.length; k++) {
        const y = top + 1.55 + k * 0.31;
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: sw, h: 0.26, rectRadius: 0.04, fill: { color: C.white }, line: { color: C.white, width: 0 } });
        s.addImage({ data: await icon(items[k][0], C.primary), x: x + 0.07, y: y + 0.04, w: 0.18, h: 0.18 });
        txt(s, items[k][1], { x: x + 0.3, y, w: sw - 0.32, h: 0.26, fontSize: 9, bold: true, color: C.dark, valign: "middle" });
      }
      if (i < n - 1) s.addImage({ data: await icon("FaChevronRight", C.accent), x: x + sw + 0.04, y: top + 2.2, w: 0.12, h: 0.22 });
    }
  }
  // usage band
  card(s, MX, 6.25, CW, 0.68, C.light, false);
  await iconCircle(s, "FaLightbulb", MX + 0.15, 6.36, 0.46, C.primary, C.white);
  txt(s, [{ text: `${clientLabel}での活用イメージ：`, options: { bold: true, color: C.primary } }, { text: usage, options: { color: C.text } }], { x: MX + 0.75, y: 6.25, w: CW - 0.9, h: 0.68, fontSize: 11.5, valign: "middle" });
  return s;
}

// ---------------------------------------------------------------------------
// 全体像：貴社を頂点にした三角形の組織図＋各チームの役割
// roles: { unitKey: "役割（1〜2行）" }（MiTok を含めてよい）
// ---------------------------------------------------------------------------
async function overviewSlide(clientLabel, keys, roles) {
  const s = contentSlide("AIDMA SERVICE", "アイドマ・ホールディングスがご提供する体制（全体像）",
    `${clientLabel}の専属チームとして、MiTokと各ユニットが連携して「仕組化」から「運用」までを担います。`);
  const cx = 3.95, w = 6.5;
  // top triangle (client)
  const triW = 2.6, triH = 1.05, top = 1.9;
  s.addShape(pres.shapes.ISOSCELES_TRIANGLE, { x: cx - triW / 2, y: top, w: triW, h: triH, fill: { color: C.dark }, line: { color: C.dark, width: 0 } });
  txt(s, clientLabel, { x: cx - triW / 2, y: top + 0.5, w: triW, h: 0.5, fontSize: 12.5, bold: true, color: C.white, align: "center", valign: "middle" });
  s.addShape(pres.shapes.LINE, { x: cx, y: top + triH, w: 0, h: 0.12, line: { color: C.dark, width: 2 } });
  const l2y = top + triH + 0.12;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx - 2.1, y: l2y, w: 4.2, h: 0.5, rectRadius: 0.06, fill: { color: C.primary }, line: { color: C.primary, width: 0 } });
  txt(s, "アイドマ・ホールディングス　外付け専属チーム", { x: cx - 2.1, y: l2y, w: 4.2, h: 0.5, fontSize: 12, bold: true, color: C.white, align: "center", valign: "middle" });
  const l3y = l2y + 0.58;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx - 2.75, y: l3y, w: 5.5, h: 0.5, rectRadius: 0.06, fill: { color: C.light }, line: { color: C.light, width: 0 } });
  txt(s, "各ユニットの専属マネージャー・ディレクター（戦略立案・チーム組成）", { x: cx - 2.75, y: l3y, w: 5.5, h: 0.5, fontSize: 11, bold: true, color: C.primary, align: "center", valign: "middle" });
  const l4y = l3y + 0.58, l4h = 6.85 - l4y;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx - w / 2, y: l4y, w, h: l4h, rectRadius: 0.08, fill: { color: C.accentLight }, line: { color: C.accent, width: 1.25, dashType: "dash" } });
  txt(s, "実務チーム（スペシャリスト）", { x: cx - w / 2, y: l4y + 0.05, w, h: 0.3, fontSize: 10.5, bold: true, color: C.accent, align: "center" });
  const perRow = keys.length > 4 ? Math.ceil(keys.length / 2) : keys.length;
  const nRows = Math.ceil(keys.length / perRow);
  const gx = 0.12, cwid = (w - 0.4 - gx * (perRow - 1)) / perRow, ch = (l4h - 0.45 - 0.1 * (nRows - 1) - 0.12) / nRows;
  for (let i = 0; i < keys.length; i++) {
    const u = UNITS[keys[i]], r = Math.floor(i / perRow), c = i % perRow;
    const inRow = Math.min(perRow, keys.length - r * perRow);
    const rowW = inRow * cwid + (inRow - 1) * gx;
    const x = cx - rowW / 2 + c * (cwid + gx), y = l4y + 0.4 + r * (ch + 0.1);
    const mit = keys[i] === "mitok";
    card(s, x, y, cwid, ch, mit ? C.primary : C.white, true);
    await iconCircle(s, u.icon, x + cwid / 2 - 0.2, y + 0.08, 0.4, mit ? C.white : C.primary, mit ? C.primary : C.white);
    txt(s, u.short, { x: x + 0.05, y: y + 0.5, w: cwid - 0.1, h: 0.3, fontSize: 11.5, bold: true, color: mit ? C.white : C.dark, align: "center" });
    txt(s, mit ? "動画・発信" : `［${u.sb || u.bracket}］`, { x: x + 0.05, y: y + 0.78, w: cwid - 0.1, h: Math.max(0.25, ch - 0.82), fontSize: 8.5, color: mit ? ON_DARK : C.muted, align: "center" });
  }
  // roles
  const rx = 7.55, rw = W - MX - rx;
  txt(s, "各チームの役割", { x: rx, y: 1.9, w: rw, h: 0.35, fontSize: 14, bold: true, color: C.accent });
  const rh = Math.min(0.8, (6.85 - 2.35) / keys.length);
  for (let i = 0; i < keys.length; i++) {
    const u = UNITS[keys[i]], y = 2.35 + i * rh;
    await iconCircle(s, u.icon, rx, y + 0.05, 0.42, keys[i] === "mitok" ? C.accent : C.primary, C.white);
    txt(s, UNIT_LABEL(keys[i]), { x: rx + 0.55, y, w: rw - 0.55, h: 0.28, fontSize: 11, bold: true, color: C.primary });
    txt(s, roles[keys[i]] || "", { x: rx + 0.55, y: y + 0.28, w: rw - 0.55, h: rh - 0.3, fontSize: 9.5, color: C.text });
  }
  return s;
}

// ---------------------------------------------------------------------------
// 課題 × サービス対応表
// issues: [["課題", {unitKey: "◎"|"○"}], ...]
// ---------------------------------------------------------------------------
function matrixSlide(clientLabel, keys, issues) {
  const s = contentSlide("AIDMA SERVICE", "課題とサービスの対応", `前回伺った${clientLabel}の課題に対して、どのチームが何を担うかを整理しました。`);
  const head = ["課題", ...keys.map((k) => UNITS[k].short)].map((h, j) => ({
    text: h, options: { bold: true, color: C.white, fill: { color: j === 0 ? C.dark : C.primary }, fontSize: 11.5, align: j === 0 ? "left" : "center", valign: "middle" },
  }));
  const body = issues.map((row, i) => [
    { text: row[0], options: { bold: true, color: C.dark, fontSize: 11.5, valign: "middle", fill: { color: i % 2 ? C.light2 : C.white } } },
    ...keys.map((k) => {
      const m = row[1][k] || "";
      return { text: m, options: { align: "center", valign: "middle", fontSize: 18, bold: true, color: m === "◎" ? C.accent : C.primary, fill: { color: m === "◎" ? C.accentLight : i % 2 ? C.light2 : C.white } } };
    }),
  ]);
  const firstW = 4.4, restW = (CW - firstW) / keys.length;
  s.addTable([head, ...body], { x: MX, y: 1.9, w: CW, colW: [firstW, ...keys.map(() => restW)], rowH: [0.5, ...issues.map(() => 0.62)], fontFace: FONT, border: { type: "solid", pt: 0.75, color: LINE }, margin: [0.05, 0.12, 0.05, 0.12] });
  txt(s, "◎：主に解決するチーム　○：あわせて支援するチーム", { x: MX, y: 1.9 + 0.5 + issues.length * 0.62 + 0.15, w: CW, h: 0.3, fontSize: 10.5, color: C.muted });
  return s;
}

// ---------------------------------------------------------------------------
// 導入の順番（組み合わせ）
// steps: [[unitKey, "時期", "やること"], ...]
// ---------------------------------------------------------------------------
async function stepsSlide(steps, note) {
  const s = contentSlide("AIDMA SERVICE", "ご提案の組み合わせと導入の順番");
  const n = steps.length, gap = 0.25, bw = (CW - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const [k, when, what] = steps[i], u = UNITS[k], x = MX + i * (bw + gap);
    card(s, x, 1.65, bw, 0.55, i === 0 ? C.accent : C.primary, false);
    txt(s, when, { x, y: 1.65, w: bw, h: 0.55, fontSize: 12.5, bold: true, color: C.white, align: "center", valign: "middle" });
    card(s, x, 2.35, bw, 3.0);
    await iconCircle(s, u.icon, x + bw / 2 - 0.35, 2.55, 0.7, k === "mitok" ? C.accent : C.primary, C.white);
    txt(s, u.short, { x: x + 0.1, y: 3.35, w: bw - 0.2, h: 0.35, fontSize: 14, bold: true, color: C.primary, align: "center" });
    txt(s, u.bracket === "MiTok" ? "（無料3本の検証）" : `［${u.sb || u.bracket}］`, { x: x + 0.1, y: 3.7, w: bw - 0.2, h: 0.5, fontSize: 9.5, color: C.muted, align: "center" });
    txt(s, what, { x: x + 0.2, y: 4.25, w: bw - 0.4, h: 1.0, fontSize: 11, color: C.text });
    if (i < n - 1) s.addImage({ data: await icon("FaChevronRight", C.accent), x: x + bw + 0.05, y: 3.9, w: 0.15, h: 0.3 });
  }
  if (note) {
    card(s, MX, 5.65, CW, 0.7, C.light, false);
    txt(s, note, { x: MX + 0.3, y: 5.65, w: CW - 0.6, h: 0.7, fontSize: 12, bold: true, color: C.dark, valign: "middle" });
  }
  return s;
}
