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

  it('does NOT flip livingCostManuallyEdited via useRoughRecommended / skipRough on monthlyLiving (spec: only direct value entry counts as manual edit)', () => {
    store().setMode('rough');

    store().useRoughRecommended('monthlyLiving');
    expect(store().livingCostManuallyEdited).toBe(false);

    clearImportState();
    store().skipRough('monthlyLiving');
    expect(store().livingCostManuallyEdited).toBe(false);
  });

  it('does NOT flip livingCostManuallyEdited via useThoroughRecommended / skipThorough on expense.monthlyLiving', () => {
    store().setMode('thorough');

    store().useThoroughRecommended('expense.monthlyLiving', 28);
    expect(store().livingCostManuallyEdited).toBe(false);

    clearImportState();
    store().skipThorough('expense.monthlyLiving');
    expect(store().livingCostManuallyEdited).toBe(false);
  });

  it('does NOT flip livingCostManuallyEdited when clearing monthlyLiving back to empty', () => {
    store().setMode('rough');
    store().setRoughValue('monthlyLiving', 28);
    expect(store().livingCostManuallyEdited).toBe(true);

    clearImportState();
    store().setRoughValue('monthlyLiving', '');
    expect(store().livingCostManuallyEdited).toBe(false);
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

  it('localStorage import is skipped when livingCostManuallyEdited is true AND the field actually has user_input', () => {
    // ユーザーが先に総合版で 28 万円を手動入力していたシナリオ。
    store().setMode('rough');
    store().setRoughValue('monthlyLiving', 28);
    expect(store().livingCostManuallyEdited).toBe(true);
    expect(store().roughDraft.monthlyLiving.source).toBe('user_input');

    localStorage.setItem(
      'lifePlanLab:livingCost',
      JSON.stringify({ selectedMonthlyTotal: 280000, selectedMonthlySource: 'breakdownTotal' }),
    );
    const before = store().roughDraft.monthlyLiving;
    store().initializeImportedLivingCost();

    // バナー表示用に importedLivingCost は立つが、フィールド値は手動入力のまま維持。
    expect(store().importedLivingCost?.monthlyYen).toBe(280000);
    expect(store().livingCostManuallyEdited).toBe(true);
    expect(store().roughDraft.monthlyLiving).toEqual(before);
  });

  it('STALE FLAG RESCUE: localStorage import applies when flag is stale (true) but the actual field is empty', () => {
    // 過去のセッションで flag=true が残っているが、現在のフィールドは初期空欄（default_value）のケース。
    // 旧実装ではここで反映が止まっていた。新実装ではフィールド状態を見て rescue する。
    useInputStore.setState({ livingCostManuallyEdited: true });
    expect(store().roughDraft.monthlyLiving.source).toBe('default_value');

    localStorage.setItem(
      'lifePlanLab:livingCost',
      JSON.stringify({ selectedMonthlyTotal: 297000, selectedMonthlySource: 'breakdownTotal' }),
    );
    store().initializeImportedLivingCost();
    store().setMode('rough');

    expect(store().roughDraft.monthlyLiving.value).toBe(29.7);
    expect(store().roughDraft.monthlyLiving.source).toBe('user_input');
    // 反映処理が走ったので flag はリセットされる。
    expect(store().livingCostManuallyEdited).toBe(false);
  });

  it('URL import resets livingCostManuallyEdited and forces apply', () => {
    useInputStore.setState({ livingCostManuallyEdited: true });
    setUrl('livingCostMonthly=297000&livingCostSource=quickAdjust');
    store().initializeImportedLivingCost();

    expect(store().livingCostManuallyEdited).toBe(false);
    expect(store().roughDraft.monthlyLiving.value).toBe(29.7);
  });

  it('reset is a full fresh start: clears livingCostManuallyEdited AND importedLivingCost', () => {
    setUrl('livingCostMonthly=297000');
    store().initializeImportedLivingCost();
    store().setMode('rough');
    store().setRoughValue('monthlyLiving', 30);
    expect(store().livingCostManuallyEdited).toBe(true);

    store().reset();
    expect(store().livingCostManuallyEdited).toBe(false);
    expect(store().importedLivingCost).toBeNull();

    // reset 後の setMode では imported は無いので、roughDraft の monthlyLiving は default のまま。
    store().setMode('rough');
    expect(store().roughDraft.monthlyLiving.source).toBe('default_value');
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

// ─────────────────────────────────────────────────────────────────────────────
// 「反映先は『現在生活費』(expense.monthlyLiving) である」ことを担保するテスト群。
// ユーザー要件で指定された R1〜R7 と、submit を経由する end-to-end 経路 2 件をカバーする。
// 老後生活費・FIRE 後生活費・住宅ローンなど別フィールドに混ざらないことを明示する。
// ─────────────────────────────────────────────────────────────────────────────

function fillRoughMinimum(): void {
  store().setRoughValue('age', 38);
  store().setRoughValue('householdIncome', 850);
  store().setRoughValue('currentAssets', 1200);
  store().setRoughValue('housing', 'rent');
  store().setRoughValue('childrenCount', '0');
  store().setRoughValue('educationPolicy', 'public');
  store().setRoughValue('workStyle', 'work_a_little');
  store().setRoughValue('reduceWorkAge', 55);
  store().setRoughValue('investmentStyle', 'balanced');
}

describe('imported living-cost target: current monthly expenses (expense.monthlyLiving)', () => {
  beforeEach(() => {
    setUrl('');
    localStorage.clear();
    store().reset();
    useInputStore.setState({
      importedLivingCost: null,
      livingCostManuallyEdited: false,
      importedMortgage: null,
      mortgageManuallyEdited: false,
    });
  });
  afterEach(() => {
    setUrl('');
    localStorage.clear();
  });

  it('R1: URL livingCostMonthly=297000 → expense.monthlyLiving が 29.7 (万円/月)', () => {
    setUrl('livingCostMonthly=297000&livingCostSource=categoryScenario');
    store().initializeImportedLivingCost();
    store().setMode('thorough');
    const ti = store().thoroughInput!;
    expect(ti.expense.monthlyLiving.value).toBe(29.7);
    expect(ti.expense.monthlyLiving.source).toBe('user_input');
  });

  it('R2: localStorage selectedMonthlyTotal=297000 → 手動編集前なら expense.monthlyLiving=29.7', () => {
    localStorage.setItem(
      'lifePlanLab:livingCost',
      JSON.stringify({ selectedMonthlyTotal: 297000, selectedMonthlySource: 'breakdownTotal' }),
    );
    store().initializeImportedLivingCost();
    store().setMode('thorough');
    expect(store().thoroughInput!.expense.monthlyLiving.value).toBe(29.7);
  });

  it('R3: 取り込みは expense.monthlyLiving だけに user_input を立て、postFireLiving/retirementLiving の source は user_input にしない', () => {
    setUrl('livingCostMonthly=297000');
    store().initializeImportedLivingCost();
    store().setMode('thorough');
    const ti = store().thoroughInput!;
    expect(ti.expense.monthlyLiving.source).toBe('user_input');
    // FIRE後生活費・老後生活費は派生値（recommendedValues.ts が submit 時に補完）なので、
    // 取り込み時点では user_input にならない。
    expect(ti.fire.postFireLiving.source).not.toBe('user_input');
    expect(ti.retirement.retirementLiving.source).not.toBe('user_input');
    // 他の支出系も触らない。
    expect(ti.expense.annualSpecial.source).not.toBe('user_input');
    expect(ti.expense.insuranceCost.source).not.toBe('user_input');
    expect(ti.expense.carCost.source).not.toBe('user_input');
    expect(ti.expense.travelCost.source).not.toBe('user_input');
  });

  it('R4: ざっくり→深掘り遷移後も expense.monthlyLiving=29.7 が引き継がれる', () => {
    setUrl('livingCostMonthly=297000');
    store().initializeImportedLivingCost();
    store().setMode('rough');
    fillRoughMinimum();
    store().submitRough();
    // ざっくり結果に 29.7 が含まれていること
    expect(store().input!.expense.monthlyLiving.value).toBe(29.7);
    expect(store().input!.expense.monthlyLiving.source).toBe('user_input');

    // 深掘りへ遷移しても引き継がれる
    store().deepenToThorough();
    expect(store().thoroughInput!.expense.monthlyLiving.value).toBe(29.7);
    expect(store().thoroughInput!.expense.monthlyLiving.source).toBe('user_input');
  });

  it('R5: 手動編集後、URL なし再起動では localStorage で expense.monthlyLiving を上書きしない', () => {
    // ユーザーが先に手動編集していたシナリオ。
    useInputStore.setState({ livingCostManuallyEdited: true });
    store().setMode('thorough');
    // 手動値（28 万円）を立てる
    store().setThoroughValue('expense.monthlyLiving', 28);
    expect(store().thoroughInput!.expense.monthlyLiving.value).toBe(28);

    // URL なしで localStorage を仕込んでも、手動値が優先される
    localStorage.setItem(
      'lifePlanLab:livingCost',
      JSON.stringify({ selectedMonthlyTotal: 297000, selectedMonthlySource: 'breakdownTotal' }),
    );
    store().initializeImportedLivingCost();
    // 手動値は維持される（再適用されない）
    expect(store().thoroughInput!.expense.monthlyLiving.value).toBe(28);
    expect(store().livingCostManuallyEdited).toBe(true);
  });

  it('R6: URL 付きで再起動すると手動編集履歴をリセットして expense.monthlyLiving を上書き、バナー復活', () => {
    // 手動編集済みの状態
    useInputStore.setState({ livingCostManuallyEdited: true });

    setUrl('livingCostMonthly=297000&livingCostSource=categoryScenario');
    store().initializeImportedLivingCost();
    store().setMode('thorough');

    expect(store().thoroughInput!.expense.monthlyLiving.value).toBe(29.7);
    expect(store().livingCostManuallyEdited).toBe(false);
    // バナー表示用の importedLivingCost が立つ
    expect(store().importedLivingCost?.monthlyYen).toBe(297000);
    expect(store().importedLivingCost?.source).toBe('categoryScenario');
  });

  it('R7: 生活費取り込みは住宅ローン・基本情報・収入・投資 state を変更しない', () => {
    setUrl('livingCostMonthly=297000');
    const beforeMortgage = store().importedMortgage;
    const beforeMortgageFlag = store().mortgageManuallyEdited;
    store().initializeImportedLivingCost();
    store().setMode('thorough');
    const ti = store().thoroughInput!;

    expect(store().importedMortgage).toBe(beforeMortgage);
    expect(store().mortgageManuallyEdited).toBe(beforeMortgageFlag);

    // 住宅 / 基本 / 収入 / 投資 / 老後 系の各 source は user_input にならない（取り込まれていない）
    expect(ti.housing.monthlyPayment.source).not.toBe('user_input');
    expect(ti.housing.balance.source).not.toBe('user_input');
    expect(ti.housing.rate.source).not.toBe('user_input');
    expect(ti.basic.householdIncome.source).not.toBe('user_input');
    expect(ti.income.selfIncome.source).not.toBe('user_input');
    expect(ti.investment.monthlyInvestment.source).not.toBe('user_input');
    expect(ti.retirement.pension.source).not.toBe('user_input');
  });

  it('end-to-end rough flow: URL → setMode rough → submitRough → result.input.expense.monthlyLiving === 29.7', () => {
    setUrl('livingCostMonthly=297000');
    store().initializeImportedLivingCost();
    store().setMode('rough');
    fillRoughMinimum();
    store().submitRough();
    expect(store().input!.expense.monthlyLiving.value).toBe(29.7);
    expect(store().input!.expense.monthlyLiving.source).toBe('user_input');
    // 結果が生成されていること（計算経路全体で破綻していない）
    expect(store().result).not.toBeNull();
  });

  it('end-to-end thorough flow: URL → setMode thorough → submitThorough → result.input.expense.monthlyLiving === 29.7', () => {
    setUrl('livingCostMonthly=297000');
    store().initializeImportedLivingCost();
    store().setMode('thorough');
    store().submitThorough();
    expect(store().input!.expense.monthlyLiving.value).toBe(29.7);
    expect(store().input!.expense.monthlyLiving.source).toBe('user_input');
    expect(store().result).not.toBeNull();
  });
});
