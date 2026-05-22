import { beforeEach, describe, expect, it } from 'vitest';
import { useInputStore } from '../../src/store/inputStore';
import { visibleThoroughPages } from '../../src/schema/thoroughSteps';

const store = () => useInputStore.getState();

function fillRoughAndSubmit() {
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
  store().submitRough();
}

describe('thorough flow store', () => {
  beforeEach(() => store().reset());

  it('enters thorough mode with an input and a first page', () => {
    store().setMode('thorough');
    expect(store().mode).toBe('thorough');
    expect(store().phase).toBe('input');
    expect(store().thoroughInput).not.toBeNull();
    expect(store().thoroughPageId).toBe('basic-1');
  });

  it('tracks source per field (value / recommended / skip)', () => {
    store().setMode('thorough');
    store().setThoroughValue('basic.spouseAge', 40);
    store().skipThorough('basic.takeHomeIncome');
    store().useThoroughRecommended('investment.returnRate', 5);

    const ti = store().thoroughInput!;
    expect(ti.basic.spouseAge).toMatchObject({ value: 40, source: 'user_input' });
    expect(ti.basic.takeHomeIncome.source).toBe('skipped');
    expect(ti.investment.returnRate).toMatchObject({ value: 5, source: 'recommended_value' });
  });

  it('manages children count and clears assumed flag when age is entered', () => {
    store().setMode('thorough');
    store().setThoroughChildrenCount(2);
    expect(store().thoroughInput!.children).toHaveLength(2);

    store().setThoroughValue('children.0.currentAge', 9);
    expect(store().thoroughInput!.children[0].currentAge.value).toBe(9);
    expect(store().thoroughInput!.children[0].ageAssumed).toBe(false);
  });

  it('carries over rough answers (value + source) when deepening', () => {
    fillRoughAndSubmit();
    store().deepenToThorough();
    expect(store().mode).toBe('thorough');
    expect(store().phase).toBe('input');
    const ti = store().thoroughInput!;
    expect(ti.basic.age).toMatchObject({ value: 38, source: 'user_input' });
    expect(ti.housing.type).toMatchObject({ value: 'own', source: 'user_input' });
  });

  it('keeps side-FIRE income and reaches the result via buildFullInput', () => {
    store().setMode('thorough');
    store().setThoroughValue('fire.type', 'side');
    store().setThoroughValue('fire.postFireIncome', 120);
    store().submitThorough();
    expect(store().phase).toBe('result');
    expect(store().result!.rows.at(-1)?.age).toBe(95);
    expect(store().input!.fire.type.value).toBe('side');
    expect(store().input!.fire.postFireIncome).toMatchObject({ value: 120, source: 'user_input' });
  });

  it('editCategory maps a result category to the matching detailed step', () => {
    store().setMode('thorough');
    store().submitThorough();
    store().editCategory('fire');
    expect(store().phase).toBe('input');
    expect(store().cameFromResult).toBe(true);
    expect(store().thoroughPageId).toBe('fire-1');
  });

  it('hides loan pages when not an owner', () => {
    store().setMode('thorough'); // default housing.type = rent
    store().setThoroughValue('housing.type', 'rent');
    let pageIds = visiblePageIds();
    expect(pageIds).not.toContain('housing-2');

    store().setThoroughValue('housing.type', 'own');
    pageIds = visiblePageIds();
    expect(pageIds).toContain('housing-2');
  });
});

function visiblePageIds(): string[] {
  return visibleThoroughPages(store().thoroughInput!).map((p) => p.pageId);
}
