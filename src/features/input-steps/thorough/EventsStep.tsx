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
  note?: string;
}

const TEMPLATES: Template[] = [
  { id: 'car', label: '車の購入', sign: 1, note: '車の維持費は毎年の支出、車購入は一時支出として扱います。' },
  { id: 'reform', label: 'リフォーム', sign: 1, note: '指定した年齢に一時支出として反映します。' },
  { id: 'parent', label: '親の支援', sign: 1, note: '指定した年齢に一時支出として反映します。' },
  { id: 'inherit', label: '相続見込み', sign: -1, note: '相続は指定年齢の一時収入として扱います。' },
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
              <span className={`event-tag${t.sign < 0 ? ' event-tag--income' : ''}`}>
                {t.sign < 0 ? '一時収入' : '一時支出'}
              </span>
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
            {t.note && <p className="field-note muted">{t.note}</p>}
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
      <p className="field-status muted">「含める」を選ぶと、指定した年齢にその金額を反映します。あとから変更できます。</p>
    </>
  );
}
