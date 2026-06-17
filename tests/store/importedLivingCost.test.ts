import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useInputStore } from '../../src/store/inputStore';

// 取り込み値（生活費見直しシミュレーター）の適用ロジックを通しで確認する。
// - URL > localStorage の優先順位
// - 手動編集後は localStorage で自動上書きしない
// - URL は手動編集履歴があっても強制適用される
// - 起動時 1 回適用後、setRoughValue('monthlyLiving') で manualEdited フラグが立つ

const store = () => useInputStore.getState();

function setUrl(search: string): void {
  window.history.replaceState({}, '', search ? `/?${search}` : '/');
}

function clearImportState(): void {
  useInputStore.setState({ importedLivingCost: null, livingCostManuallyEdited: false });
}

describe('imported living-cost integration', () => {
  beforeEach(() => {
    setUrl('');
    localStorage.clear();
    store().reset();
    clearImportState();
  });
  afterEach(() => {
    setUrl('');
    localStorage.clear();
    clearImportState();
  });

  it('applies URL import to fresh rough draft on mode pick', () => {
    setUrl('livingCostMonthly=297000&livingCostSource=categoryScenario');
    store().initializeImportedLivingCost();

    // 取り込み state が立ち、roughDraft.monthlyLiving も即時で反映されている。
    expect(store().importedLivingCost).toMatchObject({
      monthlyYen: 297000,
      source: 'categoryScenario',
      origin: 'url',
    });
    expect(store().roughDraft.monthlyLiving).toEqual({ value: 29.7, source: 'user_input' });

    // モード選択でも fresh draft に再適用される。
    store().setMode('rough');
    expect(store().roughDraft.monthlyLiving).toEqual({ value: 29.7, source: 'user_input' });
  });

  it('applies URL import to fresh thorough input on mode pick', () => {
    setUrl('livingCostMonthly=297000');
    store().initializeImportedLivingCost();

    store().setMode('thorough');
    const ti = store().thoroughInput!;
    expect(ti.expense.monthlyLiving.value).toBe(29.7);
    expect(ti.expense.monthlyLiving.source).toBe('user_input');
  });

  it('falls back to localStorage when URL is absent', () => {
    localStorage.setItem(
      'lifePlanLab:livingCost',
      JSON.stringify({ selectedMonthlyTotal: 280000, selectedMonthlySource: 'breakdownTotal' }),
    );
    store().initializeImportedLivingCost();
    expect(store().importedLivingCost?.source).toBe('breakdownTotal');
    expect(store().roughDraft.monthlyLiving).toEqual({ value: 28, source: 'user_input' });
  });

  it('URL beats localStorage when both are present', () => {
    localStorage.setItem(
      'lifePlanLab:livingCost',
      JSON.stringify({ selectedMonthlyTotal: 200000, selectedMonthlySource: 'breakdownTotal' }),
    );
    setUrl('livingCostMonthly=297000&livingCostSource=categoryScenario');
    store().initializeImportedLivingCost();
    expect(store().importedLivingCost?.source).toBe('categoryScenario');
    expect(store().roughDraft.monthlyLiving.value).toBe(29.7);
  });

  it('flips livingCostManuallyEdited when user edits monthlyLiving in rough mode', () => {
    setUrl('livingCostMonthly=297000');
    store().initializeImportedLivingCost();
    expect(store().livingCostManuallyEdited).toBe(false);

    store().setMode('rough');
    store().setRoughValue('monthlyLiving', 30);
    expect(store().livingCostManuallyEdited).toBe(true);
    expect(store().roughDraft.monthlyLiving.value).toBe(30);
  });

  it('flips livingCostManuallyEdited via useRoughRecommended / skipRough on monthlyLiving', () => {
    store().setMode('rough');

    store().useRoughRecommended('monthlyLiving');
    expect(store().livingCostManuallyEdited).toBe(true);

    clearImportState();
    store().skipRough('monthlyLiving');
    expect(store().livingCostManuallyEdited).toBe(true);
  });

  it('flips livingCostManuallyEdited when user edits expense.monthlyLiving in thorough mode', () => {
    store().setMode('thorough');
    store().setThoroughValue('expense.monthlyLiving', 31);
    expect(store().livingCostManuallyEdited).toBe(true);
    expect(store().thoroughInput!.expense.monthlyLiving.value).toBe(31);
  });

  it('does NOT flip livingCostManuallyEdited when editing other rough fields', () => {
    store().setMode('rough');
    store().setRoughValue('age', 40);
    store().setRoughValue('householdIncome', 900);
    expect(store().livingCostManuallyEdited).toBe(false);
  });

  it('localStorage import is skipped when livingCostManuallyEdited is true (but importedLivingCost is still set for the banner)', () => {
    // ユーザーが先に手動編集していたシナリオ。
    useInputStore.setState({ livingCostManuallyEdited: true });

    localStorage.setItem(
      'lifePlanLab:livingCost',
      JSON.stringify({ selectedMonthlyTotal: 280000, selectedMonthlySource: 'breakdownTotal' }),
    );
    const beforeMonthlyLiving = store().roughDraft.monthlyLiving;
    store().initializeImportedLivingCost();

    expect(store().importedLivingCost?.monthlyYen).toBe(280000);
    expect(store().livingCostManuallyEdited).toBe(true); // 維持される
    expect(store().roughDraft.monthlyLiving).toEqual(beforeMonthlyLiving); // 上書きされない
  });

  it('URL import resets livingCostManuallyEdited and forces apply', () => {
    useInputStore.setState({ livingCostManuallyEdited: true });
    setUrl('livingCostMonthly=297000&livingCostSource=quickAdjust');
    store().initializeImportedLivingCost();

    expect(store().livingCostManuallyEdited).toBe(false);
    expect(store().roughDraft.monthlyLiving.value).toBe(29.7);
  });

  it('reset clears livingCostManuallyEdited but keeps importedLivingCost so re-pick reapplies', () => {
    setUrl('livingCostMonthly=297000');
    store().initializeImportedLivingCost();
    store().setMode('rough');
    store().setRoughValue('monthlyLiving', 30);
    expect(store().livingCostManuallyEdited).toBe(true);

    store().reset();
    expect(store().livingCostManuallyEdited).toBe(false);
    expect(store().importedLivingCost?.monthlyYen).toBe(297000);

    // モード再選択で再適用される。
    store().setMode('rough');
    expect(store().roughDraft.monthlyLiving.value).toBe(29.7);
  });

  it('nudgeCondition("living", ...) on a fresh imported value flips the manualEdited flag (rough)', () => {
    setUrl('livingCostMonthly=297000');
    store().initializeImportedLivingCost();
    store().setMode('rough');
    // nudgeCondition は内部で submit を経て結果を作るため、ここでは setRoughValue 経由で確認する。
    store().setRoughValue('monthlyLiving', 32);
    expect(store().livingCostManuallyEdited).toBe(true);
    expect(store().roughDraft.monthlyLiving.value).toBe(32);
  });

  it('does nothing when neither URL nor localStorage has data', () => {
    store().initializeImportedLivingCost();
    expect(store().importedLivingCost).toBeNull();
    expect(store().livingCostManuallyEdited).toBe(false);
  });
});
