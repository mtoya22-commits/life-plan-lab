import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import App from '../../src/App';
import { useInputStore } from '../../src/store/inputStore';
import { applyRoughDraft } from '../../src/schema/roughMapping';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { THOROUGH_PAGES } from '../../src/schema/thoroughSteps';
import { field } from '../../src/schema/field';

// STEP11.12: 「現役継続」(fire.type === 'none') の UI 露出とラベル分岐の回帰テスト。
// 計算ロジック側は STEP11.10 以前から 'none' 分岐済み。今回は UI / mapping の追加を固定する。

const store = () => useInputStore.getState();

describe('rough flow: 現役継続 ("keep_working") option', () => {
  beforeEach(() => store().reset());
  afterEach(cleanup);

  it('exposes 現役で働き続けたい as a workStyle choice on top of the existing 3', () => {
    store().setMode('rough');
    // 「これからの働き方」ステップ（index 4）に遷移
    while (store().roughPage < 4) store().nextRoughPage();
    render(<App />);
    expect(screen.getByText('現役で働き続けたい')).toBeTruthy();
    expect(screen.getByText('完全リタイアしたい')).toBeTruthy();
    expect(screen.getByText('少し働きたい')).toBeTruthy();
  });

  it('maps keep_working → fire.type "none" via applyRoughDraft', () => {
    const base = createDefaultInput('rough');
    const draft = {
      ...store().roughDraft,
      workStyle: { value: 'keep_working', source: 'user_input' as const },
    } as typeof store extends () => { roughDraft: infer D } ? D : never;
    const out = applyRoughDraft(base, draft);
    expect(out.fire.type.value).toBe('none');
    expect(out.fire.type.source).toBe('user_input');
  });

  it('hides sideFireIncome and postFireLiving questions when keep_working is selected', () => {
    store().setMode('rough');
    store().setRoughValue('workStyle', 'keep_working');
    // 「FIRE後の暮らし」ステップ（index 5）へ
    while (store().roughPage < 5) store().nextRoughPage();
    render(<App />);
    expect(screen.queryByText(/サイドFIRE後の毎月収入/)).toBeNull();
    expect(screen.queryByText(/FIRE後の毎月生活費/)).toBeNull();
  });

  it('uses the neutral "働き方を変える年齢" label (not FIRE-specific)', () => {
    store().setMode('rough');
    while (store().roughPage < 4) store().nextRoughPage();
    render(<App />);
    expect(screen.getByText('働き方を変える年齢')).toBeTruthy();
  });
});

describe('thorough flow: 現役継続 option on fire.type', () => {
  afterEach(cleanup);

  it('exposes 現役継続 as the third fire.type choice', () => {
    const fire1 = THOROUGH_PAGES.find((p) => p.pageId === 'fire-1')!;
    const typeQ = fire1.questions!.find((q) => q.path === 'fire.type')!;
    const values = typeQ.options!.map((o) => o.value);
    expect(values).toEqual(['full', 'side', 'none']);
    expect(typeQ.options!.find((o) => o.value === 'none')!.label).toBe('現役継続');
  });

  it('hides fire.targetAge on fire-1 when type === "none"', () => {
    const fire1 = THOROUGH_PAGES.find((p) => p.pageId === 'fire-1')!;
    const targetAgeQ = fire1.questions!.find((q) => q.path === 'fire.targetAge')!;
    expect(targetAgeQ.showIf).toBeDefined();

    const input = createDefaultInput('thorough');
    input.fire.type.value = 'side';
    expect(targetAgeQ.showIf!(input)).toBe(true);

    input.fire.type.value = 'full';
    expect(targetAgeQ.showIf!(input)).toBe(true);

    input.fire.type.value = 'none';
    expect(targetAgeQ.showIf!(input)).toBe(false);
  });
});

describe('engine: 現役継続 produces a sensible result without FIRE event', () => {
  it('simulates without crashing and assets at 95 is finite (no FIRE event in markers)', () => {
    const i = createDefaultInput('thorough');
    i.basic.age = field(40, 'user_input', '年齢', '', '歳');
    i.basic.currentAssets = field(2000, 'user_input', '資産', '', '万円');
    i.basic.householdIncome = field(700, 'user_input', '年収', '', '万円');
    i.expense.monthlyLiving = field(25, 'user_input', '生活費', '', '万円');
    i.investment.returnRate = field(4, 'user_input', '利回り', '', '%');
    i.investment.inflationRate = field(2, 'user_input', 'インフレ', '', '%');
    i.fire.type = field('none', 'user_input', '働き方の方針', '');
    i.income.retirementAge = field(65, 'user_input', '退職予定年齢', '', '歳');
    i.retirement.pension = field(200, 'user_input', '年金', '', '万円');
    i.retirement.retirementLiving = field(260, 'user_input', '老後生活費', '', '万円');

    const result = runSimulation(applyRecommendedValues(i));
    expect(Number.isFinite(result.indicators.assetsAt95)).toBe(true);

    // FIRE 開始イベントが生まれていないこと（現役継続なので）
    const allEvents = result.rows.flatMap((r) => r.events);
    expect(allEvents.find((e) => e.kind === 'fire_start' || e.kind === 'side_fire_start')).toBeUndefined();
  });
});
