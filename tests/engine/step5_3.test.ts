import { describe, expect, it } from 'vitest';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import { eduCostForChild } from '../../src/engine/educationCostEngine';
import { field } from '../../src/schema/field';
import type { ChildInput, LifeEvent, SimulationInput, UniversityPath } from '../../src/schema/types';

// 枯渇しない安定ケース（各入力の感度が 95歳残資産に出る）
function base(): SimulationInput {
  const i = createDefaultInput('thorough');
  i.basic.age = field(40, 'user_input', '年齢', '', '歳');
  i.basic.currentAssets = field(8000, 'user_input', '資産', '', '万円');
  i.basic.householdIncome = field(1000, 'user_input', '年収', '', '万円');
  i.income.raiseRate = field(0, 'user_input', '昇給率', '', '%');
  i.expense.monthlyLiving = field(25, 'user_input', '生活費', '', '万円');
  i.investment.returnRate = field(5, 'user_input', '利回り', '', '%');
  i.investment.inflationRate = field(2, 'user_input', 'インフレ', '', '%');
  i.basic.cashRatio = field(20, 'user_input', '現金比率', '', '%');
  i.housing.type = field('rent', 'user_input', '住まい', '');
  i.housing.rent = field(10, 'user_input', '家賃', '', '万円');
  i.fire.type = field('full', 'user_input', 'FIRE', '');
  i.fire.targetAge = field(60, 'user_input', '希望年齢', '', '歳');
  i.retirement.pension = field(240, 'user_input', '年金', '', '万円');
  i.retirement.retirementLiving = field(280, 'user_input', '老後生活費', '', '万円');
  return i;
}
const at95 = (mut: (i: SimulationInput) => void): number => {
  const i = base();
  mut(i);
  return runSimulation(applyRecommendedValues(i)).indicators.assetsAt95;
};
const baseline = at95(() => {});

describe('STEP5.3 sensitivity (each input moves the result)', () => {
  it('income up -> better; living up -> worse', () => {
    expect(at95((i) => (i.basic.householdIncome = field(1400, 'user_input', '', '', '万円')))).toBeGreaterThan(baseline);
    expect(at95((i) => (i.expense.monthlyLiving = field(40, 'user_input', '', '', '万円')))).toBeLessThan(baseline);
  });

  it('return up -> better; inflation up -> worse', () => {
    expect(at95((i) => (i.investment.returnRate = field(7, 'user_input', '', '', '%')))).toBeGreaterThan(baseline);
    expect(at95((i) => (i.investment.inflationRate = field(4, 'user_input', '', '', '%')))).toBeLessThan(baseline);
  });

  it('pension up -> better (65+); retirement living up -> worse', () => {
    expect(at95((i) => (i.retirement.pension = field(360, 'user_input', '', '', '万円')))).toBeGreaterThan(baseline);
    expect(at95((i) => (i.retirement.retirementLiving = field(360, 'user_input', '', '', '万円')))).toBeLessThan(baseline);
  });

  it('raise rate up -> better; retire earlier -> worse', () => {
    expect(at95((i) => (i.income.raiseRate = field(2, 'user_input', '', '', '%')))).toBeGreaterThan(baseline);
    expect(at95((i) => (i.fire.targetAge = field(50, 'user_input', '', '', '歳')))).toBeLessThan(baseline);
  });

  it('higher cash ratio -> more conservative (lower long-term assets)', () => {
    expect(at95((i) => (i.basic.cashRatio = field(70, 'user_input', '', '', '%')))).toBeLessThan(baseline);
  });

  it('life event expense -> worse; inheritance -> better', () => {
    const car: LifeEvent = {
      id: 'car',
      label: field('車', 'user_input', '車', ''),
      atAge: field(50, 'user_input', '', '', '歳'),
      amount: field(300, 'user_input', '', '', '万円'),
    };
    const inherit: LifeEvent = {
      id: 'inherit',
      label: field('相続', 'user_input', '相続', ''),
      atAge: field(70, 'user_input', '', '', '歳'),
      amount: field(-1000, 'user_input', '', '', '万円'),
    };
    expect(at95((i) => (i.lifeEvents = [car]))).toBeLessThan(baseline);
    expect(at95((i) => (i.lifeEvents = [inherit]))).toBeGreaterThan(baseline);
  });
});

describe('STEP5.3 §3 post-depletion surplus repays shortfall', () => {
  function depleteThenPension(pension: number): SimulationInput {
    const i = base();
    i.basic.currentAssets = field(300, 'user_input', '資産', '', '万円');
    i.basic.householdIncome = field(300, 'user_input', '年収', '', '万円');
    i.expense.monthlyLiving = field(28, 'user_input', '生活費', '', '万円');
    i.fire.type = field('full', 'user_input', 'FIRE', '');
    i.fire.targetAge = field(45, 'user_input', '希望年齢', '', '歳'); // 早期に枯渇
    i.retirement.retirementLiving = field(180, 'user_input', '老後生活費', '', '万円');
    i.retirement.pension = field(pension, 'user_input', '年金', '', '万円');
    return i;
  }

  it('large pension reduces cumulative shortfall and repays it after 65', () => {
    const small = runSimulation(applyRecommendedValues(depleteThenPension(120)));
    const large = runSimulation(applyRecommendedValues(depleteThenPension(600)));
    expect(large.indicators.cumulativeShortfall).toBeLessThan(small.indicators.cumulativeShortfall);

    // 大きな年金では、65歳以降に累計不足額が減少する年が存在する（返済が起きる）。
    const rows = large.rows;
    let repaymentHappened = false;
    for (let k = 1; k < rows.length; k++) {
      if (rows[k].debug!.cumulativeShortfall < rows[k - 1].debug!.cumulativeShortfall - 1e-9) repaymentHappened = true;
    }
    expect(repaymentHappened).toBe(true);
  });
});

describe('STEP5.3 university split costs', () => {
  function child(uni: UniversityPath, living: 'home' | 'away'): ChildInput {
    return {
      currentAge: field(20, 'user_input', '年齢', '', '歳'),
      ageAssumed: false,
      middleSchool: field('public', 'user_input', '中学', ''),
      highSchool: field('public', 'user_input', '高校', ''),
      university: field(uni, 'user_input', '大学', ''),
      uniLiving: field(living, 'user_input', '住まい', ''),
    };
  }
  const cost = (uni: UniversityPath, living: 'home' | 'away') => eduCostForChild(child(uni, living), 20);

  it('private > public, science > humanities, away > home', () => {
    expect(cost('private_humanities', 'home')).toBeGreaterThan(cost('public_humanities', 'home'));
    expect(cost('public_science', 'home')).toBeGreaterThan(cost('public_humanities', 'home'));
    expect(cost('private_science', 'away')).toBeGreaterThan(cost('private_science', 'home'));
    expect(cost('none', 'home')).toBe(0);
  });
});
