import { describe, expect, it } from 'vitest';
import { draftFromAnswers } from '../../src/schema/roughMapping';
import { buildFullInputFromRough } from '../../src/schema/normalize';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import { buildLifeEvents, summaryEvents } from '../../src/features/results/lifeEvents';
import type { EducationPolicy, HousingType, InvestmentStyle } from '../../src/schema/types';

interface RoughInput {
  age: number;
  householdIncome: number;
  currentAssets: number;
  childrenCount: number;
  educationPolicy: EducationPolicy;
  housing: HousingType;
  workStyle: string;
  reduceWorkAge: number;
  investmentStyle: InvestmentStyle;
}

const BASE: RoughInput = {
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

function eventsFor(answers: RoughInput) {
  const input = buildFullInputFromRough(draftFromAnswers(answers));
  const result = runSimulation(input);
  return { events: buildLifeEvents(result, input), input, result };
}

describe('life events (single source for timeline + chart)', () => {
  it('is age-based and generates major milestone markers', () => {
    const { events } = eventsFor(BASE);
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => Number.isInteger(e.age) && Number.isInteger(e.year))).toBe(true);

    const types = events.map((e) => e.type);
    expect(types).toContain('now');
    expect(types).toContain('fire');
    expect(types).toContain('education');
    expect(types).toContain('horizon');

    // FIRE開始は希望年齢(=reduceWorkAge)
    const fire = events.find((e) => e.type === 'fire' && e.major);
    expect(fire?.age).toBe(55);
  });

  it('summary (timeline) is a subset of the same events used by the chart', () => {
    const { events } = eventsFor(BASE);
    const summary = summaryEvents(events);
    expect(summary.length).toBeGreaterThan(0);
    expect(summary.length).toBeLessThanOrEqual(5);
    expect(summary.every((s) => events.includes(s))).toBe(true); // 同一オブジェクト=同一データソース
    expect(summary.every((s) => s.major)).toBe(true);
  });

  it('does not break with 0 children (no education event)', () => {
    const { events } = eventsFor({ ...BASE, childrenCount: 0 });
    expect(events.find((e) => e.type === 'education')).toBeUndefined();
    expect(events.find((e) => e.type === 'now')).toBeDefined();
    expect(events.find((e) => e.type === 'horizon')).toBeDefined();
  });

  it('generates a depletion event when assets run out', () => {
    const { events, result } = eventsFor({
      ...BASE,
      currentAssets: 0,
      householdIncome: 300,
      childrenCount: 0,
      workStyle: 'full_retire',
      reduceWorkAge: 41,
      investmentStyle: 'stable',
    });
    expect(result.indicators.assetLongevityAge).not.toBeNull();
    const depletion = events.find((e) => e.type === 'depletion');
    expect(depletion).toBeDefined();
    expect(depletion?.major).toBe(true);
    // 枯渇がある場合、95歳時点イベントは詳細扱い(major=false)
    const horizon = events.find((e) => e.type === 'horizon');
    expect(horizon?.major).toBe(false);
  });

  it('generates a 95-year horizon event (major) when assets never deplete', () => {
    const { events, result } = eventsFor({
      ...BASE,
      currentAssets: 50000,
      householdIncome: 1500,
      childrenCount: 0,
      investmentStyle: 'growth',
      reduceWorkAge: 60,
    });
    expect(result.indicators.assetLongevityAge).toBeNull();
    expect(events.find((e) => e.type === 'depletion')).toBeUndefined();
    const horizon = events.find((e) => e.type === 'horizon');
    expect(horizon?.major).toBe(true);
  });
});
