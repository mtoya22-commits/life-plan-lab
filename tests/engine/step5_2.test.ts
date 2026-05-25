import { describe, expect, it } from 'vitest';
import { THOROUGH_PAGES } from '../../src/schema/thoroughSteps';
import { draftFromAnswers } from '../../src/schema/roughMapping';
import { buildFullInputFromRough } from '../../src/schema/normalize';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import { buildLifeEvents } from '../../src/features/results/lifeEvents';
import { judge } from '../../src/engine/judgmentEngine';
import { field } from '../../src/schema/field';
import type { Indicators, RoughFieldId, SimulationInput } from '../../src/schema/types';

function allQuestions() {
  return THOROUGH_PAGES.flatMap((p) => p.questions ?? []);
}
function q(path: string) {
  return allQuestions().find((x) => x.path === path)!;
}

describe('STEP5.2 input dedup / help', () => {
  it('help texts state what NOT to include (avoid double entry)', () => {
    expect(q('expense.monthlyLiving').help).toContain('含めません');
    expect(q('expense.annualSpecial').help).toContain('含めません');
    expect(q('expense.travelCost').help).toContain('入力不要');
    expect(q('expense.insuranceCost').help).toContain('入力不要');
    expect(q('expense.carCost').help).toContain('ライフイベント');
  });

  it('retirement lump sum is defined exactly once (no duplicate input)', () => {
    const lump = allQuestions().filter((x) => x.path === 'income.retirementLumpSum');
    expect(lump).toHaveLength(1);
  });

  it('question order groups monthly -> annual -> one-time', () => {
    const ids = THOROUGH_PAGES.map((p) => p.pageId);
    expect(ids.indexOf('expense-monthly')).toBeLessThan(ids.indexOf('expense-annual'));
    expect(ids.indexOf('expense-annual')).toBeLessThan(ids.indexOf('events'));
    // 現金比率は投資ステップに移動
    expect(q('basic.cashRatio')).toBeDefined();
    expect(THOROUGH_PAGES.find((p) => p.pageId === 'investment-2')!.questions!.some((x) => x.path === 'basic.cashRatio')).toBe(true);
  });
});

// --- 二重計上しない（計算側） ---
function base(): SimulationInput {
  const i = createDefaultInput('thorough');
  i.basic.age = field(40, 'user_input', '年齢', '', '歳');
  i.basic.currentAssets = field(3000, 'user_input', '資産', '', '万円');
  i.basic.householdIncome = field(900, 'user_input', '年収', '', '万円');
  i.income.raiseRate = field(0, 'user_input', '昇給率', '', '%');
  i.investment.returnRate = field(5, 'user_input', '利回り', '', '%');
  i.fire.type = field('side', 'user_input', 'FIRE', '');
  i.fire.targetAge = field(55, 'user_input', '希望年齢', '', '歳');
  i.fire.postFireLiving = field(300, 'user_input', 'FIRE後生活費', '', '万円');
  i.retirement.retirementLiving = field(360, 'user_input', '老後生活費', '', '万円');
  return i;
}
const run = (i: SimulationInput) => runSimulation(applyRecommendedValues(i));
const at = (i: SimulationInput, age: number) => run(i).rows.find((r) => r.age === age)!;

describe('STEP5.2 no double counting', () => {
  it('post-FIRE living vs old-age living switch at 65 (no overlap)', () => {
    const i = base();
    // 60歳: FIRE後生活費(300)・65歳: 老後生活費(360) のみ（合算しない）
    expect(at(i, 60).expense.living).toBeCloseTo(300 * Math.pow(1.02, 20), 0);
    expect(at(i, 66).expense.living).toBeCloseTo(360 * Math.pow(1.02, 26), 0);
  });

  it('education is driven only by per-child settings (no policy double add)', () => {
    const i = base();
    i.children = [
      {
        currentAge: field(10, 'user_input', '子の年齢', '', '歳'),
        ageAssumed: false,
        middleSchool: field('public' as const, 'user_input', '中学', ''),
        highSchool: field('public' as const, 'user_input', '高校', ''),
        university: field('public_humanities' as const, 'user_input', '大学', ''),
        uniLiving: field('home' as const, 'user_input', '住まい', ''),
      },
    ];
    // 高校公立(60万)期: 子1人なので教育費=60万（×インフレ）。二重にならない。
    const r = at(i, 45); // 10歳→15歳=高校
    expect(r.expense.education).toBeCloseTo(60 * Math.pow(1.02, 5), 0);
  });
});

describe('STEP5.2 judgment does not over-trust FIRE rate', () => {
  const ind = (longevity: number | null): Indicators => ({
    fireAchievementRate: 300, // 4%ルールでは高い
    assetLongevityAge: longevity,
    assetsAt95: 0,
    eduPeakResilience: { peakAge: 50, netCashFlow: 0, pctOfAssets: 0 },
    mortgageBurden: 0.1,
    cumulativeShortfall: longevity === null ? 0 : 5000,
  });

  it('short asset longevity caps the band below 安定', () => {
    expect(judge(ind(70)).band).toBe('tough'); // <75
    expect(judge(ind(81)).band).not.toBe('stable'); // 81 → needs_adjust 以下
    expect(judge(ind(81)).band === 'needs_adjust' || judge(ind(81)).band === 'tough').toBe(true);
  });
});

const HIGH_INCOME: Partial<Record<RoughFieldId, string | number>> = {
  age: 38,
  householdIncome: 1200,
  currentAssets: 3200,
  monthlyLiving: 35,
  monthlyHousing: 11,
  loanYears: 30,
  childrenCount: 2,
  educationPolicy: 'some_private',
  childAge1: 4,
  childAge2: 2,
  housing: 'own',
  workStyle: 'work_a_little',
  reduceWorkAge: 55,
  postFireLiving: 30,
  sideFireIncome: 20,
  investmentStyle: 'balanced',
};

describe('STEP5.2 display consistency (high income)', () => {
  const input = buildFullInputFromRough(draftFromAnswers(HIGH_INCOME));
  const result = runSimulation(input);
  const events = buildLifeEvents(result, input);

  it('Hero / timeline / chart all reference the same depletion age', () => {
    const longevity = result.indicators.assetLongevityAge;
    expect(longevity).not.toBeNull();
    const depletionEvent = events.find((e) => e.type === 'depletion');
    expect(depletionEvent?.age).toBe(longevity);
    const rowAtDepletion = result.rows.find((r) => r.age === longevity)!;
    expect(rowAtDepletion.endAssets).toBe(0); // グラフも同じ地点で0
  });

  it('95-year point is shown as 0 + shortfall, never negative', () => {
    expect(result.indicators.assetsAt95).toBe(0);
    expect(result.indicators.cumulativeShortfall).toBeGreaterThan(0);
    expect(result.rows.every((r) => r.endAssets >= 0)).toBe(true);
  });

  it('is not labelled 安定 despite a high FIRE rate', () => {
    expect(result.indicators.fireAchievementRate).toBeGreaterThan(100);
    expect(result.score.band).not.toBe('stable');
  });
});
