import { useInputStore, monthlyDisplayValue } from '../../../store/inputStore';
import { ja } from '../../../strings/ja';
import { QuestionCard } from '../QuestionCard';
import { HelpTooltip } from '../HelpTooltip';
import { NumberField } from '../NumberField';
import type { ThoroughQuestion } from '../../../schema/thoroughSteps';
import type { Field } from '../../../schema/types';

// しっかり診断の1項目。SimulationInput の Field を path 経由で編集する。
// 表示は number / choice / toggle。Recommended / Skip / Help を配置し source を保持する。
// 単純な数値入力をまとめられるよう、見た目（カード or 行）と中身（コントロール）を分離する。

/** タイトルなしのコントロール群（入力欄・補足・おすすめ/未入力・状態）。 */
export function ThoroughControls({ q, field }: { q: ThoroughQuestion; field: Field<unknown> }) {
  const setThoroughValue = useInputStore((s) => s.setThoroughValue);
  const useThoroughRecommended = useInputStore((s) => s.useThoroughRecommended);
  const skipThorough = useInputStore((s) => s.skipThorough);

  const source = field.source;
  const filled = source === 'user_input' || source === 'recommended_value';
  // 月額入力に統一しているパス（postFireLiving / retirementLiving）は、
  // フィールド内部値（年額）を ÷12 して NumberField に渡す。書き込みは store 側で ×12。
  const isMonthly = q.path === 'fire.postFireLiving' || q.path === 'retirement.retirementLiving';
  const displayValue =
    filled && field.value != null
      ? isMonthly
        ? monthlyDisplayValue(Number(field.value))
        : Number(field.value)
      : null;

  return (
    <>
      {q.kind === 'number' && (
        <>
          <NumberField
            placeholder={q.placeholder}
            unit={q.unit}
            value={displayValue}
            onChange={(v) => setThoroughValue(q.path, v == null ? '' : v)}
          />
          {q.inputNote && <p className="field-note muted">{q.inputNote}</p>}
        </>
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
              {source === 'skipped' ? `✓ ${ja.common.skip}` : ja.common.skip}
            </button>
          )}
        </div>
      )}

      {source === 'skipped' && <p className="field-status muted">{ja.field.skipped}</p>}
    </>
  );
}

/** 単独カード表示（選択・判断が必要な項目や、単独の数値項目に使う）。 */
export function ThoroughQuestionView({ q, field }: { q: ThoroughQuestion; field?: Field<unknown> }) {
  if (!field) return null;
  return (
    <QuestionCard title={q.label} help={q.help}>
      <ThoroughControls q={q} field={field} />
    </QuestionCard>
  );
}

/** まとめカード内の1行表示（単純な数値入力を縦に詰めてスクロールを減らす）。 */
export function ThoroughFieldRow({ q, field }: { q: ThoroughQuestion; field?: Field<unknown> }) {
  if (!field) return null;
  return (
    <div className="field-row">
      <div className="field-row__title">
        {q.label}
        {q.help && <HelpTooltip text={q.help} />}
      </div>
      <ThoroughControls q={q} field={field} />
    </div>
  );
}
