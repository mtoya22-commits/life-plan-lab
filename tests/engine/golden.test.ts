import { describe, expect, it } from 'vitest';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import { buildFullInputFromRough } from '../../src/schema/normalize';
import { draftFromAnswers } from '../../src/schema/roughMapping';
import { field } from '../../src/schema/field';
import type { RoughFieldId, SimulationInput } from '../../src/schema/types';

// 手計算できる単純ケース。期待値はエンジンから導出せず、人間の計算で固定する。
// applyRecommendedValues を通さず、全項目を user_input にして engine を直接検証する。
function simpleInput(opts: {
  assets: number;
  annualIncome?: number;
  annualExpense?: number;
  returnRate?: number;
  inflation?: number;
  cashRatio?: number;
}): SimulationInput {
  const i = createDefaultInput('thorough');
  i.basic.age = field(40, 'user_input', '年齢', '', '歳');
  i.basic.currentAssets = field(opts.assets, 'user_input', '資産', '', '万円');
  i.basic.householdIncome = field(0, 'user_input', '年収', '', '万円');
  i.basic.takeHomeIncome = field(opts.annualIncome ?? 0, 'user_input', '手取り', '', '万円');
  i.basic.cashRatio = field(opts.cashRatio ?? 0, 'user_input', '現金比率', '', '%');
  i.income.raiseRate = field(0, 'user_input', '昇給', '', '%');
  i.income.retirementAge = field(65, 'user_input', '退職', '', '歳');
  i.income.retirementLumpSum = field(0, 'user_input', '退職金', '', '万円');
  i.expense.monthlyLiving = field(0, 'user_input', '生活費', '', '万円');
  i.expense.annualSpecial = field(opts.annualExpense ?? 0, 'user_input', '特別費', '', '万円');
  i.expense.carCost = field(0, 'user_input', '車', '', '万円');
  i.expense.travelCost = field(0, 'user_input', '旅行', '', '万円');
  i.expense.insuranceCost = field(0, 'user_input', '保険', '', '万円');
  i.investment.returnRate = field(opts.returnRate ?? 0, 'user_input', '利回り', '', '%');
  i.investment.inflationRate = field(opts.inflation ?? 0, 'user_input', 'インフレ', '', '%');
  i.investment.monthlyInvestment = field(0, 'user_input', '毎月投資', '', '万円');
  i.housing.type = field('rent', 'user_input', '住まい', '');
  i.housing.rent = field(0, 'user_input', '家賃', '', '万円');
  i.housing.monthlyPayment = field(0, 'user_input', '返済', '', '万円');
  i.fire.type = field('none', 'user_input', 'FIRE', '');
  i.fire.postFireLiving = field(0, 'user_input', 'FIRE後生活費', '', '万円');
  i.retirement.pension = field(0, 'user_input', '年金', '', '万円');
  i.retirement.retirementLiving = field(0, 'user_input', '老後生活費', '', '万円');
  i.retirement.medicalCareReserve = field(false, 'user_input', '医療', '');
  i.children = [];
  i.lifeEvents = [];
  return i;
}
const rowAt = (i: SimulationInput, age: number) => runSimulation(i).rows.find((r) => r.age === age)!;

describe('golden cases (hand-computed)', () => {
  it('A: nothing happens -> assets stay flat, no shortfall', () => {
    const r = runSimulation(simpleInput({ assets: 1000 }));
    expect(r.rows.every((x) => x.endAssets === 1000)).toBe(true);
    expect(r.indicators.cumulativeShortfall).toBe(0);
    expect(r.indicators.assetsAt95).toBe(1000);
  });

  it('B: 5% return on all-invested -> compounds 1050, 1102.5, 1157.625', () => {
    const i = simpleInput({ assets: 1000, returnRate: 5, cashRatio: 0 });
    expect(rowAt(i, 40).endAssets).toBeCloseTo(1050, 6);
    expect(rowAt(i, 41).endAssets).toBeCloseTo(1102.5, 6);
    expect(rowAt(i, 42).endAssets).toBeCloseTo(1157.625, 6);
    expect(rowAt(i, 40).debug!.cashAssets).toBe(0); // 現金は0のまま
  });

  it('C: 100% cash -> no return, assets stay flat', () => {
    const i = simpleInput({ assets: 1000, returnRate: 5, cashRatio: 100 });
    expect(rowAt(i, 41).endAssets).toBe(1000);
    expect(rowAt(i, 41).investmentReturn).toBe(0);
  });

  it('D: -100/yr -> 900, 500 at 5y, 0 at 10y, shortfall grows after', () => {
    const i = simpleInput({ assets: 1000, annualExpense: 100, returnRate: 0, cashRatio: 0 });
    const r = runSimulation(i);
    expect(rowAt(i, 40).endAssets).toBe(900);
    expect(rowAt(i, 44).endAssets).toBe(500); // 5年後
    expect(rowAt(i, 49).endAssets).toBe(0); // 10年後
    expect(rowAt(i, 50).debug!.cumulativeShortfall).toBe(100); // 11年目
    expect(r.indicators.assetLongevityAge).toBe(49);
  });

  it('E: inflation 2% on a 100 expense -> 100, 102, 104.04; present value ~100', () => {
    const i = simpleInput({ assets: 1000000, annualExpense: 100, inflation: 2, returnRate: 0 });
    expect(rowAt(i, 40).expense.special).toBeCloseTo(100, 6);
    expect(rowAt(i, 41).expense.special).toBeCloseTo(102, 6);
    expect(rowAt(i, 42).expense.special).toBeCloseTo(104.04, 6);
    expect(rowAt(i, 41).debug!.annualExpenseTotalPresentValue).toBeCloseTo(100, 6);
  });
});

describe('independent reference & reconciliation', () => {
  it('B matches an independent compound-interest formula', () => {
    const i = simpleInput({ assets: 1000, returnRate: 5, cashRatio: 0 });
    const rows = runSimulation(i).rows;
    for (let k = 0; k < 5; k++) {
      expect(rows[k].endAssets).toBeCloseTo(1000 * Math.pow(1.05, k + 1), 4);
    }
  });

  it('reconciliationDiff is ~0 for every year across varied scenarios', () => {
    const scenarios: SimulationInput[] = [
      simpleInput({ assets: 1000, returnRate: 5, cashRatio: 0 }),
      simpleInput({ assets: 1000, annualExpense: 100 }),
      simpleInput({ assets: 200, annualExpense: 120, returnRate: 3, inflation: 2 }),
      buildFullInputFromRough(draftFromAnswers(HIGH_INCOME)),
    ];
    for (const s of scenarios) {
      for (const r of runSimulation(s).rows) {
        expect(Math.abs(r.debug!.reconciliationDiff)).toBeLessThan(1e-6);
      }
    }
  });
});

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
