import { describe, expect, it } from 'vitest';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { getCrashAge, runSimulation } from '../../src/engine/annualSimulationEngine';
import { field } from '../../src/schema/field';
import type { SimulationInput } from '../../src/schema/types';

// STEP6.2追加 / STEP11.23 更新: 暴落シナリオ（簡易）の計算反映を検証する。
// 「あり」のとき、取崩開始（FIRE開始 or 退職）+ 1 年の年に投資資産のみを一度だけ下落させ、
// その後は通常利回りで回復（シーケンスリスク織り込み）。
function base(crash: boolean, cashRatio = 20): SimulationInput {
  const i = createDefaultInput('thorough');
  i.basic.age = field(40, 'user_input', '', '', '歳');
  i.basic.currentAssets = field(4000, 'user_input', '', '', '万円');
  i.basic.cashRatio = field(cashRatio, 'user_input', '', '', '%');
  i.basic.householdIncome = field(800, 'user_input', '', '', '万円');
  i.basic.takeHomeIncome = field(600, 'user_input', '', '', '万円');
  i.expense.monthlyLiving = field(25, 'user_input', '', '', '万円');
  i.housing.type = field('rent', 'user_input', '', '');
  i.housing.rent = field(10, 'user_input', '', '', '万円');
  i.children = [];
  i.fire.type = field('none', 'user_input', '', '');
  i.income.retirementAge = field(65, 'user_input', '', '', '歳');
  i.investment.returnRate = field(5, 'user_input', '', '', '%');
  i.investment.inflationRate = field(2, 'user_input', '', '', '%');
  i.investment.crashScenario = field(crash, 'user_input', '', '');
  i.retirement.pension = field(200, 'user_input', '', '', '万円');
  return i;
}
const run = (i: SimulationInput) => runSimulation(applyRecommendedValues(i));

describe('STEP6.2 crash scenario is reflected in the calculation', () => {
  it('applies a one-time investment drop at drawdown-start + 1 (investment only, not cash)', () => {
    const i = base(true);
    const r = run(i);
    const crashAge = getCrashAge(i); // none + retirementAge=65 → 66
    const row = r.rows.find((x) => x.age === crashAge)!;
    expect(row.debug!.crashLoss).toBeGreaterThan(0);
    // 下落は当該年のみ（直前年は0）。
    expect(r.rows.find((x) => x.age === crashAge - 1)!.debug!.crashLoss).toBe(0);
    // 反映後の方が、暴落なしより当年末資産が小さい。
    const noCrashRow = run(base(false)).rows.find((x) => x.age === crashAge)!;
    expect(row.endAssets).toBeLessThan(noCrashRow.endAssets);
  });

  it('makes the long-term outcome worse than no crash', () => {
    const withCrash = run(base(true)).indicators;
    const without = run(base(false)).indicators;
    expect(withCrash.assetsAt95).toBeLessThan(without.assetsAt95);
  });

  it('has no effect when assets are all cash and nothing is invested', () => {
    const i = base(true, 100);
    i.investment.monthlyInvestment = field(0, 'user_input', '', '', '万円'); // 新規投資なし
    const crashAge = getCrashAge(i);
    const row = run(i).rows.find((x) => x.age === crashAge)!;
    expect(row.debug!.crashLoss).toBe(0); // 投資資産が0なので下落しない
  });

  it('shows a market-crash marker and a reflected-not-record-only note', () => {
    const i = base(true);
    const r = run(i);
    const crashAge = getCrashAge(i);
    const marker = r.rows.find((x) => x.age === crashAge)!.events.find((e) => e.kind === 'market_crash');
    expect(marker).toBeDefined();
    expect(r.notes.some((n) => n.includes('暴落シナリオ') && n.includes('下落'))).toBe(true);
    expect(r.notes.some((n) => n.includes('反映していません'))).toBe(false); // 旧「記録用・未反映」は出さない
  });

  it('keeps the reconciliation identity intact in the crash year', () => {
    const r = run(base(true));
    for (const row of r.rows) {
      expect(Math.abs(row.debug!.reconciliationDiff)).toBeLessThan(1e-6);
    }
  });

  it('does nothing when crash scenario is off', () => {
    const r = run(base(false));
    expect(r.rows.every((x) => x.debug!.crashLoss === 0)).toBe(true);
  });
});
