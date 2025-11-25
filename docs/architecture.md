# navlog 構成概要

このドキュメントは、ブラウザ上で航法計画書 (NAVLOG) を作成・編集するシングルページアプリケーション (SPA)「navlog」のコード構成と主要な処理フローをまとめたものです。

## アプリケーション概要

- **提供形態**: ビルド不要の静的サイト。`src/navlog.html` をブラウザで開くだけで動作します。
- **目的**: 航空航法計画の各レグを入力し、航法計算（WCA、MH、GS、ETE など）と YAML 形式の入出力をサポートします。
- **主要ライブラリ**:
  - [jQuery 3.6.0](https://code.jquery.com/) … DOM 操作とイベントハンドリング。
  - [js-yaml 4.1.0](https://github.com/nodeca/js-yaml) … フォームデータと YAML の相互変換。

## ファイル構成と責務

| ファイル | 役割 |
| :-- | :-- |
| `src/navlog.html` | 画面のエントリーポイント。スタイルとスクリプトを読み込み、初期化処理を起動します。 |
| `src/styles.css` | 標準表示向けのレイアウトとテーブル装飾を定義。 |
| `src/print.css` | 印刷レイアウト専用のスタイルを定義。`media="print"` で読み込まれます。 |
| `src/columns.js` | ナビゲーションログの列定義 (表示名、入力タイプ、デフォルト値など) を配列 `columns` として提供し、列タイプごとの単位や入力欄幅は `typeDefs` マップで一元管理。 |
| `src/ui.js` | テーブル UI の生成ロジックを集約。ヘッダー行、出発地行、データ行、合計行を構築し入力コンポーネントを配置。 |
| `src/navlog.js` | 航法計算 (`calculateNavlog`) と合計更新 (`updateTotals`) を実装。WCA・方位・速度・時間などを計算し行に反映します。 |
| `src/yamlUtils.js` | フォームと YAML の同期機能。`updateYAML` がフォーム → YAML、`loadFormFromYAML` が YAML → フォームの変換を担当。 |
| `src/morse.js` | VOR コード入力に連動したモールス記号表示を提供。`updateMorseCode` / `toMorseCode` をエクスポート。 |
| `src/events.js` | 既存の UI からは直接読み込まれていない補助イベントハンドラ。行追加・削除ボタン用の関数が定義されています (現状未使用)。 |

## 初期化フロー

1. `navlog.html` の `$(document).ready` ブロックが発火します。
2. `createTableHeader()` で列ヘッダーを生成。
3. `addDepartureRow()` で出発地情報行を追加。
4. `createTotalRow()` で合計行を作成。
5. `addRow()` で最初のチェックポイント行を追加。
6. `updateYAML()` を実行して初期 YAML を出力。
7. フォーム (`#navlog-form`) と YAML テキストエリア (`#yaml-output`) に `input` イベントを張り、双方向同期を有効化。

## テーブル UI の構成

- **列定義**は `columns.js` の `columns` 配列で一元管理され、`ui.js` がこの定義を読みながら行を生成します。
- 各列エントリは必要に応じて `extraInputSize` などの追加情報のみを保持し、基本的な入力欄幅と単位表記は列タイプに応じて `typeDefs` から取得して組み立てます。
- 行内の「行を追加」「削除」ボタンは `addRow` 内で生成され、クリック時に同関数または jQuery による DOM 削除を呼びます。
- `pointType` 列が `変針点` の場合、レグ区切りを示すクラス (`leg-border` / `checkpoint-border`) が行に追加され、合計行計算にも影響します。

## 航法計算ロジック (`navlog.js`)

- `calculateNavlog(row)` は対象行から必要な値を取得し、未入力の場合は上方行を探索して値を補完します。
- 計算ステップ:
  1. TAS・風速/風向・TC を取得。
  2. 風成分を三角関数で算出し、風向修正角 (WCA) を丸めて計算。
  3. 真針路 (TH)、磁針路 (MH)、実用方位 (CH) を順次計算し四捨五入。
  4. 地上速度 (GS) を切り捨て計算。
  5. 距離があれば ETE を分単位で算出。
  6. 各値を行の入力欄に反映し、`updateTotals()` を呼びます。
- `updateTotals()` はテーブル行を下から順に走査し、総距離・区間距離・総時間を集計して表示セルに反映します。

## YAML 連携 (`yamlUtils.js`)

- フォーム → YAML
  - ページタイトル (`#navlog-title`) はトップレベルキー `title` として保存。
  - 出発地行・チェックポイント行を走査し、入力済み項目のみを連想配列に格納。
  - 計算フィールド (`wca`, `th`, `mh`, `ch`, `gs`, `ete`, `remDist`, `legDistance`) は YAML に含めません。
  - `jsyaml.dump` で YAML 文字列を生成し `#yaml-output` に出力。
- YAML → フォーム
  - YAML をパース後、テーブルを再生成。
  - 出発地情報と各チェックポイント行に値をセットし、必要に応じて `calculateNavlog` や `updateMorseCode` を再実行。
  - `title` フィールドがあればタイトル入力欄へ復元し、未指定時は既定のタイトルを表示。

> YAML の詳しい項目説明とサンプルは `docs/yaml-format.md` を参照してください。

## モールス表示 (`morse.js`)

- `vorSign` 入力欄に文字列を入力すると `updateMorseCode` が発火し、隣接の `.morse-code` 要素にモールス符号を表示します。
- 文字 → モールス符号の変換テーブルを `morseCodeMap` として保持。

## スタイリングと印刷対応 (`styles.css` / `print.css`)

- `styles.css` はブラウザ表示時の余白、配色、ボタン表示など通常 UI を担当します。
- `print.css` は印刷専用スタイルとして読み込まれ、フォントサイズ縮小や `.no-print` の非表示、紙面レイアウト調整を行います。

## データライフサイクル

1. ユーザー入力が `input` イベントで `calculateNavlog` および `updateYAML` をトリガー。
2. 計算結果と集計値が即座に行・合計行へ反映されます。
3. YAML テキストエリアは常に最新状態を保持し、保存や共有に利用できます。
4. 既存 YAML を貼り付けると `loadFormFromYAML` がフォームを再構築して再計算を実施。

## 拡張・改善ポイント

- `src/events.js` のイベントハンドラは現状読み込まれていないため、不要であれば削除するか、既存ボタンに統合して再利用を検討してください。
- 列定義 `columns` に説明や入力制約 (例: 最小値/最大値) を追加するとバリデーションに活用できます。
- モバイル端末向けに入力 UI を最適化する場合、レスポンシブスタイルやタップ操作向けの改善が有効です。
- YAML スキーマを外部ドキュメント化することで、他ツールとの連携や検証 (JSON Schema 等) を導入しやすくなります。
