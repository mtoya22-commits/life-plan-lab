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

  it('first-year breakdown: interest ≈ balance × rate, principal = annual − interest', () => {
    const h = makeOwn({
      balance: field(3000, 'user_input', '残高', '', '万円'),
      rate: field(1, 'user_input', '金利', '', '%'),
      remainingYears: field(30, 'user_input', '残年数', '', '年'),
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
    const beforeFixedEnd = mortgageBreakdownForYear(h, 45, 40);
    const afterFixedEnd = mortgageBreakdownForYear(h, 55, 40);
    // 固定終了後は利息率が高くなる → 同じ残高水準でも利息額が変わる
    // 残高は同じではないが、適用利率の差は確実に出る
    expect(RATE_RISE_AFTER_FIXED).toBeGreaterThan(0);
    // 簡易: 固定終了直前と直後の利息率の差を年金利で見るのは難しいので、
    // テストとしては「固定終了が動作する＝残高フローに差が出る」を確認する。
    const flat = makeOwn({
      balance: field(3000, 'user_input', '残高', '', '万円'),
      rate: field(1, 'user_input', '金利', '', '%'),
      remainingYears: field(30, 'user_input', '残年数', '', '年'),
      rateType: field('variable', 'user_input', '金利タイプ', ''),
    });
    const flatSched = balanceSchedule(flat, 40);
    const fixedSched = balanceSchedule(h, 40);
    // 固定終了後に金利が上がるので、同年での残高は固定終了モデルの方が "やや高め残" になる
    expect(fixedSched[20]).toBeGreaterThan(flatSched[20]);
    expect(beforeFixedEnd.interest).toBeGreaterThan(0);
    expect(afterFixedEnd.interest).toBeGreaterThan(0);
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
