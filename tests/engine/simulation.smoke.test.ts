import { describe, expect, it } from 'vitest';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { buildFullInputFromRough } from '../../src/schema/normalize';
import { draftFromAnswers } from '../../src/schema/roughMapping';
import { runSimulation } from '../../src/engine/annualSimulationEngine';

const SAMPLE = draftFromAnswers({
  age: 38,
  householdIncome: 850,
  currentAssets: 1200,
  childrenCount: 2,
  educationPolicy: 'public',
  housing: 'own',
  workStyle: 'work_a_little',
  reduceWorkAge: 55,
  investmentStyle: 'balanced',
});

describe('annual simulation engine (smoke)', () => {
  it('runs end-to-end from a rough draft', () => {
    const input = buildFullInputFromRough(SAMPLE);
    const result = runSimulation(input);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.at(-1)?.age).toBe(95);
    expect(Number.isFinite(result.indicators.assetsAt95)).toBe(true);
    expect(result.score.total).toBeGreaterThanOrEqual(0);
    expect(result.score.total).toBeLessThanOrEqual(15);
    expect(result.notes.length).toBeGreaterThan(0); // 税制簡略化などの注記
    expect(result.flags).toContain('子どもの年齢は仮定で試算しています。');
  });

  it('marks source correctly: user_input vs recommended vs skipped', () => {
    const draft = draftFromAnswers({
      age: 40,
      householdIncome: 700,
      currentAssets: 500,
      childrenCount: 1,
      educationPolicy: 'public',
      housing: 'rent',
      workStyle: 'full_retire',
      reduceWorkAge: 60,
      investmentStyle: 'stable',
    });
    // 投資スタイルをスキップに上書き
    draft.investmentStyle = { value: null, source: 'skipped' };
    const input = buildFullInputFromRough(draft);
    expect(input.basic.age.source).toBe('user_input');
    // スキップした投資スタイルは標準値(skipped)のまま
    expect(input.investment.style.source).toBe('skipped');
  });

  it('applies inflation to the expense side (later years cost more, nominally)', () => {
    const input = buildFullInputFromRough(SAMPLE);
    const rows = runSimulation(input).rows;
    const early = rows[1].expense.living;
    const later = rows[10].expense.living;
    expect(later).toBeGreaterThan(early);
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
