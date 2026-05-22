import { useInputStore } from '../../../store/inputStore';
import { ja } from '../../../strings/ja';
import { ROUGH_PAGES, type RoughQuestion } from '../../../schema/roughQuestions';
import type { RoughCell } from '../../../schema/types';
import { ProgressHeader } from '../ProgressHeader';
import { QuestionCard } from '../QuestionCard';
import { HelpTooltip } from '../HelpTooltip';

// =============================================================================
// ざっくり診断のステップフロー本体。
// 1ページ1〜3項目 / 次へ・戻る / 進捗 / Recommended・Skip・Help / source管理。
// 最後のページで submitRough() → buildFullInput → 結果ダッシュボードへ。
// =============================================================================

function isComplete(cell: RoughCell): boolean {
  if (cell.source === 'recommended_value' || cell.source === 'skipped') return true;
  if (cell.source === 'user_input') return cell.value !== null && cell.value !== '';
  return false;
}

export function RoughFlow() {
  const roughPage = useInputStore((s) => s.roughPage);
  const draft = useInputStore((s) => s.roughDraft);
  const nextRoughPage = useInputStore((s) => s.nextRoughPage);
  const prevRoughPage = useInputStore((s) => s.prevRoughPage);

  const page = ROUGH_PAGES[roughPage];
  const childrenCount = countFromDraft(draft.childrenCount);
  const visible = page.questions.filter((q) => (q.showIf ? q.showIf(childrenCount) : true));
  const pageComplete = visible.every((q) => isComplete(draft[q.id]));
  const isLast = roughPage === ROUGH_PAGES.length - 1;

  return (
    <section className="screen step-layout">
      <ProgressHeader current={roughPage + 1} total={ROUGH_PAGES.length} />
      <h2 className="section-heading">{page.title}</h2>

      {visible.map((q) => (
        <RoughQuestionView key={q.id} q={q} cell={draft[q.id]} />
      ))}

      <div className="step-actions">
        <button className="btn" onClick={prevRoughPage}>
          {roughPage === 0 ? 'モード選択へ' : ja.common.back}
        </button>
        <div className="step-actions__right">
          {!pageComplete && <span className="muted step-hint">未回答の項目があります</span>}
          <button className="btn btn--primary" onClick={nextRoughPage} disabled={!pageComplete}>
            {isLast ? ja.common.seeResult : ja.common.next}
          </button>
        </div>
      </div>
    </section>
  );
}

function RoughQuestionView({ q, cell }: { q: RoughQuestion; cell: RoughCell }) {
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
            value={cell.source === 'user_input' && cell.value !== null ? String(cell.value) : ''}
            onChange={(e) => setRoughValue(q.id, e.target.value === '' ? '' : Number(e.target.value))}
          />
          {q.unit && <span className="field-number__unit">{q.unit}</span>}
        </div>
      ) : (
        <div className="choice-group">
          {q.options?.map((opt) => {
            const selected = cell.source === 'user_input' && String(cell.value) === opt.value;
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

      {cell.source === 'skipped' && <p className="field-status muted">未入力のまま、標準値で試算します。</p>}
      {cell.source === 'recommended_value' && <p className="field-status muted">おすすめ値を使用します。</p>}

      {q.id === 'childrenCount' && <ChildrenHelpText />}
    </QuestionCard>
  );
}

function ChildrenHelpText() {
  return <p className="field-status muted">お子さまの年齢は、ざっくり診断では仮の値で試算します（結果画面に明示します）。</p>;
}

function countFromDraft(cell: RoughCell): number {
  if (cell.source !== 'user_input' || cell.value === null) return 0;
  const n = typeof cell.value === 'string' ? parseInt(cell.value, 10) : cell.value;
  return Number.isFinite(n) ? n : 0;
}
