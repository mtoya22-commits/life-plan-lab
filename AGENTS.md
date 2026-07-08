# AGENTS.md — life-plan-lab（総合版）

このファイルは 2 部構成。前半は LIFE PLAN LAB 共通ルールの**配布コピー**（編集禁止・正本は `docs/agents/AGENTS.common.md`）、後半がこのリポジトリの固有ルール。

<!-- BEGIN lifeplan-common-rules（配布コピー・ここから END まで直接編集しない。変更は正本 docs/agents/AGENTS.common.md への PR で行う） -->
<!-- lifeplan-common-rules v1 / 2026-07-07 / 正本: life-plan-lab/docs/agents/AGENTS.common.md -->

# LIFE PLAN LAB 共通ルール（全リポジトリ共通）

## このファイルの扱い

- 正本は総合版リポジトリ（life-plan-lab）の `docs/agents/AGENTS.common.md`。各リポジトリの AGENTS.md 内の共通部は、この正本の**配布コピー**である。
- 共通部の変更が必要な場合は、各リポジトリでローカルに直接修正せず、正本 `docs/agents/AGENTS.common.md` への変更案として報告・提案する。
- 共通ルールとリポジトリ固有ルールが矛盾した場合、共通ルールが優先。
- AI エージェントは、このファイルおよび配布コピーをリポジトリごとに独自最適化・拡張してはならない。

## プロダクトの芯

未来を当てるためではなく整理するためのツール。煽らない・止めない・再計算できる。

## Git / 品質ゲート

- main へ直接 push しない。フィーチャーブランチ → PR → マージ。
- push / PR 前に `npm test` と `npm run build` を実行し、両方成功させる。
- 仕様変更時は関連 docs を同一 PR で更新する。

## データ互換性

- 小型シミュレーターとの共有 localStorage キーは `lifePlanLab:<simulator>` 形式。
- 新フィールド追加は optional + 読み込み時デフォルトで行う。
- 既存共有キーやフィールド名を安易にリネームしない。
- 破壊的変更が必要な場合のみ、移行設計を別 PR として提案する。
- URL パラメータは許可リスト制。優先順位は URL > localStorage（URL は明示的意図として扱う）。
- 公開前に既存保存データ・既存導線への影響を確認する。

## WordPress iframe 連携

- 埋め込み判定による単独表示／埋め込み表示の 2 モード自動切替を維持する。
- WordPress iframe の高さ自動調整と、画面遷移時の親ページへのスクロール連携を維持する。
- postMessage のメッセージ型・source・clamp 値・payload 等の契約の正典は総合版の `docs/EMBED.md`。共通ルールとしては「EMBED.md の契約を維持する」ことのみを課し、詳細値はここに固定しない。
- 親側で iframe を `position: sticky` / `100vh` / `100dvh` 固定にしない（旧方式・禁止）。
- 同一ページに複数 iframe を配置しても誤作動しないこと。

## UX / デザイン

- 375px 前後で主要 CTA、入力、ナビゲーションが欠けず、横スクロール・操作不能・意図しない重なりがないこと。
- `shared-tokens.css` の共通デザイントークンを使用する。
- 赤を主色や煽り表現として使わない。入力エラー・警告など状態を伝える必要がある箇所では適切な状態色を使用してよい。

## 小型 Sim → 総合版 引き継ぎ契約（新規 Sim の MVP 完了条件）

- 個別で入力・試算した条件を総合版へ引き継げること。下書き保存と、総合版へ渡す確定保存を分離する。
- 確定データは `lifePlanLab:<simulator>` 形式の localStorage キーに保存し、URL パラメータは親ページ遷移用の補助手段として扱う。
- 総合版でユーザーが手動編集した後はその値を優先し、外部シミュレーターの値で勝手に上書きしない。
- 取り込み中の条件と反映元を、控えめなバナー等で確認できること。
- 小型 Sim から総合版へ戻る導線を壊さない。
<!-- END lifeplan-common-rules -->

---

# life-plan-lab（総合版）固有ルール

## 役割

LIFE PLAN LAB 総合版（総合ライフプランシミュレーター v2）。小型シミュレーター（生活費見直し・住宅ローン）からのデータ受け側。ファミリー共通仕様の置き場（`docs/agents/AGENTS.common.md`（正本）／ `docs/DESIGN_HANDOFF.md` ／ `docs/EMBED.md` ／ `docs/shared-tokens.css`）。

## コマンド

- `npm run dev` — 開発サーバー（Vite）
- `npm test` — vitest（`tests/` 配下）
- `npm run build` — `tsc -b && vite build`（型検査込み）
- `npm run typecheck` — `tsc -b --noEmit`
- lint / prettier はなし。TypeScript strict が唯一の静的ゲート。

## このリポジトリが所有する契約

- セッション保存キー: `fire-lifeplan-lab.v2.session.v1`（`src/store/inputStore.ts`）。optional フィールド + 読み込み時デフォルトの互換方式。リネーム禁止。
- 受信キー: `lifePlanLab:livingCost`（`src/lib/importedLivingCost.ts`）／ `lifePlanLab:mortgage`（`src/lib/importedMortgage.ts`）／ `lifePlanLab:education`（`src/lib/importedEducation.ts`）。旧フィールド名フォールバック（正規化処理）を消さない。
- URL パラメータ許可リスト: `src/lib/embedParentParams.ts` が実装上の正。`docs/EMBED.md` 内のスニペット（2 箇所）と常に一致させる（`tests/lib/embedParentParams.test.ts` が防波堤）。
- 生活費契約フィクスチャ: `tests/fixtures/contracts/livingCostPayload.v1.json` は生活費見直しシミュレーター側の `tests/fixtures/livingCostPayload.v1.json` と**バイト単位で同一**に保つ（`sha256sum` で確認）。`lifePlanLab:livingCost` の現行契約は **`livingCost` ネスト形**で、旧フラット形はフォールバック（`v1-legacy-flat.json`・実在未確認）としてのみ維持する。フィクスチャを変更する場合は、送信側（Sim の生成テスト `tests/lib/contractFixture.test.ts`）・受信側（本リポの `tests/lib/livingCostContract.test.ts`）・両フィクスチャを同じ変更単位で更新する。
- 教育費契約フィクスチャ: `tests/fixtures/contracts/educationPayload.v1.json` は教育費ピークシミュレーター側の `tests/fixtures/educationPayload.v1.json` と**バイト単位で同一**に保つ（`sha256sum` で確認）。変更する場合は、送信側（Sim の生成テスト）・受信側（本リポの parse テスト）・両フィクスチャを同じ変更単位で更新する。
- 教育費取り込み方針（Stage 2・B案）: 引き継ぐのは条件のみで、Sim の金額（ピーク・総額）は計算へ注入せず参考表示に留める。下宿は `uniLiving='away'` で表現し、追加イベントを作らない（二重計上禁止）。新条件の検知は fingerprint 方式（`appliedEducationImportFingerprint`）。

## 注意領域

- `src/features/results/ResultDashboard.tsx` の iOS Safari 白画面対策（複数系統のスクロールリセット防御）は削らない。
- `src/store/inputStore.ts` の手動編集フラグ（`livingCostManuallyEdited` / `mortgageManuallyEdited` / `educationManuallyEdited`）は setter に分散しており、setter 追加時に漏れやすい。setter を足したら必ず確認する（教育費は `setThoroughChildrenCount` を含む）。
- 変更ごとに回帰防止テストを `tests/` に追加する慣例。`tests/engine` の golden / シナリオテストを厚く保つ。
- README の STEP9 / STEP10 の iframe 節（sticky 固定・min-height 固定）は旧方式の履歴。現行仕様は `docs/DESIGN_HANDOFF.md` §6 と `docs/EMBED.md` を参照。
