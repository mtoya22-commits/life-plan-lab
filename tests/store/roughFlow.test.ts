import { beforeEach, describe, expect, it } from 'vitest';
import { useInputStore } from '../../src/store/inputStore';
import { ROUGH_PAGES } from '../../src/schema/roughQuestions';

const store = () => useInputStore.getState();

describe('rough flow store wiring', () => {
  beforeEach(() => store().reset());

  it('mode select moves to input phase with a fresh draft', () => {
    store().setMode('rough');
    expect(store().phase).toBe('input');
    expect(store().mode).toBe('rough');
    expect(store().roughPage).toBe(0);
  });

  it('tracks source per cell (value / recommended / skip)', () => {
    store().setMode('rough');
    store().setRoughValue('age', 38);
    store().useRoughRecommended('reduceWorkAge');
    store().skipRough('householdIncome');

    const d = store().roughDraft;
    expect(d.age).toEqual({ value: 38, source: 'user_input' });
    expect(d.reduceWorkAge.source).toBe('recommended_value');
    expect(d.reduceWorkAge.value).toBe(55);
    expect(d.householdIncome).toEqual({ value: null, source: 'skipped' });
  });

  it('navigates pages and produces a result on submit', () => {
    store().setMode('rough');
    store().setRoughValue('age', 38);
    store().setRoughValue('householdIncome', 850);
    store().setRoughValue('currentAssets', 1200);
    store().setRoughValue('childrenCount', '2');
    store().setRoughValue('educationPolicy', 'public');
    store().setRoughValue('housing', 'own');
    store().setRoughValue('workStyle', 'work_a_little');
    store().setRoughValue('reduceWorkAge', 55);
    store().setRoughValue('investmentStyle', 'balanced');

    // 最終ページまで進める（最後の nextRoughPage が submit になる）
    for (let i = 0; i < ROUGH_PAGES.length; i++) store().nextRoughPage();

    expect(store().phase).toBe('result');
    expect(store().result).not.toBeNull();
    expect(store().result!.rows.at(-1)?.age).toBe(95);
  });
});
