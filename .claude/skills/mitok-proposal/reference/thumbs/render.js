const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const path = require("path");
const { daughter, staff, elder, heart, house } = require("./chars");

const FONTS = ``;
const base = (w, h, css, body) => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${w}px;height:${h}px;overflow:hidden}
body{font-family:"Noto Sans JP",sans-serif;-webkit-font-smoothing:antialiased}
${css}</style></head><body>${body}</body></html>`;

// ---------- YouTube thumbnail 1280x720 ----------
const youtube = base(1280, 720, `
.bg{position:absolute;inset:0;background:linear-gradient(120deg,#123B39 0%,#1F5E5B 55%,#2E7D77 100%)}
.ring{position:absolute;border-radius:50%;background:rgba(255,255,255,.06)}
.tag{position:absolute;left:56px;top:50px;background:#E07B39;color:#fff;font-weight:900;font-size:34px;padding:8px 22px;border-radius:10px}
.h1{position:absolute;left:56px;top:128px;color:#fff;font-weight:900;font-size:92px;line-height:1.12;letter-spacing:-1px;text-shadow:0 6px 0 rgba(0,0,0,.25)}
.h1 .y{color:#FFD54A}
.sub{position:absolute;left:56px;top:470px;background:#fff;color:#123B39;font-weight:900;font-size:40px;padding:10px 26px;border-radius:14px}
.note{position:absolute;left:60px;top:560px;color:rgba(255,255,255,.85);font-size:22px;font-weight:500}
.brand{position:absolute;left:56px;bottom:40px;color:#fff;font-weight:700;font-size:26px;display:flex;align-items:center;gap:12px}
.brand i{display:inline-block;width:18px;height:18px;border-radius:50%;background:#E07B39}
.chars{position:absolute;right:30px;bottom:-10px;display:flex;align-items:flex-end}
.bubble{position:absolute;right:300px;top:70px;background:#fff;color:#1F5E5B;font-weight:900;font-size:40px;padding:18px 28px;border-radius:26px;box-shadow:0 8px 0 rgba(0,0,0,.15)}
.bubble:after{content:"";position:absolute;right:40px;bottom:-26px;border:16px solid transparent;border-top:18px solid #fff}
.time{position:absolute;right:18px;bottom:16px;background:rgba(0,0,0,.8);color:#fff;font-size:24px;font-weight:700;padding:3px 10px;border-radius:6px}
`, `<div class="bg"></div>
<div class="ring" style="width:620px;height:620px;right:-120px;top:-160px"></div>
<div class="ring" style="width:360px;height:360px;right:260px;bottom:-200px"></div>
<div class="tag">5分でわかる</div>
<div class="h1">訪問マッサージ<br><span class="y">保険で受けられる</span><br>条件とは？</div>
<div class="sub">ケアマネさん・ご家族向け</div>
<div class="note">※医療保険の適用には医師の同意が必要です</div>
<div class="brand"><i></i>みらい設計 訪問マッサージ｜岩国エリア</div>
<div class="bubble">費用は？<br>流れは？</div>
<div class="chars"><div style="margin-right:-40px">${elder(250)}</div>${staff(300)}</div>
<div class="time">8:24</div>`);

// ---------- Instagram feed 1080x1350 (4:5) with post chrome ----------
const instagram = base(1080, 1560, `
body{background:#fff;font-family:"Zen Maru Gothic","Noto Sans JP",sans-serif}
.head{height:110px;display:flex;align-items:center;gap:22px;padding:0 32px;border-bottom:1px solid #eee}
.av{width:70px;height:70px;border-radius:50%;background:conic-gradient(#E07B39,#F2A673,#1F5E5B,#E07B39);padding:4px}
.av div{width:100%;height:100%;border-radius:50%;background:#1F5E5B;border:4px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:24px}
.name{font-weight:700;font-size:30px;color:#222}.loc{font-size:22px;color:#666}
.post{position:relative;width:1080px;height:1350px;background:#EAF4F1;overflow:hidden}
.blob{position:absolute;border-radius:50%}
.kicker{position:absolute;left:80px;top:90px;color:#E07B39;font-weight:900;font-size:40px;letter-spacing:4px}
.title{position:absolute;left:80px;top:160px;color:#163F3D;font-weight:900;font-size:104px;line-height:1.28}
.photo{position:absolute;right:50px;top:700px;width:440px;height:440px;border-radius:50%;background:#fff;display:flex;align-items:flex-end;justify-content:center;overflow:hidden;box-shadow:0 20px 40px rgba(31,94,91,.15)}
.chips{position:absolute;left:80px;top:640px;display:flex;flex-direction:column;gap:26px}
.chip{background:#fff;color:#1F5E5B;font-weight:700;font-size:34px;white-space:nowrap;padding:18px 32px;border-radius:60px;box-shadow:0 6px 16px rgba(31,94,91,.12)}
.chip b{color:#E07B39}
.foot{position:absolute;left:80px;bottom:70px;color:#1F5E5B;font-weight:700;font-size:30px}
.dots{position:absolute;bottom:30px;left:0;right:0;display:flex;gap:10px;justify-content:center}
.dots i{width:14px;height:14px;border-radius:50%;background:#B9D3CE}.dots i:first-child{background:#1F5E5B}
.bar{height:100px;display:flex;align-items:center;gap:36px;padding:0 34px}
.bar svg{width:52px;height:52px}
`, `<div class="head"><div class="av"><div>み</div></div><div><div class="name">mirai_sekkei_care</div><div class="loc">山口県岩国市</div></div></div>
<div class="post">
  <div class="blob" style="width:700px;height:700px;background:#D6EAE4;right:-260px;top:-240px"></div>
  <div class="blob" style="width:300px;height:300px;background:#FCE3CF;left:-120px;bottom:120px"></div>
  <div class="kicker">HOME CARE MASSAGE</div>
  <div class="title">ご自宅が、<br>安心のケアの<br>場所になる。</div>
  <div class="chips">
    <div class="chip">🏠 ご自宅へ伺います</div>
    <div class="chip">👪 ご家族の<b>ご相談</b>も歓迎</div>
    <div class="chip">📍 岩国から半径50km</div>
  </div>
  <div class="photo"><div style="display:flex;align-items:flex-end;margin-bottom:-30px"><div style="margin-right:-50px">${elder(220)}</div>${staff(250)}</div></div>
  <div style="position:absolute;right:90px;top:650px">${heart(90)}</div>
  <div class="foot">みらい設計 訪問マッサージ ▶ プロフィールのリンクから</div>
  <div class="dots"><i></i><i></i><i></i><i></i><i></i></div>
</div>
<div class="bar">
  <svg viewBox="0 0 24 24" fill="none" stroke="#222" stroke-width="2"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.3 3 4.5 6.8 4.5c2.1 0 3.6 1.1 4.2 2.4.6-1.3 2.1-2.4 4.2-2.4 3.8 0 5.9 3.8 4.4 7.3C19.5 16.4 12 21 12 21z"/></svg>
  <svg viewBox="0 0 24 24" fill="none" stroke="#222" stroke-width="2"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>
  <svg viewBox="0 0 24 24" fill="none" stroke="#222" stroke-width="2"><path d="M22 3 11 14M22 3l-7 19-4-8-8-4z"/></svg>
  <svg viewBox="0 0 24 24" fill="none" stroke="#222" stroke-width="2" style="margin-left:auto"><path d="M6 3h12v18l-6-5-6 5z"/></svg>
</div>`);

// ---------- TikTok vertical 1080x1920 ----------
const tiktok = base(1080, 1920, `
body{background:#111}
.v{position:absolute;inset:0;background:linear-gradient(180deg,#1b2b2a 0%,#24403E 45%,#1A2D2C 100%)}
.top{position:absolute;top:70px;left:0;right:0;text-align:center;color:rgba(255,255,255,.7);font-size:34px;font-weight:700}
.top b{color:#fff;border-bottom:4px solid #fff;padding-bottom:6px}
.hook{position:absolute;left:60px;right:60px;top:230px;text-align:center;color:#fff;font-weight:900;font-size:86px;line-height:1.3;text-shadow:0 5px 0 #000,0 0 18px rgba(0,0,0,.5)}
.hook .hl{background:#FFD54A;color:#111;padding:0 14px;border-radius:10px;text-shadow:none}
.row{position:absolute;left:50px;right:190px;display:flex;align-items:flex-end;gap:16px}
.b{background:#fff;color:#222;font-weight:700;font-size:36px;line-height:1.45;padding:22px 28px;border-radius:30px;white-space:nowrap}
.b.s{background:#E07B39;color:#fff}
.side{position:absolute;right:30px;top:900px;display:flex;flex-direction:column;align-items:center;gap:46px;color:#fff;font-size:26px;font-weight:700}
.side .ic{width:92px;height:92px;border-radius:50%;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center}
.side svg{width:56px;height:56px}
.cap{position:absolute;left:50px;right:190px;bottom:150px;color:#fff}
.cap .n{font-weight:900;font-size:40px}.cap .t{font-size:32px;margin-top:10px;line-height:1.45}
.cap .x{font-size:26px;color:rgba(255,255,255,.75);margin-top:10px}
.prog{position:absolute;left:0;right:0;bottom:90px;height:6px;background:rgba(255,255,255,.25)}
.prog i{display:block;width:32%;height:100%;background:#fff}
`, `<div class="v"></div>
<div class="top">フォロー中　<b>おすすめ</b></div>
<div class="hook">親のマッサージ、<br><span class="hl">保険が使える</span>って<br>知ってた？</div>
<div class="row" style="top:700px">${daughter(170)}<div class="b">最近、母の足腰が弱ってきて…<br>自宅で受けられるケアってある？</div></div>
<div class="row" style="top:1010px;flex-direction:row-reverse;left:100px;right:170px">${staff(170)}<div class="b s">条件を満たせば、医療保険で<br>ご自宅に伺えることがあります！</div></div>
<div class="side">
  <div class="ic" style="background:#1F5E5B;font-size:40px">み</div>
  <div><div class="ic"><svg viewBox="0 0 24 24"><path fill="#fff" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.3 3 4.5 6.8 4.5c2.1 0 3.6 1.1 4.2 2.4.6-1.3 2.1-2.4 4.2-2.4 3.8 0 5.9 3.8 4.4 7.3C19.5 16.4 12 21 12 21z"/></svg></div><div style="text-align:center;margin-top:8px">いいね</div></div>
  <div><div class="ic"><svg viewBox="0 0 24 24"><path fill="#fff" d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg></div><div style="text-align:center;margin-top:8px">コメント</div></div>
  <div><div class="ic"><svg viewBox="0 0 24 24"><path fill="#fff" d="M6 3h12v18l-6-5-6 5z"/></svg></div><div style="text-align:center;margin-top:8px">保存</div></div>
</div>
<div class="cap"><div class="n">@mirai_sekkei_care</div><div class="t">条件は3つだけ。詳しくはプロフィールのYouTubeで解説中 #訪問マッサージ #岩国 #介護</div><div class="x">※医療保険の適用には医師の同意が必要です</div></div>
<div class="prog"><i></i></div>`);

// ---------- Storyboard frames 1280x720 ----------
const sbCss = `
.bg{position:absolute;inset:0;background:#F4F8F7}
.set{position:absolute;left:0;right:0;bottom:0;height:200px;background:#E1EEEA}
.tel{position:absolute;left:60px;right:60px;bottom:40px;background:rgba(22,63,61,.92);color:#fff;font-weight:900;font-size:46px;text-align:center;padding:18px 20px;border-radius:16px}
.tel b{color:#FFD54A}
.lab{position:absolute;left:40px;top:34px;background:#E07B39;color:#fff;font-weight:900;font-size:28px;padding:6px 18px;border-radius:8px}
.bub{position:absolute;background:#fff;color:#222;font-weight:700;font-size:38px;line-height:1.4;padding:20px 28px;border-radius:24px;box-shadow:0 6px 16px rgba(0,0,0,.08)}
.board{position:absolute;background:#fff;border-radius:20px;box-shadow:0 8px 20px rgba(0,0,0,.08);padding:30px 36px;color:#163F3D}
`;
const sb = [
  base(1280, 720, sbCss, `<div class="bg"></div><div class="set"></div><div class="lab">0:00 悩みの提示</div>
    <div style="position:absolute;left:170px;bottom:125px">${daughter(270)}</div>
    <div class="bub" style="left:520px;top:120px">母が最近、外出もつらそうで…<br>家でできることってないのかな？</div>
    <div class="tel">ご家族の<b>「どこに相談すれば？」</b></div>`),
  base(1280, 720, sbCss, `<div class="bg"></div><div class="set"></div><div class="lab">1:30 訪問マッサージとは</div>
    <div style="position:absolute;left:120px;bottom:125px">${staff(270)}</div>
    <div class="board" style="left:500px;top:90px;width:700px">
      <div style="font-weight:900;font-size:40px;margin-bottom:18px">訪問マッサージとは？</div>
      <div style="font-size:32px;line-height:1.7;font-weight:700">① 施術者がご自宅・施設へ伺う<br>② 歩行が困難な方などが対象<br>③ 医師の同意で医療保険の対象に</div></div>
    <div class="tel">専門スタッフが<b>やさしく解説</b></div>`),
  base(1280, 720, sbCss, `<div class="bg"></div><div class="set"></div><div class="lab">3:00 開始までの流れ</div>
    <div style="position:absolute;left:70px;top:130px;display:flex;gap:22px">
      ${["ご相談", "ご説明", "医師の同意", "ご契約", "施術開始"].map((t, i) => `<div style="width:210px;height:210px;border-radius:24px;background:${i === 4 ? "#E07B39" : "#1F5E5B"};color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900"><div style="font-size:30px;opacity:.8">STEP ${i + 1}</div><div style="font-size:38px;margin-top:10px">${t}</div></div>`).join("")}
    </div>
    <div style="position:absolute;left:120px;bottom:125px">${staff(170)}</div>
    <div class="bub" style="left:330px;top:400px">医師の同意書の手続きも、私たちがご案内します</div>
    <div class="tel">開始まで<b>5ステップ</b>でスムーズ</div>`),
  base(1280, 720, sbCss, `<div class="bg" style="background:#1F5E5B"></div><div class="lab">5:30 お問い合わせ案内</div>
    <div style="position:absolute;left:70px;top:150px;width:400px;height:400px;border-radius:50%;background:#EAF4F1"></div><div style="position:absolute;left:125px;top:190px;width:290px;height:360px;border-radius:0 0 145px 145px;overflow:hidden;display:flex;justify-content:center">${staff(290)}</div>
    <div style="position:absolute;left:520px;top:120px;color:#fff">
      <div style="font-weight:900;font-size:60px;line-height:1.3">まずはお気軽に<br>ご相談ください</div>
      <div style="margin-top:34px;display:flex;gap:20px">
        <div style="background:#fff;color:#1F5E5B;font-weight:900;font-size:36px;padding:16px 30px;border-radius:14px">📞 お電話</div>
        <div style="background:#E07B39;color:#fff;font-weight:900;font-size:36px;padding:16px 30px;border-radius:14px">💬 LINEで相談</div>
      </div>
      <div style="margin-top:28px;font-size:28px;opacity:.85">みらい設計 訪問マッサージ｜岩国から半径50km</div></div>`),
];

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" }).catch(() => chromium.launch());
  const jobs = [["youtube", youtube, 1280, 720], ["instagram", instagram, 1080, 1560], ["tiktok", tiktok, 1080, 1920], ...sb.map((h, i) => [`story${i + 1}`, h, 1280, 720])];
  for (const [name, html, w, h] of jobs) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(__dirname, `${name}.png`) });
    await page.close();
    console.log("rendered", name);
  }
  await browser.close();
})();
