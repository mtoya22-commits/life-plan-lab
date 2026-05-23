import { useInputStore } from '../../../store/inputStore';
import { field } from '../../../schema/field';
import { NumberField } from '../NumberField';
import type { LifeEvent, SimulationInput } from '../../../schema/types';

// ライフイベントの専用ステップ（簡易版）。各テンプレートを「含める」と年齢・金額を入力。
// 相続は収入（マイナス）として扱う。複雑な繰り返しイベントは後回し。
interface Template {
  id: string;
  label: string;
  sign: 1 | -1;
}

const TEMPLATES: Template[] = [
  { id: 'car', label: '車の購入', sign: 1 },
  { id: 'reform', label: 'リフォーム', sign: 1 },
  { id: 'parent', label: '親の支援', sign: 1 },
  { id: 'inherit', label: '相続見込み', sign: -1 },
  { id: 'other', label: 'その他の一時支出', sign: 1 },
];

function makeEvent(t: Template, atAge: number, amountAbs: number): LifeEvent {
  return {
    id: t.id,
    label: field(t.label, 'user_input', t.label, `${t.label}を反映しています。`),
    atAge: field(atAge, 'user_input', `${t.label}の年齢`, '', '歳'),
    amount: field(t.sign * amountAbs, 'user_input', `${t.label}の金額`, '', '万円'),
  };
}

export function EventsStep({ input }: { input: SimulationInput }) {
  const upsert = useInputStore((s) => s.upsertLifeEvent);
  const remove = useInputStore((s) => s.removeLifeEvent);
  const baseAge = input.basic.age.value;
  const byId = new Map(input.lifeEvents.map((e) => [e.id, e]));

  return (
    <>
      {TEMPLATES.map((t) => {
        const ev = byId.get(t.id);
        const enabled = !!ev;
        const atAge = ev ? ev.atAge.value : baseAge + 10;
        const amountAbs = ev ? Math.abs(ev.amount.value) : 0;
        return (
          <div className="question-card" key={t.id}>
            <div className="question-card__title">
              {t.label}
              {t.sign < 0 && <span className="muted">（収入）</span>}
            </div>
            <div className="field-actions">
              <button
                type="button"
                className={`btn${enabled ? ' is-active' : ''}`}
                aria-pressed={enabled}
                onClick={() => (enabled ? remove(t.id) : upsert(makeEvent(t, atAge, amountAbs)))}
              >
                {enabled ? '✓ 含める' : '含める'}
              </button>
            </div>
            {enabled && (
              <div className="event-fields">
                <label className="event-field">
                  <span className="muted">年齢</span>
                  <NumberField
                    unit="歳"
                    value={atAge}
                    onChange={(v) => upsert(makeEvent(t, v ?? baseAge, amountAbs))}
                  />
                </label>
                <label className="event-field">
                  <span className="muted">金額</span>
                  <NumberField unit="万円" value={amountAbs} onChange={(v) => upsert(makeEvent(t, atAge, v ?? 0))} />
                </label>
              </div>
            )}
          </div>
        );
      })}
      <p className="field-status muted">指定した年齢に、その金額を反映します（相続は収入として扱います）。</p>
    </>
  );
}
