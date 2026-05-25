import { describe, it } from 'vitest';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { runSimulation, cautiousScenarioInput } from '../../src/engine/annualSimulationEngine';
import { field } from '../../src/schema/field';
import type { ChildInput, LifeEvent, SimulationInput } from '../../src/schema/types';

function child(age: number, uni = 'private_humanities', living = 'away'): ChildInput {
  return {
    currentAge: field(age, 'user_input', '子の年齢', '', '歳'),
    ageAssumed: false,
    middleSchool: field('public', 'user_input', '中学', ''),
    highSchool: field('public', 'user_input', '高校', ''),
    university: field(uni as never, 'user_input', '大学', ''),
    uniLiving: field(living as never, 'user_input', '住まい', ''),
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
function b(): SimulationInput {
  const i = createDefaultInput('thorough');
  i.investment.returnRate = field(5, 'user_input', '', '', '%');
  i.investment.inflationRate = field(2, 'user_input', '', '', '%');
  return i;
}
const run = (i: SimulationInput) => runSimulation(applyRecommendedValues(i));
const r0 = (n: number) => Math.round(n);

function report(name: string, i: SimulationInput) {
  const res = run(i);
  const ind = res.indicators;
  const eduPeakRow = res.rows.find((x) => x.age === ind.eduPeakResilience.peakAge)!;
  const payoff = res.rows.flatMap((x) => x.events).find((e) => e.kind === 'mortgage_payoff');
  const fire = res.rows.flatMap((x) => x.events).find((e) => e.kind === 'fire_start' || e.kind === 'side_fire_start');
  const crash = res.rows.flatMap((x) => x.events).find((e) => e.kind === 'market_crash');
  // eslint-disable-next-line no-console
  console.log(
    `\n=== ${name} ===\n` +
      `longevity=${ind.assetLongevityAge ?? '95+'} assetsAt95(PV)=${r0(ind.assetsAt95PresentValue)} assetsAt95(nom)=${r0(ind.assetsAt95)} ` +
      `shortfallPV=${r0(ind.cumulativeShortfallPresentValue)} fireRate=${r0(ind.fireAchievementRate)}%\n` +
      `eduPeakAge=${ind.eduPeakResilience.peakAge} eduPeakCost=${r0(eduPeakRow.expense.education)} ` +
      `payoff=${payoff?.age ?? '-'} fire=${fire?.age ?? '-'} crash=${crash?.age ?? '-'}\n` +
      `monthlyInvest planned/firstActual/avg=${r0(ind.monthlyInvestmentPlannedAnnual)}/${r0(ind.monthlyInvestmentActualFirstYear)}/${r0(ind.monthlyInvestmentActualAverage)}`,
  );
  const cau = runSimulation(cautiousScenarioInput(applyRecommendedValues(i))).indicators;
  // eslint-disable-next-line no-console
  console.log(
    `   慎重: longevity=${cau.assetLongevityAge ?? '95+'} assetsAt95(PV)=${r0(cau.assetsAt95PresentValue)} shortfallPV=${r0(cau.cumulativeShortfallPresentValue)}`,
  );
}

describe('STEP8.1 representative cases (debug print)', () => {
  it('prints 5 cases', () => {
    // ケース1: 標準共働き・子2・持ち家
    const c1 = b();
    c1.basic.age = field(38, 'user_input', '', '', '歳');
    c1.basic.householdIncome = field(900, 'user_input', '', '', '万円');
    c1.basic.takeHomeIncome = field(680, 'user_input', '', '', '万円');
    c1.basic.currentAssets = field(1500, 'user_input', '', '', '万円');
    c1.expense.monthlyLiving = field(28, 'user_input', '', '', '万円');
    c1.children = [child(6, 'public_humanities', 'home'), child(3, 'public_humanities', 'home')];
    c1.housing.type = field('own', 'user_input', '', '');
    c1.housing.monthlyPayment = field(12, 'user_input', '', '', '万円');
    c1.housing.remainingYears = field(28, 'user_input', '', '', '年');
    c1.fire.type = field('none', 'user_input', '', '');
    c1.investment.monthlyInvestment = field(8, 'user_input', '', '', '万円');
    c1.retirement.pension = field(220, 'user_input', '', '', '万円');
    report('1 標準共働き・子2・持ち家', c1);

    // ケース2: 高収入・子2・サイドFIRE55・年金あり
    const c2 = b();
    c2.basic.age = field(38, 'user_input', '', '', '歳');
    c2.basic.householdIncome = field(1200, 'user_input', '', '', '万円');
    c2.basic.takeHomeIncome = field(820, 'user_input', '', '', '万円');
    c2.basic.currentAssets = field(3200, 'user_input', '', '', '万円');
    c2.expense.monthlyLiving = field(30, 'user_input', '', '', '万円');
    c2.children = [child(4), child(2)];
    c2.housing.type = field('own', 'user_input', '', '');
    c2.housing.monthlyPayment = field(13, 'user_input', '', '', '万円');
    c2.housing.remainingYears = field(30, 'user_input', '', '', '年');
    c2.fire.type = field('side', 'user_input', '', '');
    c2.fire.targetAge = field(55, 'user_input', '', '', '歳');
    c2.fire.postFireLiving = field(300, 'user_input', '', '', '万円');
    c2.fire.postFireIncome = field(300, 'user_input', '', '', '万円');
    c2.fire.workUntilAge = field(65, 'user_input', '', '', '歳');
    c2.investment.monthlyInvestment = field(15, 'user_input', '', '', '万円');
    c2.retirement.pension = field(260, 'user_input', '', '', '万円');
    report('2 高収入・子2・サイドFIRE55・年金あり', c2);

    // ケース3: 賃貸・子なし・投資多め
    const c3 = b();
    c3.basic.age = field(35, 'user_input', '', '', '歳');
    c3.basic.householdIncome = field(700, 'user_input', '', '', '万円');
    c3.basic.takeHomeIncome = field(540, 'user_input', '', '', '万円');
    c3.basic.currentAssets = field(1200, 'user_input', '', '', '万円');
    c3.expense.monthlyLiving = field(20, 'user_input', '', '', '万円');
    c3.children = [];
    c3.housing.type = field('rent', 'user_input', '', '');
    c3.housing.rent = field(10, 'user_input', '', '', '万円');
    c3.fire.type = field('none', 'user_input', '', '');
    c3.investment.monthlyInvestment = field(12, 'user_input', '', '', '万円');
    c3.retirement.pension = field(180, 'user_input', '', '', '万円');
    report('3 賃貸・子なし・投資多め', c3);

    // ケース4: 支出多め・要注意
    const c4 = b();
    c4.basic.age = field(45, 'user_input', '', '', '歳');
    c4.basic.householdIncome = field(700, 'user_input', '', '', '万円');
    c4.basic.takeHomeIncome = field(540, 'user_input', '', '', '万円');
    c4.basic.currentAssets = field(800, 'user_input', '', '', '万円');
    c4.expense.monthlyLiving = field(30, 'user_input', '', '', '万円');
    c4.expense.travelCost = field(35, 'user_input', '', '', '万円');
    c4.expense.carCost = field(35, 'user_input', '', '', '万円');
    c4.children = [child(12), child(9)];
    c4.housing.type = field('own', 'user_input', '', '');
    c4.housing.monthlyPayment = field(14, 'user_input', '', '', '万円');
    c4.housing.remainingYears = field(25, 'user_input', '', '', '年');
    c4.fire.type = field('none', 'user_input', '', '');
    c4.investment.monthlyInvestment = field(2, 'user_input', '', '', '万円');
    c4.retirement.pension = field(180, 'user_input', '', '', '万円');
    report('4 支出多め・要注意', c4);

    // ケース5: 老後重視（年金・退職金・医療介護）
    const c5 = b();
    c5.basic.age = field(50, 'user_input', '', '', '歳');
    c5.basic.householdIncome = field(800, 'user_input', '', '', '万円');
    c5.basic.takeHomeIncome = field(600, 'user_input', '', '', '万円');
    c5.basic.currentAssets = field(2500, 'user_input', '', '', '万円');
    c5.expense.monthlyLiving = field(26, 'user_input', '', '', '万円');
    c5.children = [];
    c5.housing.type = field('own', 'user_input', '', '');
    c5.housing.monthlyPayment = field(10, 'user_input', '', '', '万円');
    c5.housing.remainingYears = field(10, 'user_input', '', '', '年');
    c5.fire.type = field('none', 'user_input', '', '');
    c5.income.retirementLumpSum = field(1500, 'user_input', '', '', '万円');
    c5.investment.monthlyInvestment = field(5, 'user_input', '', '', '万円');
    c5.retirement.pension = field(240, 'user_input', '', '', '万円');
    c5.retirement.retirementLiving = field(260, 'user_input', '', '', '万円');
    c5.retirement.medicalCareReserve = field(true, 'user_input', '', '');
    c5.lifeEvents = [ev('reform', 'リフォーム', 60, 300)];
    report('5 老後重視（年金・退職金・医療介護）', c5);
  });
});
