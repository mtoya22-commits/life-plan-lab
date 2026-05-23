import { describe, expect, it } from 'vitest';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import { buildLifeEvents } from '../../src/features/results/lifeEvents';
import {
  currentLifePhase,
  educationSettleAge,
  nextMilestone,
  upcomingMilestones,
} from '../../src/features/results/lifePhase';
import { field } from '../../src/schema/field';
import type { ChildInput, LifeEvent, SimulationInput } from '../../src/schema/types';

function child(age: number): ChildInput {
  return {
    currentAge: field(age, 'user_input', '子の年齢', '', '歳'),
    ageAssumed: false,
    middleSchool: field('public', 'user_input', '中学', ''),
    highSchool: field('public', 'user_input', '高校', ''),
    university: field('private_humanities', 'user_input', '大学', ''),
    uniLiving: field('away', 'user_input', '住まい', ''),
  };
}
function ev(id: string, label: string, age: number, amount: number): LifeEvent {
  return {
    id,
    label: field(label, 'user_input', label, ''),
    atAge: field(age, 'user_input', '年齢', '', '歳'),
    amount: field(amount, 'user_input', '金額', '', '万円'),
  };
}

function base(): SimulationInput {
  const i = createDefaultInput('thorough');
  i.basic.age = field(38, 'user_input', '', '', '歳');
  i.basic.householdIncome = field(1000, 'user_input', '', '', '万円');
  i.basic.takeHomeIncome = field(700, 'user_input', '', '', '万円');
  i.basic.currentAssets = field(2000, 'user_input', '', '', '万円');
  i.fire.type = field('side', 'user_input', '', '');
  i.fire.targetAge = field(55, 'user_input', '', '', '歳');
  i.children = [child(4), child(2)];
  i.housing.type = field('own', 'user_input', '', '');
  i.housing.monthlyPayment = field(11, 'user_input', '', '', '万円');
  i.housing.remainingYears = field(30, 'user_input', '', '', '年');
  i.lifeEvents = [ev('car', '車購入', 45, 500), ev('reform', 'リフォーム', 50, 200)];
  return i;
}
const run = (i: SimulationInput) => runSimulation(applyRecommendedValues(i));

describe('STEP6 life phase', () => {
  it('young parent before FIRE with kids → education prep/peak (accumulation family stage)', () => {
    const i = base();
    const phase = currentLifePhase(i, run(i));
    expect(['edu_prep', 'edu_peak']).toContain(phase.key);
    expect(phase.label.length).toBeGreaterThan(0);
    expect(phase.description).toContain('今は');
  });

  it('after FIRE start (side) → side FIRE phase', () => {
    const i = base();
    i.basic.age = field(57, 'user_input', '', '', '歳');
    i.children = [];
    expect(currentLifePhase(i, run(i)).key).toBe('side_fire');
  });

  it('age >= 65 → pension phase', () => {
    const i = base();
    i.basic.age = field(67, 'user_input', '', '', '歳');
    i.children = [];
    expect(currentLifePhase(i, run(i)).key).toBe('pension');
  });

  it('approaching FIRE within 5 years (no kids) → pre-FIRE phase', () => {
    const i = base();
    i.basic.age = field(52, 'user_input', '', '', '歳');
    i.children = [];
    expect(currentLifePhase(i, run(i)).key).toBe('pre_fire');
  });

  it('no kids, no FIRE, mid-career → accumulation phase', () => {
    const i = base();
    i.basic.age = field(40, 'user_input', '', '', '歳');
    i.fire.type = field('none', 'user_input', '', '');
    i.children = [];
    expect(currentLifePhase(i, run(i)).key).toBe('accumulation');
  });
});

describe('STEP6 next milestone', () => {
  it('returns the nearest upcoming positive milestone (not depletion/now/95)', () => {
    const i = base();
    const r = run(i);
    const events = buildLifeEvents(r, applyRecommendedValues(i));
    const next = nextMilestone(events, i.basic.age.value)!;
    expect(next).toBeDefined();
    expect(next.age).toBeGreaterThan(i.basic.age.value);
    expect(['now', 'depletion', 'horizon']).not.toContain(next.type);
    // 38歳時点で最初に来るのは車購入(45)か教育費ピークなど、45以下の節目。
    expect(next.age).toBeLessThanOrEqual(45);
  });

  it('upcomingMilestones returns several in age order', () => {
    const i = base();
    const r = run(i);
    const events = buildLifeEvents(r, applyRecommendedValues(i));
    const ups = upcomingMilestones(events, i.basic.age.value, 3);
    expect(ups.length).toBeGreaterThan(1);
    for (let k = 1; k < ups.length; k++) expect(ups[k].age).toBeGreaterThanOrEqual(ups[k - 1].age);
  });

  it('education settles after the peak when there are children', () => {
    const i = base();
    const r = run(i);
    const peak = r.indicators.eduPeakResilience.peakAge;
    const settle = educationSettleAge(i, r);
    expect(settle).not.toBeNull();
    expect(settle!).toBeGreaterThanOrEqual(peak);
  });

  it('education settle is null without children', () => {
    const i = base();
    i.children = [];
    expect(educationSettleAge(i, run(i))).toBeNull();
  });
});
