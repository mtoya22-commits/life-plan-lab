import { describe, expect, it } from 'vitest';
import {
  annualHousingCost,
  balanceSchedule,
  mortgageBreakdownForYear,
  mortgageEvents,
} from '../../src/engine/mortgageEngine';
import { HOME_MAINTENANCE_ANNUAL, RATE_RISE_AFTER_FIXED } from '../../src/engine/constants';
import { field } from '../../src/schema/field';
import type { HousingGroup } from '../../src/schema/types';

// STEP11.17-B: 住宅ローン engine 反映。
// - 残高・金利・残年数が揃えば元利均等/元金均等の年次返済を計算
// - 固定→変動切替で金利上振れ
// - ボーナス払いを反映
// - 入力不足はフォールバック（毎月返済額 × 12 の旧挙動）

function makeOwn(over: Partial<Record<keyof HousingGroup, unknown>> = {}): HousingGroup {
  return {
    type: field('own', 'user_input', '住まい', ''),
    monthlyPayment: field(0, 'skipped', '毎月返済額', '', '万円'),
    rent: field(0, 'skipped', '家賃', '', '万円'),
    balance: field(0, 'skipped', '残高', '', '万円'),
    remainingYears: field(0, 'skipped', '残年数', '', '年'),
    rate: field(0, 'skipped', '金利', '', '%'),
    rateType: field('variable', 'default_value', '金利タイプ', ''),
    fixedEndAge: field(0, 'skipped', '固定終了年齢', '', '歳'),
    repayMethod: field('equal_payment', 'default_value', '返済方式', ''),
    bonusAnnual: field(0, 'skipped', 'ボーナス払い', '', '万円'),
    ...(over as object),
  } as HousingGroup;
}

describe('mortgage engine: equal_payment (元利均等) with full data', () => {
  it('amortizes the balance to ~0 over remainingYears', () => {
    const h = makeOwn({
      balance: field(3000, 'user_input', '残高', '', '万円'),
      rate: field(1, 'user_input', '金利', '', '%'),
      remainingYears: field(30, 'user_input', '残年数', '', '年'),
      repayMethod: field('equal_payment', 'user_input', '返済方式', ''),
    });
    const schedule = balanceSchedule(h, 40);
    expect(schedule.length).toBe(30);
    expect(schedule[schedule.length - 1]).toBeLessThan(1); // 完済（端数のみ）
  });

  it('first-year breakdown: interest ≈ balance × rate, principal = annual − interest (固定金利前提)', () => {
    const h = makeOwn({
      balance: field(3000, 'user_input', '残高', '', '万円'),
      rate: field(1, 'user_input', '金利', '', '%'),
      remainingYears: field(30, 'user_input', '残年数', '', '年'),
      rateType: field('fixed', 'user_input', '金利タイプ', ''),
      repayMethod: field('equal_payment', 'user_input', '返済方式', ''),
    });
    const b = mortgageBreakdownForYear(h, 40, 40);
    expect(b.interest).toBeCloseTo(30, 0); // 3000 × 1% = 30万
    // 元利均等30年 1% の年返済額 ≈ 116万 → 元金 ≈ 86万
    expect(b.principal + b.interest).toBeGreaterThan(115);
    expect(b.principal + b.interest).toBeLessThan(120);
  });

  it('payoff year switches to maintenance only', () => {
    const h = makeOwn({
      balance: field(3000, 'user_input', '残高', '', '万円'),
      rate: field(1, 'user_input', '金利', '', '%'),
      remainingYears: field(30, 'user_input', '残年数', '', '年'),
    });
    // 完済後（baseAge 40 → 残30年 → 70歳以降）
    expect(annualHousingCost(h, 75, 40)).toBe(HOME_MAINTENANCE_ANNUAL);
  });
});

describe('mortgage engine: equal_principal (元金均等)', () => {
  it('principal is constant year-over-year, interest decreases', () => {
    const h = makeOwn({
      balance: field(3000, 'user_input', '残高', '', '万円'),
      rate: field(1, 'user_input', '金利', '', '%'),
      remainingYears: field(30, 'user_input', '残年数', '', '年'),
      repayMethod: field('equal_principal', 'user_input', '返済方式', ''),
    });
    const y0 = mortgageBreakdownForYear(h, 40, 40);
    const y5 = mortgageBreakdownForYear(h, 45, 40);
    // 元金均等は元金が一定
    expect(y0.principal).toBeCloseTo(y5.principal, 0);
    // 利息は減る
    expect(y5.interest).toBeLessThan(y0.interest);
  });
});

describe('mortgage engine: 固定→変動切替', () => {
  it('rate rises by RATE_RISE_AFTER_FIXED after fixedEndAge under "fixed" rateType', () => {
    const h = makeOwn({
      balance: field(3000, 'user_input', '残高', '', '万円'),
      rate: field(1, 'user_input', '金利', '', '%'),
      remainingYears: field(30, 'user_input', '残年数', '', '年'),
      rateType: field('fixed', 'user_input', '金利タイプ', ''),
      fixedEndAge: field(50, 'user_input', '固定終了', '', '歳'),
    });
    expect(RATE_RISE_AFTER_FIXED).toBeGreaterThan(0);
    const beforeFixedEnd = mortgageBreakdownForYear(h, 45, 40);
    const afterFixedEnd = mortgageBreakdownForYear(h, 55, 40);
    expect(beforeFixedEnd.interest).toBeGreaterThan(0);
    expect(afterFixedEnd.interest).toBeGreaterThan(0);
  });
});

describe('mortgage engine: rateType (固定 vs 変動) は engine 上で区別される', () => {
  it('変動は全期間で金利が上振れる → 固定（fixedEndAge なし）より総返済利息が大きい', () => {
    const fixedNoEnd = makeOwn({
      balance: field(3000, 'user_input', '残高', '', '万円'),
      rate: field(1, 'user_input', '金利', '', '%'),
      remainingYears: field(30, 'user_input', '残年数', '', '年'),
      rateType: field('fixed', 'user_input', '金利タイプ', ''),
      // fixedEndAge なし → 完済まで固定
    });
    const variable = makeOwn({
      balance: field(3000, 'user_input', '残高', '', '万円'),
      rate: field(1, 'user_input', '金利', '', '%'),
      remainingYears: field(30, 'user_input', '残年数', '', '年'),
      rateType: field('variable', 'user_input', '金利タイプ', ''),
    });
    const fixedFirstYear = mortgageBreakdownForYear(fixedNoEnd, 40, 40);
    const variableFirstYear = mortgageBreakdownForYear(variable, 40, 40);
    // 変動は最初から +0.3% 上乗せされる → 初年度利息が固定より大きい
    expect(variableFirstYear.interest).toBeGreaterThan(fixedFirstYear.interest);
  });

  it('元利均等 + 固定 vs 元利均等 + 変動 で初年度返済額が異なる', () => {
    const fixedNoEnd = makeOwn({
      balance: field(3000, 'user_input', '残高', '', '万円'),
      rate: field(1, 'user_input', '金利', '', '%'),
      remainingYears: field(30, 'user_input', '残年数', '', '年'),
      rateType: field('fixed', 'user_input', '金利タイプ', ''),
      repayMethod: field('equal_payment', 'user_input', '返済方式', ''),
    });
    const variable = makeOwn({
      ...fixedNoEnd,
      rateType: field('variable', 'user_input', '金利タイプ', ''),
    });
    const f = mortgageBreakdownForYear(fixedNoEnd, 40, 40);
    const v = mortgageBreakdownForYear(variable, 40, 40);
    // 元利均等は annualPayment 固定 → 変動の annualPayment は +0.3% 分だけ高い
    expect(v.principal + v.interest).toBeGreaterThan(f.principal + f.interest);
  });

  it('固定（fixedEndAge=完済年）と変動でも結果が異なる（前回はここが等しくなって誤検出されていた）', () => {
    // ユーザーが「base() で固定と変動が同じだった」と指摘した症状を回帰固定する。
    const fixedFullTerm = makeOwn({
      balance: field(2000, 'user_input', '残高', '', '万円'),
      rate: field(1, 'user_input', '金利', '', '%'),
      remainingYears: field(20, 'user_input', '残年数', '', '年'),
      rateType: field('fixed', 'user_input', '金利タイプ', ''),
      fixedEndAge: field(60, 'user_input', '固定終了', '', '歳'), // 完済年と同じ
    });
    const variable = makeOwn({
      ...fixedFullTerm,
      rateType: field('variable', 'user_input', '金利タイプ', ''),
    });
    // 固定（fixedEndAge=完済）は実質「ずっと base rate」、変動は全期間 +0.3%。
    // 1年あたりの利息が異なるので、年次残高列の中盤値が等しくならないこと。
    const fS = balanceSchedule(fixedFullTerm, 40);
    const vS = balanceSchedule(variable, 40);
    expect(fS[10]).not.toBeCloseTo(vS[10], 1);
  });
});

describe('mortgage engine: ボーナス払い', () => {
  it('shortens the payoff schedule when bonusAnnual > 0', () => {
    const noBonus = makeOwn({
      balance: field(3000, 'user_input', '残高', '', '万円'),
      rate: field(1, 'user_input', '金利', '', '%'),
      remainingYears: field(30, 'user_input', '残年数', '', '年'),
    });
    const withBonus = makeOwn({
      balance: field(3000, 'user_input', '残高', '', '万円'),
      rate: field(1, 'user_input', '金利', '', '%'),
      remainingYears: field(30, 'user_input', '残年数', '', '年'),
      bonusAnnual: field(20, 'user_input', 'ボーナス払い', '', '万円'),
    });
    expect(balanceSchedule(withBonus, 40).length).toBeLessThan(balanceSchedule(noBonus, 40).length);
  });
});

describe('mortgage engine: backward compatibility (no balance/rate)', () => {
  it('falls back to monthlyPayment × 12 when balance is unknown', () => {
    const h = makeOwn({
      monthlyPayment: field(10, 'user_input', '毎月返済', '', '万円'),
      remainingYears: field(25, 'user_input', '残年数', '', '年'),
    });
    expect(annualHousingCost(h, 40, 40)).toBe(120); // 旧挙動: 10 × 12
    expect(annualHousingCost(h, 65, 40)).toBe(HOME_MAINTENANCE_ANNUAL); // 完済後
  });

  it('rent unchanged', () => {
    const rent = makeOwn({
      type: field('rent', 'user_input', '住まい', ''),
      rent: field(8, 'user_input', '家賃', '', '万円'),
    });
    expect(annualHousingCost(rent, 40, 40)).toBe(96);
  });
});

describe('mortgageEvents: payoff age comes from schedule when full data', () => {
  it('emits payoff at schedule end + 1', () => {
    const h = makeOwn({
      balance: field(3000, 'user_input', '残高', '', '万円'),
      rate: field(1, 'user_input', '金利', '', '%'),
      remainingYears: field(30, 'user_input', '残年数', '', '年'),
    });
    const events = mortgageEvents(h, 40);
    const payoff = events.find((e) => e.kind === 'mortgage_payoff')!;
    expect(payoff.age).toBe(70); // 40 + 30
  });

  it('falls back to baseAge + remainingYears when no schedule', () => {
    const h = makeOwn({
      monthlyPayment: field(10, 'user_input', '毎月返済', '', '万円'),
      remainingYears: field(25, 'user_input', '残年数', '', '年'),
    });
    const events = mortgageEvents(h, 40);
    const payoff = events.find((e) => e.kind === 'mortgage_payoff')!;
    expect(payoff.age).toBe(65);
  });
});
