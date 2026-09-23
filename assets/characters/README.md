# キャラクター画像の置き場

**ここに画像を置くだけでキャラクターが変わります。コードは触りません。**

画像が無いキャラクターは、いままでどおりコードで描いた絵（SVG）が出ます。
1枚入れれば、そのキャラクターだけが新しい絵になります。

---

## 置き方

```
assets/characters/
  player/                     主人公
    battle_m.webp  battle_f.webp
    field_m.webp   field_f.webp
    portrait_m.webp portrait_f.webp
    face_m.webp    face_f.webp

  companions/<仲間ID>/        仲間（riina / velt / noa）
    battle.webp  field.webp  portrait.webp  face.webp

  jobs/<職業ID>/              職業（swordsman / archmage など25種）
    battle_m.webp  battle_f.webp
    field_m.webp   field_f.webp

  npc/<NPC ID>/               村人・店主など
    field.webp  portrait.webp  face.webp

  monsters/<敵ID>/            敵（slime / orc など）
    battle.webp  face.webp

  bosses/<ボスID>/            ボス
    battle.webp  portrait.webp  face.webp
```

IDは `src/data/jobs.js` `src/data/enemies.js` `src/data/story.js` の
鍵をそのまま使います。新しい対応表はありません。

`tools/art-test.js` を走らせると、置いた画像の名前が正しいか検査できます。

---

## 用途ごとの大きさ

| 用途 | 画像サイズ | 比率 | 使われる画面 |
|---|---|---|---|
| `battle` | 384×480 | 4:5 | 戦闘 |
| `field` | 192×240 | 4:5 | 拠点・学院・ギルド・街・探索・移動演出 |
| `portrait` | 512×768 | 2:3 | 状態・転職・会話 |
| `face` | 128×128 | 1:1 | 仲間一覧・対象選び |

## 共通の決まり

- **形式**：WebP（PNGでも可）。**透過は必須**
- **背景**：完全に透明。**影は描かない**（画面側で足します）
- **向き**：**すべて右向き**。敵は表示するときに左右反転します
- **足元**：画像の下端に合わせる（`battle` と `field`）
- **余白**：上下左右に3%。揺れや反転で切れないように
- **大きさ**：表示の2倍の画素で作る（上の表がすでに2倍の値です）
- **容量**：1枚 **40KB以内**
- **色**：背景が暗い紫（`#120d1c`）なので、**輪郭のふちを一段明るく**すると沈みません

## 絵が無いときの代わり

```
  欲しい絵                     → 無ければ
  ────────────────────────────────────────────
  仲間専用・その職の絵         → 職の絵（性別あり）
  職の絵（性別あり）           → 職の絵（性別なし）
  職の絵（性別なし）           → そのキャラの汎用の絵
  そのキャラの汎用の絵         → 同じ系統の代表職の絵
  同じ系統の代表職の絵         → いままでのSVG
```

## 画像を足したあと

```
npm run art        画像の一覧を作り直す（src/data/art.js を生成）
npm test           全部が壊れていないか確かめる
```

`npm run art` を忘れると、置いた画像は使われません。
