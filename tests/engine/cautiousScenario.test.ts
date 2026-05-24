import { describe, expect, it } from 'vitest';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { runSimulation, cautiousScenarioInput } from '../../src/engine/annualSimulationEngine';
import { field } from '../../src/schema/field';
import type { SimulationInput } from '../../src/schema/types';

// STEP8.2: 慎重シナリオ（利回り−2%・下限0%／インフレ+1%）の検証。暴落（一時下落）とは別物。
function base(): SimulationInput {
  const i = createDefaultInput('thorough');
  i.basic.age = field(40, 'user_input', '', '', '歳');
  i.basic.householdIncome = field(900, 'user_input', '', '', '万円');
  i.basic.takeHomeIncome = field(680, 'user_input', '', '', '万円');
  i.basic.currentAssets = field(1800, 'user_input', '', '', '万円');
  i.expense.monthlyLiving = field(26, 'user_input', '', '', '万円');
  i.children = [];
  i.housing.type = field('rent', 'user_input', '', '');
  i.housing.rent = field(10, 'user_input', '', '', '万円');
  i.fire.type = field('none', 'user_input', '', '');
  i.investment.monthlyInvestment = field(8, 'user_input', '', '', '万円');
  i.investment.returnRate = field(5, 'user_input', '', '', '%');
  i.investment.inflationRate = field(2, 'user_input', '', '', '%');
  i.retirement.pension = field(200, 'user_input', '', '', '万円');
  return i;
}
const run = (i: SimulationInput) => runSimulation(applyRecommendedValues(i));

describe('STEP8.2 cautious scenario', () => {
  it('lowers return by 2 (floor 0) and raises inflation by 1', () => {
    const i = base();
    const c = cautiousScenarioInput(i);
    expect(c.investment.returnRate.value).toBe(3);
    expect(c.investment.inflationRate.value).toBe(3);
  });

  it('keeps the cautious return at 0, never negative', () => {
    const i = base();
    i.investment.returnRate = field(1, 'user_input', '', '', '%');
    expect(cautiousScenarioInput(i).investment.returnRate.value).toBe(0);
  });

  it('does not toggle the crash scenario (it is a separate concept)', () => {
    const on = base();
    on.investment.crashScenario = field(true, 'user_input', '', '');
    expect(cautiousScenarioInput(on).investment.crashScenario.value).toBe(true);
    const off = base();
    off.investment.crashScenario = field(false, 'user_input', '', '');
    expect(cautiousScenarioInput(off).investment.crashScenario.value).toBe(false);
  });

  it('produces a worse-or-equal outcome than the standard scenario', () => {
    const std = run(base());
    const cautious = run(cautiousScenarioInput(base()));
    expect(cautious.indicators.assetsAt95).toBeLessThan(std.indicators.assetsAt95);
    const stdLong = std.indicators.assetLongevityAge ?? 999;
    const cautLong = cautious.indicators.assetLongevityAge ?? 999;
    expect(cautLong).toBeLessThanOrEqual(stdLong);
  });

  it('does not mutate the original input', () => {
    const i = base();
    cautiousScenarioInput(i);
    expect(i.investment.returnRate.value).toBe(5);
    expect(i.investment.inflationRate.value).toBe(2);
  });

  it('runs without error across varied cases', () => {
    const cases = [
      base(),
      (() => {
        const i = base();
        i.fire.type = field('side', 'user_input', '', '');
        i.fire.targetAge = field(55, 'user_input', '', '', '歳');
        return i;
      })(),
      (() => {
        const i = base();
        i.investment.returnRate = field(0, 'user_input', '', '', '%');
        return i;
      })(),
    ];
    for (const c of cases) {
      const r = run(cautiousScenarioInput(c));
      expect(r.rows.at(-1)!.age).toBe(95);
      expect(Number.isFinite(r.indicators.assetsAt95)).toBe(true);
    }
  });
});
