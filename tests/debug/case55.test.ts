import { describe, expect, it } from 'vitest';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
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
function ev(id: string, label: string, age: number, amount: number): LifeEvent {
  return {
    id,
    label: field(label, 'user_input', label, ''),
    atAge: field(age, 'user_input', '年齢', '', '歳'),
    amount: field(amount, 'user_input', '金額', '', '万円'),
  };
}

function caseInput(): SimulationInput {
  const i = createDefaultInput('thorough');
  i.basic.age = field(38, 'user_input', '', '', '歳');
  i.basic.spouseAge = field(35, 'user_input', '', '', '歳');
  i.basic.householdIncome = field(1200, 'user_input', '', '', '万円');
  i.basic.takeHomeIncome = field(650, 'user_input', '', '', '万円');
  i.basic.currentAssets = field(3200, 'user_input', '', '', '万円');
  i.basic.cashRatio = field(20, 'user_input', '', '', '%');
  i.income.selfIncome = field(900, 'user_input', '', '', '万円');
  i.income.spouseIncome = field(300, 'user_input', '', '', '万円');
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
  i.housing.balance = field(3100, 'user_input', '', '', '万円');
  i.housing.remainingYears = field(30, 'user_input', '', '', '年');
  i.housing.rate = field(1.175, 'user_input', '', '', '%');
  i.housing.rateType = field('variable', 'user_input', '', '');
  i.housing.repayMethod = field('equal_principal', 'user_input', '', '');
  i.housing.bonusAnnual = field(0, 'user_input', '', '', '万円');
  i.fire.type = field('side', 'user_input', '', '');
  i.fire.targetAge = field(55, 'user_input', '', '', '歳');
  i.fire.postFireLiving = field(270, 'user_input', '', '', '万円');
  i.fire.postFireIncome = field(400, 'user_input', '', '', '万円');
  i.fire.workUntilAge = field(65, 'user_input', '', '', '歳');
  i.investment.monthlyInvestment = field(20, 'user_input', '', '', '万円');
  i.investment.returnRate = field(5, 'user_input', '', '', '%');
  i.investment.inflationRate = field(2, 'user_input', '', '', '%');
  i.investment.crashScenario = field(true, 'user_input', '', '');
  i.retirement.pension = field(240, 'user_input', '', '', '万円');
  i.retirement.retirementLiving = field(255, 'user_input', '', '', '万円');
  i.retirement.medicalCareReserve = field(false, 'user_input', '', '');
  i.lifeEvents = [ev('car', '車購入', 45, 500), ev('reform', 'リフォーム', 50, 200)];
  return i;
}

const AGES = [38, 43, 45, 48, 50, 53, 55, 58, 63, 64, 65, 68, 73, 95];

describe('debug: STEP5.5 case', () => {
  it('prints the yearly breakdown', () => {
    const result = runSimulation(applyRecommendedValues(caseInput()));
    const r = (n: number) => Math.round(n);
    const lines = AGES.map((age) => {
      const row = result.rows.find((x) => x.age === age)!;
      const d = row.debug!;
      return [
        `age=${row.age}`,
        `begin=${r(d.beginningTotalAssets)}`,
        `ret=${r(row.investmentReturn)}`,
        `labor=${r(row.income.labor)}`,
        `side=${r(row.income.postFire)}`,
        `pen=${r(row.income.pension)}`,
        `oneIn=${r(d.oneTimeIncome)}`,
        `incTot=${r(row.income.total)}`,
        `living=${r(row.expense.living)}`,
        `edu=${r(row.expense.education)}`,
        `house=${r(row.expense.housing)}`,
        `special=${r(row.expense.special)}`,
        `expTot=${r(row.expense.total)}`,
        `net=${r(d.annualNetCashflow)}`,
        `plan=${r(d.plannedInvestmentAmount)}`,
        `act=${r(d.actualInvestmentAmount)}`,
        `skip=${r(d.skippedInvestmentAmount)}`,
        `cash=${r(d.cashAssets)}`,
        `inv=${r(d.investmentAssets)}`,
        `end=${r(row.endAssets)}`,
        `short=${r(d.cumulativeShortfall)}`,
      ].join(' ');
    });
    // eslint-disable-next-line no-console
    console.log('\n===== STEP5.5 CASE =====\n' + lines.join('\n'));
    // eslint-disable-next-line no-console
    console.log(
      `longevity=${result.indicators.assetLongevityAge} shortfall=${r(result.indicators.cumulativeShortfall)} shortfallPV=${r(result.indicators.cumulativeShortfallPresentValue)} eduPeak=${result.indicators.eduPeakResilience.peakAge}`,
    );
    expect(result.rows.length).toBeGreaterThan(0);
  });
});
