import { describe, expect, it } from 'vitest';
import {
  ALLOWED_PARENT_PARAMS,
  appendAllowedParamsToIframeSrc,
} from '../../src/lib/embedParentParams';

// 親 WordPress ページの URL params を iframe src に持ち越すヘルパーの単体テスト。
// docs/EMBED.md の vanilla JS スニペットと完全同一のアルゴリズムを TypeScript で実装しており、
// ここで動作を担保することで、EMBED.md の最小実装がそのままコピペで動くことを示す。

const BASE = 'https://example.com/life-plan-lab/';

describe('appendAllowedParamsToIframeSrc', () => {
  it('passes through livingCostMonthly and livingCostSource', () => {
    const got = appendAllowedParamsToIframeSrc(
      BASE,
      '?livingCostMonthly=297000&livingCostSource=categoryScenario',
    );
    expect(got).toBe(
      'https://example.com/life-plan-lab/?livingCostMonthly=297000&livingCostSource=categoryScenario',
    );
  });

  it('passes through mortgage parameters as a group', () => {
    const got = appendAllowedParamsToIframeSrc(
      BASE,
      '?mortgageMonthlyPaymentYen=95000&mortgageBalanceYen=32000000&mortgageInterestRate=0.925&mortgageRemainingYears=30&mortgageSource=currentPlan',
    );
    expect(got).toContain('mortgageMonthlyPaymentYen=95000');
    expect(got).toContain('mortgageBalanceYen=32000000');
    expect(got).toContain('mortgageInterestRate=0.925');
    expect(got).toContain('mortgageRemainingYears=30');
    expect(got).toContain('mortgageSource=currentPlan');
  });

  it('drops disallowed parameters silently', () => {
    const got = appendAllowedParamsToIframeSrc(
      BASE,
      '?foo=bar&livingCostMonthly=297000&utm_source=newsletter',
    );
    expect(got).toBe('https://example.com/life-plan-lab/?livingCostMonthly=297000');
    expect(got).not.toContain('foo');
    expect(got).not.toContain('utm_source');
  });

  it('returns the base unchanged when parent search is empty', () => {
    expect(appendAllowedParamsToIframeSrc(BASE, '')).toBe(BASE);
  });

  it('returns the base unchanged when parent search has only disallowed params', () => {
    expect(appendAllowedParamsToIframeSrc(BASE, '?foo=bar&baz=qux')).toBe(BASE);
  });

  it('joins with & when the base already has a query string', () => {
    const base = 'https://example.com/life-plan-lab/?mode=rough';
    const got = appendAllowedParamsToIframeSrc(base, '?livingCostMonthly=297000');
    expect(got).toBe(
      'https://example.com/life-plan-lab/?mode=rough&livingCostMonthly=297000',
    );
  });

  it('ignores empty string values for allowed keys', () => {
    expect(
      appendAllowedParamsToIframeSrc(BASE, '?livingCostMonthly=&livingCostSource=categoryScenario'),
    ).toBe('https://example.com/life-plan-lab/?livingCostSource=categoryScenario');
  });

  it('preserves the order from the allow list (deterministic)', () => {
    const got = appendAllowedParamsToIframeSrc(
      BASE,
      '?mortgageRateType=variable&livingCostMonthly=297000&mortgageMonthlyPaymentYen=95000',
    );
    // ALLOWED_PARENT_PARAMS の順序: livingCostMonthly → mortgageMonthlyPaymentYen → ... → mortgageRateType
    const idxLiving = got.indexOf('livingCostMonthly');
    const idxMortgage = got.indexOf('mortgageMonthlyPaymentYen');
    const idxRateType = got.indexOf('mortgageRateType');
    expect(idxLiving).toBeGreaterThan(0);
    expect(idxLiving).toBeLessThan(idxMortgage);
    expect(idxMortgage).toBeLessThan(idxRateType);
  });

  it('exposes a stable allowlist of 11 keys', () => {
    expect(ALLOWED_PARENT_PARAMS).toContain('livingCostMonthly');
    expect(ALLOWED_PARENT_PARAMS).toContain('livingCostSource');
    expect(ALLOWED_PARENT_PARAMS).toContain('mortgageMonthlyPaymentYen');
    expect(ALLOWED_PARENT_PARAMS).toContain('mortgageRateType');
    expect(ALLOWED_PARENT_PARAMS.length).toBe(11);
  });
});
