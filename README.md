# 高校生 × Sony α7 IV × WD Blue 8TB 活用ガイド

PDF資料「高校生がSony α7 IVとWD Blue 8TBを活用する将来性と現実的な活用法」をもとにした1ページ完結の静的Webサイトです。

## 構成
- `index.html` — 本文（カメラ性能 / ストレージ特性 / バックアップ体制 / 事例 / 将来展望 / 出典）
- `css/style.css` — ダークテーマ・レスポンシブ対応のスタイル
- `js/main.js` — スクロール表示アニメーション、数値カウントアップ、モバイルメニュー

## ローカルでの確認
```bash
python3 -m http.server 8080
```
ビルド不要。ファイルをそのまま静的ホスティング（GitHub Pages、Cloudflare Pages など）に配置できます。
