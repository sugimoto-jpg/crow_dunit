const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");

const OUT = process.argv[2] || "deck.pptx";
const TH = __dirname + "/thumbs/";

// ---- Palette ----
const C = {
  primary: "1F5E5B",
  dark: "163F3D",
  light: "E7F2EF",
  light2: "F4F8F7",
  accent: "E07B39",
  accentLight: "FCEBDD",
  text: "2A3332",
  muted: "66807D",
  gray: "EEF0F0",
  grayText: "7A8584",
  white: "FFFFFF",
};
const FONT = "Meiryo UI";

const iconCache = {};
async function icon(name, color) {
  const key = name + color;
  if (iconCache[key]) return iconCache[key];
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(fa[name], { color: "#" + color, size: 256 })
  );
  const buf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  iconCache[key] = "image/png;base64," + buf.toString("base64");
  return iconCache[key];
}

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.title = "訪問マッサージ事業 営業・マーケティング総合改革提案書";
pres.company = "株式会社アイドマ・ホールディングス";

const W = 13.333;
const MX = 0.6;
const CW = W - MX * 2;
let pageNo = 0;

function txt(slide, text, o) {
  slide.addText(text, Object.assign({ isTextBox: true, fontFace: FONT, color: C.text, valign: "top", margin: 0 }, o));
}

function shadow() {
  return { type: "outer", color: "000000", blur: 6, offset: 2, angle: 90, opacity: 0.12 };
}

function card(slide, x, y, w, h, fill, withShadow = true) {
  const o = { x, y, w, h, fill: { color: fill || C.white }, rectRadius: 0.12, line: { color: fill || C.white, width: 0 } };
  if (withShadow) o.shadow = shadow();
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, o);
}

async function iconCircle(slide, name, x, y, d, bg, fg) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg, width: 0 } });
  const p = d * 0.26;
  slide.addImage({ data: await icon(name, fg), x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p });
}

function numCircle(slide, n, x, y, d, bg, fg, size) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg, width: 0 } });
  txt(slide, String(n), { x, y, w: d, h: d, align: "center", valign: "middle", fontSize: size || 14, bold: true, color: fg });
}

function contentSlide(kicker, title, lead) {
  const s = pres.addSlide();
  pageNo++;
  s.background = { color: C.white };
  txt(s, kicker, { x: MX, y: 0.38, w: 8, h: 0.3, fontSize: 11, bold: true, color: C.accent, charSpacing: 2 });
  txt(s, title, { x: MX, y: 0.68, w: CW, h: 0.62, fontSize: 26, bold: true, color: C.primary, valign: "middle" });
  if (lead) txt(s, lead, { x: MX, y: 1.32, w: CW, h: 0.4, fontSize: 13, color: C.muted, valign: "middle" });
  txt(s, String(pageNo + 1), { x: W - MX - 0.6, y: 7.02, w: 0.6, h: 0.28, fontSize: 10, color: C.grayText, align: "right" });
  txt(s, "株式会社アイドマ・ホールディングス｜MiTok", { x: MX, y: 7.02, w: 5, h: 0.28, fontSize: 9, color: C.grayText });
  return s;
}

function table(slide, header, rows, opts) {
  const hdr = header.map((h) => ({
    text: h,
    options: { bold: true, color: C.white, fill: { color: C.primary }, fontSize: opts.hsize || 12, valign: "middle" },
  }));
  const body = rows.map((r, i) =>
    r.map((cell, j) => {
      const base = { fontSize: opts.size || 11.5, color: C.text, valign: "middle", fill: { color: i % 2 ? C.light2 : C.white } };
      if (j === 0 && opts.firstBold !== false) Object.assign(base, { bold: true, color: C.primary });
      if (typeof cell === "object") return { text: cell.text, options: Object.assign(base, cell.options) };
      return { text: cell, options: base };
    })
  );
  slide.addTable([hdr, ...body], {
    x: opts.x, y: opts.y, w: opts.w, colW: opts.colW, rowH: opts.rowH,
    fontFace: FONT, border: { type: "solid", pt: 0.75, color: "D5E3E0" }, margin: [0.05, 0.1, 0.05, 0.1],
  });
}

(async () => {
  // ================= 1. Title =================
  {
    const s = pres.addSlide();
    s.background = { color: C.dark };
    s.addShape(pres.shapes.OVAL, { x: 8.9, y: 1.2, w: 5.4, h: 5.4, fill: { color: C.primary }, line: { color: C.primary, width: 0 } });
    s.addShape(pres.shapes.OVAL, { x: 10.2, y: 0.4, w: 2.2, h: 2.2, fill: { color: C.accent, transparency: 15 }, line: { color: C.accent, width: 0 } });
    s.addImage({ data: await icon("FaHandHoldingHeart", "CFE6E1"), x: 10.35, y: 2.75, w: 2.1, h: 2.1 });
    txt(s, "株式会社みらい設計 御中", { x: MX + 0.1, y: 0.8, w: 7, h: 0.4, fontSize: 16, color: "CFE6E1" });
    txt(s, "訪問マッサージ事業\n営業・マーケティング\n総合改革提案書", { x: MX + 0.1, y: 1.6, w: 8.2, h: 2.7, fontSize: 40, bold: true, color: C.white, lineSpacingMultiple: 1.05 });
    txt(s, "「動画をつくる」から「選ばれ続ける仕組みをつくる」へ", { x: MX + 0.1, y: 4.45, w: 8.2, h: 0.5, fontSize: 18, bold: true, color: "F2A673" });
    txt(s, "AI対話・動画プラットフォーム「MiTok（ミトク）」ご活用提案／第2回お打ち合わせ資料", { x: MX + 0.1, y: 5.15, w: 8.2, h: 0.4, fontSize: 13, color: "CFE6E1" });
    txt(s, "株式会社アイドマ・ホールディングス　MiTok事業部", { x: MX + 0.1, y: 6.55, w: 8, h: 0.4, fontSize: 13, bold: true, color: C.white });
    s.addNotes(
      "【営業担当者用・事前確認】\n" +
        "・坂田様は代表ではなく取締役会長。冒頭で決裁権限・決裁フローを必ず確認する。\n" +
        "・今回の対象は保険事業ではなく訪問マッサージ（介護）事業。保険はクロスセル文脈にとどめる。\n" +
        "・課題が「不明」のため、ヒアリングで会長ご自身の言葉で課題を言語化していただくことが成否を分ける。\n" +
        "\n" +
        "【時間配分（60分）】0-5分 振り返り／5-20分 Why Now＋ヒアリング／20-35分 プッシュ・プル戦略／35-45分 フェーズ1・2／45-60分 数値ヒアリング・シミュレーション・次回日程の確定"
    );
  }

  // ================= 2. Executive summary =================
  {
    const s = contentSlide("EXECUTIVE SUMMARY", "結論：MiTokを「新規利用者獲得エンジン」として導入する");
    card(s, MX, 1.5, CW, 1.05, C.light, false);
    txt(s, "紹介・人脈に依存した集客から、動画と仕組みで紹介と問い合わせが生まれ続ける\n「地域No.1の訪問マッサージ事業体制」へ転換することをご提案します。", {
      x: MX + 0.35, y: 1.5, w: CW - 0.7, h: 1.05, fontSize: 16, bold: true, color: C.dark, valign: "middle",
    });
    const items = [
      ["FaBullhorn", "プッシュ｜紹介元への働きかけ", "ケアマネジャー・介護施設・医療機関・既存の保険顧客へ、訪問前・訪問後・資料送付時に動画を届け、紹介件数と面談化率を引き上げる。"],
      ["FaSearch", "プル｜ご家族からの指名", "YouTube／Instagram／TikTokで「訪問マッサージとは？」「保険で受けられる？」を解説し、ご家族からの直接問い合わせの導線をつくる。"],
      ["FaRoute", "2フェーズの伴走", "無料3本は効果検証のためのプロトタイプ。検証結果をそのまま有料伴走へ引き継ぎ、改善・量産・営業組み込みまで一気通貫で実行する。"],
    ];
    const cw = (CW - 0.6) / 3;
    for (let i = 0; i < 3; i++) {
      const x = MX + i * (cw + 0.3);
      card(s, x, 2.85, cw, 2.55);
      await iconCircle(s, items[i][0], x + 0.3, 3.1, 0.7, C.primary, C.white);
      txt(s, items[i][1], { x: x + 1.15, y: 3.1, w: cw - 1.35, h: 0.7, fontSize: 15, bold: true, color: C.primary, valign: "middle" });
      txt(s, items[i][2], { x: x + 0.3, y: 3.95, w: cw - 0.6, h: 1.3, fontSize: 12.5, lineSpacingMultiple: 1.15 });
    }
    txt(s, "12ヶ月後のゴール", { x: MX, y: 5.68, w: 3, h: 0.35, fontSize: 13, bold: true, color: C.accent });
    const goals = ["「訪問マッサージといえば、みらい設計」と地域で第一想起される", "紹介が担当者の人脈でなく、動画と仕組みで継続的に発生する", "保険事業で培った「安心・安全・安堵」を介護領域の信頼の証にする"];
    for (let i = 0; i < 3; i++) {
      const x = MX + i * (cw + 0.3);
      await iconCircle(s, "FaCheck", x, 6.1, 0.4, C.accentLight, C.accent);
      txt(s, goals[i], { x: x + 0.52, y: 6.05, w: cw - 0.55, h: 0.6, fontSize: 12, valign: "middle" });
    }
  }

  // ================= 3. Recap =================
  {
    const s = contentSlide("01｜RECAP", "前回お打ち合わせの振り返り");
    table(s, ["項目", "確認内容"], [
      ["体制", "昨年4月に合同会社保険プラザと合併し、株式会社みらい設計として新体制へ（岩国16名）"],
      ["事業", "損害保険・生命保険の代理店事業／訪問マッサージ等の介護関連事業（7年目）"],
      ["強み", "半径50km圏の地域密着体制、顧客との深い繋がり、「安心・安全・安堵」のイメージ"],
      ["MiTok活用の対象", { text: "保険事業ではなく、訪問マッサージ（介護）事業", options: { bold: true, color: C.accent } }],
      ["期待すること", "新規チャネルからの認知拡大・顧客獲得、HP・顧客案内などへの二次利用"],
      ["宿題（貴社）", "訪問マッサージ・介護訴求のスライド資料（5〜10P／PDF）のご用意"],
      ["宿題（弊社）", "改善相談および新プランのご提案（＝本資料）"],
    ], { x: MX, y: 1.6, w: 8.2, colW: [2.0, 6.2], rowH: 0.62, size: 12 });
    card(s, 9.2, 1.6, 3.53, 4.96, C.light, false);
    await iconCircle(s, "FaFileAlt", 9.55, 1.95, 0.8, C.primary, C.white);
    txt(s, "ご用意いただいた資料の活用", { x: 9.55, y: 2.95, w: 2.9, h: 0.5, fontSize: 15, bold: true, color: C.primary });
    txt(s, "坂田会長にご用意いただくスライド資料は、そのまま無料3本の台本・構成の一次素材として活用します。\n\n貴社の言葉・想いを起点に動画をつくるため、「自社らしさ」が伝わる内容に仕上がります。", {
      x: 9.55, y: 3.5, w: 2.9, h: 2.9, fontSize: 12.5, lineSpacingMultiple: 1.2,
    });
    s.addNotes("資料をご用意いただいたことへのお礼を伝え、「台本素材として既に活用を始めている」ことを伝えて、プロジェクトが動き出している感覚をつくる。");
  }

  // ================= 4. Market =================
  {
    const s = contentSlide("02｜WHY NOW", "市場環境の変化：「待つ営業」が通用しなくなっている");
    const rows = [
      ["FaUserFriends", "高齢化の進行と需要の拡大", "後期高齢者が増え、在宅で医療・介護を受ける方が増加", "潜在需要は拡大。一方で参入事業者も増え、選ばれる理由が問われる"],
      ["FaUserClock", "ケアマネ・施設の人手不足", "担当件数が多く、業者の話をじっくり聞く時間がない", "訪問して説明する営業は、会ってもらうこと自体が難しくなる"],
      ["FaMobileAlt", "意思決定者は“子世代”", "利用を決めるのは、スマホで調べる40〜60代のご家族が多い", "検索・SNSで見つからない事業者は、比較の土俵にすら乗らない"],
      ["FaVideo", "情報接触の“動画化”", "高齢層・子世代ともにYouTube・SNSでの動画視聴が日常化", "文字だけのチラシ・パンフレットでは違いが伝わらない"],
      ["FaSyncAlt", "貴社の体制変化（合併）", "合併・メーカー統廃合を経て、新体制での再スタート期", "ブランドを再定義し、発信を仕切り直せる“今”が最適なタイミング"],
    ];
    txt(s, "変化", { x: MX + 0.95, y: 1.55, w: 3, h: 0.3, fontSize: 11, bold: true, color: C.muted });
    txt(s, "起きていること", { x: 4.35, y: 1.55, w: 3, h: 0.3, fontSize: 11, bold: true, color: C.muted });
    txt(s, "貴社への影響", { x: 8.55, y: 1.55, w: 3, h: 0.3, fontSize: 11, bold: true, color: C.accent });
    for (let i = 0; i < rows.length; i++) {
      const y = 1.9 + i * 1.0;
      card(s, MX, y, CW, 0.85, i === 4 ? C.accentLight : C.light2, false);
      await iconCircle(s, rows[i][0], MX + 0.18, y + 0.12, 0.6, i === 4 ? C.accent : C.primary, C.white);
      txt(s, rows[i][1], { x: MX + 0.95, y, w: 2.7, h: 0.85, fontSize: 14, bold: true, color: i === 4 ? C.accent : C.primary, valign: "middle" });
      txt(s, rows[i][2], { x: 4.35, y, w: 3.8, h: 0.85, fontSize: 12, valign: "middle" });
      s.addImage({ data: await icon("FaArrowRight", C.accent), x: 8.18, y: y + 0.3, w: 0.25, h: 0.25 });
      txt(s, rows[i][3], { x: 8.55, y, w: 4.0, h: 0.85, fontSize: 12, bold: true, valign: "middle" });
    }
  }

  // ================= 5. Issues =================
  {
    const s = contentSlide("02｜WHY NOW", "貴社が直面していると想定される本質的課題（仮説）",
      "前回は明確な課題を伺えていないため、同業に共通する構造的課題を仮説として整理しました。本日、該当度をご確認ください。");
    const issues = [
      ["紹介ルートの属人化", "紹介元との関係が特定の担当者・会長ご自身の人脈に依存", "担当者の異動・退職やケアマネの交代で紹介が止まる"],
      ["面談化率の低下", "訪問・FAXしても「パンフレットを置いておいて」で終わる", "接点はあるのに利用者紹介につながらない"],
      ["資料送付後の離脱", "パンフレットが読まれない／ご家族まで届かない", "「保険で受けられる」等の最重要情報が伝わらない"],
      ["サービス理解の壁", "訪問リハビリ・整体との違いが伝わっていない", "比較されず、知っている事業者・大手に流れる"],
      ["保険事業との相乗効果が未活用", "保険のお客様やそのご家族に介護事業を案内できていない", "最も信頼関係のある見込み客層を取りこぼす"],
      ["施術者の採用", "有資格者（あん摩マッサージ指圧師等）の採用競争が激しい", "需要があっても受け入れ枠を増やせない"],
    ];
    const cw = (CW - 0.6) / 3, ch = 2.3;
    for (let i = 0; i < 6; i++) {
      const x = MX + (i % 3) * (cw + 0.3), y = 1.9 + Math.floor(i / 3) * (ch + 0.22);
      card(s, x, y, cw, ch);
      numCircle(s, i + 1, x + 0.25, y + 0.22, 0.5, C.primary, C.white, 15);
      txt(s, issues[i][0], { x: x + 0.9, y: y + 0.22, w: cw - 1.1, h: 0.5, fontSize: 15, bold: true, color: C.primary, valign: "middle" });
      txt(s, "現象", { x: x + 0.25, y: y + 0.85, w: 0.6, h: 0.3, fontSize: 10.5, bold: true, color: C.muted });
      txt(s, issues[i][1], { x: x + 0.85, y: y + 0.83, w: cw - 1.1, h: 0.7, fontSize: 12 });
      txt(s, "リスク", { x: x + 0.25, y: y + 1.55, w: 0.6, h: 0.3, fontSize: 10.5, bold: true, color: C.accent });
      txt(s, issues[i][2], { x: x + 0.85, y: y + 1.53, w: cw - 1.1, h: 0.7, fontSize: 12, bold: true });
    }
    s.addNotes("ここが本商談の最重要パート。6つの仮説を一つずつ指し示し、「この中で一番近いものはどれですか？」と聞く。会長ご自身の言葉で課題を語っていただくまで次に進まない。数字（紹介件数・利用者数）もここで確認する。");
  }

  // ================= 6. Why not "make and wait" =================
  {
    const s = contentSlide("02｜WHY NOW", "「動画を作って放置する（反応待ち）」では成果が出ない理由");
    const rows = [
      ["届く人数", "HPに来た人しか見ない", "ケアマネ・施設・保険顧客・SNSへ能動的に届ける"],
      ["判断材料", "再生数が少なく「効果があるのか分からない」まま終わる", "送付数・視聴率・問い合わせ数を数値で比較できる"],
      ["改善", "1本で終わり、何が良く何が悪かったか学べない", "検証結果から台本・尺・訴求を改善し続ける"],
      ["営業との接続", "営業現場で使われず、担当者の手間も減らない", "訪問前後・FAX・メールに組み込まれ、営業の型になる"],
      ["結論", "「動画は効果がなかった」という誤った判断に至る", "紹介・問い合わせが増える“仕組み”が残る"],
    ];
    const lx = MX + 1.9, colw = 4.95, gap = 0.3;
    const rx = lx + colw + gap;
    card(s, lx, 1.55, colw, 0.6, C.gray, false);
    txt(s, "作って放置（反応待ち）", { x: lx, y: 1.55, w: colw, h: 0.6, fontSize: 15, bold: true, color: C.grayText, align: "center", valign: "middle" });
    card(s, rx, 1.55, colw, 0.6, C.primary, false);
    txt(s, "戦略設計 ＋ 運用", { x: rx, y: 1.55, w: colw, h: 0.6, fontSize: 15, bold: true, color: C.white, align: "center", valign: "middle" });
    for (let i = 0; i < rows.length; i++) {
      const y = 2.3 + i * 0.78;
      const last = i === rows.length - 1;
      txt(s, rows[i][0], { x: MX, y, w: 1.8, h: 0.66, fontSize: 13, bold: true, color: C.primary, valign: "middle" });
      card(s, lx, y, colw, 0.66, C.light2, false);
      await iconCircle(s, "FaTimes", lx + 0.15, y + 0.16, 0.34, "D9DEDD", C.grayText);
      txt(s, rows[i][1], { x: lx + 0.62, y, w: colw - 0.75, h: 0.66, fontSize: 12, color: last ? C.text : C.grayText, bold: last, valign: "middle" });
      card(s, rx, y, colw, 0.66, last ? C.accentLight : C.light, false);
      await iconCircle(s, "FaCheck", rx + 0.15, y + 0.16, 0.34, last ? C.accent : C.primary, C.white);
      txt(s, rows[i][2], { x: rx + 0.62, y, w: colw - 0.75, h: 0.66, fontSize: 12, bold: true, color: C.dark, valign: "middle" });
    }
    txt(s, [
      { text: "動画は“置く”ものではなく“使う”もの。", options: { bold: true, color: C.accent, breakLine: true } },
      { text: "成果を分けるのは出来栄えではなく、「誰に・いつ・どう届け・どう改善するか」という運用設計です。", options: { color: C.text } },
    ], { x: MX, y: 6.25, w: CW, h: 0.7, fontSize: 14, align: "center", valign: "middle" });
    s.addNotes("「無料の3本を作って様子を見る」という姿勢そのものが、成果が出ない進め方であることを論理的に伝えるスライド。お客様を否定せず、「多くの企業様がここでつまずく」という第三者の事例として話す。");
  }

  // ================= 7. Why MiTok / Why Us =================
  {
    const s = contentSlide("02｜WHY MiTok / WHY US", "なぜ「動画 × 生成AI（MiTok）」で、なぜアイドマなのか");
    const feats = [
      ["FaComments", "AI掛け合い（対話型）の動画", "「ご家族の疑問」×「専門スタッフの回答」形式で、医療保険・同意書など難しい制度も自然に理解できる"],
      ["FaLayerGroup", "短期間・低コストで量産", "ケアマネ向け／施設向け／ご家族向け／求人向けなど、ターゲット別に作り分けられる"],
      ["FaEdit", "修正・差し替えが容易", "制度改定・料金変更・キャンペーン内容の変更にもすぐ対応できる"],
      ["FaRecycle", "二次利用しやすい", "HP・SNS・メール・LINE・QR付きチラシ・施設での上映など、あらゆる接点で使い回せる"],
      ["FaUserShield", "撮影不要", "施術中の利用者様を撮影せずに済み、プライバシー配慮と現場負担の軽減を両立"],
    ];
    txt(s, "Why MiTok", { x: MX, y: 1.5, w: 4, h: 0.4, fontSize: 16, bold: true, color: C.accent });
    for (let i = 0; i < feats.length; i++) {
      const y = 2.0 + i * 0.95;
      await iconCircle(s, feats[i][0], MX, y + 0.05, 0.6, C.light, C.primary);
      txt(s, feats[i][1], { x: MX + 0.8, y, w: 6.6, h: 0.35, fontSize: 14, bold: true, color: C.primary });
      txt(s, feats[i][2], { x: MX + 0.8, y: y + 0.36, w: 6.6, h: 0.52, fontSize: 11.5 });
    }
    const rx = 8.4, rw = W - MX - rx;
    card(s, rx, 1.5, rw, 5.35, C.dark, false);
    txt(s, "Why アイドマ", { x: rx + 0.35, y: 1.75, w: rw - 0.7, h: 0.4, fontSize: 16, bold: true, color: "F2A673" });
    const us = [
      ["“売れる導線”の設計力", "営業・マーケティング支援を本業とする会社として、動画を「商談・紹介」につなげる設計からご支援"],
      ["プッシュ×プルをワンストップ", "営業アプローチとWebマーケティングを分断せず、一体で設計・運用"],
      ["貴社の強みをスケール", "「地域密着」「深い顧客関係」という貴社の資産を、動画で広げることに主眼を置く"],
    ];
    for (let i = 0; i < us.length; i++) {
      const y = 2.35 + i * 1.45;
      numCircle(s, i + 1, rx + 0.35, y, 0.45, C.accent, C.white, 13);
      txt(s, us[i][0], { x: rx + 0.95, y, w: rw - 1.25, h: 0.45, fontSize: 14, bold: true, color: C.white, valign: "middle" });
      txt(s, us[i][1], { x: rx + 0.95, y: y + 0.5, w: rw - 1.25, h: 0.85, fontSize: 11.5, color: "D6E6E3" });
    }
  }

  // ================= 8. Push targets =================
  {
    const s = contentSlide("03｜PUSH STRATEGY", "プッシュ型営業：紹介元と決定者の両方へ“先回り”して届ける",
      "訪問マッサージの利用者獲得は「紹介元（ケアマネ・施設・医師）」と「決定者（ご家族）」の2層構造です。");
    const hl = { fill: { color: C.accentLight } };
    table(s, ["ターゲット", "相手の本音・関心", "届ける動画テーマ（例）", "主なチャネル"], [
      ["居宅介護支援事業所\n（ケアマネジャー）", "紹介してトラブルにならないか／手続きが面倒ではないか", "ケアマネさんのための3分でわかる訪問マッサージ｜紹介から開始までの流れ", "訪問前メール／FAX（QR付）／フォーム営業／訪問後フォロー"],
      ["介護施設\n（有料老人ホーム・サ高住等）", "施設の業務負担が増えないか／入居者満足につながるか", "施設様向け｜導入で入居者様に起きる変化と施設側の手間", "施設長宛DM（QR付）／フォーム営業／説明会での上映"],
      ["医療機関\n（医師・地域連携室）", "制度的に問題ないか／患者の状態を共有してくれるか", "訪問マッサージの同意書と報告体制について", "地域連携室への郵送・メール／訪問時の案内"],
      [{ text: "既存の保険顧客\n（契約者様・ご家族）", options: hl }, { text: "親の足腰が弱ってきた／どこに相談すればいいか分からない", options: hl }, { text: "保険のみらい設計が、ご自宅でのケアもお手伝いしています", options: hl }, { text: "保険更新・点検時の案内／メルマガ・LINE／郵送物同封", options: hl }],
      ["ご家族\n（直接の問い合わせ者）", "費用はいくら？／本当に保険が使える？／どんな人が来る？", "よくあるご質問にスタッフがお答えします", "問い合わせ後の自動返信／初回面談前の事前送付"],
    ], { x: MX, y: 1.8, w: CW, colW: [2.5, 3.2, 3.6, 2.83], rowH: [0.45, 0.72, 0.72, 0.72, 0.72, 0.72], size: 11, hsize: 11.5 });
    await iconCircle(s, "FaStar", MX, 6.33, 0.5, C.accent, C.white);
    txt(s, [
      { text: "最大の差別化ポイント：", options: { bold: true, color: C.accent } },
      { text: "保険代理店として築いた既存顧客との信頼関係を、介護事業の案内に活かせるのは貴社だけです。（個人情報の利用目的の範囲内で実施するよう事前に設計します）" },
    ], { x: MX + 0.65, y: 6.25, w: CW - 0.65, h: 0.66, fontSize: 11.5, valign: "middle" });
    s.addNotes("保険顧客へのクロスセルは貴社にしかない強みとして強調する。「保険の更新・点検のタイミングで、ご家族向けの動画を1本添えるだけ」と、手間が増えないことを伝える。");
  }

  // ================= 9. Push process =================
  {
    const s = contentSlide("03｜PUSH STRATEGY", "営業プロセスへの組み込み：6つの接点すべてに動画を置く");
    const steps = [
      ["初回接触", "飛び込み・電話・FAX", "動画QR付きのFAX・DM・フォーム営業で「まず3分」", "アポ獲得率UP"],
      ["訪問前", "当日に一から説明", "訪問前に動画を送り、基本説明を事前に済ませる", "面談化率UP"],
      ["面談・訪問", "パンフレットで口頭説明", "タブレットで一緒に視聴し、説明品質を統一", "属人化の解消"],
      ["訪問後", "お礼の電話のみ", "「本日のおさらい動画」をメール・LINEで送付", "ケアマネが転送できる"],
      ["ご家族への説明", "ケアマネが口頭で伝える", "ケアマネ経由でご家族向け動画が届く", "決定者に正確に届く"],
      ["定期接点", "年末年始の挨拶程度", "月1回の動画メルマガ（制度・事例・季節のケア）", "紹介が継続する"],
    ];
    const n = steps.length, gap = 0.16, bw = (CW - gap * (n - 1)) / n;
    txt(s, "従来", { x: MX, y: 2.55, w: 1, h: 0.3, fontSize: 10.5, bold: true, color: C.grayText });
    for (let i = 0; i < n; i++) {
      const x = MX + i * (bw + gap);
      card(s, x, 1.6, bw, 0.8, C.primary, false);
      txt(s, `STEP ${i + 1}`, { x, y: 1.65, w: bw, h: 0.3, fontSize: 10, bold: true, color: "F2A673", align: "center" });
      txt(s, steps[i][0], { x, y: 1.93, w: bw, h: 0.42, fontSize: 14, bold: true, color: C.white, align: "center", valign: "middle" });
      card(s, x, 2.85, bw, 0.8, C.gray, false);
      txt(s, steps[i][1], { x: x + 0.12, y: 2.85, w: bw - 0.24, h: 0.8, fontSize: 11.5, color: C.grayText, align: "center", valign: "middle" });
      s.addImage({ data: await icon("FaArrowDown", C.accent), x: x + bw - 0.45, y: 3.78, w: 0.28, h: 0.28 });
      card(s, x, 4.15, bw, 1.55, C.light, false);
      txt(s, steps[i][2], { x: x + 0.14, y: 4.22, w: bw - 0.28, h: 1.42, fontSize: 12, bold: true, color: C.dark, valign: "middle" });
      card(s, x, 5.85, bw, 0.62, C.accentLight, false);
      txt(s, steps[i][3], { x: x + 0.08, y: 5.85, w: bw - 0.16, h: 0.62, fontSize: 12, bold: true, color: C.accent, align: "center", valign: "middle" });
    }
    txt(s, "MiTok導入後", { x: MX, y: 3.8, w: 2, h: 0.3, fontSize: 10.5, bold: true, color: C.primary });
    txt(s, "期待効果", { x: MX, y: 6.52, w: 2, h: 0.3, fontSize: 10.5, bold: true, color: C.accent });
  }

  // ================= 10. Mechanism + KPI =================
  {
    const s = contentSlide("03｜PUSH STRATEGY", "営業の負担を減らしながら、成果を上げる仕組み");
    const mech = [
      ["FaRobot", "説明の自動化", "繰り返す「制度説明」「開始までの流れ」は動画に任せ、担当者は関係構築に集中"],
      ["FaClipboardList", "営業の型化", "送る動画・タイミング・文面をテンプレート化し、誰がやっても同じ成果に"],
      ["FaChartBar", "反応の可視化", "視聴状況・問い合わせ経路を把握し、反応の良い事業所から優先訪問"],
      ["FaExchangeAlt", "紹介の“バトン”化", "ケアマネがご家族へ転送しやすい動画で、紹介時の説明負担を肩代わり"],
    ];
    for (let i = 0; i < mech.length; i++) {
      const y = 1.6 + i * 1.28;
      card(s, MX, y, 5.7, 1.12);
      await iconCircle(s, mech[i][0], MX + 0.22, y + 0.22, 0.68, C.primary, C.white);
      txt(s, mech[i][1], { x: MX + 1.1, y: y + 0.14, w: 4.4, h: 0.35, fontSize: 14, bold: true, color: C.primary });
      txt(s, mech[i][2], { x: MX + 1.1, y: y + 0.5, w: 4.45, h: 0.55, fontSize: 11.5 });
    }
    txt(s, "プッシュ施策のKPI（例）", { x: 6.75, y: 1.6, w: 5, h: 0.4, fontSize: 15, bold: true, color: C.accent });
    table(s, ["指標", "定義", "測定方法"], [
      ["送付数", "動画を届けた事業所・顧客数", "送付リスト管理"],
      ["視聴率", "送付数に対する視聴数", "URL別アクセス数"],
      ["アポ獲得率", "送付先のうち面談・訪問に至った割合", "営業管理表"],
      ["紹介件数", "ケアマネ・施設・医療機関からの紹介数", "問い合わせ経路の記録"],
      ["利用開始数", "紹介・問い合わせから施術開始に至った数", "利用者台帳"],
    ], { x: 6.75, y: 2.1, w: 5.98, colW: [1.35, 2.85, 1.78], rowH: 0.62, size: 11.5 });
    txt(s, "※具体的な目標値は、本日伺う現状数値（紹介件数・訪問件数・利用者数など）をもとにフェーズ1開始時に設定します。", {
      x: 6.75, y: 6.0, w: 5.98, h: 0.6, fontSize: 10.5, color: C.muted,
    });
  }

  // ================= 11. Pull platforms =================
  {
    const s = contentSlide("04｜PULL STRATEGY", "プル型Webマーケティング：媒体ごとに役割を分ける");
    const pf = [
      ["FaYoutube", "YouTube", "理解・比較検討", "長尺解説（5〜10分）", "情報を詳しく調べたいご家族、ケアマネジャー", ["訪問マッサージとは？医療保険で受けられる条件を解説", "訪問マッサージと訪問リハビリの違い", "利用開始までの5ステップ"]],
      ["FaInstagram", "Instagram", "信頼・親近感", "デザイン重視（フィード・リール）", "30〜50代の子世代、地域の方、求職者", ["スタッフ紹介／1日の訪問の流れ", "ご家族の声（許諾済み）", "季節の在宅ケアのポイント"]],
      ["FaTiktok", "TikTok／ショート", "認知拡大", "縦型ショート（15〜60秒）", "幅広い層（特に子世代・孫世代）、求職者", ["知らないと損！親のマッサージ、保険が使えるかも", "寝たきりの親に家族ができること3選", "施術者の本音Q&A"]],
    ];
    const cw = (CW - 0.6) / 3;
    for (let i = 0; i < 3; i++) {
      const x = MX + i * (cw + 0.3), y = 1.55, h = 5.3;
      card(s, x, y, cw, h);
      await iconCircle(s, pf[i][0], x + 0.3, y + 0.3, 0.75, C.primary, C.white);
      txt(s, pf[i][1], { x: x + 1.2, y: y + 0.28, w: cw - 1.4, h: 0.45, fontSize: 18, bold: true, color: C.primary });
      txt(s, "役割：" + pf[i][2], { x: x + 1.2, y: y + 0.72, w: cw - 1.4, h: 0.35, fontSize: 12.5, bold: true, color: C.accent });
      txt(s, "動画の型", { x: x + 0.3, y: y + 1.3, w: cw - 0.6, h: 0.28, fontSize: 10.5, bold: true, color: C.muted });
      txt(s, pf[i][3], { x: x + 0.3, y: y + 1.58, w: cw - 0.6, h: 0.35, fontSize: 13, bold: true });
      txt(s, "主な視聴者", { x: x + 0.3, y: y + 2.05, w: cw - 0.6, h: 0.28, fontSize: 10.5, bold: true, color: C.muted });
      txt(s, pf[i][4], { x: x + 0.3, y: y + 2.33, w: cw - 0.6, h: 0.6, fontSize: 12 });
      card(s, x + 0.2, y + 3.05, cw - 0.4, 2.05, C.light, false);
      txt(s, "コンテンツ例", { x: x + 0.4, y: y + 3.15, w: cw - 0.8, h: 0.3, fontSize: 10.5, bold: true, color: C.primary });
      txt(s, pf[i][5].map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < pf[i][5].length - 1 } })), {
        x: x + 0.4, y: y + 3.45, w: cw - 0.8, h: 1.55, fontSize: 11.5, paraSpaceAfter: 4,
      });
    }
  }

  // ================= 12. Rough images =================
  {
    const s = contentSlide("04｜PULL STRATEGY", "動画ラフイメージの提示方針（3つの型）");
    const types = [
      { name: "① 長尺解説型", use: "YouTube／HP掲載／ケアマネ送付用", len: "3〜8分", fw: 2.6, fh: 1.46,
        flow: ["よくある悩みの提示", "訪問マッサージとは", "保険適用の条件・同意書", "費用の目安・流れ", "選ばれる理由", "お問い合わせ案内"],
        tone: "落ち着き・安心感。専門用語は必ず言い換え", goal: "「自分の家族も対象かも」と理解し問い合わせる" },
      { name: "② デザイン重視型", use: "Instagram／HP／パンフレット連動", len: "30〜90秒", fw: 1.5, fh: 1.5,
        flow: ["印象的な一文「ご自宅が、ケアの場所になる。」", "サービスの特長3つ", "スタッフの想い", "対応エリア", "プロフィールへ誘導"],
        tone: "温かさ・清潔感。「安心・安全・安堵」を視覚で表現", goal: "フォロー・保存され、必要なときに思い出される" },
      { name: "③ 縦型ショート型", use: "TikTok／YouTubeショート／リール", len: "15〜60秒", fw: 0.86, fh: 1.52,
        flow: ["フック「親のマッサージ、保険が使えるって知ってた？」", "答え（条件を一言で）", "詳しくはプロフィールへ"],
        tone: "親しみやすさ・意外性。ただし誇張は避ける", goal: "認知拡大と、長尺動画・HPへの送客" },
    ];
    const cw = (CW - 0.6) / 3;
    for (let i = 0; i < 3; i++) {
      const t = types[i], x = MX + i * (cw + 0.3);
      card(s, x, 1.5, cw, 2.1, C.light, false);
      // thumbnail rough image
      const img = ["youtube", "instagram", "tiktok"][i], ar = [1280 / 720, 1080 / 1560, 1080 / 1920][i];
      const th = 1.9, tw = th * ar;
      s.addImage({ path: TH + img + ".png", x: x + (cw - tw) / 2, y: 1.6, w: tw, h: th, rounding: false, shadow: shadow() });
      txt(s, "尺：" + t.len, { x: x + cw - 1.3, y: 3.8, w: 1.3, h: 0.3, fontSize: 11, color: C.accent, align: "right", bold: true });
      txt(s, t.name, { x, y: 3.75, w: cw, h: 0.4, fontSize: 16, bold: true, color: C.primary });
      txt(s, t.use, { x, y: 4.13, w: cw, h: 0.3, fontSize: 11, color: C.muted });
      txt(s, t.flow.map((f, k) => ({ text: f, options: { bullet: { type: "number" }, breakLine: k < t.flow.length - 1 } })), {
        x, y: 4.5, w: cw, h: 1.45, fontSize: 11, paraSpaceAfter: 1,
      });
      txt(s, [
        { text: "トーン：", options: { bold: true, color: C.primary } }, { text: t.tone, options: { breakLine: true } },
        { text: "ゴール：", options: { bold: true, color: C.accent } }, { text: t.goal },
      ], { x, y: 6.0, w: cw, h: 0.85, fontSize: 11 });
    }
    s.addNotes("MiTokのAI掛け合い形式（ご家族役が質問し、専門スタッフ役が回答）を前提としたラフ。無料3本はこの3つの型を1本ずつ制作する（フェーズ1のスライドにつなげる）。");
  }

  // ================= 12b. Thumbnail showcase =================
  {
    const s = contentSlide("04｜PULL STRATEGY", "サムネイル・画面イメージ（ラフ案）",
      "無料3本のうち、プル施策で活用する動画の“見え方”のイメージです。媒体ごとに、最初の1秒で伝えることを変えています。");
    const ims = [["youtube", MX, 5.3, 5.3 * 720 / 1280], ["instagram", 6.45, 4.15 * 1080 / 1560, 4.15], ["tiktok", 9.9, 4.15 * 1080 / 1920, 4.15]];
    const caps = ["YouTube｜長尺解説のサムネイル", "Instagram｜フィード投稿", "TikTok／ショート｜冒頭画面"];
    for (let i = 0; i < 3; i++) {
      const [img, x, w, h] = ims[i];
      s.addImage({ path: TH + img + ".png", x, y: 1.95, w, h, shadow: shadow() });
      if (i > 0) txt(s, caps[i], { x: x - 0.2, y: 6.18, w: w + 0.4, h: 0.3, fontSize: 11, bold: true, color: C.primary, align: "center" });
    }
    const pts = [
      ["YouTube", "検索で比較される前提で「保険」「条件」を大きく。対象者を明示してクリック率を高める"],
      ["Instagram", "世界観と安心感を優先。保存されやすいよう特長を3つのチップに整理"],
      ["TikTok", "冒頭2秒の問いかけ＋MiTokの掛け合い吹き出しでスクロールを止める"],
    ];
    for (let i = 0; i < 3; i++) {
      const y = 5.12 + i * 0.47;
      card(s, MX, y, 5.3, 0.4, i === 0 ? C.light : C.light2, false);
      txt(s, pts[i][0], { x: MX + 0.12, y, w: 1.05, h: 0.4, fontSize: 10.5, bold: true, color: C.accent, valign: "middle" });
      txt(s, pts[i][1], { x: MX + 1.15, y, w: 4.1, h: 0.4, fontSize: 9.5, valign: "middle" });
    }
    txt(s, "※イラスト・アカウント名・再生時間は仮のものです。本制作では貴社のロゴ・写真・スタッフ素材を使用します。医療保険に触れる表現には「医師の同意が必要」である旨を必ず併記します。", {
      x: MX, y: 6.55, w: CW, h: 0.42, fontSize: 9.5, color: C.muted,
    });
    s.addNotes("「無料3本」の完成イメージを具体的に見せることで、制作後の活用シーンを想像していただく。サムネイルは媒体ごとに役割が違う（YouTube＝比較検討、Instagram＝信頼・保存、TikTok＝認知）ことを改めて伝える。");
  }

  // ================= 12c. Storyboard =================
  {
    const s = contentSlide("04｜PULL STRATEGY", "長尺解説動画の絵コンテ（ラフ案）：MiTokの掛け合い構成");
    const fr = [["story1", "0:00｜悩みの提示", "ご家族役が「どこに相談すれば？」と共感を呼ぶ"], ["story2", "1:30｜訪問マッサージとは", "専門スタッフ役が制度を3点で解説"], ["story3", "3:00｜開始までの流れ", "5ステップ図で不安を解消"], ["story4", "5:30｜お問い合わせ案内", "電話・LINEの2択で行動を促す"]];
    const fw = 3.75, fh = fw * 720 / 1280, gx = 0.3;
    for (let i = 0; i < 4; i++) {
      const x = MX + (i % 2) * (fw + gx), y = 1.55 + Math.floor(i / 2) * (fh + 0.62);
      s.addImage({ path: TH + fr[i][0] + ".png", x, y, w: fw, h: fh, shadow: shadow() });
      txt(s, [{ text: fr[i][1] + "　", options: { bold: true, color: C.primary } }, { text: fr[i][2], options: { color: C.text } }], { x, y: y + fh + 0.08, w: fw, h: 0.5, fontSize: 10.5 });
    }
    const rx = MX + 2 * fw + gx + 0.35, rw = W - MX - rx;
    card(s, rx, 1.55, rw, 5.3, C.light, false);
    txt(s, "構成のポイント", { x: rx + 0.3, y: 1.75, w: rw - 0.6, h: 0.4, fontSize: 15, bold: true, color: C.primary });
    const pts = [
      ["対話で理解が進む", "ご家族役の素朴な疑問にスタッフ役が答える形式で、制度の説明も自然に頭に入る"],
      ["テロップで要点を固定", "音声なしで見られても伝わるよう、各シーンの結論を下部テロップに表示"],
      ["1本で全ターゲットに", "ケアマネへの事前送付、HP掲載、ご家族への案内に同じ動画を使い回せる"],
    ];
    for (let i = 0; i < pts.length; i++) {
      const y = 2.3 + i * 1.45;
      numCircle(s, i + 1, rx + 0.3, y, 0.42, C.accent, C.white, 12);
      txt(s, pts[i][0], { x: rx + 0.85, y, w: rw - 1.1, h: 0.42, fontSize: 13, bold: true, color: C.dark, valign: "middle" });
      txt(s, pts[i][1], { x: rx + 0.85, y: y + 0.45, w: rw - 1.1, h: 0.9, fontSize: 11 });
    }
    s.addNotes("絵コンテは台本作成前のたたき台。貴社にご用意いただくスライド資料の内容をもとに、各シーンのセリフを具体化していく。");
  }

  // ================= 13. Funnel =================
  {
    const s = contentSlide("04｜PULL STRATEGY", "認知から問い合わせ・紹介までのファネル設計");
    const st = [
      ["認知", "TikTok／ショート／リール", "縦型ショート", "プロフィール→YouTube・HP", "再生数・リーチ数"],
      ["興味・関心", "Instagram／YouTube", "デザイン重視／長尺解説", "フォロー・保存・登録", "保存数・視聴維持率"],
      ["比較・検討", "YouTube／HP／Googleマップ", "長尺解説・FAQ", "問い合わせフォーム・電話・LINE", "HP遷移数"],
      ["問い合わせ", "HP／LINE／電話", "FAQ動画（自動返信内）", "無料相談・体験の予約", "問い合わせ数"],
      ["利用開始", "初回面談・同意書取得", "事前送付動画", "施術開始", "利用開始数"],
      ["継続・紹介", "定期便り・LINE", "季節のケア動画", "ご近所・知人への紹介", "継続率・紹介数"],
    ];
    const heads = ["主な接点", "動画の型", "次の行動への導線", "測定指標"];
    const cx = [4.05, 6.35, 8.55, 10.85], cws = [2.2, 2.1, 2.2, 1.88];
    for (let j = 0; j < 4; j++) txt(s, heads[j], { x: cx[j], y: 1.5, w: cws[j], h: 0.3, fontSize: 11, bold: true, color: C.muted });
    const fw0 = 3.2, cxF = MX + 1.65;
    for (let i = 0; i < st.length; i++) {
      const y = 1.88 + i * 0.83, w = fw0 - i * 0.36;
      const col = i >= 3 ? C.accent : C.primary;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cxF - w / 2, y, w, h: 0.7, rectRadius: 0.1, fill: { color: col, transparency: i >= 3 ? 0 : i * 12 }, line: { color: col, width: 0 } });
      txt(s, st[i][0], { x: cxF - w / 2, y, w, h: 0.7, fontSize: 14, bold: true, color: C.white, align: "center", valign: "middle" });
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 3.9, y, w: W - MX - 3.9, h: 0.7, rectRadius: 0.08, fill: { color: i % 2 ? C.white : C.light2 }, line: { color: "DCE7E5", width: 0.75 } });
      for (let j = 0; j < 4; j++) txt(s, st[i][j + 1], { x: cx[j], y, w: cws[j], h: 0.7, fontSize: 11.5, valign: "middle", bold: j === 3, color: j === 3 ? C.primary : C.text });
    }
  }

  // ================= 14. Compliance =================
  {
    const s = contentSlide("04｜PULL STRATEGY", "広告規制への配慮：安心して使い続けられる動画にする",
      "訪問マッサージ（あん摩マッサージ指圧・はり・きゅう）の広告は、法令により表示できる内容が制限されています。");
    const items = [
      ["FaBan", "効果・効能を断定しない", "「治る」「必ず良くなる」など、効果・効能を断定・保証する表現を用いません。"],
      ["FaIdCard", "資格・技能は法令の範囲で表記", "施術者の資格・技能の表記は、法令で認められた範囲で行います。"],
      ["FaUserLock", "利用者様の声は許諾と匿名化", "ご利用者様の声・写真は必ず書面で許諾を取得し、個人が特定されない形で使用します。"],
      ["FaClipboardCheck", "公開前のダブルチェック", "最終的な表現は、必要に応じて貴社および関係機関のご確認を経て公開します。"],
    ];
    const cw = (CW - 0.3) / 2, ch = 1.9;
    for (let i = 0; i < 4; i++) {
      const x = MX + (i % 2) * (cw + 0.3), y = 2.05 + Math.floor(i / 2) * (ch + 0.3);
      card(s, x, y, cw, ch);
      await iconCircle(s, items[i][0], x + 0.35, y + 0.35, 0.85, C.light, C.primary);
      txt(s, items[i][1], { x: x + 1.5, y: y + 0.35, w: cw - 1.8, h: 0.45, fontSize: 16, bold: true, color: C.primary });
      txt(s, items[i][2], { x: x + 1.5, y: y + 0.85, w: cw - 1.8, h: 0.85, fontSize: 12.5 });
    }
    txt(s, "台本作成の段階から配慮することで、「攻めた表現で公開して後から差し替え」とならない設計にします。", {
      x: MX, y: 6.5, w: CW, h: 0.4, fontSize: 12.5, bold: true, color: C.accent, align: "center",
    });
    s.addNotes("広告規制は断定的な法解釈を述べず、「配慮して設計する」旨の説明にとどめる。");
  }

  // ================= 15. Phase 1 definition =================
  {
    const s = contentSlide("05｜PHASE 1", "無料3本は「サービス紹介」ではなく「効果検証のプロトタイプ」");
    card(s, MX, 1.5, CW, 0.9, C.dark, false);
    txt(s, "プッシュとプル、どの型・どのターゲット・どのチャネルが最も成果につながるかを、\nあえて条件を変えた3本で同時に比較検証します。", {
      x: MX + 0.4, y: 1.5, w: CW - 0.8, h: 0.9, fontSize: 15, bold: true, color: C.white, valign: "middle",
    });
    const v = [
      ["1本目", "プッシュ検証", "長尺解説型", "ケアマネジャー・介護施設", "3分でわかる訪問マッサージ｜紹介から施術開始までの流れ", "FAX・DM（QR）、訪問前後のメール、フォーム営業", "事前送付で面談化率・紹介件数は上がるか", "視聴率／アポ獲得率／紹介件数"],
      ["2本目", "プル検証（信頼形成）", "デザイン重視型", "ご家族（子世代）", "みらい設計の訪問マッサージ｜ご自宅が、安心のケアの場所に", "Instagram、HP、保険顧客への案内", "保険顧客・ご家族に届けると問い合わせは発生するか", "保存数／HP遷移数／問い合わせ数"],
      ["3本目", "プル検証（認知拡大）", "縦型ショート型", "幅広い地域の方", "親のマッサージ、保険が使えるかも？", "TikTok、YouTubeショート、リール", "地域でどの程度の認知が取れ、どの訴求が響くか", "再生数／視聴維持率／プロフィール遷移数"],
    ];
    const labels = ["ターゲット", "テーマ案", "配信先", "検証する仮説", "主なKPI"];
    const cw = (CW - 0.6) / 3;
    for (let i = 0; i < 3; i++) {
      const x = MX + i * (cw + 0.3), y = 2.65;
      card(s, x, y, cw, 4.2);
      numCircle(s, i + 1, x + 0.25, y + 0.2, 0.55, C.accent, C.white, 16);
      txt(s, v[i][1], { x: x + 0.95, y: y + 0.15, w: cw - 1.1, h: 0.38, fontSize: 15, bold: true, color: C.primary });
      txt(s, v[i][2], { x: x + 0.95, y: y + 0.5, w: cw - 1.1, h: 0.3, fontSize: 11.5, bold: true, color: C.accent });
      for (let k = 0; k < 5; k++) {
        const ly = y + 0.98 + k * 0.63;
        txt(s, labels[k], { x: x + 0.25, y: ly, w: 1.15, h: 0.55, fontSize: 10.5, bold: true, color: C.muted });
        txt(s, v[i][3 + k], { x: x + 1.4, y: ly, w: cw - 1.6, h: 0.58, fontSize: 11, bold: k === 3 });
      }
    }
    s.addNotes("「無料3本＝お試し」ではなく「検証」であることを強調する。検証である以上、KPIと比較軸を最初に決めておく必要があり、その設計自体が伴走の価値であると伝える。");
  }

  // ================= 16. Phase 1 schedule + limits =================
  {
    const s = contentSlide("05｜PHASE 1", "フェーズ1の進め方（約6週間）と、3本だけで終える限界");
    const sch = [
      ["1週目", "キックオフ", "現状数値の確認／KPI設定／台本作成", "資料・素材のご提供、現状数値の共有"],
      ["2週目", "制作", "3本の制作・初稿確認・修正", "初稿のご確認（30分程度）"],
      ["3〜5週目", "配信・送付", "プッシュ：送付リスト作成・送付／プル：SNS投稿", "営業訪問時の動画活用"],
      ["6週目", "検証レポート会", "効果検証レポート＆フェーズ2設計会", "結果のご確認・次の打ち手の合意"],
    ];
    const lw = 7.3;
    txt(s, "スケジュール", { x: MX, y: 1.5, w: 3, h: 0.35, fontSize: 14, bold: true, color: C.accent });
    for (let i = 0; i < sch.length; i++) {
      const y = 1.95 + i * 1.22;
      const last = i === sch.length - 1;
      card(s, MX, y, 1.4, 1.02, last ? C.accent : C.primary, false);
      txt(s, sch[i][0], { x: MX, y: y + 0.1, w: 1.4, h: 0.4, fontSize: 14, bold: true, color: C.white, align: "center", valign: "middle" });
      txt(s, sch[i][1], { x: MX, y: y + 0.5, w: 1.4, h: 0.4, fontSize: 11, color: C.white, align: "center", valign: "middle" });
      card(s, MX + 1.55, y, lw - 1.55, 1.02, C.light2, false);
      txt(s, sch[i][2], { x: MX + 1.75, y: y + 0.1, w: lw - 1.95, h: 0.45, fontSize: 13, bold: true, color: C.dark, valign: "middle" });
      txt(s, "貴社：" + sch[i][3], { x: MX + 1.75, y: y + 0.55, w: lw - 1.95, h: 0.38, fontSize: 11, color: C.muted, valign: "middle" });
    }
    const rx = MX + lw + 0.4, rw = W - MX - rx;
    card(s, rx, 1.5, rw, 5.35, C.accentLight, false);
    await iconCircle(s, "FaExclamationTriangle", rx + 0.3, 1.75, 0.6, C.accent, C.white);
    txt(s, "3本だけで終えた場合の限界", { x: rx + 1.05, y: 1.75, w: rw - 1.25, h: 0.6, fontSize: 15, bold: true, color: C.accent, valign: "middle" });
    const lim = [
      ["成果まで届かない", "約1ヶ月・3本では「兆し」は掴めても、利用者増まで至らないのが一般的"],
      ["SNSの成長がリセット", "SNSは投稿の継続性が評価されるため、止めると積み上げが消える"],
      ["思い出してもらえない", "紹介は繰り返しの接点で生まれる。単発の送付では記憶に残らない"],
    ];
    for (let i = 0; i < lim.length; i++) {
      const y = 2.6 + i * 1.12;
      txt(s, lim[i][0], { x: rx + 0.3, y, w: rw - 0.6, h: 0.35, fontSize: 13, bold: true, color: C.dark });
      txt(s, lim[i][1], { x: rx + 0.3, y: y + 0.37, w: rw - 0.6, h: 0.65, fontSize: 11.5 });
    }
    txt(s, "だからこそ、フェーズ1は伴走プランの“初月”として設計します。", { x: rx + 0.3, y: 6.0, w: rw - 0.6, h: 0.7, fontSize: 12.5, bold: true, color: C.primary, valign: "middle" });
  }

  // ================= 17. Phase 2 scope =================
  {
    const s = contentSlide("06｜PHASE 2", "有料伴走プランで実施すること：制作から営業組み込みまで一気通貫");
    const sc = [
      ["FaVideo", "動画の追加生成", "検証で成果の出た型を中心に、ターゲット別・テーマ別に継続制作"],
      ["FaCalendarAlt", "配信運用", "SNS投稿カレンダー作成、投稿支援、YouTube最適化（タイトル・概要欄・サムネイル）"],
      ["FaHandshake", "営業プロセス組み込み", "送付リスト設計、FAX・DM・メール・フォーム営業の文面作成、送付フローの型化"],
      ["FaChartLine", "分析・改善", "月次レポート（視聴・問い合わせ・紹介の経路分析）、台本・訴求のA/Bテスト"],
      ["FaRecycle", "二次利用展開", "HP掲載、QR付きチラシ・パンフレット、施設説明会用動画、採用動画への展開"],
      ["FaUsers", "定例ミーティング", "月1回の定例で成果を確認し、翌月の施策を決定"],
    ];
    const cw = (CW - 0.6) / 3, ch = 2.35;
    for (let i = 0; i < 6; i++) {
      const x = MX + (i % 3) * (cw + 0.3), y = 1.6 + Math.floor(i / 3) * (ch + 0.3);
      card(s, x, y, cw, ch);
      await iconCircle(s, sc[i][0], x + 0.3, y + 0.3, 0.75, C.primary, C.white);
      txt(s, sc[i][1], { x: x + 1.2, y: y + 0.3, w: cw - 1.4, h: 0.75, fontSize: 16, bold: true, color: C.primary, valign: "middle" });
      txt(s, sc[i][2], { x: x + 0.3, y: y + 1.25, w: cw - 0.6, h: 0.95, fontSize: 12.5, lineSpacingMultiple: 1.1 });
    }
  }

  // ================= 18. Roadmap =================
  {
    const s = contentSlide("06｜PHASE 2", "12ヶ月の伴走ロードマップ");
    const rm = [
      ["1〜1.5ヶ月目", "助走期（フェーズ1）", ["無料3本の制作・配信", "効果検証"], "「勝ちパターン」の仮説特定"],
      ["2〜3ヶ月目", "立ち上げ期", ["勝ちパターンの横展開", "送付フローの型化", "SNS投稿の定常化"], "営業現場で動画を使うことが当たり前に"],
      ["4〜6ヶ月目", "拡大期", ["送付先エリアの拡大", "YouTube検索流入の強化", "保険顧客への定期案内・FAQ整備"], "紹介・問い合わせ件数の継続的な増加"],
      ["7〜12ヶ月目", "定着・自走期", ["動画ライブラリの完成", "社内運用への移管支援", "採用動画への展開"], "地域での第一想起と、仕組みで回る集客体制"],
    ];
    const n = 4, gap = 0.12, bw = (CW - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const x = MX + i * (bw + gap);
      const col = i === 0 ? C.accent : C.primary;
      s.addShape(i === 0 ? pres.shapes.PENTAGON : pres.shapes.CHEVRON, { x, y: 1.6, w: bw + (i < n - 1 ? 0.25 : 0), h: 1.0, fill: { color: col, transparency: i === 0 ? 0 : 30 - i * 10 }, line: { color: col, width: 0 } });
      txt(s, rm[i][0], { x: x + 0.35, y: 1.65, w: bw - 0.5, h: 0.4, fontSize: 12, color: C.white, bold: true, align: "center" });
      txt(s, rm[i][1], { x: x + 0.35, y: 2.02, w: bw - 0.5, h: 0.45, fontSize: 15, color: C.white, bold: true, align: "center" });
      card(s, x, 2.9, bw, 2.35, C.light2, false);
      txt(s, "主な実施内容", { x: x + 0.25, y: 3.02, w: bw - 0.5, h: 0.3, fontSize: 10.5, bold: true, color: C.muted });
      txt(s, rm[i][2].map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < rm[i][2].length - 1 } })), {
        x: x + 0.25, y: 3.35, w: bw - 0.4, h: 1.8, fontSize: 12, paraSpaceAfter: 5,
      });
      card(s, x, 5.45, bw, 1.35, i === 3 ? C.dark : C.light, false);
      txt(s, "到達目標", { x: x + 0.25, y: 5.55, w: bw - 0.5, h: 0.3, fontSize: 10.5, bold: true, color: i === 3 ? "F2A673" : C.accent });
      txt(s, rm[i][3], { x: x + 0.25, y: 5.85, w: bw - 0.5, h: 0.85, fontSize: 12.5, bold: true, color: i === 3 ? C.white : C.dark });
    }
  }

  // ================= 20. Seamless transition =================
  {
    const s = contentSlide("06｜SEAMLESS TRANSITION", "「テスト（無料3本）」から「本格展開」へ、止めずにつなぐ");
    const rows = [
      ["検証設計", "3本を「作ること」がゴールになりがち", "最初からKPI・比較軸を設計し、検証として実施"],
      ["検証後", "社内検討・見積り・契約で1〜2ヶ月の空白", "検証レポート当日に次の制作へ即着手"],
      ["SNS", "投稿が止まり、アカウント評価がリセット", "投稿が途切れず、成長が積み上がる"],
      ["営業現場", "「一時的な取り組み」として定着しない", "動画活用が営業の型として定着"],
      ["成果まで", "実質的に3〜4ヶ月後ろ倒し", "最短ルートで成果創出へ"],
    ];
    const lx = MX + 1.6, cw = 5.1, rx = lx + cw + 0.2;
    card(s, lx, 1.5, cw, 0.55, C.gray, false);
    txt(s, "様子見（無料3本 → 結果を見て検討）", { x: lx, y: 1.5, w: cw, h: 0.55, fontSize: 13, bold: true, color: C.grayText, align: "center", valign: "middle" });
    card(s, rx, 1.5, cw, 0.55, C.accent, false);
    txt(s, "早期ご決定（無料3本を伴走の初月に組み込み）", { x: rx, y: 1.5, w: cw, h: 0.55, fontSize: 13, bold: true, color: C.white, align: "center", valign: "middle" });
    for (let i = 0; i < rows.length; i++) {
      const y = 2.15 + i * 0.58;
      txt(s, rows[i][0], { x: MX, y, w: 1.5, h: 0.5, fontSize: 12.5, bold: true, color: C.primary, valign: "middle" });
      card(s, lx, y, cw, 0.5, C.light2, false);
      txt(s, rows[i][1], { x: lx + 0.2, y, w: cw - 0.4, h: 0.5, fontSize: 12, color: C.grayText, valign: "middle" });
      card(s, rx, y, cw, 0.5, C.accentLight, false);
      txt(s, rows[i][2], { x: rx + 0.2, y, w: cw - 0.4, h: 0.5, fontSize: 12, bold: true, color: C.dark, valign: "middle" });
    }
    txt(s, "移行の流れ", { x: MX, y: 5.2, w: 3, h: 0.35, fontSize: 14, bold: true, color: C.accent });
    const fl = [["ご契約時", "伴走プランのご契約\n（フェーズ1を初月に組み込み）"], ["約6週間", "無料3本の制作・配信・検証"], ["検証レポート会", "勝ちパターンの特定と\nフェーズ2計画の確定"], ["フェーズ2開始", "追加制作・運用・営業組み込み\nによる本格展開"]];
    const gw = 0.35, fw = (CW - gw * 3) / 4;
    for (let i = 0; i < 4; i++) {
      const x = MX + i * (fw + gw);
      card(s, x, 5.6, fw, 1.25, i === 0 ? C.dark : C.light, false);
      txt(s, fl[i][0], { x: x + 0.2, y: 5.68, w: fw - 0.4, h: 0.35, fontSize: 13, bold: true, color: i === 0 ? "F2A673" : C.primary });
      txt(s, fl[i][1], { x: x + 0.2, y: 6.03, w: fw - 0.4, h: 0.75, fontSize: 11.5, color: i === 0 ? C.white : C.text });
      if (i < 3) s.addImage({ data: await icon("FaChevronRight", C.accent), x: x + fw + 0.07, y: 6.07, w: 0.22, h: 0.3 });
    }
    s.addNotes("「まず無料の3本を見てから考えたい」への切り返し：「もちろん3本の成果はしっかり検証します。ただ、検証後に検討を始めると1〜2ヶ月の空白が生まれ、SNSも営業での活用も止まってしまいます。検証を“伴走プランの初月”として設計しておけば、結果が出た当日に次の一手を打てます」");
  }

  // ================= 21. Opportunity loss =================
  {
    const s = contentSlide("06｜COST OF WAITING", "「様子見」による機会損失の考え方",
      "訪問マッサージは継続利用が見込めるストック型事業。1ヶ月の遅れは「1ヶ月分の売上」では終わりません。");
    const stats = [["約3万円", "利用者1名あたりの\n月間売上（仮）"], ["12ヶ月", "平均継続期間（仮）"], ["約36万円", "利用者1名あたりの\n生涯売上"]];
    const ops = ["×", "="];
    const bw = 2.55, g = 0.55;
    for (let i = 0; i < 3; i++) {
      const x = MX + i * (bw + g);
      card(s, x, 2.05, bw, 1.9, i === 2 ? C.light : C.light2, false);
      txt(s, stats[i][0], { x, y: 2.15, w: bw, h: 0.95, fontSize: 36, bold: true, color: i === 2 ? C.primary : C.dark, align: "center", valign: "middle" });
      txt(s, stats[i][1], { x, y: 3.1, w: bw, h: 0.75, fontSize: 12, color: C.muted, align: "center" });
      if (i < 2) txt(s, ops[i], { x: x + bw, y: 2.55, w: g, h: 0.8, fontSize: 30, bold: true, color: C.accent, align: "center", valign: "middle" });
    }
    const bx = MX + 3 * (bw + g) - g + 0.35, bwid = W - MX - bx;
    card(s, bx, 2.05, bwid, 1.9, C.dark, false);
    txt(s, "後ろ倒し期間（仮）", { x: bx + 0.2, y: 2.2, w: bwid - 0.4, h: 0.3, fontSize: 11, color: "CFE6E1", align: "center" });
    txt(s, "3ヶ月", { x: bx + 0.2, y: 2.5, w: bwid - 0.4, h: 0.8, fontSize: 30, bold: true, color: C.white, align: "center", valign: "middle" });
    txt(s, "検討・再見積り・再立ち上げ", { x: bx + 0.2, y: 3.35, w: bwid - 0.4, h: 0.4, fontSize: 11, color: "CFE6E1", align: "center" });

    card(s, MX, 4.3, CW, 1.75, C.accentLight, false);
    txt(s, "仮に月2名の新規獲得が3ヶ月遅れると……", { x: MX + 0.4, y: 4.45, w: 6.5, h: 0.4, fontSize: 14, bold: true, color: C.dark });
    txt(s, "36万円 × 6名 ＝", { x: MX + 0.4, y: 4.95, w: 5.0, h: 0.9, fontSize: 26, bold: true, color: C.dark, valign: "middle" });
    txt(s, "約216万円", { x: MX + 5.2, y: 4.8, w: 4.5, h: 1.1, fontSize: 48, bold: true, color: C.accent, valign: "middle" });
    txt(s, "の機会損失", { x: MX + 9.55, y: 4.95, w: 2.4, h: 0.9, fontSize: 20, bold: true, color: C.dark, valign: "middle" });
    txt(s, "※上記は考え方を示すための仮置きの数値です。本日、貴社の実数値（単価・継続期間・現在の新規獲得数）で再計算させてください。", {
      x: MX, y: 6.25, w: CW, h: 0.5, fontSize: 11, color: C.muted,
    });
    s.addNotes("数値はあくまで仮置き。ホワイトボードや画面共有で、会長と一緒に実数値（施術単価・月間訪問回数・平均継続月数・現在の月間新規数）を入れて再計算する。「利用者様が月に〇名増えれば回収できる」という損益分岐を示す。");
  }

  // ================= 22. Hearing =================
  {
    const s = contentSlide("07｜TODAY", "本日ご確認させていただきたいこと");
    const q = [
      ["現在の利用者数と、月あたりの新規利用開始数", "KPI・目標値の設定"],
      ["新規利用者の主な獲得経路（ケアマネ／施設／医師／ご家族／保険顧客）", "注力するプッシュ先の決定"],
      ["紹介元との関係は誰が担っているか", "属人化リスクの把握"],
      ["利用者1名あたりの月間売上・平均継続期間", "投資対効果の算出"],
      ["受け入れ可能な利用者数の上限（施術者数）", "集客と採用のバランス設計"],
      ["現在のHP・SNSアカウントの有無と運用状況", "プル施策の起点設計"],
      ["保険顧客への介護事業のご案内実績・可否", "クロスセル施策の設計"],
      ["本施策のご決裁フロー（ご決裁者・時期）", "導入スケジュールの確定"],
    ];
    const cw = (CW - 0.3) / 2;
    for (let i = 0; i < q.length; i++) {
      const x = MX + Math.floor(i / 4) * (cw + 0.3), y = 1.6 + (i % 4) * 1.3;
      card(s, x, y, cw, 1.12);
      numCircle(s, i + 1, x + 0.25, y + 0.28, 0.56, i === 7 ? C.accent : C.primary, C.white, 15);
      txt(s, q[i][0], { x: x + 1.0, y: y + 0.12, w: cw - 1.2, h: 0.6, fontSize: 13.5, bold: true, color: C.dark, valign: "middle" });
      txt(s, "目的：" + q[i][1], { x: x + 1.0, y: y + 0.72, w: cw - 1.2, h: 0.3, fontSize: 11, color: C.muted });
    }
    s.addNotes("8番（決裁フロー）は冒頭で必ず確認。「代表にも相談したい」となった場合は、代表同席の場をその場で日程確定し、会長が社内提案しやすいよう要約版資料をお渡しする。");
  }

  // ================= 23a. Target simulation =================
  {
    const s = contentSlide("07｜SIMULATION", "目標値シミュレーション（ご提案）",
      "本日伺った数値を反映し、次回お打ち合わせで目標として合意するための試算です。※下記は現時点の仮置き値です。");
    // baseline band (from hearing on previous slide)
    card(s, MX, 1.85, CW, 0.75, C.light, false);
    txt(s, "現状（本日のヒアリング値）", { x: MX + 0.25, y: 1.85, w: 2.7, h: 0.75, fontSize: 12.5, bold: true, color: C.primary, valign: "middle" });
    const base = [["利用者数", "〇名"], ["月間新規", "〇名"], ["1名の月間売上", "約3万円"], ["平均継続", "12ヶ月"], ["受け入れ上限", "〇名"]];
    const bw0 = (CW - 3.0) / base.length;
    for (let i = 0; i < base.length; i++) {
      const x = MX + 3.0 + i * bw0;
      txt(s, base[i][0], { x, y: 1.93, w: bw0 - 0.1, h: 0.28, fontSize: 10.5, color: C.muted });
      txt(s, base[i][1], { x, y: 2.2, w: bw0 - 0.1, h: 0.34, fontSize: 15, bold: true, color: C.dark });
    }

    // left: monthly KPI funnel at full operation
    txt(s, "拡大期（4ヶ月目以降）の月間KPI試算", { x: MX, y: 2.85, w: 5.4, h: 0.35, fontSize: 13.5, bold: true, color: C.accent });
    const push = [["動画送付先（ケアマネ・施設・医療機関）", "60件"], ["視聴（視聴率50%）", "30件"], ["面談（面談化率30%）", "9件"], ["紹介発生（紹介率30%）", "約3件"], ["利用開始（開始率60%）", "約2名"]];
    txt(s, "プッシュ", { x: MX, y: 3.25, w: 1.5, h: 0.28, fontSize: 11, bold: true, color: C.primary });
    for (let i = 0; i < push.length; i++) {
      const y = 3.55 + i * 0.44, w = 5.4 - i * 0.35;
      const last = i === push.length - 1;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y, w, h: 0.38, rectRadius: 0.06, fill: { color: last ? C.primary : C.light2 }, line: { color: last ? C.primary : "DCE7E5", width: 0.75 } });
      txt(s, push[i][0], { x: MX + 0.15, y, w: w - 1.2, h: 0.38, fontSize: 11, color: last ? C.white : C.text, bold: last, valign: "middle" });
      txt(s, push[i][1], { x: MX + w - 1.05, y, w: 0.95, h: 0.38, fontSize: 12, bold: true, color: last ? C.white : C.dark, align: "right", valign: "middle" });
    }
    txt(s, "プル", { x: MX, y: 5.8, w: 1.5, h: 0.28, fontSize: 11, bold: true, color: C.primary });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y: 6.1, w: 5.4, h: 0.42, rectRadius: 0.06, fill: { color: C.primary }, line: { color: C.primary, width: 0 } });
    txt(s, "SNS・HP経由の問い合わせ 月2件（開始率50%）", { x: MX + 0.15, y: 6.1, w: 4.2, h: 0.42, fontSize: 11, bold: true, color: C.white, valign: "middle" });
    txt(s, "約1名", { x: MX + 4.35, y: 6.1, w: 0.95, h: 0.42, fontSize: 12, bold: true, color: C.white, align: "right", valign: "middle" });

    // right: stat tiles + chart
    const rx = 6.4, rw = W - MX - rx;
    const stats = [["+3名/月", "拡大期の新規利用者\n（上乗せ分）"], ["+26名", "12ヶ月後の\n利用者数の上乗せ"], ["+78万円/月", "12ヶ月目の\n月間売上の上乗せ"]];
    const sw = (rw - 0.4) / 3;
    for (let i = 0; i < 3; i++) {
      const x = rx + i * (sw + 0.2);
      card(s, x, 2.85, sw, 1.2, i === 2 ? C.accentLight : C.light2, false);
      txt(s, stats[i][0], { x, y: 2.9, w: sw, h: 0.55, fontSize: 21, bold: true, color: i === 2 ? C.accent : C.primary, align: "center", valign: "middle" });
      txt(s, stats[i][1], { x, y: 3.45, w: sw, h: 0.55, fontSize: 10, color: C.muted, align: "center" });
    }
    const months = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
    s.addChart(pres.charts.BAR, [{ name: "上乗せ利用者数（累計）", labels: months, values: [0, 1, 2, 4, 6, 8, 11, 14, 17, 20, 23, 26] }], {
      x: rx, y: 4.2, w: rw, h: 2.45, barDir: "col", barGapWidthPct: 45,
      chartColors: [C.primary], showLegend: false,
      showTitle: true, title: "上乗せ利用者数（累計）の推移　※月（ヶ月目）", titleFontSize: 11, titleColor: C.text, titleFontFace: FONT,
      catAxisLabelColor: C.muted, valAxisLabelColor: C.muted, catAxisLabelFontSize: 10, valAxisLabelFontSize: 10,
      catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT,
      valGridLine: { color: "E3ECEA", size: 0.75 }, catGridLine: { style: "none" },
      catAxisLineShow: false, valAxisLineShow: false, valAxisMaxVal: 30, valAxisMajorUnit: 10,
    });
    txt(s, "※立ち上げ期+1名/月、拡大期+2名/月、定着期+3名/月で段階的に増加と仮定。途中解約・受け入れ上限は考慮していない単純試算です。", {
      x: rx, y: 6.65, w: rw, h: 0.35, fontSize: 9.5, color: C.muted,
    });
    s.addNotes("前スライドのヒアリングで伺った数値（利用者数・月間新規・単価・継続期間・受け入れ上限）を上部の帯に記入し、その場で試算を調整する。確定値は次回お打ち合わせで「目標値」として合意する流れをつくる。受け入れ上限（施術者数）を超える場合は、採用動画の活用もあわせて提案する。\n\n試算ロジック：送付60件×視聴50%×面談30%×紹介30%×開始60%≒2名／月、プル（問い合わせ2件×50%）≒1名／月。累計：1ヶ月目0、2〜3ヶ月目+1/月、4〜6ヶ月目+2/月、7〜12ヶ月目+3/月 → 12ヶ月後26名、月間売上上乗せ26名×3万円=78万円。");
  }

  // ================= 23b. Schedule =================
  {
    const s = contentSlide("07｜NEXT STEP", "今後のスケジュール：次回お打ち合わせからご契約・本格始動へ");
    const sch = [
      ["本日", "課題・現状数値の\nヒアリング", C.accent],
      ["次回打ち合わせ", "試算の確定\n目標合意・正式提案", C.accent],
      ["ご契約〜1週間", "キックオフ\nKPI設定・素材確認", C.primary],
      ["〜2週間", "無料3本の\n初稿提出・修正", C.primary],
      ["3〜5週目", "配信・送付の実行\n（KPI計測開始）", C.primary],
      ["6週目", "効果検証レポート会\n→ フェーズ2へ", C.primary],
      ["3ヶ月目", "中間レビュー\n試算との対比・補正", C.dark],
      ["12ヶ月目", "年間振り返り\n次年度計画", C.dark],
    ];
    const n = sch.length, lineY = 2.05, sw = CW / n;
    s.addShape(pres.shapes.LINE, { x: MX + sw / 2, y: lineY, w: CW - sw, h: 0, line: { color: "B9D3CE", width: 2 } });
    for (let i = 0; i < n; i++) {
      const cx = MX + sw * i + sw / 2, col = sch[i][2];
      s.addShape(pres.shapes.OVAL, { x: cx - 0.17, y: lineY - 0.17, w: 0.34, h: 0.34, fill: { color: col }, line: { color: C.white, width: 2 } });
      txt(s, sch[i][0], { x: cx - sw / 2 + 0.04, y: 2.4, w: sw - 0.08, h: 0.55, fontSize: 12, bold: true, color: col, align: "center", valign: "middle" });
      txt(s, sch[i][1], { x: cx - sw / 2 + 0.04, y: 2.95, w: sw - 0.08, h: 0.8, fontSize: 10.5, align: "center" });
    }
    // highlight next meeting
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX + sw + 0.05, y: 1.6, w: sw - 0.1, h: 2.25, rectRadius: 0.1, fill: { color: C.accent, transparency: 88 }, line: { color: C.accent, width: 1.25, dashType: "dash" } });

    const cw = (CW - 0.3) / 2, y0 = 4.3, h0 = 2.2;
    card(s, MX, y0, cw, h0, C.accentLight, false);
    await iconCircle(s, "FaClipboardCheck", MX + 0.3, y0 + 0.25, 0.6, C.accent, C.white);
    txt(s, "次回までに貴社にご準備いただきたいこと", { x: MX + 1.05, y: y0 + 0.25, w: cw - 1.25, h: 0.6, fontSize: 14, bold: true, color: C.dark, valign: "middle" });
    const mine = ["現状数値の確認（利用者数・月間新規・紹介経路の内訳）", "主な紹介元（ケアマネ・施設・医療機関）のリスト", "HP・SNSアカウントの有無と、ロゴ・写真素材"];
    txt(s, mine.map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < mine.length - 1 } })), { x: MX + 0.35, y: y0 + 1.05, w: cw - 0.7, h: 1.4, fontSize: 12.5, paraSpaceAfter: 6 });
    const rx = MX + cw + 0.3;
    card(s, rx, y0, cw, h0, C.light, false);
    await iconCircle(s, "FaPenNib", rx + 0.3, y0 + 0.25, 0.6, C.primary, C.white);
    txt(s, "次回お打ち合わせで弊社がご提示するもの", { x: rx + 1.05, y: y0 + 0.25, w: cw - 1.25, h: 0.6, fontSize: 14, bold: true, color: C.dark, valign: "middle" });
    const ours = ["実数値を反映した目標値シミュレーション（確定版）", "無料3本の台本ドラフト（ご用意資料をもとに作成）", "プッシュ送付先リスト案と送付フロー案"];
    txt(s, ours.map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < ours.length - 1 } })), { x: rx + 0.35, y: y0 + 1.05, w: cw - 0.7, h: 1.4, fontSize: 12.5, paraSpaceAfter: 6 });
    s.addNotes("本日の最後に、次回お打ち合わせの日程をその場で確定させる（代表の同席が必要な場合は、あわせて日程を押さえる）。次回は「シミュレーション確定＋台本ドラフト提示」という具体的な成果物を持参することを約束し、次回の場で契約判断をいただける状態をつくる。");
  }
  // ================= 24. Closing =================
  {
    const s = pres.addSlide();
    s.background = { color: C.dark };
    s.addShape(pres.shapes.OVAL, { x: -1.2, y: 4.2, w: 4.5, h: 4.5, fill: { color: C.primary }, line: { color: C.primary, width: 0 } });
    s.addShape(pres.shapes.OVAL, { x: 11.3, y: -0.8, w: 2.6, h: 2.6, fill: { color: C.accent, transparency: 20 }, line: { color: C.accent, width: 0 } });
    txt(s, "おわりに", { x: 1.2, y: 0.9, w: 6, h: 0.4, fontSize: 14, bold: true, color: "F2A673", charSpacing: 2 });
    txt(s, "「動画をつくる」のではなく、\n「事業を伸ばす」ことにコミットします。", { x: 1.2, y: 1.45, w: 11, h: 1.6, fontSize: 32, bold: true, color: C.white, lineSpacingMultiple: 1.1 });
    txt(s, "貴社は、保険事業で長年培ってきた「地域の方との深い信頼関係」と、7年にわたる訪問マッサージ事業の「現場の実績」という、他社が簡単には真似できない資産をお持ちです。\n\n合併を経て新体制となった今こそ、その資産を動画と仕組みで地域全体に届け、「安心・安全・安堵」を届ける事業者として選ばれ続ける体制をつくる絶好のタイミングです。", {
      x: 3.9, y: 3.35, w: 8.6, h: 2.4, fontSize: 14, color: "D6E6E3", lineSpacingMultiple: 1.25,
    });
    txt(s, "次回お打ち合わせで、ぜひ次の一歩をご一緒に踏み出させてください。", { x: 3.9, y: 5.95, w: 8.6, h: 0.5, fontSize: 17, bold: true, color: "F2A673" });
    txt(s, "株式会社アイドマ・ホールディングス　MiTok事業部", { x: 3.9, y: 6.65, w: 8.6, h: 0.35, fontSize: 12, color: C.white });
  }

  await pres.writeFile({ fileName: OUT });
  console.log("written", OUT);
})();
