import { useInputStore } from '../../../store/inputStore';
import { field } from '../../../schema/field';
import { NumberField } from '../NumberField';
import type { LifeEvent, SimulationInput } from '../../../schema/types';

// ライフイベントの専用ステップ（簡易版）。
// 「含める」を押しただけでは年齢・金額は空欄のまま（=計算に反映されない）。
// 各テンプレートに「例（◯歳・◯万円）を入れる」ボタンを置き、ユーザーが選ぶ。
// 相続は収入（マイナス）として扱う。
interface Template {
  id: string;
  label: string;
  sign: 1 | -1;
  note?: string;
  exampleAge?: number;
  exampleAmount?: number; // 絶対値（sign で内部符号化）
}

const TEMPLATES: Template[] = [
  {
    id: 'car',
    label: '車の購入',
    sign: 1,
    exampleAge: 45,
    exampleAmount: 500,
    note: '車の維持費は毎年の支出、車購入は一時支出として扱います。',
  },
  {
    id: 'reform',
    label: 'リフォーム',
    sign: 1,
    exampleAge: 50,
    exampleAmount: 200,
    note: '指定した年齢に一時支出として反映します。',
  },
  {
    id: 'parent',
    label: '親の支援',
    sign: 1,
    exampleAge: 60,
    exampleAmount: 300,
    note: '指定した年齢に一時支出として反映します。',
  },
  {
    id: 'inherit',
    label: '相続見込み',
    sign: -1,
    exampleAge: 70,
    exampleAmount: 1000,
    note: '相続は指定年齢の一時収入として扱います。',
  },
  { id: 'other', label: 'その他の一時支出', sign: 1 },
];

const ageSkipped = (t: Template) => field(0, 'skipped' as const, `${t.label}の年齢`, '', '歳');
const ageInput = (t: Template, v: number) => field(v, 'user_input' as const, `${t.label}の年齢`, '', '歳');
const amountSkipped = (t: Template) =>
  field(0, 'skipped' as const, `${t.label}の金額`, '', '万円');
const amountInput = (t: Template, v: number) =>
  field(t.sign * Math.abs(v), 'user_input' as const, `${t.label}の金額`, '', '万円');

function blankEvent(t: Template): LifeEvent {
  return {
    id: t.id,
    label: field(t.label, 'user_input', t.label, ''),
    atAge: ageSkipped(t),
    amount: amountSkipped(t),
  };
}
function withExample(t: Template): LifeEvent {
  if (t.exampleAge == null || t.exampleAmount == null) return blankEvent(t);
  return {
    id: t.id,
    label: field(t.label, 'user_input', t.label, ''),
    atAge: ageInput(t, t.exampleAge),
    amount: amountInput(t, t.exampleAmount),
  };
}

export function EventsStep({ input }: { input: SimulationInput }) {
  const upsert = useInputStore((s) => s.upsertLifeEvent);
  const remove = useInputStore((s) => s.removeLifeEvent);
  const byId = new Map(input.lifeEvents.map((e) => [e.id, e]));

  return (
    <>
      {TEMPLATES.map((t) => {
        const ev = byId.get(t.id);
        const enabled = !!ev;
        // 表示は「ユーザーが明示的に入力した値」だけ。skipped は空欄。
        const ageVal = ev && ev.atAge.source === 'user_input' ? ev.atAge.value : null;
        const amtVal = ev && ev.amount.source === 'user_input' ? Math.abs(ev.amount.value) : null;
        const hasExample = t.exampleAge != null && t.exampleAmount != null;
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
                onClick={() => (enabled ? remove(t.id) : upsert(blankEvent(t)))}
              >
                {enabled ? '✓ 含める' : '含める'}
              </button>
              {enabled && hasExample && (
                <button type="button" className="btn btn--recommended" onClick={() => upsert(withExample(t))}>
                  例（{t.exampleAge}歳・{t.exampleAmount}万円）を入れる
                </button>
              )}
            </div>
            {t.note && <p className="field-note muted">{t.note}</p>}
            {enabled && (
              <div className="event-fields">
                <label className="event-field">
                  <span className="muted">年齢</span>
                  <NumberField
                    unit="歳"
                    placeholder={hasExample ? `例：${t.exampleAge}` : undefined}
                    value={ageVal}
                    onChange={(v) =>
                      upsert({ ...ev!, atAge: v == null ? ageSkipped(t) : ageInput(t, v) })
                    }
                  />
                </label>
                <label className="event-field">
                  <span className="muted">金額</span>
                  <NumberField
                    unit="万円"
                    placeholder={hasExample ? `例：${t.exampleAmount}` : undefined}
                    value={amtVal}
                    onChange={(v) =>
                      upsert({ ...ev!, amount: v == null ? amountSkipped(t) : amountInput(t, v) })
                    }
                  />
                </label>
              </div>
            )}
          </div>
        );
      })}
      <p className="field-status muted">
        「含める」を選んでも、年齢と金額の両方が入力されていなければ計算には反映されません。あとから変更できます。
      </p>
    </>
  );
}
