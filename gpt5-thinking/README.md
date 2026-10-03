# THINK / VALUE — 「GPT 5 Thinkingはお得か｜I（評価版レポート）」専用サイト

PDF「GPT 5 Thinkingはお得か｜I（評価版レポート）」（全3ページ）の**本文を全文そのまま**掲載した、
WebGL 3D とスクロールアニメーション主体のインタラクティブ・サイトです。

## 構成
| ファイル | 内容 |
|---|---|
| `index.html` | 本文（はじめに〜第9章〜結論）＋各章のインタラクティブ図解 |
| `css/style.css` | ダーク／グラスモーフィズム／3D CSS（カード反転・層スタック・軌道） |
| `js/scene.js` | Three.js：GLSLノイズで変形する「思考コア」、章ごとに隊形が変わる12,000粒子、ブルーム |
| `js/main.js` | GSAP + ScrollTrigger + Lenis：文字分割アニメ、章連動、各ウィジェット |

## 章ごとの演出
- **はじめに** — COST ⇄ BENEFIT の天秤（要素をタップして載せ替え）
- **第1章** — AUTO ルーティング・シミュレーター（INSTANT/FAST と THINKING の経路）
- **第2章** — 「下書きノート→清書」＋ TEST‑TIME COMPUTE スライダー（3Dコアの揺らぎと連動）
- **第3章** — 3D軌道で回る得意領域、HARD REFUSAL / SAFE‑COMPLETIONS 切替
- **第4章** — プラン層の3Dスタック、PRICE / RATE LIMITS / CREDITS / TIME の4レンズ
- **第5章** — PERFORMANCE × PERSONALITY の4象限マップ
- **第6章** — o3 / GPT‑4o / GPT‑5 の3D反転カード
- **第7章** — TOTAL VALUE = BENEFIT − COST、LENGTH・DIFFICULTY・TOLERANCE TO ERRORS 計算機
- **第8章** — FAST ⇄ THINKING のシナリオカード（ADAPTIVE USE）
- **第9章** — TRUST = TECHNOLOGY × HABITS の掛け算シールド
- **結論** — CONDITIONALLY YES

図解は本文の考え方を視覚化したイメージです。本文にない料金・回数・ベンチマーク数値は載せていません。

## ローカル確認
```bash
cd gpt5-thinking && python3 -m http.server 8080
```
ビルド不要（ライブラリは CDN から読み込み）。`prefers-reduced-motion` とモバイル表示に対応しています。

## 自動コミット（作業消失対策）
```bash
scripts/watchdog.sh start 20     # 20秒ごとにスナップショット。落ちても自動で再起動
scripts/autocommit.sh status     # 状態と直近ログ
scripts/autocommit.sh restore    # 最新スナップショットを .autocommit/restore に展開
scripts/watchdog.sh stop         # 停止
```
- 変更は専用ブランチ **`autosave/gpt5-thinking`** に保存され、GitHub へ自動 push されます。
- 別の index ファイルと `git commit-tree` を使うため、HEAD や作業中ブランチ、ステージ内容には一切触れません。
  他の作業者がブランチを切り替えたり rebase していても安全です。
- 内容が変わっていなければコミットしません。push に失敗した場合は次のサイクルで再試行します。
