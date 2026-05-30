# LIFE PLAN LAB — 進捗とロードマップ

最終更新: 2026-05-30
対象ブランチ: `claude/fire-lifeplan-v2-design-s8a3a`

このドキュメントは、生活設計シミュレーターの STEP11.5 以降に実施した変更と、
今後の残課題を 1 枚で見渡せるようにまとめたものです。コミットは時系列順。

---

## ここまでの進捗

### STEP11.5 — iframe 内でも下部ナビが切れないようにする
コミット: `3e594f1`

- `.bottom-nav` を `position: fixed` から `position: sticky` に変更
- 入力画面 (`.step-layout`) を `height: 100svh; height: 100dvh; overflow: hidden` の縦 flex に
- 内側に `.step-content`（flex:1, overflow-y:auto）を追加し、入力カードだけが内部スクロールする構造に
- `RoughFlow` / `ThoroughFlow` の JSX をラップ。`useEffect` でステップ切替時に `.step-content` の scrollTop もリセット（behavior は `'auto'`）
- WordPress 側 iframe の高さ・README は触らず、アプリ側で完結

**回帰防止**: `tests/render/stepLayout.test.tsx`（`.step-layout > .step-content + .bottom-nav` の兄弟構造を固定）

---

### STEP11.6 — 未入力項目の見落とし防止
コミット: `1a5dd4f`

- 下部ナビ直上に常時ステータス行「このステップ：X/Y 項目入力済み」を追加
- 未入力のまま「次へ」を押した場合、確認パネルを出して 2 ボタン:
  - 「未入力項目を見る」: 最初の未入力項目へスクロール
  - 「このまま次へ」: 通常進行（仕様 #4 のとおり状態は変更しない）
- per-item の「未入力で進む」(skipped) は入力済み扱いとしてカウント
- ざっくり診断と、しっかり診断の `'fields'` ページに適用
- family / events ページは項目数の概念がないので無印

**回帰防止**: `tests/render/oversightPrevention.test.tsx`

---

### STEP11.7 — 確認パネルの存在感を下げる
コミット: `962370a`

- セージ淡パネル → 細い補足バー（背景は親の薄白を継承、上部 1px ヘアラインのみ）
- 文言: 「未入力の項目があります。未入力のまま次へ進みますか？」→「未入力の項目があります」（ステータス行に「未入力でも次へ進めます」が出ているので重複を解消）
- ボタンを 36px・font-size 0.82rem に縮小、横並び中央寄せ
- 「未入力項目を見る」を押した時点で scrollIntoView 後にパネルを dismiss、もう一度「次へ」を押せば再表示

---

### STEP11.8 — 開始前トップ画面に説明・注意点・関連記事を戻す
コミット: `816ee93`

- `ModeSelect.tsx` に 3 セクション追加:
  - A. `<details>` 折りたたみ「このシミュレーターの詳しい説明を見る」
    - 「このシミュレーターで分かること」(8 bullets) + 「現在価値と将来額の違い」
  - B. 「ご利用前の注意点」(`ja.common.disclaimer` フル本文)
  - C. 「次に読みたい関連記事」(プレースホルダー)
- 旧 `.top-disclaimer`（短文一行）は削除し、B に役割集約
- `phase === 'mode'` のときだけ `ModeSelect` が `App.tsx` でマウントされるので、入力・結果画面では自動的に出ない

**回帰防止**: `tests/render/topSections.test.tsx`（モード切替後にこれらが DOM から消えることを固定）

---

### STEP11.9 — 入力ステータス行の 1 行表示化
コミット: `6d7cd51`

- 文言: 「このステップ：1/3項目入力済み。未入力でも次へ進めます」→「**1/3入力済み・未入力OK**」
- 完了時は「**3/3入力済み**」だけ
- CSS: `font-size 0.78 → 0.76rem`、`line-height 1.3`、`white-space: nowrap` + `overflow: hidden` + `text-overflow: ellipsis`、`margin-bottom 6 → 4px`
- 375px でもナビ全体の高さを増やさない

---

### STEP11.10 — 教育費を MEXT R5 に整合・私立小学校追加・大学入学金分離
コミット: `3b62198`

#### 案 A: MEXT R5 整合
| 段階 | 旧 | 新 |
|---|---|---|
| 小学校 公立 | 35 (固定) | **37** |
| 小学校 私立 | (なし) | **174** (新規追加) |
| 中学校 公立 | 55 | **54** |
| 中学校 私立 | 140 | **156** |
| 高校 公立 | 60 | **60** |
| 高校 私立 | 120 | **118** |
| 大学 国公立文系 | 90/170 | 90/170 (維持) |
| 大学 国公立理系 | 110/190 | **100/180** |
| 大学 私立文系 | 130/230 | **150/230** |
| 大学 私立理系 | 170/270 | **175/255** |

#### 案 B: 大学入学金を年次分離
- 新規定数 `UNIVERSITY_ENTRANCE_FEE`（国公立 28 / 私立文 25 / 私立理 26 / 進学なし 0）
- `eduCostForChild` で `ageThisYear === 18` のときだけ加算
- 子の進学が重なる年（中3 + 大1 など）にピークが現実的に立ち上がる

#### スキーマ・UI
- `ChildInput` に `elementarySchool: Field<SchoolPath>` を追加
- しっかり診断 `FamilyStep` に小学校カード（年齢→小学校→中学→高校→大学→住まいの順）
- ざっくり診断 `POLICY_PATHS` を拡張: 「教育重視」のみ私立小学校

**回帰防止**: `tests/engine/educationCost.test.ts`、既存 12 ファイルに `elementarySchool: 'public'` を機械的追加

---

### STEP11.11 — 入学金の結果画面表示、出典明記、下部ナビの「次へ」切れ対策
コミット: `4b0a498`

#### ① 入学金を結果画面の教育費詳細に明示
- `EducationDetail` に `input` を渡し、年ごとに「18歳になる子の入学金（インフレ反映）」を再計算
- いずれかの年に入学金が立つ場合のみ「うち入学金」列を追加（不要な年は列ごと非表示）

#### ② 出典明記
教育費詳細シート末尾:
- 小・中・高: **文科省「令和5年度 子供の学習費調査」**
- 大学学費: **文科省「令和5年度 私立大学等の入学者に係る学生納付金等調査」+ 国立大学標準授業料**
- 大学生活費: **JASSO「令和4年度 学生生活調査」**

#### ③ 下部ナビ「次へ」切れ対策
- `.bottom-nav` 左右 padding: 14 → 10 (−8px)
- `.bottom-nav__inner` gap: 12 → 8 (−8px)
- `.bottom-nav__inner .btn` padding: 12px 18px → 10px 14px
- `.bottom-nav__center`: `flex: 0 1 auto; min-width: 0` 追加

**注**: STEP11.8 で説明セクションは既に ModeSelect 内（phase === 'mode' のみ）になっているため、説明非表示の追加コード変更は不要

---

### STEP11.12 — 「現役継続」選択肢を追加
コミット: `19fe13b`

#### ざっくり診断
- 「将来の働き方」に 4 つ目の選択肢「**現役で働き続けたい**」を追加
- `keep_working → fire.type 'none'` マッピング
- 「仕事を減らしたい年齢」→「働き方を変える年齢」に汎用化
- `keep_working` 時は FIRE後生活費・サイドFIRE後収入を非表示

#### しっかり診断
- `fire.type` に「**現役継続**」(`none`) を追加。質問見出し「将来の働き方」、ステップタイトル「働き方の方針」
- `fire.targetAge`（FIRE希望年齢）: `showIf: isFiring` で 'none' 時非表示
- **FIRE-2 ステップ全体**: `showIf: isFiring` で 'none' 時はステップごとスキップ

#### 計算ロジック・結果画面
- STEP11.10 以前から 'none' 分岐済み（`fireStartAge = retirementAge`、`lifePhase`・`Outlook`・`ResultSummary`・`riskFactors` で「退職後」表記）
- コード変更なし

**回帰防止**: `tests/render/workContinuation.test.tsx`

---

### STEP11.13 — 結果画面からの複数条件編集 + 現役継続の整合性 + ブリッジ生活費
コミット: `e56d8d5`

#### ① 「続けて変更」導線
- Store に `resultReturnTarget: 'top' | 'adjust' | null` を追加
- 新規アクション: `submitRoughAndContinue` / `submitThoroughAndContinue`（再計算後 `'adjust'`）
- 既存 `submitRough` / `submitThorough` は `'top'`
- `clearResultReturnTarget` で消費後にクリア
- RoughFlow / ThoroughFlow の `cameFromResult` モード時のみ「続けて変更」ボタン (`.recompute-continue`, 36px secondary)
- ResultDashboard で `EditLinks` を `forwardRef`、`calculatedAt` の useEffect で分岐:
  - `'adjust'` → `details.open = true` + `scrollIntoView`
  - それ以外 → `window.scrollTo({ top: 0 })`

#### ② 現役継続モードの編集整合性
- 既存の `showIf` 設計で対応済み（FIRE-後ステップが編集導線から消える、文言は「退職後」になる）

#### ③ retirementAge < 65 のブリッジ生活費（推奨案 A）
- しっかり診断 FIRE-1 ページに新規質問:
  - path: `fire.postFireLiving`（既存フィールドを再利用）
  - label: 「退職後の生活費（年額・年金開始まで）」
  - showIf: `fire.type === 'none' && income.retirementAge < 65`

**回帰防止**: `tests/render/multiEditFlow.test.tsx`

---

## 全体テスト・ビルド状況

- テスト: **317 件 pass**（43 ファイル）
- ビルド: 成功（CSS 22.99 kB / JS 238.60 kB）
- 後方互換: 既存 `'full'` / `'side'` フローはそのまま動作

---

## 残課題（ロードマップ）

### 高優先度

#### R-1: 私立医歯薬・6 年制の大学カテゴリ
- 現状: STEP11.10 で 4 年制（文系・理系 × 国公立・私立）のみ対応
- 必要な作業: 別カテゴリ追加（`medical` 等）、6 年通学の engine 対応、UI に追加選択肢
- 推定規模: 中（schema 拡張、engine の年齢判定を 18〜23 に、constants の追加、テスト追加）
- 利用層は限定的なので優先度判断要

#### R-2: 結果画面の年次収支表で「入学金」を別行表示
- 現状: STEP11.11 で教育費詳細シート（Bottom Sheet）には別列で出している
- 年次収支表ダッシュボード本体では未対応
- 必要な作業: 年次表のレイアウト変更、`expense.educationEntrance` 等の row 内訳追加

### 中優先度

#### R-3: ざっくり診断モードの編集導線ラベル
- 現状: `ja.editLinks.fire = 'FIRE条件を修正'` 固定。'none' 選択時に違和感
- 案: 動的化（'none' なら「働き方・退職条件を修正」など）、もしくは中立名「働き方を修正」へ統一
- 規模: 小（ja.ts と ResultDashboard の修正のみ）

#### R-4: 現役継続でのブリッジ生活費を rough にも展開
- 現状: しっかり診断のみ。ざっくり診断は `income.retirementAge` を直接編集できず、常に 65 想定
- ざっくり診断は意図的に簡素化しているので、現状維持でも可

#### R-5: 関連記事セクション（STEP11.8 の C）の実コンテンツ化
- 現状: プレースホルダー文だけ
- 必要な作業: 各テーマ別の記事リンクを配置、WordPress 側のテーマ別ページとの連携

### 低優先度

#### R-6: モバイル実機での視認確認（サンドボックスで未実施分）
- STEP11.5 以降の sticky ナビ・ステータス行・確認パネル・「続けて変更」ボタンが iPhone SE (375px) 実機でどう見えるか
- 確認ポイント:
  - 下部ナビ「次へ」が切れない
  - ステータス行 1 行表示
  - 補足バーが圧迫感を与えない
  - iframe 内で sticky が正しく機能

#### R-7: 教育費数値の年次更新
- 文科省「子供の学習費調査」「私立大学等の学生納付金等調査」、JASSO「学生生活調査」が更新されたら `src/engine/constants.ts` の `EDUCATION_COST` と `UNIVERSITY_ENTRANCE_FEE` を差し替え
- 差し替えは constants.ts 1 ファイル内で完結する設計（コメントに出典明記済み）

#### R-8: 教育費出典の結果ダッシュボードへの誘導
- 現状: 教育費詳細シート（Bottom Sheet）の末尾のみに出典
- 試算条件サマリー（`AssumptionSummary`）にも「教育費の出典」を含めると、より透明性が増す

---

## 設計上の決定メモ

### 入力フェーズの分離（STEP11.5）
- iframe 内での sticky 動作のため、`.step-layout` は `height: 100dvh` で内部スクロールを `.step-content` に閉じ込める
- 外側 `.app` の `padding-bottom: 64px`（旧固定ナビ用）は削除

### 文言の中立化（STEP11.6 / STEP11.12）
- FIRE 専用計算機の印象を弱めるため、「FIRE 条件」→「働き方の方針」など可能な範囲で汎用語に
- 「未入力 OK」のソフトトーンを採用し、「必須」「エラー」「不足」は使わない

### 教育費の出典固定（STEP11.10 / STEP11.11）
- MEXT R5 + JASSO R4 を基準にする
- 入学金は 4 年で均さず 1 年目に加算する（教育費ピークの正確化）
- `constants.ts` 1 ファイルで一括差し替え可能

### 結果ループの設計（STEP11.13）
- `resultReturnTarget` で「上部に戻る」と「条件編集に戻る」を切り替える stateful な仕組み
- `cameFromResult` フラグ（既存）と組み合わせて、入力フェーズの UI を編集モード ⇔ 通常モードに分岐
- 「続けて変更」はあくまで補助導線として 36px の secondary ボタンで配置

---

## ファイル所在

- 教育費定数: `src/engine/constants.ts`
- 教育費エンジン: `src/engine/educationCostEngine.ts`
- 教育費詳細 UI: `src/features/results/EducationDetail.tsx`
- 入力フロー: `src/features/input-steps/rough/RoughFlow.tsx`, `.../thorough/ThoroughFlow.tsx`
- 結果画面: `src/features/results/ResultDashboard.tsx`
- ストア: `src/store/inputStore.ts`
- スキーマ: `src/schema/types.ts`, `src/schema/thoroughSteps.ts`, `src/schema/roughQuestions.ts`, `src/schema/roughMapping.ts`
- 文言: `src/strings/ja.ts`
- スタイル: `src/index.css`

---

## コミット履歴サマリ

| STEP | コミット | 概要 |
|---|---|---|
| 11.5 | `3e594f1` | 下部ナビを sticky 化、iframe 対応 |
| 11.6 | `1a5dd4f` | 未入力ステータス + 確認パネル |
| 11.7 | `962370a` | 確認パネルを細い補足バーに |
| 11.8 | `816ee93` | トップ画面に説明・注意点・関連記事を戻す |
| 11.9 | `6d7cd51` | ステータス行を 1 行表示に短縮 |
| 11.10 | `3b62198` | 教育費を MEXT R5 整合・私立小・入学金分離 |
| 11.11 | `4b0a498` | 入学金 UI 表示・出典明記・ナビ padding 調整 |
| 11.12 | `19fe13b` | 現役継続オプション追加 |
| 11.13 | `e56d8d5` | 続けて変更 + 現役継続整合 + ブリッジ生活費 |
