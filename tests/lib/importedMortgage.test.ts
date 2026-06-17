import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  balanceYenToMan,
  bonusYenToMan,
  monthlyYenToMan,
  readImportedMortgage,
} from '../../src/lib/importedMortgage';

// 住宅ローンシミュレーター（別アプリ）からの取り込み値パーサーの単体テスト。
// jsdom 上で URL と localStorage を都度差し替えて、優先順位・正規化・防御性を確認する。

function setUrl(search: string): void {
  window.history.replaceState({}, '', search ? `/?${search}` : '/');
}

describe('mortgage unit conversion helpers', () => {
  it('monthlyYenToMan keeps 1 decimal', () => {
    expect(monthlyYenToMan(95000)).toBe(9.5);
    expect(monthlyYenToMan(11000)).toBe(1.1);
    expect(monthlyYenToMan(99500)).toBe(10); // 9.95 → 10.0
  });
  it('balanceYenToMan rounds to integer 万円', () => {
    expect(balanceYenToMan(32000000)).toBe(3200);
    expect(balanceYenToMan(0)).toBe(0);
    expect(balanceYenToMan(15800)).toBe(2); // 1.58 → 2
  });
  it('bonusYenToMan rounds to integer 万円', () => {
    expect(bonusYenToMan(0)).toBe(0);
    expect(bonusYenToMan(200000)).toBe(20);
  });
});

describe('readImportedMortgage', () => {
  beforeEach(() => {
    setUrl('');
    localStorage.clear();
  });
  afterEach(() => {
    setUrl('');
    localStorage.clear();
  });

  it('reads URL params with all common fields', () => {
    setUrl(
      'mortgageMonthlyPaymentYen=95000' +
        '&mortgageAnnualPaymentYen=1140000' +
        '&mortgageBalanceYen=32000000' +
        '&mortgageInterestRate=0.925' +
        '&mortgageRemainingYears=30' +
        '&mortgageBonusAnnualYen=0' +
        '&mortgageRepaymentMethod=equalPrincipal' +
        '&mortgageRateType=variable' +
        '&mortgageSource=currentPlan',
    );
    expect(readImportedMortgage()).toEqual({
      monthlyPaymentYen: 95000,
      annualPaymentYen: 1140000,
      balanceYen: 32000000,
      interestRate: 0.925,
      remainingYears: 30,
      bonusAnnualYen: 0,
      repaymentMethod: 'equalPrincipal',
      rateType: 'variable',
      source: 'currentPlan',
      origin: 'url',
    });
  });

  it('treats unknown source string as "unknown" but still imports value', () => {
    setUrl('mortgageMonthlyPaymentYen=95000&mortgageSource=foo');
    expect(readImportedMortgage()).toMatchObject({
      monthlyPaymentYen: 95000,
      source: 'unknown',
      origin: 'url',
    });
  });

  it('treats missing source as "unknown"', () => {
    setUrl('mortgageBalanceYen=32000000');
    expect(readImportedMortgage()).toMatchObject({
      balanceYen: 32000000,
      source: 'unknown',
      origin: 'url',
    });
  });

  it('keeps the URL import even when some individual fields are invalid (only invalid fields are dropped)', () => {
    setUrl(
      'mortgageMonthlyPaymentYen=95000&mortgageInterestRate=abc&mortgageRemainingYears=99&mortgageBalanceYen=32000000',
    );
    const got = readImportedMortgage();
    expect(got).toMatchObject({
      monthlyPaymentYen: 95000,
      balanceYen: 32000000,
      origin: 'url',
    });
    expect(got?.interestRate).toBeUndefined();
    expect(got?.remainingYears).toBeUndefined(); // 99 > 50 で却下
  });

  it('falls back to localStorage when URL has no valid amount field', () => {
    localStorage.setItem(
      'lifePlanLab:mortgage',
      JSON.stringify({
        selectedMonthlyPaymentYen: 95000,
        balanceYen: 32000000,
        interestRate: 0.925,
        remainingYears: 30,
        selectedSource: 'currentPlan',
        repaymentMethod: 'equalPrincipal',
        rateType: 'variable',
        savedAt: '2026-06-17T00:00:00.000Z',
        version: 1,
      }),
    );
    // URL に valid な月額も残高も無いケース
    setUrl('mortgageInterestRate=abc&mortgageRemainingYears=99');
    expect(readImportedMortgage()).toMatchObject({
      monthlyPaymentYen: 95000,
      balanceYen: 32000000,
      origin: 'localStorage',
    });
  });

  it('URL takes priority over localStorage when both are present', () => {
    localStorage.setItem(
      'lifePlanLab:mortgage',
      JSON.stringify({ selectedMonthlyPaymentYen: 80000, balanceYen: 20000000, selectedSource: 'rateAdjusted' }),
    );
    setUrl('mortgageMonthlyPaymentYen=95000&mortgageSource=currentPlan');
    expect(readImportedMortgage()).toMatchObject({
      monthlyPaymentYen: 95000,
      source: 'currentPlan',
      origin: 'url',
    });
  });

  it('returns null when neither URL nor localStorage provides a valid amount', () => {
    expect(readImportedMortgage()).toBeNull();
  });

  it('returns null when URL only has invalid amounts', () => {
    setUrl('mortgageMonthlyPaymentYen=0&mortgageBalanceYen=-100');
    expect(readImportedMortgage()).toBeNull();
  });

  it('returns null when localStorage payload is malformed JSON', () => {
    localStorage.setItem('lifePlanLab:mortgage', 'not json');
    expect(readImportedMortgage()).toBeNull();
  });

  it('drops unknown repaymentMethod / rateType values individually', () => {
    setUrl('mortgageMonthlyPaymentYen=95000&mortgageRepaymentMethod=foo&mortgageRateType=bar');
    const got = readImportedMortgage();
    expect(got?.monthlyPaymentYen).toBe(95000);
    expect(got?.repaymentMethod).toBeUndefined();
    expect(got?.rateType).toBeUndefined();
  });

  it('localStorage payload accepts unknown source but still imports the amount', () => {
    localStorage.setItem(
      'lifePlanLab:mortgage',
      JSON.stringify({ selectedMonthlyPaymentYen: 95000, selectedSource: 'mystery' }),
    );
    expect(readImportedMortgage()).toMatchObject({ monthlyPaymentYen: 95000, source: 'unknown' });
  });

  it('localStorage falls back to top-level monthlyPaymentYen when selectedMonthlyPaymentYen is absent', () => {
    localStorage.setItem(
      'lifePlanLab:mortgage',
      JSON.stringify({ monthlyPaymentYen: 95000, balanceYen: 32000000, selectedSource: 'currentPlan' }),
    );
    expect(readImportedMortgage()).toMatchObject({
      monthlyPaymentYen: 95000,
      balanceYen: 32000000,
      source: 'currentPlan',
    });
  });
});
