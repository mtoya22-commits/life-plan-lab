import { describe, expect, it } from 'vitest';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import { buildRiskFactors } from '../../src/features/results/riskFactors';
import { field } from '../../src/schema/field';
import type { ChildInput, SimulationInput } from '../../src/schema/types';

function child(age: number): ChildInput {
  return {
    currentAge: field(age, 'user_input', '子の年齢', '', '歳'),
    ageAssumed: false,
    middleSchool: field('public', 'user_input', '中学', ''),
    highSchool: field('public', 'user_input', '高校', ''),
    university: field('private_humanities', 'user_input', '大学', ''),
    uniLiving: field('away', 'user_input', '住まい', ''),
  };
}

// STEP5.6/5.7 の検証ケース（月20万投資だが家計の黒字が小さい）。
function caseInput(): SimulationInput {
  const i = createDefaultInput('thorough');
  i.basic.age = field(38, 'user_input', '', '', '歳');
  i.basic.householdIncome = field(1200, 'user_input', '', '', '万円');
  i.basic.takeHomeIncome = field(650, 'user_input', '', '', '万円');
  i.basic.currentAssets = field(3200, 'user_input', '', '', '万円');
  i.basic.cashRatio = field(20, 'user_input', '', '', '%');
  i.income.raiseRate = field(0.5, 'user_input', '', '', '%');
  i.income.retirementAge = field(65, 'user_input', '', '', '歳');
  i.expense.monthlyLiving = field(25, 'user_input', '', '', '万円');
  i.expense.insuranceCost = field(10, 'user_input', '', '', '万円');
  i.expense.annualSpecial = field(50, 'user_input', '', '', '万円');
  i.expense.travelCost = field(30, 'user_input', '', '', '万円');
  i.expense.carCost = field(40, 'user_input', '', '', '万円');
  i.children = [child(4), child(2)];
  i.housing.type = field('own', 'user_input', '', '');
  i.housing.monthlyPayment = field(11, 'user_input', '', '', '万円');
  i.housing.remainingYears = field(30, 'user_input', '', '', '年');
  i.fire.type = field('side', 'user_input', '', '');
  i.fire.targetAge = field(55, 'user_input', '', '', '歳');
  i.fire.postFireLiving = field(270, 'user_input', '', '', '万円');
  i.fire.postFireIncome = field(400, 'user_input', '', '', '万円');
  i.fire.workUntilAge = field(65, 'user_input', '', '', '歳');
  i.investment.monthlyInvestment = field(20, 'user_input', '', '', '万円');
  i.investment.returnRate = field(5, 'user_input', '', '', '%');
  i.investment.inflationRate = field(2, 'user_input', '', '', '%');
  i.retirement.pension = field(240, 'user_input', '', '', '万円');
  i.retirement.retirementLiving = field(255, 'user_input', '', '', '万円');
  return i;
}
const run = (i: SimulationInput) => runSimulation(applyRecommendedValues(i));

describe('STEP5.7 surfaces the actually-reflected investment amount', () => {
  it('exposes planned / first-year actual / average reflected amounts', () => {
    const ind = run(caseInput()).indicators;
    expect(ind.monthlyInvestmentPlannedAnnual).toBe(240);
    // 初年度の実際の積立額 = その年の家計黒字（満額240より小さい）。
    expect(ind.monthlyInvestmentActualFirstYear).toBeGreaterThan(0);
    expect(ind.monthlyInvestmentActualFirstYear).toBeLessThan(240);
    // 平均は満額より小さく、初年度以降は赤字で0の年もあるためさらに低い。
    expect(ind.monthlyInvestmentActualAverage).toBeLessThanOrEqual(ind.monthlyInvestmentActualFirstYear);
    expect(ind.monthlyInvestmentActualAverage).toBeGreaterThanOrEqual(0);
  });

  it('first-year actual equals the first working-year actual transfer', () => {
    const r = run(caseInput());
    const at38 = r.rows.find((x) => x.age === 38)!.debug!;
    expect(r.indicators.monthlyInvestmentActualFirstYear).toBeCloseTo(at38.actualInvestmentAmount, 6);
  });

  it('risk factor explains input vs actually-reflected amount', () => {
    const factors = buildRiskFactors(run(caseInput()), applyRecommendedValues(caseInput()));
    const inv = factors.find((f) => f.includes('毎月投資額') && f.includes('満額'));
    expect(inv).toBeDefined();
    expect(inv!).toContain('入力上');
    expect(inv!).toContain('実際に反映された積立額');
    expect(inv!).toContain('初年度');
    expect(inv!).toContain('年240万円'); // 入力満額（年額）
  });
});
