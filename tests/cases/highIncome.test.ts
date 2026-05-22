import { describe, expect, it } from 'vitest';
import { draftFromAnswers } from '../../src/schema/roughMapping';
import { buildFullInputFromRough } from '../../src/schema/normalize';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import type { RoughFieldId } from '../../src/schema/types';

// 検証用ケース: 高収入・高資産・子ども2人(4歳/2歳)・住宅ローンあり・55歳サイドFIRE。
// 目的は「過度に楽観的にならない」ことの監査。重要項目が結果へ反映されているかを確認する。
const ANSWERS: Partial<Record<RoughFieldId, string | number>> = {
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

describe('verification case: high income, side-FIRE at 55', () => {
  const input = buildFullInputFromRough(draftFromAnswers(ANSWERS));
  const result = runSimulation(input);
  const at = (age: number) => result.rows.find((r) => r.age === age)!;

  it('does NOT use gross income directly (uses take-home)', () => {
    // 額面1200をそのまま労働収入にしていない（手取り≒78%）
    expect(input.basic.takeHomeIncome.value).toBeLessThan(1200);
    expect(at(40).income.labor).toBeLessThan(1200);
    expect(at(40).income.labor).toBeGreaterThan(0);
  });

  it('reflects housing cost for an owner with a loan (not zero)', () => {
    expect(at(45).expense.housing).toBeGreaterThan(0); // 持ち家でも住宅費が0でない
    expect(at(45).expense.housing).toBeCloseTo(11 * 12, 5); // 月11万 × 12
  });

  it('stops the mortgage at payoff (38 + 30 = 68)', () => {
    expect(at(67).expense.housing).toBeGreaterThan(0);
    expect(at(70).expense.housing).toBe(0); // 完済後は住居費が下がる
  });

  it('reflects child ages in the education peak (older child to university ~52)', () => {
    expect(result.indicators.eduPeakResilience.peakAge).toBeGreaterThanOrEqual(50);
    // 子どもが大学を出た後（22歳超）は教育費が無くなる: 4歳の子が22歳 = 親56歳以降
    expect(at(60).expense.education).toBe(0);
  });

  it('stops main labor income at FIRE but keeps side income (no double income)', () => {
    expect(at(54).income.labor).toBeGreaterThan(0);
    expect(at(56).income.labor).toBe(0); // FIRE後は労働収入0
    expect(at(56).income.postFire).toBeCloseTo(20 * 12, 5); // サイド収入 月20万×12
    expect(at(66).income.postFire).toBe(0); // 65歳の就労終了後は0
  });

  it('applies inflation to the expense side', () => {
    expect(at(60).expense.living).toBeGreaterThan(at(40).expense.living);
  });

  it('produces a finite, in-range result (not an absurd value)', () => {
    expect(Number.isFinite(result.indicators.assetsAt95)).toBe(true);
    expect(result.score.total).toBeGreaterThanOrEqual(0);
    expect(result.score.total).toBeLessThanOrEqual(15);
  });

  it('keeps the captured-fields note so the user is not misled', () => {
    // ざっくり由来でも、簡略化注記（税）と利回りモデル注記は表示される
    expect(result.notes.length).toBeGreaterThan(0);
  });
});
