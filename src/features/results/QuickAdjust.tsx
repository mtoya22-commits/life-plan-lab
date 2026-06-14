import { useInputStore } from '../../store/inputStore';
import { ja } from '../../strings/ja';

// What-if クイック調整。結果画面で主要 3 条件を ± で動かし、その場で再計算する。
// 「編集 → 再計算 → 結果」の往復なしに試行錯誤できるようにするのが目的。
// 値の書き込みはドラフト（roughDraft / thoroughInput）まで届くので、
// あとから「条件を変えてみる」を開いても値が一致する（nudgeCondition 参照）。
//
// ノブの出し分け:
// - 年齢: rough + 現役継続 では非表示（rough ドラフトに退職年齢セルがないため）
// - 利回り: thorough のみ（rough は投資スタイル選択から導出されるため）

interface KnobDef {
  knob: 'age' | 'living' | 'return';
  label: string;
  value: number;
  unit: string;
  step: number;
  min: number;
  max: number;
}

export function QuickAdjust() {
  const mode = useInputStore((s) => s.mode);
  const input = useInputStore((s) => s.input);
  const nudgeCondition = useInputStore((s) => s.nudgeCondition);

  if (!input) return null;

  const isThorough = mode === 'thorough';
  const isNone = input.fire.type.value === 'none';

  const knobs: KnobDef[] = [];

  if (!(mode === 'rough' && isNone)) {
    knobs.push({
      knob: 'age',
      label: isThorough ? (isNone ? '退職予定年齢' : 'FIRE希望年齢') : '働き方を変える年齢',
      value: isNone ? input.income.retirementAge.value : input.fire.targetAge.value,
      unit: '歳',
      step: 1,
      min: 35,
      max: 80,
    });
  }

  knobs.push({
    knob: 'living',
    // 現役期の月額生活費を動かす。FIRE後・老後の生活費は「条件を変えてみる」で詳細編集。
    label: '毎月の生活費（現役）',
    value: input.expense.monthlyLiving.value,
    unit: '万円/月',
    step: 1,
    min: 0,
    max: Number.POSITIVE_INFINITY,
  });

  if (isThorough) {
    knobs.push({
      knob: 'return',
      label: '想定利回り',
      value: input.investment.returnRate.value,
      unit: '%',
      step: 0.5,
      min: 0,
      max: 10,
    });
  }

  return (
    <section id="quick-adjust" className="quick-adjust" aria-label={ja.result.quickAdjustHeading}>
      <h2 className="section-heading">{ja.result.quickAdjustHeading}</h2>
      {knobs.map((k) => (
        <div className="quick-adjust__row" key={k.knob}>
          <span className="quick-adjust__label">{k.label}</span>
          <span className="quick-adjust__value">
            {k.value.toLocaleString('ja-JP')}
            <span className="quick-adjust__unit">{k.unit}</span>
          </span>
          <span className="quick-adjust__steppers">
            <button
              type="button"
              className="stepper-btn"
              aria-label={`${k.label}を${k.step}${k.unit}減らす`}
              disabled={k.value - k.step < k.min}
              onClick={() => nudgeCondition(k.knob, -k.step)}
            >
              −
            </button>
            <button
              type="button"
              className="stepper-btn"
              aria-label={`${k.label}を${k.step}${k.unit}増やす`}
              disabled={k.value + k.step > k.max}
              onClick={() => nudgeCondition(k.knob, k.step)}
            >
              ＋
            </button>
          </span>
        </div>
      ))}
      <p className="quick-adjust__note muted">{ja.result.quickAdjustNote}</p>
    </section>
  );
}
