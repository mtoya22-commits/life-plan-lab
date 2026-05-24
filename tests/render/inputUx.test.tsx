import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import App from '../../src/App';
import { useInputStore } from '../../src/store/inputStore';

// STEP6.2: 入力画面のUX（月額/年額の明示・記録用の明示・一時収入/支出・安心感）。
const store = () => useInputStore.getState();

describe('STEP6.2 input UX copy', () => {
  beforeEach(() => store().reset());
  afterEach(cleanup);

  it('clarifies monthly vs annual on money fields', () => {
    store().setMode('thorough');
    store().setThoroughPage('expense-monthly');
    const { container } = render(<App />);
    expect(container.textContent).toContain('月額・万円で入力'); // 毎月生活費
    expect(container.textContent).toContain('年額・万円で入力'); // 保険料（年間）
  });

  it('marks pension/old-age living as present-value annual amounts', () => {
    store().setMode('thorough');
    store().setThoroughPage('retirement-1');
    const { container } = render(<App />);
    expect(container.textContent).toContain('今のお金の感覚で'); // 年金見込み
    expect(container.textContent).toContain('日常生活費のみ'); // 老後生活費
  });

  it('uses the softened skip label and a one-time reassurance up front', () => {
    store().setMode('thorough');
    const { container } = render(<App />);
    expect(container.textContent).toContain('未入力で進む');
    expect(container.textContent).not.toContain('スキップ済み');
    expect(container.textContent).toContain('あとから変えて再計算できます');
  });

  it('hides the fixed-rate-end field when the rate is variable, shows it when fixed', () => {
    store().setMode('thorough');
    store().setThoroughValue('housing.type', 'own');
    store().setThoroughValue('housing.rateType', 'variable');
    store().setThoroughPage('housing-3');
    let r = render(<App />);
    expect(r.container.textContent).not.toContain('固定終了年齢');
    expect(r.container.textContent).toContain('記録用'); // 金利は現在記録用
    cleanup();

    store().setThoroughValue('housing.rateType', 'fixed');
    r = render(<App />);
    expect(r.container.textContent).toContain('固定終了年齢');
  });

  it('labels life events as one-time income vs expense with clarifying notes', () => {
    store().setMode('thorough');
    store().setThoroughPage('events');
    const { container } = render(<App />);
    expect(container.textContent).toContain('一時収入'); // 相続
    expect(container.textContent).toContain('一時支出'); // 車購入など
    expect(container.textContent).toContain('車の維持費は毎年の支出'); // 維持費と購入の区別
    expect(container.textContent).toContain('相続は指定年齢の一時収入');
  });

  it('shows a per-page item overview so the page length is predictable', () => {
    store().setMode('thorough');
    store().setThoroughPage('expense-monthly');
    const { container } = render(<App />);
    expect(container.textContent).toContain('確認する項目（2）');
    expect(container.textContent).toContain('毎月生活費');
    expect(container.textContent).toContain('保険料');
  });

  it('groups consecutive number inputs into a single compact card', () => {
    store().setMode('thorough');
    store().setThoroughPage('expense-annual'); // 年間特別費・旅行費・車関連費（すべて数値）
    const { container } = render(<App />);
    const groups = container.querySelectorAll('.group-card');
    expect(groups.length).toBe(1);
    expect(groups[0].querySelectorAll('.field-row').length).toBe(3);
  });

  it('keeps decision (choice/toggle) items as their own cards, not grouped', () => {
    store().setMode('thorough');
    store().setThoroughValue('housing.type', 'own');
    store().setThoroughValue('housing.rateType', 'fixed');
    store().setThoroughPage('housing-3'); // rate(数値) / 固定変動(選択) / 固定終了(数値)
    const { container } = render(<App />);
    // 選択肢が独立カードになるため、数値がまとまった group-card は作られない（各数値は単独）
    expect(container.querySelector('.choice-group')).not.toBeNull();
    expect(container.querySelectorAll('.group-card').length).toBe(0);
  });

  it('grouped fields still save values and source correctly', () => {
    store().setMode('thorough');
    store().setThoroughPage('expense-annual');
    render(<App />);
    store().setThoroughValue('expense.travelCost', 33);
    store().skipThorough('expense.carCost');
    expect(store().thoroughInput!.expense.travelCost).toMatchObject({ value: 33, source: 'user_input' });
    expect(store().thoroughInput!.expense.carCost.source).toBe('skipped');
  });

  it('softens the thorough progress eta wording', () => {
    store().setMode('thorough');
    const { container } = render(<App />);
    expect(container.textContent).toContain('あと約');
    expect(container.textContent).toContain('のこり');
    expect(container.textContent).not.toContain('残り'); // 「残り◯ステップ」の作業感を避ける
  });
});
