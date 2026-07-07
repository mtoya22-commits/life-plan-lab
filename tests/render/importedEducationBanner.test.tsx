import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { ImportedEducationBanner } from '../../src/features/imported-education/ImportedEducationBanner';
import { RoughFlow } from '../../src/features/input-steps/rough/RoughFlow';
import { ROUGH_PAGES } from '../../src/schema/roughQuestions';
import { useInputStore } from '../../src/store/inputStore';
import { EDUCATION_STORAGE_KEY } from '../../src/lib/importedEducation';

// 教育費取り込みバナーの表示状態（active / pending / edited）と rough ロックの実DOM確認。
// 方針: pending 時は通常バナー・参考行を出さず「反映する」を優先。
//       edited 時は控えめな注記と再適用導線のみ。参考行は「取り込み時の参考値」と明示。

const FIXTURE_PATH = resolve(process.cwd(), 'tests/fixtures/contracts/educationPayload.v1.json');
const fixtureText = readFileSync(FIXTURE_PATH, 'utf8');

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
    importedEducation: null,
    educationManuallyEdited: false,
    appliedEducationImportFingerprint: null,
  });
}
function importFixture(mutate?: (p: Record<string, unknown>) => void): void {
  const p = JSON.parse(fixtureText);
  mutate?.(p);
  localStorage.setItem(EDUCATION_STORAGE_KEY, JSON.stringify(p));
  store().initializeImportedEducation();
}

describe('ImportedEducationBanner', () => {
  beforeEach(() => {
    setUrl('');
    localStorage.clear();
    store().reset();
    clearImports();
  });
  afterEach(() => {
    cleanup();
    setUrl('');
    localStorage.clear();
    clearImports();
  });

  it('renders nothing without an import', () => {
    const { container } = render(<ImportedEducationBanner variant="result" />);
    expect(container.textContent).toBe('');
  });

  it('active: result variant shows recalc note, reference line labeled 参考値, and saved date', () => {
    importFixture();
    const { container } = render(<ImportedEducationBanner variant="result" />);
    expect(container.textContent).toContain('教育費ピークシミュレーター');
    expect(container.textContent).toContain('保存日: 2026年7月7日');
    expect(container.textContent).toContain('計算し直している');
    expect(container.textContent).toContain('取り込み時の参考値');
    expect(container.textContent).toContain('約2,568万円');
    expect(container.textContent).toContain('ピーク 2036年');
    // 保存が新しいので鮮度注記は出ない
    expect(container.textContent).not.toContain('保存から時間が経っています');
  });

  it('active: shows stale note when savedAt is more than a year old', () => {
    importFixture((p) => {
      p.savedAt = '2024-01-01T00:00:00.000Z';
    });
    const { container } = render(<ImportedEducationBanner variant="result" />);
    expect(container.textContent).toContain('保存から時間が経っています');
  });

  it('active: omits reference line and saved date safely when meta is invalid/missing', () => {
    importFixture((p) => {
      delete p.savedAt;
      delete p.totalFutureCostYen;
      delete p.peakYear;
    });
    const { container } = render(<ImportedEducationBanner variant="result" />);
    expect(container.textContent).toContain('教育費ピークシミュレーターから取り込みました');
    expect(container.textContent).not.toContain('保存日');
    expect(container.textContent).not.toContain('参考値');
  });

  it('edited: result shows only the subdued manual-edit note (no reference line)', () => {
    importFixture();
    store().setMode('thorough');
    store().setThoroughValue('children.0.currentAge', 9);
    const { container } = render(<ImportedEducationBanner variant="result" />);
    expect(container.textContent).toContain('手動変更されています');
    expect(container.textContent).not.toContain('参考値');
    expect(container.textContent).not.toContain('約2,568万円');
  });

  it('edited: input page offers 再適用 which restores imported conditions', () => {
    importFixture();
    store().setMode('thorough');
    store().setThoroughValue('children.0.currentAge', 9);
    const { getByText } = render(<ImportedEducationBanner variant="inputPageThorough" />);
    fireEvent.click(getByText('教育費シミュレーターの条件を再適用する'));
    expect(store().educationManuallyEdited).toBe(false);
    expect(store().thoroughInput!.children[0].currentAge.value).toBe(8);
  });

  it('pending: shows 反映する instead of the normal banner; clicking applies the new payload', () => {
    importFixture();
    store().setMode('thorough');
    store().setThoroughValue('children.0.currentAge', 9); // manual edit
    importFixture((p) => {
      (p.children as Record<string, unknown>[])[0].currentAge = 12; // 新しい条件
    });
    const { container, getByText } = render(<ImportedEducationBanner variant="result" />);
    expect(container.textContent).toContain('新しい条件があります');
    expect(container.textContent).not.toContain('参考値'); // 参考行は出さない
    fireEvent.click(getByText('反映する'));
    expect(store().thoroughInput!.children[0].currentAge.value).toBe(12);
    expect(store().educationManuallyEdited).toBe(false);
  });
});

describe('rough education lock', () => {
  beforeEach(() => {
    setUrl('');
    localStorage.clear();
    store().reset();
    clearImports();
  });
  afterEach(() => {
    cleanup();
    setUrl('');
    localStorage.clear();
    clearImports();
  });

  // 教育設問（childrenCount）を含むページ番号を質問定義から求め、render 前に直接セットする。
  const educationPageIndex = ROUGH_PAGES.findIndex((p) =>
    p.questions.some((q) => q.id === 'childrenCount'),
  );

  it('locks education questions while the import is active and unlocks on release', () => {
    importFixture();
    store().setMode('rough');
    useInputStore.setState({ roughPage: educationPageIndex });
    const { container, getByText } = render(<RoughFlow />);

    expect(container.textContent).toContain('教育費の条件は教育費ピークシミュレーターから引き継いでいます');
    expect(container.textContent).toContain('お子さま：8歳・5歳');
    expect(container.textContent).not.toContain('お子さまの人数'); // 設問はロック（非表示）
    expect(container.textContent).not.toContain('教育の方針');

    // 解除すると通常の設問編集へ戻る
    fireEvent.click(getByText('取り込みを解除して自分で入力する'));
    expect(store().educationManuallyEdited).toBe(true);
    expect(container.textContent).toContain('お子さまの人数');
    expect(container.textContent).toContain('教育の方針');
  });

  it('renders education questions normally when there is no import', () => {
    store().setMode('rough');
    useInputStore.setState({ roughPage: educationPageIndex });
    const { container } = render(<RoughFlow />);
    expect(container.textContent).toContain('お子さまの人数');
    expect(container.textContent).not.toContain('教育費ピークシミュレーターから引き継いでいます');
  });
});
