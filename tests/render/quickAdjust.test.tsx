import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import App from '../../src/App';
import { useInputStore } from '../../src/store/inputStore';

// STEP11.15: What-if クイック調整（nudgeCondition）と前回比の差分表示のテスト。

const store = () => useInputStore.getState();

describe('nudgeCondition: store behavior', () => {
  beforeEach(() => store().reset());
  afterEach(cleanup);

  it('rough: living -1万 improves the outlook and writes user_input back to the draft', () => {
    act(() => store().loadSample());
    // サンプルは資産枯渇ケースのこともあるため、残資産または累計不足額のどちらかで改善を確認する。
    const beforeAssets = store().result!.indicators.assetsAt95;
    const beforeShortfall = store().result!.indicators.cumulativeShortfall;
    const beforeLiving = store().input!.expense.monthlyLiving.value;

    act(() => store().nudgeCondition('living', -1));

    const afterAssets = store().result!.indicators.assetsAt95;
    const afterShortfall = store().result!.indicators.cumulativeShortfall;
    expect(afterAssets > beforeAssets || afterShortfall < beforeShortfall).toBe(true);
    expect(store().input!.expense.monthlyLiving.value).toBe(beforeLiving - 1);
    // ドラフトにも書き戻る（あとで編集画面を開いても一致する）
    const cell = store().roughDraft.monthlyLiving;
    expect(cell.source).toBe('user_input');
    expect(cell.value).toBe(beforeLiving - 1);
  });

  it('rough: age knob maps to reduceWorkAge (and thus fire.targetAge)', () => {
    act(() => store().loadSample());
    const before = store().input!.fire.targetAge.value;
    act(() => store().nudgeCondition('age', 1));
    expect(store().input!.fire.targetAge.value).toBe(before + 1);
    expect(store().roughDraft.reduceWorkAge.source).toBe('user_input');
  });

  it('thorough none: age knob adjusts income.retirementAge, not fire.targetAge', () => {
    act(() => store().loadThoroughSample(false));
    const ti = store().thoroughInput!;
    ti.fire.type.value = 'none';
    ti.fire.type.source = 'user_input';
    act(() => store().submitThorough());

    const beforeRetire = store().input!.income.retirementAge.value;
    const beforeTarget = store().input!.fire.targetAge.value;
    act(() => store().nudgeCondition('age', -1));
    expect(store().input!.income.retirementAge.value).toBe(beforeRetire - 1);
    expect(store().input!.fire.targetAge.value).toBe(beforeTarget);
  });

  it('thorough side: age knob adjusts fire.targetAge', () => {
    act(() => store().loadThoroughSample(true)); // sample は side
    const before = store().input!.fire.targetAge.value;
    act(() => store().nudgeCondition('age', 1));
    expect(store().input!.fire.targetAge.value).toBe(before + 1);
  });

  it('thorough: return knob adjusts investment.returnRate by 0.5', () => {
    act(() => store().loadThoroughSample(true));
    const before = store().input!.investment.returnRate.value;
    act(() => store().nudgeCondition('return', 0.5));
    expect(store().input!.investment.returnRate.value).toBeCloseTo(before + 0.5);
  });

  it('clamps: age cannot exceed 80 (no-op)', () => {
    act(() => store().loadThoroughSample(true));
    act(() => store().nudgeCondition('age', 80)); // 55 + 80 > 80 → no-op
    const calculatedAt = store().result!.calculatedAt;
    act(() => store().nudgeCondition('age', 26)); // 55 + 26 = 81 > 80 → no-op
    expect(store().result!.calculatedAt).toBe(calculatedAt); // 再計算されていない
  });

  it('sets resultReturnTarget to "stay" after a nudge', () => {
    act(() => store().loadSample());
    act(() => store().nudgeCondition('living', 1));
    expect(store().resultReturnTarget).toBe('stay');
  });
});

describe('previousIndicators: delta tracking', () => {
  beforeEach(() => store().reset());
  afterEach(cleanup);

  it('is null on the first result, set after a nudge, cleared on reset', () => {
    act(() => store().loadSample());
    expect(store().previousIndicators).toBeNull();

    const before = store().result!.indicators.assetsAt95PresentValue;
    act(() => store().nudgeCondition('living', -1));
    expect(store().previousIndicators).not.toBeNull();
    expect(store().previousIndicators!.assetsAt95PresentValue).toBe(before);

    act(() => store().reset());
    expect(store().previousIndicators).toBeNull();
  });

  it('submitRough stashes the previous result for the delta chip', () => {
    act(() => store().loadSample());
    const before = store().result!.indicators.assetsAt95;
    act(() => store().editCategory('basic'));
    act(() => store().setRoughValue('monthlyLiving', 20));
    act(() => store().submitRough());
    expect(store().previousIndicators!.assetsAt95).toBe(before);
  });
});

describe('result screen: QuickAdjust card and delta chip', () => {
  beforeEach(() => store().reset());
  afterEach(cleanup);

  it('renders the quick-adjust card with knobs and recalculates in place on tap', () => {
    act(() => store().loadSample());
    const { container } = render(<App />);
    // 「想定利回り」等は試算条件テーブルにも出るため、カード内にスコープして判定する。
    const card = container.querySelector('.quick-adjust')!;
    expect(card).not.toBeNull();
    expect(card.textContent).toContain('条件を少し動かして見る');
    // rough サンプル（side）: 年齢 + 生活費（現役）。利回りノブは thorough のみ。
    expect(card.textContent).toContain('働き方を変える年齢');
    expect(card.textContent).toContain('毎月の生活費（現役）');
    expect(card.textContent).not.toContain('想定利回り');

    // − をタップ → その場で再計算され、差分チップが出る
    const minus = container.querySelector('[aria-label="毎月の生活費（現役）を1万円/月減らす"]') as HTMLButtonElement;
    const calculatedBefore = store().result!.calculatedAt;
    fireEvent.click(minus);
    expect(store().result!.calculatedAt).not.toBe(calculatedBefore);
    expect(container.textContent).toContain('前回の条件より');
    // 「条件を変えてみる」details は開かない（stay）
    const details = Array.from(container.querySelectorAll<HTMLDetailsElement>('details.collapsible')).find((d) =>
      d.querySelector('summary')?.textContent?.includes('条件を変えてみる'),
    );
    expect(details!.open).toBe(false);
  });

  it('thorough result shows the return-rate knob', () => {
    act(() => store().loadThoroughSample(true));
    const { container } = render(<App />);
    const card = container.querySelector('.quick-adjust')!;
    expect(card.textContent).toContain('想定利回り');
  });

  it('hides the delta chip on the first result', () => {
    act(() => store().loadSample());
    const { container } = render(<App />);
    expect(container.textContent).not.toContain('前回の条件より');
  });

  it('thorough none: age knob is labeled 退職予定年齢', () => {
    act(() => store().loadThoroughSample(false));
    const ti = store().thoroughInput!;
    ti.fire.type.value = 'none';
    act(() => store().submitThorough());
    const { container } = render(<App />);
    const card = container.querySelector('.quick-adjust')!;
    expect(card.textContent).toContain('退職予定年齢');
    expect(card.textContent).not.toContain('FIRE希望年齢');
  });
});
