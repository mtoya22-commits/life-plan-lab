import { useEffect, useState } from 'react';
import { useInputStore } from '../../../store/inputStore';
import { ja } from '../../../strings/ja';
import { ROUGH_PAGES, type RoughQuestion } from '../../../schema/roughQuestions';
import type { RoughCell } from '../../../schema/types';
import { ProgressHeader } from '../ProgressHeader';
import { QuestionCard } from '../QuestionCard';
import { NumberField } from '../NumberField';

// =============================================================================
// ざっくり診断のステップフロー本体。
// 思想: アンケートではなく「人生設計を調整する道具」。止めない・煽らない・スマホで軽い。
// - 各ステップに目的説明 / 進捗 + あと何問・何分 / 下部固定ナビ
// - 未回答ガードはソフト（おすすめ・スキップ・このまま進む の逃げ道を必ず提示）
// - 結果画面からの「カテゴリ修正」(cameFromResult) では再計算ボタンを主導線にする
// =============================================================================

function isComplete(cell: RoughCell): boolean {
  if (cell.source === 'recommended_value' || cell.source === 'skipped') return true;
  if (cell.source === 'user_input') return cell.value !== null && cell.value !== '';
  return false;
}

export function RoughFlow() {
  const roughPage = useInputStore((s) => s.roughPage);
  const draft = useInputStore((s) => s.roughDraft);
  const cameFromResult = useInputStore((s) => s.cameFromResult);
  const nextRoughPage = useInputStore((s) => s.nextRoughPage);
  const prevRoughPage = useInputStore((s) => s.prevRoughPage);
  const submitRough = useInputStore((s) => s.submitRough);
  const submitRoughAndContinue = useInputStore((s) => s.submitRoughAndContinue);
  const backToResult = useInputStore((s) => s.backToResult);

  const [attempted, setAttempted] = useState(false);

  // ステップが変わったら質問画面の先頭へスクロール（前ステップの位置を引き継がない）。
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    setAttempted(false);
  }, [roughPage, cameFromResult]);

  const page = ROUGH_PAGES[roughPage];
  const visible = page.questions.filter((q) => (q.showIf ? q.showIf(draft) : true));
  const completedCount = visible.filter((q) => isComplete(draft[q.id])).length;
  const totalCount = visible.length;
  const pageComplete = totalCount === 0 || completedCount === totalCount;
  const isLast = roughPage === ROUGH_PAGES.length - 1;

  // あと何問・あと何分（おおよそ）
  const laterQuestions = ROUGH_PAGES.slice(roughPage + 1).reduce(
    (n, p) => n + p.questions.filter((q) => (q.showIf ? q.showIf(draft) : true)).length,
    0,
  );
  const remainingQuestions = laterQuestions + (totalCount - completedCount);
  const etaText = remainingQuestions <= 0 ? 'まもなく完了' : `残り約${remainingQuestions}問・あと約1分`;

  const advance = () => {
    setAttempted(false);
    nextRoughPage(); // スクロールは roughPage 変更を検知する useEffect が担当
  };

  // 「次へ」: 未入力があれば確認パネルを出すだけ。即スクロールはせず、ユーザーに選ばせる。
  const handleNext = () => {
    if (pageComplete) {
      advance();
    } else {
      setAttempted(true);
    }
  };

  // 「未入力項目を見る」: 最初の未入力項目を .step-content 内でセンターに表示し、
  // 補足バーは閉じる。移動した先で同じ案内が残り続けると圧迫感が出るため。
  // 再度「次へ」を押して未入力が残っていれば、また同じ補足バーが出る。
  const revealFirstIncomplete = () => {
    const firstIncomplete = visible.find((q) => !isComplete(draft[q.id]));
    if (firstIncomplete) {
      document.getElementById(`q-${firstIncomplete.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setAttempted(false);
  };

  // 「このまま次へ」: 仕様 #4 のとおり、未入力項目には触らず通常進行する。
  // 仕様 #5 の「入力済み扱い」はあくまで per-item の「未入力で進む」ボタン分のみで、
  // ステップ単位の確認パネルでは状態を変えない（明示的にスキップしたい項目はユーザーが個別操作する）。
  const proceedAsIs = () => {
    advance();
  };

  return (
    <section className="screen step-layout">
      <div className="step-content">
        {cameFromResult ? (
          <header className="edit-header">編集中：{page.title}</header>
        ) : (
          <ProgressHeader label="ざっくり診断" current={roughPage + 1} total={ROUGH_PAGES.length} etaText={etaText} />
        )}

        <div className="step-head">
          <h2 className="section-heading">{page.title}</h2>
          <p className="step-purpose muted">{page.purpose}</p>
        </div>

        {!cameFromResult && roughPage === 0 && <p className="step-reassure">{ja.nav.reassure}</p>}

        {visible.map((q) => (
          <div id={`q-${q.id}`} key={q.id}>
            <RoughQuestionView q={q} cell={draft[q.id]} showHint={attempted && !isComplete(draft[q.id])} />
          </div>
        ))}

        <div className="bottom-nav-spacer" />
      </div>

      <nav className="bottom-nav" aria-label="ステップ操作">
        {/* 通常モード時のみ、入力済み/未入力の自己確認ステータスと、
            「次へ」を押した直後の軽い確認パネルを出す。
            cameFromResult（結果からの編集）では再計算が主導線なので出さない。 */}
        {!cameFromResult && totalCount > 0 && (!attempted || pageComplete) && (
          <p className="step-status" aria-live="polite">
            {ja.nav.stepStatus(completedCount, totalCount)}
          </p>
        )}
        {!cameFromResult && attempted && !pageComplete && (
          <div className="step-confirm" role="group" aria-label="未入力項目の確認">
            <p className="step-confirm__text">{ja.nav.confirmIncomplete}</p>
            <div className="step-confirm__actions">
              <button type="button" className="btn" onClick={revealFirstIncomplete}>
                {ja.nav.showIncomplete}
              </button>
              <button type="button" className="btn btn--primary" onClick={proceedAsIs}>
                {ja.nav.confirmProceed}
              </button>
            </div>
          </div>
        )}

        {/* 結果からの編集モード時の補助ボタン: 続けて変更（結果へ戻って次の条件編集へ）。
            メインの「再計算して結果へ」と区別したいため、主ボタンの上に薄い 1 行で置く。 */}
        {cameFromResult && (
          <div className="recompute-continue">
            <button type="button" className="btn" onClick={submitRoughAndContinue}>
              {ja.nav.recomputeContinue}
            </button>
          </div>
        )}

        <div className="bottom-nav__inner">
          {cameFromResult ? (
            <>
              <button className="btn" onClick={backToResult}>
                {ja.nav.backToResult}
              </button>
              <span className="bottom-nav__center muted">編集中</span>
              <button className="btn btn--primary" onClick={submitRough}>
                {ja.nav.recompute}
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={prevRoughPage}>
                {roughPage === 0 ? ja.nav.toModeSelect : ja.common.back}
              </button>
              <span className="bottom-nav__center muted">
                {roughPage + 1} / {ROUGH_PAGES.length}
              </span>
              <button className="btn btn--primary" onClick={handleNext}>
                {isLast ? ja.common.seeResult : ja.common.next}
              </button>
            </>
          )}
        </div>
      </nav>
    </section>
  );
}

function RoughQuestionView({ q, cell, showHint }: { q: RoughQuestion; cell: RoughCell; showHint: boolean }) {
  const setRoughValue = useInputStore((s) => s.setRoughValue);
  const useRoughRecommended = useInputStore((s) => s.useRoughRecommended);
  const skipRough = useInputStore((s) => s.skipRough);

  return (
    <QuestionCard title={q.label} help={q.help}>
      {q.kind === 'number' ? (
        <NumberField
          placeholder={q.placeholder}
          unit={q.unit}
          value={
            (cell.source === 'user_input' || cell.source === 'recommended_value') && cell.value !== null
              ? Number(cell.value)
              : null
          }
          onChange={(v) => setRoughValue(q.id, v == null ? '' : v)}
        />
      ) : (
        <div className="choice-group">
          {q.options?.map((opt) => {
            const selected =
              (cell.source === 'user_input' || cell.source === 'recommended_value') &&
              String(cell.value) === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                className={`choice${selected ? ' choice--selected' : ''}`}
                aria-pressed={selected}
                onClick={() => setRoughValue(q.id, opt.value)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {(q.allowRecommended || q.allowSkip) && (
        <div className="field-actions">
          {q.allowRecommended && (
            <button
              type="button"
              className={`btn btn--recommended${cell.source === 'recommended_value' ? ' is-active' : ''}`}
              onClick={() => useRoughRecommended(q.id)}
            >
              {cell.source === 'recommended_value' ? '✓ ' : ''}
              {q.recommendedLabel ?? ja.common.useRecommended}
            </button>
          )}
          {q.allowSkip && (
            <button
              type="button"
              className={`btn btn--skip${cell.source === 'skipped' ? ' is-active' : ''}`}
              onClick={() => skipRough(q.id)}
            >
              {cell.source === 'skipped' ? `✓ ${ja.common.skip}` : ja.common.skip}
            </button>
          )}
        </div>
      )}

      {cell.source === 'skipped' && <p className="field-status muted">{ja.field.skipped}</p>}

      {showHint && (
        <p className="field-hint">{q.kind === 'number' ? ja.field.hintNumber : ja.field.hintChoice}</p>
      )}

      {q.id === 'childrenCount' && <p className="field-status muted">{ja.field.childrenAgeNote}</p>}
    </QuestionCard>
  );
}
