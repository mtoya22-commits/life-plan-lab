import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import App from '../../src/App';
import { useInputStore } from '../../src/store/inputStore';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { field } from '../../src/schema/field';
import type { FireType, SimulationInput } from '../../src/schema/types';

// STEP11.14: UIUX監査で見つかった「現役継続 (fire.type === 'none') に残る FIRE 表記」の除去を固定する。
// - Hero の FIRE準備率 脚注は 'none' では出さない
// - スコア項目は 'none' では「老後資金準備率」（配点は共通）
// - 試算条件に「FIRE後生活費」を出さない（ブリッジ年がある場合は「退職後の生活費」）
// - 住宅ローン文言は「退職後も返済が…」に分岐
// - 編集導線は「働き方・退職を修正」
// - 退職予定年齢に「退職」マーカーが出る

const store = () => useInputStore.getState();

function makeInput(fireType: FireType, retirementAge = 65): SimulationInput {
  const i = createDefaultInput('thorough');
  i.basic.age = field(40, 'user_input', '年齢', '', '歳');
  i.basic.currentAssets = field(3000, 'user_input', '資産', '', '万円');
  i.basic.householdIncome = field(800, 'user_input', '年収', '', '万円');
  i.expense.monthlyLiving = field(25, 'user_input', '生活費', '', '万円');
  i.investment.returnRate = field(4, 'user_input', '利回り', '', '%');
  i.investment.inflationRate = field(2, 'user_input', 'インフレ', '', '%');
  i.fire.type = field(fireType, 'user_input', '働き方の方針', '');
  i.fire.targetAge = field(55, 'user_input', 'FIRE希望年齢', '', '歳');
  i.income.retirementAge = field(retirementAge, 'user_input', '退職予定年齢', '', '歳');
  i.retirement.pension = field(200, 'user_input', '年金', '', '万円');
  i.retirement.retirementLiving = field(260, 'user_input', '老後生活費', '', '万円');
  // 持ち家 + 退職後も返済が残る残年数（caption 分岐の検証用）
  i.housing.type = field('own', 'user_input', '住まい', '');
  i.housing.monthlyPayment = field(10, 'user_input', '毎月返済', '', '万円');
  i.housing.remainingYears = field(30, 'user_input', '残年数', '', '年');
  return i;
}

describe('engine: score/assumptions/notes wording for 現役継続', () => {
  it('score item label is 老後資金準備率 for none, FIRE達成率 for side (same scoring)', () => {
    const none = runSimulation(applyRecommendedValues(makeInput('none')));
    const side = runSimulation(applyRecommendedValues(makeInput('side')));
    const noneItem = none.score.byIndicator.find((s) => s.key === 'fireAchievementRate')!;
    const sideItem = side.score.byIndicator.find((s) => s.key === 'fireAchievementRate')!;
    expect(noneItem.label).toBe('老後資金準備率');
    expect(sideItem.label).toBe('FIRE達成率');
  });

  it('assumptions omit FIRE後生活費 for none with retirementAge >= 65', () => {
    const result = runSimulation(applyRecommendedValues(makeInput('none', 65)));
    const labels = result.assumptions.map((a) => a.label);
    expect(labels.find((l) => l.includes('FIRE後'))).toBeUndefined();
    expect(labels.find((l) => l.includes('退職後の生活費'))).toBeUndefined();
  });

  it('assumptions relabel the bridge living cost to 退職後の生活費 for none with early retirement', () => {
    const result = runSimulation(applyRecommendedValues(makeInput('none', 60)));
    const labels = result.assumptions.map((a) => a.label);
    expect(labels).toContain('退職後の生活費');
    expect(labels.find((l) => l.includes('FIRE後'))).toBeUndefined();
  });

  it('notes use 退職後 instead of FIRE後 for none mode', () => {
    const none = runSimulation(applyRecommendedValues(makeInput('none')));
    expect(none.notes.join('')).not.toContain('FIRE後');
    expect(none.notes.join('')).not.toContain('FIRE準備率');
    expect(none.notes.join('')).toContain('老後資金準備率');

    const side = runSimulation(applyRecommendedValues(makeInput('side')));
    expect(side.notes.join('')).toContain('FIRE後');
  });

  it('emits a 退職 (full_retire) marker at retirementAge for none mode', () => {
    const result = runSimulation(applyRecommendedValues(makeInput('none', 60)));
    const markers = result.rows.flatMap((r) => r.events);
    const retire = markers.find((e) => e.kind === 'full_retire');
    expect(retire).toBeDefined();
    expect(retire!.age).toBe(60);
    expect(retire!.label).toBe('退職');
    // FIRE 系イベントは出ない
    expect(markers.find((e) => e.kind === 'fire_start' || e.kind === 'side_fire_start')).toBeUndefined();
  });

  it('keeps the FIRE開始 marker (not 退職) for full-FIRE users', () => {
    const result = runSimulation(applyRecommendedValues(makeInput('full')));
    const markers = result.rows.flatMap((r) => r.events);
    expect(markers.find((e) => e.kind === 'fire_start')).toBeDefined();
    expect(markers.find((e) => e.kind === 'full_retire' && e.label === '退職')).toBeUndefined();
  });
});

describe('result screen: FIRE wording is hidden for 現役継続', () => {
  afterEach(cleanup);

  function renderNoneResult(retirementAge = 65) {
    store().reset();
    store().loadThoroughSample(false);
    const ti = store().thoroughInput!;
    ti.fire.type.value = 'none';
    ti.fire.type.source = 'user_input';
    ti.income.retirementAge.value = retirementAge;
    store().submitThorough();
    return render(<App />);
  }

  it('hides the FIRE準備率 hero footnote for none, shows it for the sample (side) result', () => {
    const { container } = renderNoneResult();
    expect(container.textContent).not.toContain('FIRE準備率');
    cleanup();

    store().reset();
    store().loadThoroughSample(true); // sample は side
    const { container: c2 } = render(<App />);
    expect(c2.textContent).toContain('FIRE準備率');
  });

  it('mortgage card caption says 退職後 (not FIRE後) for none mode', () => {
    const { container } = renderNoneResult(60);
    // 持ち家サンプルでは完済が退職より後ろのケース。FIRE後 文言が出ないことだけを固定する。
    expect(container.textContent).not.toContain('FIRE後も返済');
  });

  it('rough edit links relabel FIRE条件を修正 → 働き方・退職を修正 for none', () => {
    store().reset();
    store().loadSample(); // rough サンプル（side）で結果へ
    const input = store().input!;
    input.fire.type.value = 'none';
    // 再計算せずとも EditLinks は store の input を読むため、再レンダリングで反映される
    const { container } = render(<App />);
    expect(container.textContent).toContain('働き方・退職を修正');
    expect(container.textContent).not.toContain('FIRE条件を修正');
  });
});
