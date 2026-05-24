import { describe, expect, it } from 'vitest';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import { buildRiskFactors } from '../../src/features/results/riskFactors';
import { field } from '../../src/schema/field';
import type { ChildInput, LifeEvent, SimulationInput } from '../../src/schema/types';

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
function ev(id: string, age: number, amount: number): LifeEvent {
  return {
    id,
    label: field(id, 'user_input', id, ''),
    atAge: field(age, 'user_input', '年齢', '', '歳'),
    amount: field(amount, 'user_input', '金額', '', '万円'),
  };
}

// STEP5.5 の検証ケース（実機報告条件）
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
  i.investment.crashScenario = field(false, 'user_input', '', ''); // 暴落は別テストで検証（ここは収入インフレの検証）
  i.retirement.pension = field(240, 'user_input', '', '', '万円');
  i.retirement.retirementLiving = field(255, 'user_input', '', '', '万円');
  i.lifeEvents = [ev('car', 45, 500), ev('reform', 50, 200)];
  return i;
}
const run = (i: SimulationInput) => runSimulation(applyRecommendedValues(i));
const longevity = (i: SimulationInput) => run(i).indicators.assetLongevityAge ?? 999;

describe('STEP5.5 income is inflated like expenses (present-value input)', () => {
  it('pension and side income grow with inflation (not nominal-fixed)', () => {
    const r = run(caseInput());
    const p66 = r.rows.find((x) => x.age === 66)!.income.pension;
    expect(p66).toBeCloseTo(240 * Math.pow(1.02, 28), 1); // 現在価値240 → 将来額
    const side56 = r.rows.find((x) => x.age === 56)!.income.postFire;
    expect(side56).toBeCloseTo(400 * Math.pow(1.02, 18), 1);
  });

  it('notes explain income inflation and daily-only living', () => {
    const notes = run(caseInput()).notes;
    expect(notes.some((n) => n.includes('FIRE後収入・年金・退職金は現在価値'))).toBe(true);
    expect(notes.some((n) => n.includes('日常生活費のみ'))).toBe(true);
  });

  it('current assets are the chart/table starting point (38歳=入力値)', () => {
    const r = run(caseInput());
    expect(r.rows[0].startAssets).toBe(3200); // 「現在」表示に使う値
  });
});

describe('STEP5.5 cause isolation (each lever moves longevity the right way)', () => {
  const baseLongevity = longevity(caseInput());

  it('reproduces a depletion around the mid-70s (not absurdly early)', () => {
    expect(baseLongevity).toBeGreaterThanOrEqual(70);
  });

  it('dropping discretionary spend in retirement helps', () => {
    const i = caseInput();
    i.expense.travelCost = field(0, 'user_input', '', '', '万円');
    i.expense.carCost = field(0, 'user_input', '', '', '万円');
    i.expense.annualSpecial = field(0, 'user_input', '', '', '万円');
    expect(longevity(i)).toBeGreaterThan(baseLongevity);
  });

  it('higher pension helps', () => {
    const i = caseInput();
    i.retirement.pension = field(360, 'user_input', '', '', '万円');
    expect(longevity(i)).toBeGreaterThan(baseLongevity);
  });

  it('removing children (education) helps', () => {
    const i = caseInput();
    i.children = [];
    expect(longevity(i)).toBeGreaterThan(baseLongevity);
  });

  it('removing one-time events (car/reform) helps', () => {
    const i = caseInput();
    i.lifeEvents = [];
    expect(longevity(i)).toBeGreaterThan(baseLongevity);
  });

  it('lower post-FIRE/old-age living helps', () => {
    const i = caseInput();
    i.fire.postFireLiving = field(200, 'user_input', '', '', '万円');
    i.retirement.retirementLiving = field(200, 'user_input', '', '', '万円');
    expect(longevity(i)).toBeGreaterThan(baseLongevity);
  });
});

describe('STEP5.5 risk factors (見直しが効きやすいポイント)', () => {
  it('lists actionable factors for the depleting case', () => {
    const r = run(caseInput());
    const factors = buildRiskFactors(r, applyRecommendedValues(caseInput()));
    const text = (f: { title: string; points: string[] }) => [f.title, ...f.points].join(' ');
    expect(factors.length).toBeGreaterThan(0);
    expect(factors.length).toBeLessThanOrEqual(5);
    expect(factors.some((f) => text(f).includes('尽きる'))).toBe(true);
    expect(factors.some((f) => text(f).includes('教育費'))).toBe(true);
  });
});
