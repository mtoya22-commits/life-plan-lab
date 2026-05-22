import { describe, expect, it } from 'vitest';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import { field } from '../../src/schema/field';
import type { LifeEvent, SimulationInput } from '../../src/schema/types';

// STEP5: 捕捉項目が年次シミュレーションへ反映されることの確認。
// base は createDefaultInput ベース。run() で実際の送信と同じく applyRecommendedValues を通す。
function base(): SimulationInput {
  const i = createDefaultInput('thorough');
  i.basic.age = field(40, 'user_input', '本人年齢', '', '歳');
  i.basic.currentAssets = field(3000, 'user_input', '現在資産', '', '万円');
  i.basic.householdIncome = field(1200, 'user_input', '世帯年収', '', '万円');
  i.income.raiseRate = field(0, 'user_input', '昇給率', '', '%'); // 計算を簡単にするため0
  i.investment.returnRate = field(5, 'user_input', '想定利回り', '', '%');
  i.fire.type = field('full', 'user_input', 'FIREタイプ', '');
  i.fire.targetAge = field(60, 'user_input', 'FIRE希望年齢', '', '歳');
  return i;
}
const run = (i: SimulationInput) => runSimulation(applyRecommendedValues(i));
const at = (i: SimulationInput, age: number) => run(i).rows.find((r) => r.age === age)!;

describe('STEP5 reflection', () => {
  it('1. take-home: uses direct take-home income when entered', () => {
    const i = base();
    i.basic.takeHomeIncome = field(700, 'user_input', '手取り年収', '', '万円');
    expect(at(i, 40).income.labor).toBeCloseTo(700, 5);
    expect(run(i).notes.some((n) => n.includes('手取り年収を直接使用'))).toBe(true);
  });

  it('2. take-home: splits spouse income with per-band rates', () => {
    const i = base();
    i.income.selfIncome = field(600, 'user_input', '本人収入', '', '万円');
    i.income.spouseIncome = field(600, 'user_input', '配偶者収入', '', '万円');
    // 600万は78%帯 → 468 + 468 = 936（世帯1200の72%=864 と異なる）
    expect(at(i, 40).income.labor).toBeCloseTo(936, 0);
    expect(run(i).notes.some((n) => n.includes('夫婦別収入から手取り'))).toBe(true);
  });

  it('3. take-home: estimates from household income otherwise', () => {
    const i = base(); // householdIncome 1200 → 72%
    expect(at(i, 40).income.labor).toBeCloseTo(864, 0);
    expect(run(i).notes.some((n) => n.includes('世帯年収から簡易'))).toBe(true);
  });

  it('4. monthly investment is NOT added to cashflow (neutral at 0% return)', () => {
    const a = base();
    a.investment.returnRate = field(0, 'user_input', '想定利回り', '', '%');
    const b = structuredClone(a);
    b.investment.monthlyInvestment = field(10, 'user_input', '毎月投資額', '', '万円');
    // 利回り0なら、毎月投資額は現金↔投資の振替に過ぎず総資産に影響しない
    expect(run(b).indicators.assetsAt95).toBeCloseTo(run(a).indicators.assetsAt95, 3);
  });

  it('5. cash ratio: only the investment portion earns return', () => {
    const allCash = base();
    allCash.basic.cashRatio = field(100, 'user_input', '現金比率', '', '%');
    const allInvest = base();
    allInvest.basic.cashRatio = field(0, 'user_input', '現金比率', '', '%');
    expect(run(allInvest).indicators.assetsAt95).toBeGreaterThan(run(allCash).indicators.assetsAt95);
  });

  it('6. owned home keeps maintenance after the loan is paid off', () => {
    const i = base();
    i.housing.type = field('own', 'user_input', '住まい', '');
    i.housing.monthlyPayment = field(10, 'user_input', '毎月返済額', '', '万円');
    i.housing.remainingYears = field(10, 'user_input', '残年数', '', '年'); // 完済は50歳
    expect(at(i, 45).expense.housing).toBeCloseTo(120, 5); // 返済中
    expect(at(i, 55).expense.housing).toBe(60); // 完済後は維持費
  });

  it('7. pension is added from age 65 when entered', () => {
    const i = base();
    i.retirement.pension = field(180, 'user_input', '年金見込み', '', '万円');
    expect(at(i, 64).income.pension).toBe(0);
    expect(at(i, 66).income.pension).toBe(180);
  });

  it('8. retirement lump sum is a one-time income at FIRE/retirement age', () => {
    const i = base(); // fire full, targetAge 60 → fireStartAge 60
    i.income.retirementLumpSum = field(500, 'user_input', '退職金', '', '万円');
    expect(at(i, 60).income.other).toBe(500);
    expect(at(i, 61).income.other).toBe(0);
  });

  it('9. medical/care reserve adds late-life expense', () => {
    const i = base();
    i.retirement.medicalCareReserve = field(true, 'user_input', '医療介護予備費', '');
    expect(at(i, 74).expense.retirementExtra).toBe(0);
    expect(at(i, 76).expense.retirementExtra).toBeGreaterThan(0);
  });

  it('10. life events apply at the given age (cost and inheritance inflow)', () => {
    const i = base();
    const reform: LifeEvent = {
      id: 'reform',
      label: field('リフォーム', 'user_input', 'リフォーム', ''),
      atAge: field(50, 'user_input', '年齢', '', '歳'),
      amount: field(300, 'user_input', '金額', '', '万円'),
    };
    const inherit: LifeEvent = {
      id: 'inherit',
      label: field('相続', 'user_input', '相続', ''),
      atAge: field(70, 'user_input', '年齢', '', '歳'),
      amount: field(-500, 'user_input', '金額', '', '万円'),
    };
    i.lifeEvents = [reform, inherit];
    expect(at(i, 50).expense.special).toBeGreaterThanOrEqual(300);
    expect(at(i, 70).income.other).toBe(500);
  });

  it('11+12. no labor after FIRE; side income stops at workUntilAge', () => {
    const i = base();
    i.fire.type = field('side', 'user_input', 'FIREタイプ', '');
    i.fire.targetAge = field(55, 'user_input', 'FIRE希望年齢', '', '歳');
    i.fire.postFireIncome = field(240, 'user_input', 'FIRE後収入', '', '万円');
    i.fire.workUntilAge = field(65, 'user_input', '就労終了', '', '歳');
    expect(at(i, 56).income.labor).toBe(0);
    expect(at(i, 56).income.postFire).toBe(240);
    expect(at(i, 66).income.postFire).toBe(0);
  });
});
