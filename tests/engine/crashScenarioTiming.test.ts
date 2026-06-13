import { describe, expect, it } from 'vitest';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { getCrashAge, runSimulation } from '../../src/engine/annualSimulationEngine';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { field } from '../../src/schema/field';

// STEP11.23: 暴落シナリオを取崩開始（FIRE開始 or 退職）の翌年に置く。
// シーケンスリスクが最大になる時期を「最悪に近いタイミング」として代表させる保守想定。

function makeInput(opts: { startAge: number; fireType: 'full' | 'side' | 'none'; targetAge?: number; retirementAge?: number }) {
  const i = createDefaultInput('thorough');
  i.basic.age = field(opts.startAge, 'user_input', '年齢', '', '歳');
  i.fire.type = field(opts.fireType, 'user_input', 'FIRE種別', '');
  if (opts.targetAge !== undefined) i.fire.targetAge = field(opts.targetAge, 'user_input', 'FIRE希望年齢', '', '歳');
  if (opts.retirementAge !== undefined) i.income.retirementAge = field(opts.retirementAge, 'user_input', '退職予定年齢', '', '歳');
  return i;
}

describe('crash scenario timing = drawdown start + 1 (sequence risk)', () => {
  it('side FIRE: targetAge=55 → crashAge=56', () => {
    const i = makeInput({ startAge: 40, fireType: 'side', targetAge: 55 });
    expect(getCrashAge(i)).toBe(56);
  });

  it('full FIRE: targetAge=60 → crashAge=61', () => {
    const i = makeInput({ startAge: 40, fireType: 'full', targetAge: 60 });
    expect(getCrashAge(i)).toBe(61);
  });

  it('none (現役継続): retirementAge=65 → crashAge=66', () => {
    const i = makeInput({ startAge: 40, fireType: 'none', retirementAge: 65 });
    expect(getCrashAge(i)).toBe(66);
  });

  it('既に取崩開始済み (startAge=70, targetAge=55) → crashAge=71 (startAge+1 防御)', () => {
    const i = makeInput({ startAge: 70, fireType: 'full', targetAge: 55 });
    expect(getCrashAge(i)).toBe(71);
  });

  it('engine 統合: 暴落 on でタイムラインに market_crash が targetAge+1 で出る', () => {
    const i = makeInput({ startAge: 40, fireType: 'side', targetAge: 55 });
    i.basic.currentAssets = field(3000, 'user_input', '資産', '', '万円');
    i.basic.householdIncome = field(700, 'user_input', '年収', '', '万円');
    i.expense.monthlyLiving = field(20, 'user_input', '生活費', '', '万円');
    i.investment.crashScenario = field(true, 'user_input', '暴落シナリオ', '');
    const result = runSimulation(applyRecommendedValues(i));
    const crashMarker = result.rows.flatMap((r) => r.events).find((e) => e.kind === 'market_crash');
    expect(crashMarker).toBeDefined();
    expect(crashMarker!.age).toBe(56);
  });

  it('notes に「FIRE開始または退職の翌年」「シーケンスリスク」「コロナショック」が含まれる', () => {
    const i = makeInput({ startAge: 40, fireType: 'side', targetAge: 55 });
    i.basic.currentAssets = field(3000, 'user_input', '資産', '', '万円');
    i.basic.householdIncome = field(700, 'user_input', '年収', '', '万円');
    i.expense.monthlyLiving = field(20, 'user_input', '生活費', '', '万円');
    i.investment.crashScenario = field(true, 'user_input', '暴落シナリオ', '');
    const result = runSimulation(applyRecommendedValues(i));
    const joined = result.notes.join('|');
    expect(joined).toContain('FIRE開始または退職の翌年');
    expect(joined).toContain('シーケンスリスク');
    expect(joined).toContain('コロナショック');
  });
});
