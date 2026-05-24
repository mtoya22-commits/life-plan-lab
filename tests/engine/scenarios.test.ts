import { describe, expect, it } from 'vitest';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import { field } from '../../src/schema/field';
import type { ChildInput, SimulationInput } from '../../src/schema/types';

// STEP8.1: 代表ケースの公開前検証。結果が自然で、条件上使われない値が漏れないことを固定する。
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
function base(): SimulationInput {
  const i = createDefaultInput('thorough');
  i.basic.age = field(40, 'user_input', '', '', '歳');
  i.basic.householdIncome = field(900, 'user_input', '', '', '万円');
  i.basic.takeHomeIncome = field(680, 'user_input', '', '', '万円');
  i.basic.currentAssets = field(1800, 'user_input', '', '', '万円');
  i.basic.cashRatio = field(20, 'user_input', '', '', '%');
  i.expense.monthlyLiving = field(26, 'user_input', '', '', '万円');
  i.children = [];
  i.housing.type = field('own', 'user_input', '', '');
  i.housing.monthlyPayment = field(11, 'user_input', '', '', '万円');
  i.housing.remainingYears = field(25, 'user_input', '', '', '年');
  i.fire.type = field('none', 'user_input', '', '');
  i.income.retirementAge = field(65, 'user_input', '', '', '歳');
  i.investment.monthlyInvestment = field(6, 'user_input', '', '', '万円');
  i.investment.returnRate = field(5, 'user_input', '', '', '%');
  i.investment.inflationRate = field(2, 'user_input', '', '', '%');
  i.retirement.pension = field(220, 'user_input', '', '', '万円');
  return i;
}
const run = (i: SimulationInput) => runSimulation(applyRecommendedValues(i));
const hasKind = (i: SimulationInput, kind: string) =>
  run(i).rows.flatMap((r) => r.events).some((e) => e.kind === kind);

describe('STEP8.1 representative-case sanity', () => {
  it('every case completes finite, runs to 95, never negative assets, reconciles', () => {
    const cases = [base(), (() => { const i = base(); i.children = [child(6, 'public_humanities', 'home'), child(3)]; return i; })()];
    for (const c of cases) {
      const r = run(c);
      expect(r.rows.at(-1)!.age).toBe(95);
      expect(Number.isFinite(r.indicators.assetsAt95)).toBe(true);
      expect(r.rows.every((x) => x.endAssets >= 0 && x.investmentReturn >= 0)).toBe(true);
      expect(r.rows.every((x) => Math.abs(x.debug!.reconciliationDiff) < 1e-6)).toBe(true);
    }
  });

  it('no-FIRE: shows no FIRE-start event (regression: was firing at retirement age)', () => {
    const i = base(); // fire.type = none
    expect(hasKind(i, 'fire_start')).toBe(false);
    expect(hasKind(i, 'side_fire_start')).toBe(false);
  });

  it('side FIRE: shows a side-FIRE-start event', () => {
    const i = base();
    i.fire.type = field('side', 'user_input', '', '');
    i.fire.targetAge = field(55, 'user_input', '', '', '歳');
    expect(hasKind(i, 'side_fire_start')).toBe(true);
  });

  it('renter: no mortgage-payoff event', () => {
    const i = base();
    i.housing.type = field('rent', 'user_input', '', '');
    i.housing.rent = field(10, 'user_input', '', '', '万円');
    expect(hasKind(i, 'mortgage_payoff')).toBe(false);
  });

  it('no children: no education cost across the plan', () => {
    expect(run(base()).rows.every((x) => x.expense.education === 0)).toBe(true);
  });

  it('education peak lands in a child university window (18-21)', () => {
    const i = base();
    i.children = [child(10, 'private_humanities', 'away')]; // 親40 → 大学=親48〜51
    const peak = run(i).indicators.eduPeakResilience.peakAge;
    expect(peak).toBeGreaterThanOrEqual(48);
    expect(peak).toBeLessThanOrEqual(51);
  });

  it('higher pension improves the old-age outcome', () => {
    const lo = base();
    const hi = base();
    hi.retirement.pension = field(360, 'user_input', '', '', '万円');
    expect(run(hi).indicators.assetsAt95).toBeGreaterThan(run(lo).indicators.assetsAt95);
  });

  it('a retirement lump sum improves the outcome', () => {
    const without = base();
    const withLump = base();
    withLump.income.retirementLumpSum = field(1500, 'user_input', '', '', '万円');
    expect(run(withLump).indicators.assetsAt95).toBeGreaterThan(run(without).indicators.assetsAt95);
  });

  it('crash scenario worsens the outcome', () => {
    const off = base();
    const on = base();
    on.investment.crashScenario = field(true, 'user_input', '', '');
    expect(run(on).indicators.assetsAt95).toBeLessThan(run(off).indicators.assetsAt95);
  });

  it('with zero inflation, present value equals future (nominal) value at 95', () => {
    const i = base();
    i.investment.inflationRate = field(0, 'user_input', '', '', '%');
    const ind = run(i).indicators;
    expect(ind.assetsAt95PresentValue).toBeCloseTo(ind.assetsAt95, 3);
  });

  it('an overspending household depletes and reports a present-value shortfall (calm framing)', () => {
    const i = base();
    i.basic.takeHomeIncome = field(520, 'user_input', '', '', '万円');
    i.basic.currentAssets = field(700, 'user_input', '', '', '万円');
    i.expense.monthlyLiving = field(34, 'user_input', '', '', '万円');
    i.expense.travelCost = field(40, 'user_input', '', '', '万円');
    const r = run(i);
    expect(r.indicators.assetLongevityAge).not.toBeNull();
    expect(r.indicators.cumulativeShortfallPresentValue).toBeGreaterThan(0);
    // 表示資産はマイナスにしない（不足は別管理）
    expect(r.indicators.assetsAt95).toBeGreaterThanOrEqual(0);
  });
});
