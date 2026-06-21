# デザイン / UX / アーキテクチャ 申し送り資料

ローン専用などの **小さなシミュレーター** を、現行の総合ライフプランシミュレーター
（life-plan-lab）と **見た目・使用感・実装品質を揃えて** 作るための申し送り。

コピペ用のトークン/共通クラスは [`shared-tokens.css`](./shared-tokens.css) に分離してある。
本書はその背景と「なぜそうしているか」を説明する。

---

## 0. プロダクトの芯（最初に読む）

> **未来を当てるためではなく、未来を整理するためのツール。**
> 入力して終わりではなく「結果を見る → 条件を変える → また見る → 家族で話す」
> という試行錯誤を支える。

この一文がデザインと文言のすべての判断基準。新シミュレーターでも、
**煽らない・止めない・いつでも再計算できる** を貫く。

---

## 1. デザイントークン（Quiet Luxury）

核となる思想:

- **赤を使わない。** 注意・警告系もブラス（`--brass`）／ブラウン（`--band-tough`）で落ち着かせる。
- **上質感は面でなく細い線で出す。** Hero 上端の 2px ブラスグラデーションが代表例。
- 深緑（`--accent`）を主軸に、ウォームアイボリー背景＋温かい白カード。「森の中の落ち着いた相談室」。

主要トークン（全量は `shared-tokens.css`）:

| トークン | 値 | 用途 |
|---|---|---|
| `--bg` | `#f4f1ea` | ウォームアイボリー背景 |
| `--surface` | `#fffdf7` | カード面 |
| `--text` / `--muted` | `#2a2c27` / `#6e736a` | 本文 / 補足・注記 |
| `--border` | `#eee9e0` | 控えめな境界 |
| `--accent` / `--accent-strong` / `--accent-soft` | `#2d4a3e` / `#233f33` / `#e7ede8` | 深緑 CTA / 押下 / 淡パネル |
| `--brass` | `#a98b5d` | 差し色（線限定） |
| `--band-stable/realistic/needs/tough` | `#3f6b54` / `#4c6b62` / `#8f7344` / `#8a6749` | 判定バンド |
| `--radius` / `--shadow` / `--shadow-raised` | `14px` / 微シャドウ / hover 浮き | カード |
| `--app-pad-top` | `calc(24px + env(safe-area-inset-top,0px))` | 上部 safe-area |

**タイポグラフィ**: `-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', 'Segoe UI', sans-serif` / `line-height: 1.7`。
サイズ階層: 主見出し 1.5rem・セクション見出し 1.1rem(600)・本文 0.9rem・注記 0.78〜0.85rem。

**レイアウト**: `.app { max-width: 720px; padding: var(--app-pad-top) 18px 0 }`。
セクション間 gap は入力 14px / 結果 16px。カード内 padding は標準 18px（入力カードは詰めて 14px 16px）。

**ボタン**: `.btn`（padding 12px 18px / radius 10px / transition 0.25s）、`--primary`（accent 背景・白文字）、
`--recommended`（accent-soft）、`--skip`（muted）。下部ナビのボタンは min-height 48px を確保。

**アニメ**: `@keyframes fade-rise`（6px 上げ + フェード）、collapsible の ▾ 回転 0.15s。
すべて `prefers-reduced-motion: no-preference` でガード。

---

## 2. 文章トーン（煽らない・止めない・整理する）

文言は **`src/strings/ja.ts` に一元集約**。新シミュレーターでも同じく `strings/ja.ts` を作り、
散らさない。実例:

- 判定は赤/エラーでなく段階表現: `安定 / 現実的 / 調整余地あり / 見直し推奨`。「破綻」「危険」は使わない。
- 冒頭で安心を一度だけ: 「分かる範囲で大丈夫です。未入力でも概算でき、あとから変えて再計算できます。」
- スキップは選択肢として提示: 「未入力で進む」「未入力のまま、標準値で概算します。あとから変更できます。」
- 結果の位置づけを明言: 「これは概算です。未来を当てるためではなく、整理するためのものです。」
- 慎重条件は不安煽りでなく「別の見方」: 「将来を予測するものではなく、前提を変えた確認用です。」

避けること: 赤字エラー表示、入力を強制する語、未来を断定する語、専門用語の説明なし投下。

---

## 3. 入力フローの作法

1 ステップの構成（`src/features/input-steps/rough/RoughFlow.tsx`, `thorough/ThoroughFlow.tsx`）:

```
ProgressHeader            … 進捗（X/Y）+ あと何問・何分
section.step-head         … 目的説明（muted トーン）
reassure                  … 初回ステップのみ、安心の一文
QuestionCard × N          … 題目 + ？help + 入力フィールド
bottom-nav
  ├ step-status           … 「X/Y 入力済み・未入力OK」の自己確認
  ├ step-confirm          … 未入力時の軽い確認パネル（止めない）
  └ 3-button nav          … 戻る / 中央表示 / 次へ
```

- **任意入力が前提**: 各項目にスキップ・おすすめ値・「未入力で進む」を用意。
- **未回答ガードはソフト**: 「次へ」で未入力があってもモーダルで止めない。確認パネルを出し、
  「未入力項目を見る」で最初の該当項目へ `scrollIntoView({ block: 'center' })`。ユーザー主動にする。
- **スクロール構造（2 モード対応）**: `shared-tokens.css` の `.step-layout / .step-content / .bottom-nav` を参照。
  DOM 構造（`.step-layout > .step-content + .bottom-nav` の siblings）はどちらのモードでも同じ。
  CSS は起動時に検出した埋め込み状態（§6 参照）で切り替わる:
  - **単独表示モード**: inner-scroll 1 本（`.step-layout` `100svh` + `.step-content` `overflow-y: auto` + `.bottom-nav` `sticky`）。「次へ」を常時 viewport 下端に固定する。`100svh`（URL bar 出現時の小さい方）で iOS Safari に堅牢。
  - **埋め込みモード**: `html.is-embedded` で上記の固定 viewport 高さと inner-scroll を release。`.bottom-nav` は `static`。スクロールは親 WordPress ページに集約される。

ヘルプ: `HelpTooltip`（？アイコン）。タップで開き、外側タップ/Escape で閉じる。長文は max-height + scroll。
**用語解説ではなく「どこを見れば入力できるか」の案内**にする。

---

## 4. 結果画面の作法

- **結論を隠さない**: Hero を最上段に常時表示（判定バンド + 主指標 + 「動かすと変わりやすい項目」+ 次ステップ link）。
  判定の根拠は `<details>` で展開（各指標に「何を測る指標か」の 1 行 explainer を添える）。
- **What-if を上に**: QuickAdjust を Hero 直下に置き「操作 → 結果がほぼ 1 画面で完結」。
- **詳細は全部 collapsible / inline `<details>`**（モーダル不使用 = iframe の position:fixed 問題を構造的に回避）。
  weight は `.collapsible--primary`（最重要）/`--card`（操作）/`--muted`（補助・参考）で視覚化。
- **列挙は絞る**: 見直しポイントは最大 6 件など、上限を設けて密度過剰を避ける。

---

## 5. アーキテクチャ規約

ディレクトリ責務:

| ディレクトリ | 責務 |
|---|---|
| `src/schema` | 型・入力スキーマ・正規化（両モードの合流点） |
| `src/engine` | 純粋関数の計算群（UI から完全分離）。定数は `engine/constants.ts` |
| `src/store` | zustand。phase 遷移・入力状態・localStorage 自動保存 |
| `src/features` | 画面（mode-select / input-steps / results / resume） |
| `src/lib` | ユーティリティ（iframe 通信・整形・背面ロック） |
| `src/strings` | 日本語文言の一元管理 |

**Field<T> パターン（踏襲推奨）**: 全入力項目を
`Field<T>{ value, source, label, assumptionText, unit? }` で包む。
`source = user_input | recommended_value | default_value | skipped`。
これにより「今回の試算条件」を機械生成でき、「何を変えると結果が変わるか」を UI で自動識別できる。

**エンジン**: `runSimulation(input): SimulationResult` のように純粋関数 1 本に集約し、
UI/ストアに一切依存させない。複数画面（Hero・グラフ・年次表）は同じ `SimulationResult` を参照（データ単一ソース）。
**ローン計算は `src/engine/mortgageEngine.ts` が独立しており、ローン専用シミュレーターの基盤として流用可能。**

**状態**: zustand 単一ストア、phase `mode → input → result`。
localStorage 自動保存（キー例 `fire-lifeplan-lab.v2.session.v1`）＋「続きから再開」プロンプト。
月額/年額などの単位変換は setter 内で吸収する。

---

## 6. ビルド / デプロイ / テスト / iframe

- **Vite**: `base: './'`（相対パス出力、サブディレクトリ公開前提）。重いライブラリ（Recharts 等）は
  結果到達時に lazy import し初期表示を軽くする。
- **デプロイ**: `.github/workflows/deploy-pages.yml`。トリガーは `workflow_dispatch`（手動）または
  `main` への push。GitHub Pages へ配置。フィーチャーブランチの push ではデプロイしない（事故防止）。
- **テスト**: vitest。`tests/engine`（計算・golden・シナリオ）/ `tests/store` / `tests/render` / `tests/debug`。
  計算系を厚めに、代表ケースは固定値テストで信頼性を担保。TypeScript は `strict`。
- **iframe 規約（2 モード）**:
  - アプリは起動時に `window.self !== window.top` で iframe 埋め込みを判定し、`<html>` に
    `data-embedded="true"` と `class="is-embedded"` を付ける（`src/main.tsx`）。付かない側
    （GitHub Pages 直リンク等）は単独表示モードのまま動く。

  - **単独表示モード（GitHub Pages・dev）**:
    `.step-layout { height: calc(100svh - --app-pad-top); overflow: hidden }` +
    `.step-content { overflow-y: auto }` + `.bottom-nav { position: sticky }` の **inner-scroll 1 本**。
    スマホ単独で「次へ」を viewport 下端に固定するのに堅牢。`100svh`（URL bar 出現時の小さい方）で iOS Safari 安定。

  - **埋め込みモード（WordPress iframe）**:
    `html.is-embedded` で上記 inner-scroll パターンを release。`.step-layout` は
    `display: block / height: auto`、`.bottom-nav` は `position: static`。これにより PC で発生していた
    **アプリ内部スクロール + iframe 内スクロール + WordPress ページスクロールの 3 重** を
    **WordPress 親ページの 1 本** に統一する。

  - **高さの自動追従**: `src/lib/embed.ts` の `postEmbeddedHeight()` を `src/App.tsx` が `#root` の
    `ResizeObserver` で発火し、`lifeplanlab:resize` を親に送る。親側は `Math.max(min, Math.min(max, h))`
    で clamp して `iframe.style.height` を更新。自己増殖防止のため送信側で 2px 未満の振動は無視。

  - **画面遷移時のスクロール**: phase 変化（mode → input → result）と結果再計算で
    `postEmbeddedScrollTop()` が `lifeplanlab:scrollTop` を送る。親側は
    `iframe.getBoundingClientRect().top + window.pageYOffset` までスムーススクロール。

  - **親 → 子の URL params パススルー**: 生活費見直し・住宅ローンシミュレーターは親 WordPress ページの
    URL に `?livingCostMonthly=...` 等を付与する。iframe の `window.location.search` は親と別 URL を
    見ているため自動では届かない。親側スクリプトで `src/lib/embedParentParams.ts` と同じアルゴリズム
    （許可リスト 11 項目を抜き、`frame.src` に append）を実行して持ち越す。

  - **モーダル開閉通知**: 既存の `src/lib/notifyModalToParent.ts`（`lifeplan-lab:modal` namespace）は
    引き続き有効。ResumePrompt 開閉中に親スクロールを止めたい場合に併用。

  - **親側の最小実装**: [`docs/EMBED.md`](./EMBED.md) に貼り付け済みコードを掲載
    （iframe + URL passthrough + resize listener + scrollTop listener）。**WordPress に貼る唯一の
    実装資料はこれ**。本書はそこへの設計原則の入口として扱う。

  - **旧 sticky wrapper パターンについて**: 過去の WordPress 埋め込みでは、親側で iframe を
    `position: sticky` と `100vh / 100dvh` に固定する方式を使用していた。ただし、この方式は
    iframe 高さの自動追従、画面遷移時の親ページ先頭スクロール、親ページへのスクロール集約と
    相性が悪い。**新規ページおよび既存ページの更新では、WordPress 親側で iframe を
    `position: sticky`、`height: 100vh`、`height: 100dvh` に固定しない**。必ず
    [`docs/EMBED.md`](./EMBED.md) の最新スニペットを使用し、URL params パススルー、
    `lifeplanlab:resize`、`lifeplanlab:scrollTop` を含む埋め込み方式へ統一する。

### 新規小型シミュレーターの必須要件

WordPress iframe 埋め込みを前提とする新規シミュレーターでは、以下を MVP 完了条件とする。

**iframe 埋め込み要件**

- iframe 埋め込み判定と単独表示／埋め込み表示の自動切替
- 埋め込み時のアプリ内スクロール解除と、親ページスクロールへの集約
- `lifeplanlab:resize` による親 iframe 高さ自動追従
- `lifeplanlab:scrollTop` による画面遷移時の親ページ先頭スクロール
- [`docs/EMBED.md`](./EMBED.md) の親側スニペット更新
- 総合版へ渡す URL パラメータがある場合、親 WordPress ページから iframe への許可リスト付きパススルー
- 複数 iframe 配置時にも、送信元 iframe を識別して誤作動しないこと（メッセージに `source: '<simulator>'` を必ず付ける）

**総合版への引き継ぎ契約**

個別シミュレーターで入力・試算した条件を総合版へ戻し、人生全体で確認できる仕組みも必須方針。

- 新規小型シミュレーターは、個別で入力・試算した条件を総合版へ引き継げることを MVP 完了条件とする。
- 下書き保存と、総合版へ渡す確定保存を分離すること。
- 確定データは `lifePlanLab:<simulator>` 形式の localStorage キーに保存し、URL パラメータは親ページ遷移用の補助手段として扱うこと。
- 総合版側では、受け取り値を実際に画面・計算で使う既存の正しい入力フィールドへ反映すること。
- 総合版でユーザーが手動編集した後は、その値を優先し、外部シミュレーターの値で勝手に上書きしないこと。
- 取り込み中の条件と反映元を、控えめなバナー等で確認できること。

---

## 7. 再利用できる共通部品

新シミュレーターへコピー/移植する候補:

| パス | 部品 | 用途 |
|---|---|---|
| `src/features/input-steps/QuestionCard.tsx` | QuestionCard | 質問カード（題目 + help + 子要素） |
| `src/features/input-steps/NumberField.tsx` | NumberField | 数値入力（小数・Backspace・フォーカス外反映） |
| `src/features/input-steps/HelpTooltip.tsx` | HelpTooltip | ？ヘルプ（自動クローズ・長文対応） |
| `src/features/input-steps/ProgressHeader.tsx` | ProgressHeader | 進捗 + ETA |
| `src/features/results/DetailCard.tsx` | DetailCard | 値 + caption + inline 展開 |
| `src/features/results/QuickAdjust.tsx` | QuickAdjust | What-if ステッパー（指標に合わせて要適応） |
| `src/lib/notifyModalToParent.ts` / `useLockBodyScroll.ts` / `format.ts` | lib | iframe 通信（モーダル）/ 背面ロック / 数値整形 |
| `src/lib/embed.ts` | `isEmbedded` / `postEmbeddedHeight` / `postEmbeddedScrollTop` / `measureContentHeight` | iframe 検出・高さ通知・先頭スクロール依頼 |
| `src/lib/embedParentParams.ts` | `appendAllowedParamsToIframeSrc` / `ALLOWED_PARENT_PARAMS` | 親→子 URL パススルーの TS リファレンス（[`docs/EMBED.md`](./EMBED.md) と同一アルゴリズム） |

> 注: `src/components/` は現在空（旧 BottomSheet は inline `<details>` 化で削除済み）。
> 共通部品は実質 `features/` と `lib/` にある。
>
> iframe 埋め込みの詳細スニペット（高さ自動追従・先頭スクロール・URL パススルー）は
> [`docs/EMBED.md`](./EMBED.md) を参照。本書は思想と全体像に絞り、コピペ用コードは EMBED.md 側に集約している。

---

## 8. リポジトリ分割の指針（判断材料）

| 観点 | 目安 |
|---|---|
| 独立ドメイン（ローン計算のみ等） | **別リポジトリが素直。** `shared-tokens.css` をコピーして開始 |
| 総合版と将来統合し得る | 同リポジトリ別エントリ（Vite multi-page）も可 |
| 共通化の度合い | まずトークン CSS + `lib` のコピーで十分。早すぎる npm package 化はしない |

最初の一歩のおすすめ: **別リポを切り、`shared-tokens.css` を貼り、`strings/ja.ts`・`engine`・
`store` を同じ規約で立ち上げ、`mortgageEngine.ts` を流用する。**
入力 → 結果 → 再計算のループ構造と文言トーンを最優先で揃えると、別アプリでも「同じ家族」に感じられる。
