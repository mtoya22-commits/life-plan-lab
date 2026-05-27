import { describe, expect, it } from 'vitest';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import { buildRiskFactors } from '../../src/features/results/riskFactors';
import { buildLifeEvents } from '../../src/features/results/lifeEvents';
import { mortgageEvents } from '../../src/engine/mortgageEngine';
import { field } from '../../src/schema/field';
import type { ChildInput, LifeEvent, SimulationInput } from '../../src/schema/types';

function child(age: number): ChildInput {
  return {
    currentAge: field(age, 'user_input', '子の年齢', '', '歳'),
    ageAssumed: false,
    elementarySchool: field('public', 'user_input', '小学校', ''),
    middleSchool: field('public', 'user_input', '中学', ''),
    highSchool: field('public', 'user_input', '高校', ''),
    university: field('private_humanities', 'user_input', '大学', ''),
    uniLiving: field('away', 'user_input', '住まい', ''),
  };
}
function ev(id: string, label: string, age: number, amount: number): LifeEvent {
  return {
    id,
    label: field(label, 'user_input', label, ''),
    atAge: field(age, 'user_input', '年齢', '', '歳'),
    amount: field(amount, 'user_input', '金額', '', '万円'),
  };
}

// STEP5.6 の検証ケース（実機報告条件：月20万投資だが家計の黒字が小さい）。
function caseInput(): SimulationInput {
  const i = createDefaultInput('thorough');
  i.basic.age = field(38, 'user_input', '', '', '歳');
  i.basic.householdIncome = field(1200, 'user_input', '', '', '万円');
  i.basic.takeHomeIncome = field(650, 'user_input', '', '', '万円');
  i.basic.currentAssets = field(3200, 'user_input', '', '', '万円');
  i.basic.cashRatio = field(20, 'user_input', '', '', '%');
  i.income.raiseRate = field(0.5, 'user_input', '', '', '%');
  i.income.retirementAge = field(65, 'user_input', '', '', '歳');
  i.income.retirementLumpSum = field(500, 'user_input', '', '', '万円');
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
  i.lifeEvents = [ev('car', '車購入', 45, 500), ev('reform', 'リフォーム', 50, 200)];
  return i;
}
const run = (i: SimulationInput) => runSimulation(applyRecommendedValues(i));

describe('STEP5.6 monthly investment is capped at the household surplus', () => {
  it('records planned vs actual vs skipped each working year', () => {
    const r = run(caseInput());
    const at38 = r.rows.find((x) => x.age === 38)!.debug!;
    // 計画は満額（月20万×12=240）。実際はその年の黒字までしか積み立てられない。
    expect(at38.plannedInvestmentAmount).toBe(240);
    expect(at38.actualInvestmentAmount).toBeCloseTo(at38.annualNetCashflow, 6);
    expect(at38.actualInvestmentAmount).toBeLessThan(240);
    expect(at38.skippedInvestmentAmount).toBeCloseTo(240 - at38.actualInvestmentAmount, 6);
  });

  it('invests nothing in a deficit year (planned still 240, actual 0)', () => {
    const r = run(caseInput());
    const deficit = r.rows.find((x) => x.age < 55 && x.debug!.annualNetCashflow < 0)!.debug!;
    expect(deficit.plannedInvestmentAmount).toBe(240);
    expect(deficit.actualInvestmentAmount).toBe(0);
    expect(deficit.skippedInvestmentAmount).toBe(240);
  });

  it('keeps the investment window open through side-FIRE working years, stops after full retirement', () => {
    const r = run(caseInput()); // サイドFIRE55・就労65
    const at56 = r.rows.find((x) => x.age === 56)!.debug!; // サイドFIRE中（就労65歳まで反映対象）
    expect(at56.plannedInvestmentAmount).toBe(240); // 反映対象内（停止しない）
    expect(at56.actualInvestmentAmount).toBe(0); // ただしこの年は黒字なし → 積立0
    const at66 = r.rows.find((x) => x.age === 66)!.debug!; // 就労終了後
    expect(at66.plannedInvestmentAmount).toBe(0);
    expect(at66.actualInvestmentAmount).toBe(0);
  });

  it('surfaces the planned annual amount and the first underfunded age', () => {
    const ind = run(caseInput()).indicators;
    expect(ind.monthlyInvestmentPlannedAnnual).toBe(240);
    expect(ind.investmentUnderfundedFromAge).toBe(38);
  });

  it('lists an actionable risk factor about underfunded investment', () => {
    const input = applyRecommendedValues(caseInput());
    const factors = buildRiskFactors(run(caseInput()), input);
    const text = (f: { title: string; points: string[] }) => [f.title, ...f.points].join(' ');
    expect(factors.some((f) => text(f).includes('満額') && text(f).includes('積立'))).toBe(true);
  });

  it('does not flag underfunding when monthly investment is not entered', () => {
    const i = caseInput();
    i.investment.monthlyInvestment = field(0, 'skipped', '', '', '万円');
    const r = run(i);
    expect(r.indicators.monthlyInvestmentPlannedAnnual).toBe(0);
    expect(r.indicators.investmentUnderfundedFromAge).toBe(null);
    // 未入力時は黒字の一定割合のみを積み立てるため、満額不足の概念は出さない。
    const at38 = r.rows.find((x) => x.age === 38)!.debug!;
    expect(at38.skippedInvestmentAmount).toBeCloseTo(0, 6);
  });
});

describe('STEP5.6 one-time life events appear as markers (same source as the calc)', () => {
  it('reflects car/reform amounts in the spending of the event year', () => {
    const r = run(caseInput());
    const at45 = r.rows.find((x) => x.age === 45)!;
    // 45歳=車購入500、50歳=リフォーム200 が一時支出として反映される。
    expect(at45.debug!.oneTimeExpense).toBeGreaterThan(400);
    const at50 = r.rows.find((x) => x.age === 50)!;
    expect(at50.debug!.oneTimeExpense).toBeGreaterThan(150);
  });

  it('includes user life events in the timeline/marker source', () => {
    const r = run(caseInput());
    const events = buildLifeEvents(r, applyRecommendedValues(caseInput()));
    const car = events.find((e) => e.age === 45 && e.title === '車購入');
    const reform = events.find((e) => e.age === 50 && e.title === 'リフォーム');
    expect(car).toBeDefined();
    expect(reform).toBeDefined();
    expect(car!.type).toBe('custom');
    expect(car!.relatedStepId).toBe('detailed-events');
  });
});

describe('STEP5.6 variable rate does not emit a fixed-rate-end marker', () => {
  it('omits fixed_rate_end when the rate is variable', () => {
    const i = createDefaultInput('thorough');
    i.basic.age = field(40, 'user_input', '', '', '歳');
    i.housing.type = field('own', 'user_input', '', '');
    i.housing.rateType = field('variable', 'user_input', '', '');
    i.housing.fixedEndAge = field(50, 'user_input', '', '', '歳');
    const events = mortgageEvents(i.housing, i.basic.age.value);
    expect(events.some((e) => e.kind === 'fixed_rate_end')).toBe(false);
  });

  it('emits fixed_rate_end when the rate is fixed', () => {
    const i = createDefaultInput('thorough');
    i.basic.age = field(40, 'user_input', '', '', '歳');
    i.housing.type = field('own', 'user_input', '', '');
    i.housing.rateType = field('fixed', 'user_input', '', '');
    i.housing.fixedEndAge = field(50, 'user_input', '', '', '歳');
    const events = mortgageEvents(i.housing, i.basic.age.value);
    expect(events.some((e) => e.kind === 'fixed_rate_end' && e.age === 50)).toBe(true);
  });
});
