import { useInputStore } from '../../../store/inputStore';
import { ja } from '../../../strings/ja';
import { QuestionCard } from '../QuestionCard';
import type { ThoroughQuestion } from '../../../schema/thoroughSteps';
import type { Field } from '../../../schema/types';

// しっかり診断の1項目。SimulationInput の Field を path 経由で編集する。
// 表示は number / choice / toggle。Recommended / Skip / Help を配置し source を保持する。
export function ThoroughQuestionView({ q, field }: { q: ThoroughQuestion; field?: Field<unknown> }) {
  const setThoroughValue = useInputStore((s) => s.setThoroughValue);
  const useThoroughRecommended = useInputStore((s) => s.useThoroughRecommended);
  const skipThorough = useInputStore((s) => s.skipThorough);

  if (!field) return null;
  const source = field.source;
  const filled = source === 'user_input' || source === 'recommended_value';
  const showVal = filled && field.value != null ? String(field.value) : '';

  return (
    <QuestionCard title={q.label} help={q.help}>
      {q.kind === 'number' && (
        <div className="field-number">
          <input
            className="input"
            type="number"
            inputMode="numeric"
            placeholder={q.placeholder}
            min={q.min}
            max={q.max}
            value={showVal}
            onChange={(e) => setThoroughValue(q.path, e.target.value === '' ? '' : Number(e.target.value))}
          />
          {q.unit && <span className="field-number__unit">{q.unit}</span>}
        </div>
      )}

      {q.kind === 'choice' && (
        <div className="choice-group">
          {q.options?.map((opt) => {
            const selected = filled && String(field.value) === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                className={`choice${selected ? ' choice--selected' : ''}`}
                aria-pressed={selected}
                onClick={() => setThoroughValue(q.path, opt.value)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {q.kind === 'toggle' && (
        <div className="choice-group">
          <button
            type="button"
            className={`choice${field.value === true ? ' choice--selected' : ''}`}
            aria-pressed={field.value === true}
            onClick={() => setThoroughValue(q.path, true)}
          >
            あり
          </button>
          <button
            type="button"
            className={`choice${field.value === false ? ' choice--selected' : ''}`}
            aria-pressed={field.value === false}
            onClick={() => setThoroughValue(q.path, false)}
          >
            なし
          </button>
        </div>
      )}

      {(q.allowRecommended || q.allowSkip) && (
        <div className="field-actions">
          {q.allowRecommended && q.recommendedValue !== undefined && (
            <button
              type="button"
              className={`btn btn--recommended${source === 'recommended_value' ? ' is-active' : ''}`}
              onClick={() => useThoroughRecommended(q.path, q.recommendedValue!)}
            >
              {source === 'recommended_value' ? '✓ ' : ''}
              {q.recommendedLabel ?? ja.common.useRecommended}
            </button>
          )}
          {q.allowSkip && (
            <button
              type="button"
              className={`btn btn--skip${source === 'skipped' ? ' is-active' : ''}`}
              onClick={() => skipThorough(q.path)}
            >
              {source === 'skipped' ? '✓ スキップ済み' : ja.common.skip}
            </button>
          )}
        </div>
      )}

      {source === 'skipped' && <p className="field-status muted">{ja.field.skipped}</p>}
      {source === 'recommended_value' && <p className="field-status muted">{ja.field.recommended}</p>}
    </QuestionCard>
  );
}
