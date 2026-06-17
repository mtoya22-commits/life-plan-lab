import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useInputStore } from '../../src/store/inputStore';

// 住宅ローン取り込みの店内挙動（パースして state に流す部分）。
// 生活費取り込みと同じ思想で、URL > localStorage、手動編集後の自動上書き抑止、
// URL 起動時のリセット強制適用、ざっくり→深掘りでの再適用を確認する。

const store = () => useInputStore.getState();

function setUrl(search: string): void {
  window.history.replaceState({}, '', search ? `/?${search}` : '/');
}
function clearImports(): void {
  useInputStore.setState({
    importedLivingCost: null,
    livingCostManuallyEdited: false,
    importedMortgage: null,
    mortgageManuallyEdited: false,
  });
}

describe('imported mortgage integration', () => {
  beforeEach(() => {
    setUrl('');
    localStorage.clear();
    store().reset();
    clearImports();
  });
  afterEach(() => {
    setUrl('');
    localStorage.clear();
    clearImports();
  });

  it('initializeImportedMortgage applies URL value to a fresh rough draft', () => {
    setUrl(
      'mortgageMonthlyPaymentYen=95000' +
        '&mortgageBalanceYen=32000000' +
        '&mortgageInterestRate=0.925' +
        '&mortgageRemainingYears=30' +
        '&mortgageSource=currentPlan',
    );
    store().initializeImportedMortgage();

    expect(store().importedMortgage).toMatchObject({
      monthlyPaymentYen: 95000,
      balanceYen: 32000000,
      interestRate: 0.925,
      remainingYears: 30,
      source: 'currentPlan',
      origin: 'url',
    });
    // ざっくり側に反映できるのは housing / monthlyHousing / loanYears のみ
    expect(store().roughDraft.housing).toEqual({ value: 'own', source: 'user_input' });
    expect(store().roughDraft.monthlyHousing).toEqual({ value: 9.5, source: 'user_input' });
    expect(store().roughDraft.loanYears).toEqual({ value: 30, source: 'user_input' });
  });

  it('setMode("thorough") applies imported mortgage to fresh thoroughInput with proper unit conversion', () => {
    setUrl(
      'mortgageMonthlyPaymentYen=95000' +
        '&mortgageBalanceYen=32000000' +
        '&mortgageInterestRate=0.925' +
        '&mortgageRemainingYears=30' +
        '&mortgageBonusAnnualYen=200000' +
        '&mortgageRepaymentMethod=equalPrincipal' +
        '&mortgageRateType=variable' +
        '&mortgageSource=currentPlan',
    );
    store().initializeImportedMortgage();

    store().setMode('thorough');
    const h = store().thoroughInput!.housing;
    expect(h.type.value).toBe('own');
    expect(h.monthlyPayment.value).toBe(9.5);
    expect(h.balance.value).toBe(3200);
    expect(h.rate.value).toBe(0.925);
    expect(h.remainingYears.value).toBe(30);
    expect(h.bonusAnnual.value).toBe(20);
    expect(h.repayMethod.value).toBe('equal_principal');
    expect(h.rateType.value).toBe('variable');
    expect(h.type.source).toBe('user_input');
    expect(h.monthlyPayment.source).toBe('user_input');
  });

  it('maps fixedPeriod rate type to plain fixed', () => {
    setUrl('mortgageMonthlyPaymentYen=95000&mortgageRateType=fixedPeriod');
    store().initializeImportedMortgage();
    store().setMode('thorough');
    expect(store().thoroughInput!.housing.rateType.value).toBe('fixed');
  });

  it('falls back to localStorage when URL is absent', () => {
    localStorage.setItem(
      'lifePlanLab:mortgage',
      JSON.stringify({
        selectedMonthlyPaymentYen: 80000,
        balanceYen: 20000000,
        interestRate: 1.2,
        remainingYears: 25,
        selectedSource: 'rateAdjusted',
        repaymentMethod: 'equalPayment',
        rateType: 'fixed',
      }),
    );
    store().initializeImportedMortgage();
    expect(store().importedMortgage?.source).toBe('rateAdjusted');
    expect(store().roughDraft.monthlyHousing.value).toBe(8);
    expect(store().roughDraft.loanYears.value).toBe(25);
  });

  it('URL beats localStorage when both are present', () => {
    localStorage.setItem(
      'lifePlanLab:mortgage',
      JSON.stringify({ selectedMonthlyPaymentYen: 80000, balanceYen: 20000000, selectedSource: 'rateAdjusted' }),
    );
    setUrl('mortgageMonthlyPaymentYen=95000&mortgageSource=currentPlan');
    store().initializeImportedMortgage();
    expect(store().importedMortgage?.source).toBe('currentPlan');
    expect(store().roughDraft.monthlyHousing.value).toBe(9.5);
  });

  it('flips mortgageManuallyEdited when user edits any housing-related rough field', () => {
    store().setMode('rough');
    store().setRoughValue('monthlyHousing', 12);
    expect(store().mortgageManuallyEdited).toBe(true);

    clearImports();
    store().setRoughValue('loanYears', 25);
    expect(store().mortgageManuallyEdited).toBe(true);

    clearImports();
    store().setRoughValue('housing', 'rent');
    expect(store().mortgageManuallyEdited).toBe(true);
  });

  it('flips mortgageManuallyEdited when user edits any housing.* thorough path', () => {
    store().setMode('thorough');
    store().setThoroughValue('housing.balance', 1500);
    expect(store().mortgageManuallyEdited).toBe(true);

    clearImports();
    store().setThoroughValue('housing.rate', 1.5);
    expect(store().mortgageManuallyEdited).toBe(true);
  });

  it('does NOT cross-pollute living-cost and mortgage flags', () => {
    store().setMode('rough');
    store().setRoughValue('monthlyLiving', 28);
    expect(store().livingCostManuallyEdited).toBe(true);
    expect(store().mortgageManuallyEdited).toBe(false);

    clearImports();
    store().setRoughValue('monthlyHousing', 12);
    expect(store().mortgageManuallyEdited).toBe(true);
    expect(store().livingCostManuallyEdited).toBe(false);
  });

  it('localStorage import is skipped when mortgageManuallyEdited is true (but importedMortgage is still set for the banner)', () => {
    useInputStore.setState({ mortgageManuallyEdited: true });
    localStorage.setItem(
      'lifePlanLab:mortgage',
      JSON.stringify({ selectedMonthlyPaymentYen: 95000, balanceYen: 32000000, selectedSource: 'currentPlan' }),
    );
    const before = store().roughDraft.monthlyHousing;
    store().initializeImportedMortgage();
    expect(store().importedMortgage?.monthlyPaymentYen).toBe(95000);
    expect(store().mortgageManuallyEdited).toBe(true);
    expect(store().roughDraft.monthlyHousing).toEqual(before);
  });

  it('URL import resets mortgageManuallyEdited and forces apply', () => {
    useInputStore.setState({ mortgageManuallyEdited: true });
    setUrl('mortgageMonthlyPaymentYen=95000&mortgageSource=currentPlan');
    store().initializeImportedMortgage();
    expect(store().mortgageManuallyEdited).toBe(false);
    expect(store().roughDraft.monthlyHousing.value).toBe(9.5);
  });

  it('reset clears both flag and importedMortgage (full fresh start)', () => {
    setUrl('mortgageMonthlyPaymentYen=95000');
    store().initializeImportedMortgage();
    store().setMode('rough');
    store().setRoughValue('monthlyHousing', 12);
    expect(store().mortgageManuallyEdited).toBe(true);

    store().reset();
    expect(store().mortgageManuallyEdited).toBe(false);
    expect(store().importedMortgage).toBeNull();
  });

  it('deepenToThorough re-applies imported mortgage details that rough mode could not hold', () => {
    setUrl(
      'mortgageMonthlyPaymentYen=95000' +
        '&mortgageBalanceYen=32000000' +
        '&mortgageInterestRate=0.925' +
        '&mortgageRemainingYears=30' +
        '&mortgageBonusAnnualYen=300000' +
        '&mortgageSource=currentPlan',
    );
    store().initializeImportedMortgage();
    store().setMode('rough');
    // ざっくり側で必要な質問だけ埋めて submit。
    store().setRoughValue('age', 38);
    store().setRoughValue('householdIncome', 850);
    store().setRoughValue('currentAssets', 1200);
    store().setRoughValue('childrenCount', '0');
    store().setRoughValue('educationPolicy', 'public');
    store().setRoughValue('workStyle', 'work_a_little');
    store().setRoughValue('reduceWorkAge', 55);
    store().setRoughValue('investmentStyle', 'balanced');
    store().submitRough();

    store().deepenToThorough();
    const h = store().thoroughInput!.housing;
    expect(h.balance.value).toBe(3200);
    expect(h.rate.value).toBe(0.925);
    expect(h.bonusAnnual.value).toBe(30);
    expect(h.monthlyPayment.value).toBe(9.5);
  });

  it('does nothing when neither URL nor localStorage provides a mortgage', () => {
    store().initializeImportedMortgage();
    expect(store().importedMortgage).toBeNull();
    expect(store().mortgageManuallyEdited).toBe(false);
  });
});
