import { useEffect, useState } from 'react';
import { useInputStore } from '../../../store/inputStore';
import { ja } from '../../../strings/ja';
import { ROUGH_PAGES, type RoughQuestion } from '../../../schema/roughQuestions';
import type { RoughCell } from '../../../schema/types';
import { ProgressHeader } from '../ProgressHeader';
import { QuestionCard } from '../QuestionCard';

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
  const backToResult = useInputStore((s) => s.backToResult);

  const [attempted, setAttempted] = useState(false);

  // ステップが変わったら質問画面の先頭へスクロール（前ステップの位置を引き継がない）。
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [roughPage, cameFromResult]);

  const page = ROUGH_PAGES[roughPage];
  const visible = page.questions.filter((q) => (q.showIf ? q.showIf(draft) : true));
  const pageComplete = visible.every((q) => isComplete(draft[q.id]));
  const isLast = roughPage === ROUGH_PAGES.length - 1;

  // あと何問・あと何分（おおよそ）
  const laterQuestions = ROUGH_PAGES.slice(roughPage + 1).reduce(
    (n, p) => n + p.questions.filter((q) => (q.showIf ? q.showIf(draft) : true)).length,
    0,
  );
  const remainingQuestions = laterQuestions + visible.filter((q) => !isComplete(draft[q.id])).length;
  const etaText = remainingQuestions <= 0 ? 'まもなく完了' : `残り約${remainingQuestions}問・あと約1分`;

  const advance = () => {
    setAttempted(false);
    nextRoughPage(); // スクロールは roughPage 変更を検知する useEffect が担当
  };

  const handleNext = () => {
    if (pageComplete) {
      advance();
    } else {
      setAttempted(true);
      const firstIncomplete = visible.find((q) => !isComplete(draft[q.id]));
      if (firstIncomplete) {
        document.getElementById(`q-${firstIncomplete.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  return (
    <section className="screen step-layout">
      {cameFromResult ? (
        <header className="edit-header">編集中：{page.title}</header>
      ) : (
        <ProgressHeader label="ざっくり診断" current={roughPage + 1} total={ROUGH_PAGES.length} etaText={etaText} />
      )}

      <div className="step-head">
        <h2 className="section-heading">{page.title}</h2>
        <p className="step-purpose muted">{page.purpose}</p>
      </div>

      {visible.map((q) => (
        <div id={`q-${q.id}`} key={q.id}>
          <RoughQuestionView q={q} cell={draft[q.id]} showHint={attempted && !isComplete(draft[q.id])} />
        </div>
      ))}

      {/* 下部余白（固定ナビと本文が重ならないように） */}
      <div className="bottom-nav-spacer" />

      <nav className="bottom-nav" aria-label="ステップ操作">
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

        {!cameFromResult && attempted && !pageComplete && (
          <div className="bottom-nav__hint">
            <span className="muted">{ja.nav.incompleteHint}</span>
            <button className="link-btn" onClick={advance}>
              {ja.nav.proceedAnyway}
            </button>
          </div>
        )}
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
        <div className="field-number">
          <input
            className="input"
            type="number"
            inputMode="numeric"
            placeholder={q.placeholder}
            min={q.min}
            max={q.max}
            // おすすめ値も表示し、自由に編集・削除できる（空欄で未入力に戻る）。
            value={
              (cell.source === 'user_input' || cell.source === 'recommended_value') && cell.value !== null
                ? String(cell.value)
                : ''
            }
            onChange={(e) => setRoughValue(q.id, e.target.value === '' ? '' : Number(e.target.value))}
          />
          {q.unit && <span className="field-number__unit">{q.unit}</span>}
        </div>
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
              {cell.source === 'skipped' ? '✓ スキップ済み' : ja.common.skip}
            </button>
          )}
        </div>
      )}

      {cell.source === 'skipped' && <p className="field-status muted">{ja.field.skipped}</p>}
      {cell.source === 'recommended_value' && <p className="field-status muted">{ja.field.recommended}</p>}

      {showHint && (
        <p className="field-hint">{q.kind === 'number' ? ja.field.hintNumber : ja.field.hintChoice}</p>
      )}

      {q.id === 'childrenCount' && <p className="field-status muted">{ja.field.childrenAgeNote}</p>}
    </QuestionCard>
  );
}
