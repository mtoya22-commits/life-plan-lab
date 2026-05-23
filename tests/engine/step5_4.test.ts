import { describe, expect, it } from 'vitest';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import { buildFullInputFromRough } from '../../src/schema/normalize';
import { draftFromAnswers } from '../../src/schema/roughMapping';
import { field } from '../../src/schema/field';
import type { ChildInput, RoughFieldId, SimulationInput } from '../../src/schema/types';

function thoroughBase(): SimulationInput {
  const i = createDefaultInput('thorough');
  i.basic.age = field(40, 'user_input', '年齢', '', '歳');
  i.basic.currentAssets = field(6000, 'user_input', '資産', '', '万円');
  i.basic.householdIncome = field(1000, 'user_input', '年収', '', '万円');
  i.income.raiseRate = field(0, 'user_input', '昇給', '', '%');
  i.investment.returnRate = field(5, 'user_input', '利回り', '', '%');
  i.investment.inflationRate = field(2, 'user_input', 'インフレ', '', '%');
  return i;
}
const run = (i: SimulationInput) => runSimulation(applyRecommendedValues(i));
const at = (i: SimulationInput, age: number) => run(i).rows.find((r) => r.age === age)!;

describe('STEP5.4 age/timing boundaries', () => {
  it('pension applies from exactly age 65 (inclusive)', () => {
    const i = thoroughBase();
    i.investment.inflationRate = field(0, 'user_input', 'インフレ', '', '%'); // 名目で確認
    i.retirement.pension = field(200, 'user_input', '年金', '', '万円');
    expect(at(i, 64).income.pension).toBe(0);
    expect(at(i, 65).income.pension).toBe(200);
  });

  it('labor stops in the FIRE start year', () => {
    const i = thoroughBase();
    i.fire.type = field('side', 'user_input', 'FIRE', '');
    i.fire.targetAge = field(55, 'user_input', '希望年齢', '', '歳');
    expect(at(i, 54).income.labor).toBeGreaterThan(0);
    expect(at(i, 55).income.labor).toBe(0);
  });

  it('retirement lump sum is paid in the FIRE/retirement year only', () => {
    const i = thoroughBase();
    i.investment.inflationRate = field(0, 'user_input', 'インフレ', '', '%');
    i.fire.type = field('side', 'user_input', 'FIRE', '');
    i.fire.targetAge = field(55, 'user_input', '希望年齢', '', '歳');
    i.income.retirementLumpSum = field(500, 'user_input', '退職金', '', '万円');
    expect(at(i, 54).debug!.retirementIncome).toBe(0);
    expect(at(i, 55).debug!.retirementIncome).toBe(500);
    expect(at(i, 56).debug!.retirementIncome).toBe(0);
  });

  it('medical/care reserve starts at 75 and increases at 85', () => {
    const i = thoroughBase();
    i.retirement.medicalCareReserve = field(true, 'user_input', '医療', '');
    expect(at(i, 74).expense.retirementExtra).toBe(0);
    expect(at(i, 75).expense.retirementExtra).toBeGreaterThan(0);
    expect(at(i, 85).expense.retirementExtra).toBeGreaterThan(at(i, 75).expense.retirementExtra);
  });

  it('university cost applies only during ages 18-21', () => {
    const i = thoroughBase();
    const child: ChildInput = {
      currentAge: field(17, 'user_input', '年齢', '', '歳'),
      ageAssumed: false,
      middleSchool: field('public', 'user_input', '中学', ''),
      highSchool: field('public', 'user_input', '高校', ''),
      university: field('private_humanities', 'user_input', '大学', ''),
      uniLiving: field('home', 'user_input', '住まい', ''),
    };
    i.children = [child];
    // 17歳=高校(60), 18歳=大学開始, 22歳=教育費なし
    expect(at(i, 40).expense.education).toBeCloseTo(60, 0); // 17歳 高校
    expect(at(i, 41).expense.education).toBeGreaterThan(60); // 18歳 大学
    expect(at(i, 45).expense.education).toBe(0); // 22歳
  });
});

const ROUGH: Partial<Record<RoughFieldId, string | number>> = {
  age: 40,
  householdIncome: 1000,
  currentAssets: 5000,
  monthlyLiving: 35,
  monthlyHousing: 11,
  loanYears: 30,
  childrenCount: 0,
  housing: 'own',
  workStyle: 'work_a_little',
  reduceWorkAge: 55,
  postFireLiving: 30,
  sideFireIncome: 20,
  investmentStyle: 'balanced',
};

describe('STEP5.4 unit conversions (month -> year, % -> decimal)', () => {
  const input = buildFullInputFromRough(draftFromAnswers(ROUGH));

  it('rough monthly inputs convert to annual figures', () => {
    expect(input.expense.monthlyLiving.value).toBe(35); // 月額のまま保持
    expect(input.housing.monthlyPayment.value).toBe(11); // 毎月住居費→ローン返済(月)
    expect(input.fire.postFireLiving.value).toBe(30 * 12); // 月30→年360
    expect(input.fire.postFireIncome.value).toBe(20 * 12); // 月20→年240
  });

  it('engine multiplies monthly living and housing by 12', () => {
    const r = runSimulation(input).rows.find((x) => x.age === 40)!;
    expect(r.expense.living).toBeCloseTo(35 * 12, 6); // 月35 → 年420（offset0でインフレ1）
    expect(r.expense.housing).toBeCloseTo(11 * 12, 6); // 月11 → 年132
  });

  it('rate % is treated as a decimal (5% on 1000 all-invest -> 1050)', () => {
    const i = createDefaultInput('thorough');
    i.basic.age = field(40, 'user_input', '', '', '歳');
    i.basic.currentAssets = field(1000, 'user_input', '', '', '万円');
    i.basic.cashRatio = field(0, 'user_input', '', '', '%');
    i.basic.householdIncome = field(0, 'user_input', '', '', '万円');
    i.basic.takeHomeIncome = field(0, 'user_input', '', '', '万円');
    i.expense.monthlyLiving = field(0, 'user_input', '', '', '万円');
    i.housing.type = field('rent', 'user_input', '', '');
    i.housing.rent = field(0, 'user_input', '', '', '万円');
    i.investment.returnRate = field(5, 'user_input', '', '', '%');
    i.investment.inflationRate = field(0, 'user_input', '', '', '%');
    i.fire.type = field('none', 'user_input', '', '');
    i.children = [];
    expect(runSimulation(i).rows[0].endAssets).toBeCloseTo(1050, 6);
  });
});
