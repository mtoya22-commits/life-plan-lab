import { describe, expect, it } from 'vitest';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import { draftFromAnswers } from '../../src/schema/roughMapping';
import { buildFullInputFromRough } from '../../src/schema/normalize';
import { field } from '../../src/schema/field';
import type { RoughFieldId, SimulationInput } from '../../src/schema/types';

function depleting(inflation: number): SimulationInput {
  const i = createDefaultInput('thorough');
  i.basic.age = field(40, 'user_input', '年齢', '', '歳');
  i.basic.currentAssets = field(200, 'user_input', '資産', '', '万円');
  i.basic.householdIncome = field(300, 'user_input', '年収', '', '万円');
  i.income.raiseRate = field(0, 'user_input', '昇給率', '', '%');
  i.investment.returnRate = field(3, 'user_input', '利回り', '', '%');
  i.investment.inflationRate = field(inflation, 'user_input', 'インフレ', '', '%');
  i.expense.monthlyLiving = field(30, 'user_input', '生活費', '', '万円');
  i.fire.type = field('full', 'user_input', 'FIRE', '');
  i.fire.targetAge = field(45, 'user_input', '希望年齢', '', '歳');
  return i;
}
const run = (i: SimulationInput) => runSimulation(applyRecommendedValues(i));

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

describe('present value conversion', () => {
  it('present value of cumulative shortfall is smaller than the nominal future amount', () => {
    const r = run(depleting(2));
    expect(r.indicators.cumulativeShortfall).toBeGreaterThan(0);
    expect(r.indicators.cumulativeShortfallPresentValue).toBeGreaterThan(0);
    expect(r.indicators.cumulativeShortfallPresentValue).toBeLessThan(r.indicators.cumulativeShortfall);
  });

  it('with 0% inflation, present value equals nominal', () => {
    const r = run(depleting(0));
    expect(r.indicators.cumulativeShortfallPresentValue).toBeCloseTo(r.indicators.cumulativeShortfall, 3);
    // 95歳PVも将来額と一致（インフレ0）
    const at95 = r.rows.find((x) => x.age === 95)!;
    expect(at95.debug!.presentValueFactor).toBeCloseTo(1, 6);
  });

  it('higher inflation widens the gap between nominal and present value', () => {
    const r2 = run(depleting(2));
    const r4 = run(depleting(4));
    const gap2 = r2.indicators.cumulativeShortfall - r2.indicators.cumulativeShortfallPresentValue;
    const gap4 = r4.indicators.cumulativeShortfall - r4.indicators.cumulativeShortfallPresentValue;
    expect(gap4).toBeGreaterThan(gap2);
  });

  it('cumulative shortfall PV is the sum of per-year discounted shortfalls', () => {
    const r = run(depleting(2));
    // 各年の不足増分 × presentValueFactor の累計が、最終PVと一致する
    let pv = 0;
    let prevNominal = 0;
    for (const row of r.rows) {
      const inc = row.debug!.cumulativeShortfall - prevNominal; // その年に増えた不足額（名目）
      prevNominal = row.debug!.cumulativeShortfall;
      pv += inc * row.debug!.presentValueFactor;
    }
    expect(pv).toBeCloseTo(r.indicators.cumulativeShortfallPresentValue, 3);
  });

  it('year rows expose nominal and present-value figures distinctly', () => {
    const r = run(depleting(2));
    const row = r.rows.find((x) => x.age === 80)!;
    expect(row.debug!.presentValueFactor).toBeLessThan(1);
    expect(row.debug!.totalAssetsPresentValue).toBeCloseTo(row.endAssets * row.debug!.presentValueFactor, 3);
    expect(row.debug!.livingCostPresentValue).toBeCloseTo(row.expense.living * row.debug!.presentValueFactor, 3);
  });

  it('high-income case: 95-year shortfall has a smaller present value', () => {
    const r = runSimulation(buildFullInputFromRough(draftFromAnswers(HIGH_INCOME)));
    expect(r.indicators.cumulativeShortfall).toBeGreaterThan(0);
    expect(r.indicators.cumulativeShortfallPresentValue).toBeGreaterThan(0);
    expect(r.indicators.cumulativeShortfallPresentValue).toBeLessThan(r.indicators.cumulativeShortfall);
    expect(r.indicators.assetsAt95PresentValue).toBeLessThanOrEqual(r.indicators.assetsAt95 + 1e-9);
  });
});
