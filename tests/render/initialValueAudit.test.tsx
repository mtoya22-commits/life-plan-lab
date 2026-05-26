import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import App from '../../src/App';
import { useInputStore } from '../../src/store/inputStore';

// STEP10.1: 入力値の初期表示の監査。
// 「個人差が大きい項目」は最初から実値を入れず、placeholderや「例を入れる」ボタンで対応する。
const store = () => useInputStore.getState();

function inputValueOf(container: HTMLElement, label: string): string {
  const card = Array.from(container.querySelectorAll<HTMLElement>('.question-card, .field-row')).find((c) =>
    c.querySelector('.question-card__title, .field-row__title')?.textContent?.includes(label),
  )!;
  return (card.querySelector<HTMLInputElement>('input.input')!).value;
}

describe('STEP10.1 initial-value UX audit', () => {
  beforeEach(() => store().reset());
  afterEach(cleanup);

  it('fire-1: no FIRE option is pre-selected (personal choice)', () => {
    store().setMode('thorough');
    store().setThoroughPage('fire-1');
    const { container } = render(<App />);
    expect(container.querySelector('.choice--selected')).toBeNull();
  });

  it('fire-2: post-FIRE living renders empty (was prefilled 0)', () => {
    store().setMode('thorough');
    store().setThoroughValue('fire.type', 'side');
    store().setThoroughPage('fire-2');
    const { container } = render(<App />);
    expect(inputValueOf(container, 'FIRE後生活費')).toBe('');
  });

  it('housing-3: interest rate renders empty (was prefilled 1.0)', () => {
    store().setMode('thorough');
    store().setThoroughValue('housing.type', 'own');
    store().setThoroughPage('housing-3');
    const { container } = render(<App />);
    expect(inputValueOf(container, '金利')).toBe('');
  });

  it('retirement-1: old-age living renders empty (was prefilled 0)', () => {
    store().setMode('thorough');
    store().setThoroughPage('retirement-1');
    const { container } = render(<App />);
    expect(inputValueOf(container, '老後生活費')).toBe('');
  });

  it('standard-example fields keep their value (return rate, inflation)', () => {
    store().setMode('thorough');
    store().setThoroughPage('investment-1');
    let r = render(<App />);
    expect(inputValueOf(r.container, '想定利回り')).toBe('5'); // 標準例（5%）として残す
    cleanup();
    store().setThoroughPage('investment-2');
    r = render(<App />);
    expect(inputValueOf(r.container, 'インフレ率')).toBe('2'); // 標準例（2%）として残す
  });

  it('events: 含める alone does NOT pre-fill age/amount and does NOT affect calc', () => {
    store().setMode('thorough');
    store().setThoroughPage('events');
    const { container } = render(<App />);
    const carCard0 = Array.from(container.querySelectorAll<HTMLElement>('.question-card')).find((c) =>
      c.querySelector('.question-card__title')?.textContent?.includes('車の購入'),
    )!;
    fireEvent.click(carCard0.querySelector<HTMLButtonElement>('.btn')!);
    // 再取得（クリックで内部が再描画されるため）
    const carCard = Array.from(container.querySelectorAll<HTMLElement>('.question-card')).find((c) =>
      c.querySelector('.question-card__title')?.textContent?.includes('車の購入'),
    )!;
    const inputs = carCard.querySelectorAll<HTMLInputElement>('input.input');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    expect(inputs[0].value).toBe('');
    expect(inputs[1].value).toBe('');
    // 計算（submit→result）で車購入が一時支出に乗らない
    store().submitThorough();
    const res = store().result!;
    expect(res.rows.every((r) => (r.debug?.lifeEventExpense ?? 0) === 0)).toBe(true);
  });

  it('events: pressing the example button fills both age and amount, and affects calc', () => {
    store().setMode('thorough');
    store().setThoroughValue('basic.age', 38);
    store().setThoroughPage('events');
    const { container } = render(<App />);
    const findCar = () =>
      Array.from(container.querySelectorAll<HTMLElement>('.question-card')).find((c) =>
        c.querySelector('.question-card__title')?.textContent?.includes('車の購入'),
      )!;
    fireEvent.click(findCar().querySelector<HTMLButtonElement>('.btn')!); // 含める
    const exampleBtn = Array.from(findCar().querySelectorAll<HTMLButtonElement>('.btn')).find((b) =>
      b.textContent?.includes('例（'),
    )!;
    fireEvent.click(exampleBtn);
    expect(store().thoroughInput!.lifeEvents.find((e) => e.id === 'car')?.atAge.value).toBe(45);
    expect(Math.abs(store().thoroughInput!.lifeEvents.find((e) => e.id === 'car')?.amount.value ?? 0)).toBe(500);
    store().submitThorough();
    const carYear = store().result!.rows.find((r) => r.age === 45)!.debug!.lifeEventExpense;
    expect(carYear).toBeGreaterThan(0);
  });

  it('events: only age entered (no amount) does not affect calc', () => {
    store().setMode('thorough');
    store().setThoroughValue('basic.age', 38);
    store().setThoroughPage('events');
    // 含めるのみ → 年齢だけ入力（金額未入力）
    store().upsertLifeEvent({
      id: 'car',
      label: { value: '車', source: 'user_input', label: '', assumptionText: '' },
      atAge: { value: 50, source: 'user_input', label: '', assumptionText: '', unit: '歳' },
      amount: { value: 0, source: 'skipped', label: '', assumptionText: '', unit: '万円' },
    });
    store().submitThorough();
    expect(store().result!.rows.every((r) => (r.debug?.lifeEventExpense ?? 0) === 0)).toBe(true);
  });
});
