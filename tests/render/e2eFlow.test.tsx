import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../../src/App';
import { useInputStore } from '../../src/store/inputStore';
import { visibleThoroughPages } from '../../src/schema/thoroughSteps';

// STEP6.4: トップ→入力→結果→修正→再計算の通し回帰確認。
// 新機能ではなく、導線が破綻していないこと・値が保持されること・最上部表示を担保する。
const store = () => useInputStore.getState();

function fillRough() {
  store().setRoughValue('age', 40);
  store().setRoughValue('householdIncome', 800);
  store().setRoughValue('currentAssets', 1500);
  store().setRoughValue('childrenCount', '1');
  store().setRoughValue('educationPolicy', 'public');
  store().setRoughValue('childAge1', 6);
  store().setRoughValue('housing', 'own');
  store().setRoughValue('workStyle', 'work_a_little');
  store().setRoughValue('reduceWorkAge', 55);
  store().setRoughValue('investmentStyle', 'balanced');
}

describe('STEP6.4 end-to-end flows', () => {
  beforeEach(() => store().reset());
  afterEach(cleanup);

  it('top → rough card → result (dashboard + deepen link visible)', () => {
    render(<App />);
    fireEvent.click(screen.getByText('ざっくり診断').closest('button')!);
    expect(store().phase).toBe('input');
    expect(store().mode).toBe('rough');
    fillRough();
    store().submitRough();
    cleanup();
    const { container } = render(<App />);
    expect(store().phase).toBe('result');
    expect(container.textContent).toContain('あなたの人生ダッシュボード');
    expect(container.querySelector('.outlook')).not.toBeNull();
    expect(container.textContent).toContain('しっかり診断で詳しく見る'); // ざっくりは深掘り導線あり
  });

  it('top → thorough card → result (dashboard, no deepen link)', () => {
    render(<App />);
    fireEvent.click(screen.getByText('しっかり診断').closest('button')!);
    expect(store().phase).toBe('input');
    expect(store().mode).toBe('thorough');
    store().submitThorough();
    cleanup();
    const { container } = render(<App />);
    expect(store().phase).toBe('result');
    expect(container.textContent).toContain('あなたの人生ダッシュボード');
    expect(container.textContent).not.toContain('しっかり診断で詳しく見る'); // しっかりは深掘り導線なし
  });

  it('rough → deepen carries values into thorough', () => {
    fillRough();
    store().submitRough();
    store().deepenToThorough();
    expect(store().mode).toBe('thorough');
    expect(store().phase).toBe('input');
    expect(store().thoroughInput!.basic.age).toMatchObject({ value: 40, source: 'user_input' });
    expect(store().thoroughInput!.housing.type.value).toBe('own');
  });

  it('result → edit every visible thorough page → recompute → result (values preserved, top scroll)', () => {
    const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    store().loadThoroughSample(true);
    expect(store().phase).toBe('result');
    const startAge = store().thoroughInput!.basic.age.value;

    for (const page of visibleThoroughPages(store().thoroughInput!)) {
      store().editThoroughPage(page.pageId);
      expect(store().phase).toBe('input');
      expect(store().cameFromResult).toBe(true);
      expect(store().thoroughPageId).toBe(page.pageId);
      // 入力済みの値が保持されている（往復で消えない）
      expect(store().thoroughInput!.basic.age.value).toBe(startAge);

      spy.mockClear();
      store().submitThorough();
      cleanup();
      render(<App />);
      expect(store().phase).toBe('result');
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ top: 0, behavior: 'auto' }));
    }
    spy.mockRestore();
  });

  it('rough result → edit each category → recompute round-trips', () => {
    fillRough();
    store().submitRough();
    for (const stepId of ['basic', 'family', 'housing', 'fire', 'investment'] as const) {
      store().editCategory(stepId);
      expect(store().phase).toBe('input');
      expect(store().cameFromResult).toBe(true);
      store().submitRough();
      expect(store().phase).toBe('result');
    }
  });

  it('a recorded edit is reflected after recompute (pension raises 66yo income)', () => {
    store().loadThoroughSample(true);
    const before = store().result!.rows.find((r) => r.age === 66)!.income.pension;
    store().editThoroughPage('retirement-1');
    store().setThoroughValue('retirement.pension', 360);
    store().submitThorough();
    const after = store().result!.rows.find((r) => r.age === 66)!.income.pension;
    expect(after).toBeGreaterThan(before);
  });

  it('dev sample links live only in a collapsed DEV menu and reach a result at top', () => {
    const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const { container } = render(<App />);
    const dev = Array.from(container.querySelectorAll<HTMLDetailsElement>('details.collapsible')).find((d) =>
      d.querySelector('summary')?.textContent?.includes('開発用メニュー'),
    )!;
    expect(dev.open).toBe(false);
    fireEvent.click(dev.querySelector<HTMLButtonElement>('.dev-sample')!); // 「サンプルで結果を見る」
    cleanup();
    render(<App />);
    expect(store().phase).toBe('result');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ top: 0, behavior: 'auto' }));
    spy.mockRestore();
  });
});
