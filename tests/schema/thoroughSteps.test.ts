import { describe, expect, it } from 'vitest';
import {
  ROUGH_TO_DETAILED,
  THOROUGH_PAGES,
  firstThoroughPageId,
  visibleThoroughPages,
} from '../../src/schema/thoroughSteps';
import { createDefaultInput } from '../../src/schema/defaultValues';
import type { ThoroughStepId } from '../../src/schema/types';

const EXPECTED_STEPS: ThoroughStepId[] = [
  'detailed-basic',
  'detailed-income',
  'detailed-expense',
  'detailed-family',
  'detailed-housing',
  'detailed-fire',
  'detailed-investment',
  'detailed-retirement',
  'detailed-events',
];

describe('thorough steps definition', () => {
  it('defines pages for every detailed stepId', () => {
    const present = new Set(THOROUGH_PAGES.map((p) => p.stepId));
    for (const id of EXPECTED_STEPS) expect(present.has(id)).toBe(true);
  });

  it('uses unique page ids', () => {
    const ids = THOROUGH_PAGES.map((p) => p.pageId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('shows loan pages only for owners (not renters)', () => {
    const input = createDefaultInput('thorough');

    input.housing.type.value = 'rent';
    expect(visibleThoroughPages(input).map((p) => p.pageId)).not.toContain('housing-2');

    input.housing.type.value = 'own';
    expect(visibleThoroughPages(input).map((p) => p.pageId)).toContain('housing-2');
  });

  it('keeps the visible step count (progress denominator) consistent with housing', () => {
    const input = createDefaultInput('thorough');
    // この回帰テストは住まい起因の差分のみを見たいので、FIRE 関連の差分は固定する（side で FIRE ステップを最大表示）。
    input.fire.type.value = 'side';
    input.housing.type.value = 'rent';
    expect(visibleThoroughPages(input).length).toBe(14); // 賃貸はローン関連2ページを非表示
    input.housing.type.value = 'own';
    expect(visibleThoroughPages(input).length).toBe(16); // 持ち家は金利・返済方式を1ページに統合済み
  });

  it('hides the FIRE-after step entirely when 現役継続 (fire.type === "none") is selected', () => {
    const input = createDefaultInput('thorough');
    input.housing.type.value = 'rent';
    input.fire.type.value = 'side';
    const withFire = visibleThoroughPages(input).map((p) => p.pageId);
    expect(withFire).toContain('fire-2');

    input.fire.type.value = 'none';
    const noFire = visibleThoroughPages(input).map((p) => p.pageId);
    expect(noFire).not.toContain('fire-2');
    // fire-1（働き方の方針）は残る（type 自体は選びたいから）
    expect(noFire).toContain('fire-1');
    expect(noFire.length).toBe(withFire.length - 1);
  });

  it('keeps the two record-only mortgage detail pages merged into one', () => {
    const loanPages = THOROUGH_PAGES.filter((p) => p.stepId === 'detailed-housing');
    // 住まい / ローン / 金利・返済方式 の3ページ（金利と返済方式は1ページに統合）
    expect(loanPages.map((p) => p.pageId)).toEqual(['housing-1', 'housing-2', 'housing-3']);
  });

  it('maps rough result categories to detailed steps', () => {
    expect(ROUGH_TO_DETAILED.basic).toBe('detailed-basic');
    expect(ROUGH_TO_DETAILED.family).toBe('detailed-family');
    expect(ROUGH_TO_DETAILED.housing).toBe('detailed-housing');
    expect(ROUGH_TO_DETAILED.fire).toBe('detailed-fire');
    expect(ROUGH_TO_DETAILED.investment).toBe('detailed-investment');
  });

  it('first page is basic for a fresh thorough input', () => {
    const input = createDefaultInput('thorough');
    expect(firstThoroughPageId(input)).toBe('basic-1');
  });

  it('shows FIRE-after income only for side FIRE', () => {
    const page = THOROUGH_PAGES.find((p) => p.pageId === 'fire-2')!;
    const q = page.questions!.find((x) => x.path === 'fire.postFireIncome')!;
    const input = createDefaultInput('thorough');

    input.fire.type.value = 'full';
    expect(q.showIf!(input)).toBe(false);

    input.fire.type.value = 'side';
    expect(q.showIf!(input)).toBe(true);
  });
});
