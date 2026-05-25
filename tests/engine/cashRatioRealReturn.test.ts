import { describe, expect, it } from 'vitest';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import { draftFromAnswers } from '../../src/schema/roughMapping';
import { buildFullInputFromRough } from '../../src/schema/normalize';
import { field } from '../../src/schema/field';
import type { RoughFieldId, SimulationInput } from '../../src/schema/types';

const run = (i: SimulationInput) => runSimulation(applyRecommendedValues(i));

// 枯渇しない裕福なケース（現金比率の効果が長期残資産に出る）
function wealthy(cashRatio: number): SimulationInput {
  const i = createDefaultInput('thorough');
  i.basic.age = field(40, 'user_input', '年齢', '', '歳');
  i.basic.currentAssets = field(10000, 'user_input', '資産', '', '万円');
  i.basic.householdIncome = field(1200, 'user_input', '年収', '', '万円');
  i.income.raiseRate = field(0, 'user_input', '昇給率', '', '%');
  i.investment.returnRate = field(5, 'user_input', '利回り', '', '%');
  i.investment.inflationRate = field(2, 'user_input', 'インフレ', '', '%');
  i.basic.cashRatio = field(cashRatio, 'user_input', '現金比率', '', '%');
  i.retirement.pension = field(240, 'user_input', '年金', '', '万円');
  i.fire.type = field('full', 'user_input', 'FIRE', '');
  i.fire.targetAge = field(60, 'user_input', '希望年齢', '', '歳');
  return i;
}

const HIGH_INCOME: Partial<Record<RoughFieldId, string | number>> = {
  age: 38,
  householdIncome: 1200,
  currentAssets: 3200,
  monthlyLiving: 35,
  monthlyHousing: 11,
  loanYears: 30,
  childrenCount: 2,
  educationPolicy: 'some_private',
  childAge1: 4,
  childAge2: 2,
  housing: 'own',
  workStyle: 'work_a_little',
  reduceWorkAge: 55,
  postFireLiving: 30,
  sideFireIncome: 20,
  investmentStyle: 'balanced',
};

describe('cash ratio & real return', () => {
  it('lower cash ratio gives higher long-term present-value assets', () => {
    const low = run(wealthy(20)).indicators.assetsAt95PresentValue;
    const high = run(wealthy(60)).indicators.assetsAt95PresentValue;
    expect(low).toBeGreaterThan(high);
  });

  it('shows a real-return guideline (5% nominal, 2% inflation ~ 2.9%)', () => {
    const notes = run(wealthy(20)).notes;
    expect(notes.some((n) => n.includes('実質利回り目安は約2.9%'))).toBe(true);
  });

  it('pension unentered: warns it is not reflected', () => {
    const r = runSimulation(buildFullInputFromRough(draftFromAnswers(HIGH_INCOME)));
    expect(r.notes.some((n) => n.includes('年金が未入力'))).toBe(true);
  });

  it('adding pension improves asset longevity in the high-income case', () => {
    const noPension = runSimulation(buildFullInputFromRough(draftFromAnswers(HIGH_INCOME)));
    const withPensionInput = buildFullInputFromRough(draftFromAnswers(HIGH_INCOME));
    withPensionInput.retirement.pension = field(330, 'user_input', '年金', '', '万円');
    const withPension = runSimulation(withPensionInput);

    expect(noPension.indicators.assetLongevityAge).not.toBeNull();
    const noAge = noPension.indicators.assetLongevityAge!;
    // 年金ありは枯渇しない(null)か、枯渇年齢が遅くなる
    const improved = withPension.indicators.assetLongevityAge === null || withPension.indicators.assetLongevityAge > noAge;
    expect(improved).toBe(true);
    // 累計不足額も減る
    expect(withPension.indicators.cumulativeShortfall).toBeLessThan(noPension.indicators.cumulativeShortfall);
  });
});
