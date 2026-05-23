import { describe, expect, it } from 'vitest';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import { field } from '../../src/schema/field';
import type { SimulationInput } from '../../src/schema/types';

// STEP5.1: 資産推移エンジンの不変条件と積み上げ期の監査。
function base(): SimulationInput {
  const i = createDefaultInput('thorough');
  i.basic.age = field(40, 'user_input', '本人年齢', '', '歳');
  i.basic.currentAssets = field(2000, 'user_input', '現在資産', '', '万円');
  i.basic.householdIncome = field(900, 'user_input', '世帯年収', '', '万円');
  i.income.raiseRate = field(0, 'user_input', '昇給率', '', '%');
  i.investment.returnRate = field(5, 'user_input', '想定利回り', '', '%');
  i.investment.inflationRate = field(2, 'user_input', 'インフレ率', '', '%');
  i.expense.monthlyLiving = field(25, 'user_input', '毎月生活費', '', '万円');
  i.fire.type = field('full', 'user_input', 'FIREタイプ', '');
  i.fire.targetAge = field(60, 'user_input', 'FIRE希望年齢', '', '歳');
  return i;
}
const run = (i: SimulationInput) => runSimulation(applyRecommendedValues(i));

// 早期に枯渇するケース（負の複利が出やすい）
function depleting(): SimulationInput {
  const i = base();
  i.basic.currentAssets = field(200, 'user_input', '現在資産', '', '万円');
  i.basic.householdIncome = field(300, 'user_input', '世帯年収', '', '万円');
  i.expense.monthlyLiving = field(30, 'user_input', '毎月生活費', '', '万円');
  i.fire.type = field('full', 'user_input', 'FIREタイプ', '');
  i.fire.targetAge = field(45, 'user_input', 'FIRE希望年齢', '', '歳');
  return i;
}

describe('STEP5.1 invariants', () => {
  it('investment return is never negative even when investment is 0/negative-pressure', () => {
    const rows = run(depleting()).rows;
    expect(rows.every((r) => r.investmentReturn >= 0)).toBe(true);
  });

  it('display assets never go below 0; shortfall accumulates after depletion', () => {
    const result = run(depleting());
    expect(result.rows.every((r) => r.endAssets >= 0)).toBe(true);
    expect(result.rows.every((r) => r.debug!.cashAssets >= 0 && r.debug!.investmentAssets >= 0)).toBe(true);
    expect(result.indicators.assetLongevityAge).not.toBeNull();
    expect(result.indicators.cumulativeShortfall).toBeGreaterThan(0);
    expect(result.indicators.assetsAt95).toBe(0);
  });

  it('cumulative shortfall is non-decreasing over the years', () => {
    const rows = run(depleting()).rows;
    let prev = 0;
    for (const r of rows) {
      expect(r.debug!.cumulativeShortfall).toBeGreaterThanOrEqual(prev);
      prev = r.debug!.cumulativeShortfall;
    }
  });

  it('pension: 0 when not entered, applied from 65 when entered', () => {
    const without = run(base());
    expect(without.rows.find((r) => r.age === 66)!.income.pension).toBe(0);
    const i = base();
    i.retirement.pension = field(180, 'user_input', '年金', '', '万円');
    const withp = run(i);
    expect(withp.rows.find((r) => r.age === 64)!.income.pension).toBe(0);
    expect(withp.rows.find((r) => r.age === 66)!.income.pension).toBe(180);
  });

  it('no labor after FIRE; side income stops at workUntilAge; investment keeps running', () => {
    const i = base();
    i.fire.type = field('side', 'user_input', 'FIREタイプ', '');
    i.fire.targetAge = field(55, 'user_input', '希望年齢', '', '歳');
    i.fire.postFireIncome = field(240, 'user_input', 'FIRE後収入', '', '万円');
    i.fire.workUntilAge = field(65, 'user_input', '就労終了', '', '歳');
    const rows = run(i).rows;
    expect(rows.find((r) => r.age === 56)!.income.labor).toBe(0);
    expect(rows.find((r) => r.age === 56)!.income.postFire).toBe(240);
    expect(rows.find((r) => r.age === 66)!.income.postFire).toBe(0);
    // FIRE後も既存投資資産の運用は継続（投資資産が残る限り運用益>0）
    const r70 = rows.find((r) => r.age === 70)!;
    if (r70.debug!.investmentAssets > 0) expect(r70.investmentReturn).toBeGreaterThan(0);
  });

  it('living: normal vs post-FIRE not double counted (single living value per year)', () => {
    const i = base();
    i.fire.type = field('side', 'user_input', 'FIREタイプ', '');
    i.fire.targetAge = field(55, 'user_input', '希望年齢', '', '歳');
    i.fire.postFireLiving = field(240, 'user_input', 'FIRE後生活費', '', '万円');
    const rows = run(i).rows;
    // 60歳(FIRE後・65歳前): 生活費は postFireLiving のみ（通常生活費と合算しない）
    const r60 = rows.find((r) => r.age === 60)!;
    expect(r60.expense.living).toBeCloseTo(240 * Math.pow(1.02, 20), 0);
  });

  it('mortgage payment and home maintenance never both apply in the same year', () => {
    const i = base();
    i.housing.type = field('own', 'user_input', '住まい', '');
    i.housing.monthlyPayment = field(10, 'user_input', '返済額', '', '万円');
    i.housing.remainingYears = field(10, 'user_input', '残年数', '', '年'); // 完済50歳
    const rows = run(i).rows;
    for (const r of rows) {
      const loan = r.expense.housing - r.debug!.homeMaintenanceCost;
      const bothPositive = loan > 0.01 && r.debug!.homeMaintenanceCost > 0.01;
      expect(bothPositive).toBe(false);
    }
  });

  it('monthly investment is not added to total assets (neutral at 0% return)', () => {
    const a = base();
    a.investment.returnRate = field(0, 'user_input', '利回り', '', '%');
    const b = structuredClone(a);
    b.investment.monthlyInvestment = field(10, 'user_input', '毎月投資額', '', '万円');
    expect(run(b).indicators.assetsAt95).toBeCloseTo(run(a).indicators.assetsAt95, 3);
  });

  it('cash & investment never negative; no over-investment in deficit years', () => {
    const i = base();
    i.investment.monthlyInvestment = field(20, 'user_input', '毎月投資額', '', '万円');
    // 教育費ピークで赤字になりやすいよう子ども2人を設定
    i.children = [
      makeChild(10),
      makeChild(8),
    ];
    const rows = run(i).rows;
    for (const r of rows) {
      expect(r.debug!.cashAssets).toBeGreaterThanOrEqual(0);
      expect(r.debug!.investmentAssets).toBeGreaterThanOrEqual(0);
      // 赤字年は新規投資の振替が起きない
      if (r.debug!.annualNetCashflow < 0) expect(r.debug!.actualInvestmentTransfer).toBe(0);
    }
  });

  it('higher cash ratio suppresses long-term growth', () => {
    // 枯渇しない裕福なケースで比較（95歳残資産に差が出るように）
    const wealthy = (cashRatio: number): SimulationInput => {
      const i = base();
      i.basic.currentAssets = field(10000, 'user_input', '現在資産', '', '万円');
      i.retirement.pension = field(240, 'user_input', '年金', '', '万円');
      i.basic.cashRatio = field(cashRatio, 'user_input', '現金比率', '', '%');
      return i;
    };
    expect(run(wealthy(60)).indicators.assetsAt95).toBeLessThan(run(wealthy(20)).indicators.assetsAt95);
  });

  it('higher inflation shortens asset longevity / worsens the outcome', () => {
    const mk = (inf: number) => {
      const i = depleting();
      i.investment.inflationRate = field(inf, 'user_input', 'インフレ率', '', '%');
      return run(i);
    };
    const r0 = mk(0);
    const r4 = mk(4);
    // 4%の方が累計不足額が大きい（結果が悪化）
    expect(r4.indicators.cumulativeShortfall).toBeGreaterThan(r0.indicators.cumulativeShortfall);
  });
});

function makeChild(age: number) {
  return {
    currentAge: field(age, 'user_input', '子の年齢', '', '歳'),
    ageAssumed: false,
    middleSchool: field('private' as const, 'user_input', '中学', ''),
    highSchool: field('private' as const, 'user_input', '高校', ''),
    university: field('private_science' as const, 'user_input', '大学', ''),
    uniLiving: field('away' as const, 'user_input', '住まい', ''),
  };
}
