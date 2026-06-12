import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import App from '../../src/App';
import { useInputStore } from '../../src/store/inputStore';
import { THOROUGH_PAGES } from '../../src/schema/thoroughSteps';

// STEP11.16: 生活費の単位を月額入力に統一する。
// - thoroughInput 内部値は年額のまま（engine と既存テストを壊さない）。
// - setThoroughValue / useThoroughRecommended で月額 → 年額に ×12 する。
// - 入力 UI（NumberField）は ÷12 して月額を表示する。

const store = () => useInputStore.getState();

describe('monthly-input unification for living-cost fields', () => {
  beforeEach(() => store().reset());
  afterEach(cleanup);

  it('setThoroughValue("fire.postFireLiving", 25) stores 300 (×12) annually', () => {
    act(() => store().setMode('thorough'));
    act(() => store().setThoroughValue('fire.postFireLiving', 25));
    expect(store().thoroughInput!.fire.postFireLiving.value).toBe(300);
    expect(store().thoroughInput!.fire.postFireLiving.source).toBe('user_input');
  });

  it('setThoroughValue("retirement.retirementLiving", 22) stores 264 annually', () => {
    act(() => store().setMode('thorough'));
    act(() => store().setThoroughValue('retirement.retirementLiving', 22));
    expect(store().thoroughInput!.retirement.retirementLiving.value).toBe(264);
  });

  it('non-monthly paths are not multiplied', () => {
    act(() => store().setMode('thorough'));
    act(() => store().setThoroughValue('basic.householdIncome', 800));
    expect(store().thoroughInput!.basic.householdIncome.value).toBe(800);
  });

  it('question labels read 毎月... / 万円/月', () => {
    const fire2 = THOROUGH_PAGES.find((p) => p.pageId === 'fire-2')!;
    const postFire = fire2.questions!.find((q) => q.path === 'fire.postFireLiving')!;
    expect(postFire.label).toContain('毎月');
    expect(postFire.unit).toBe('万円/月');

    const retirement1 = THOROUGH_PAGES.find((p) => p.pageId === 'retirement-1')!;
    const rl = retirement1.questions!.find((q) => q.path === 'retirement.retirementLiving')!;
    expect(rl.label).toContain('毎月');
    expect(rl.unit).toBe('万円/月');
  });

  it('the input field on fire-2 shows the monthly value (annual ÷ 12)', () => {
    act(() => store().setMode('thorough'));
    act(() => store().setThoroughValue('fire.type', 'side')); // fire-2 を見えるように
    act(() => store().setThoroughValue('fire.postFireLiving', 25)); // 月25万 → 内部300万/年
    act(() => store().setThoroughPage('fire-2'));
    const { container } = render(<App />);
    const card = Array.from(container.querySelectorAll<HTMLElement>('.question-card, .field-row')).find((c) =>
      c.querySelector('.question-card__title, .field-row__title')?.textContent?.includes('FIRE後の毎月生活費'),
    );
    expect(card).toBeDefined();
    const inp = card!.querySelector<HTMLInputElement>('input.input')!;
    expect(inp.value).toBe('25');
  });
});

describe('result-screen DOM ordering: QuickAdjust is up under Hero', () => {
  beforeEach(() => store().reset());
  afterEach(cleanup);

  it('QuickAdjust appears before Outlook (i.e. above the fold area)', () => {
    act(() => store().loadSample());
    const { container } = render(<App />);
    const all = Array.from(container.querySelectorAll('section, div, h2'));
    const heroIdx = all.findIndex((el) => el.classList.contains('hero'));
    const adjustIdx = all.findIndex((el) => el.classList.contains('quick-adjust'));
    const outlookIdx = all.findIndex((el) => el.classList.contains('outlook'));
    expect(heroIdx).toBeGreaterThanOrEqual(0);
    expect(adjustIdx).toBeGreaterThan(heroIdx);
    if (outlookIdx >= 0) expect(adjustIdx).toBeLessThan(outlookIdx);
  });
});
