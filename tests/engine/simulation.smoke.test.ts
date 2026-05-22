import { describe, expect, it } from 'vitest';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { buildFullInputFromRough } from '../../src/schema/normalize';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import type { RoughAnswers } from '../../src/schema/types';

const SAMPLE: RoughAnswers = {
  age: 38,
  householdIncome: 850,
  currentAssets: 1200,
  childrenCount: 2,
  educationPolicy: 'public',
  housing: 'own',
  workStyle: 'work_a_little',
  reduceWorkAge: 55,
  investmentStyle: 'balanced',
};

describe('annual simulation engine (smoke)', () => {
  it('runs end-to-end from rough answers', () => {
    const result = runSimulation(buildFullInputFromRough(SAMPLE));
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.at(-1)?.age).toBe(95);
    expect(Number.isFinite(result.indicators.assetsAt95)).toBe(true);
    expect(result.score.total).toBeGreaterThanOrEqual(0);
    expect(result.score.total).toBeLessThanOrEqual(15);
  });

  it('side-FIRE never does worse than full-FIRE under identical conditions', () => {
    const base = applyRecommendedValues(createDefaultInput('thorough'));
    base.fire.postFireIncome.value = 120; // サイドFIREの労働収入

    const full = structuredClone(base);
    full.fire.type.value = 'full';
    const side = structuredClone(base);
    side.fire.type.value = 'side';

    const fullRows = runSimulation(full).rows;
    const sideRows = runSimulation(side).rows;

    for (let i = 0; i < fullRows.length; i++) {
      expect(sideRows[i].endAssets).toBeGreaterThanOrEqual(fullRows[i].endAssets - 1e-6);
    }
  });
});
