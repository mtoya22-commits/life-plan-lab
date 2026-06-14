import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import App from '../../src/App';
import { useInputStore } from '../../src/store/inputStore';
import { judge, weakestFactor } from '../../src/engine/judgmentEngine';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { field } from '../../src/schema/field';
import type { FireType, SimulationInput } from '../../src/schema/types';

// 結果 Hero の再設計（スコア表記削除・帯ラベル短縮・モード前置き・次の一手）。
// 判定しきい値や指標の計算は変えない。Hero の見せ方とコピーだけを固定する。

const store = () => useInputStore.getState();

function makeInput(fireType: FireType, retirementAge = 65, targetAge = 55): SimulationInput {
  const i = createDefaultInput('thorough');
  i.basic.age = field(40, 'user_input', '年齢', '', '歳');
  i.basic.currentAssets = field(3000, 'user_input', '資産', '', '万円');
  i.basic.householdIncome = field(800, 'user_input', '年収', '', '万円');
  i.expense.monthlyLiving = field(25, 'user_input', '生活費', '', '万円');
  i.investment.returnRate = field(4, 'user_input', '利回り', '', '%');
  i.investment.inflationRate = field(2, 'user_input', 'インフレ', '', '%');
  i.fire.type = field(fireType, 'user_input', '働き方の方針', '');
  i.fire.targetAge = field(targetAge, 'user_input', 'FIRE希望年齢', '', '歳');
  i.income.retirementAge = field(retirementAge, 'user_input', '退職予定年齢', '', '歳');
  i.retirement.pension = field(200, 'user_input', '年金', '', '万円');
  i.retirement.retirementLiving = field(260, 'user_input', '老後生活費', '', '万円');
  i.housing.type = field('own', 'user_input', '住まい', '');
  i.housing.monthlyPayment = field(10, 'user_input', '毎月返済', '', '万円');
  i.housing.remainingYears = field(30, 'user_input', '残年数', '', '年');
  return i;
}

function renderWith(input: SimulationInput) {
  store().reset();
  store().loadThoroughSample(true);
  // テスト入力に差し替え
  const ti = store().thoroughInput!;
  Object.assign(ti, input);
  store().submitThorough();
  return render(<App />);
}

describe('Hero 再設計: スコア表記を消す + 帯ラベルを短く', () => {
  afterEach(cleanup);

  it('帯バッジに「（X / 15）」のスコア表記が含まれない', () => {
    store().reset();
    store().loadThoroughSample(true);
    const { container } = render(<App />);
    const band = container.querySelector('.hero__band');
    expect(band).not.toBeNull();
    expect(band!.textContent).not.toMatch(/\d+\s*\/\s*15/);
  });

  it('帯ラベルは短縮版（安定/現実的/調整余地あり/見直し推奨）のいずれか', () => {
    store().reset();
    store().loadThoroughSample(true);
    const { container } = render(<App />);
    const label = container.querySelector('.hero__band-label')!.textContent ?? '';
    expect(['安定', '現実的', '調整余地あり', '見直し推奨']).toContain(label.trim());
  });

  it('帯バッジは <details><summary> 構造で、判定の根拠が 5 項目展開される', () => {
    store().reset();
    store().loadThoroughSample(true);
    const { container } = render(<App />);
    const judgeBlock = container.querySelector('.hero__judge');
    expect(judgeBlock?.tagName).toBe('DETAILS');
    const items = container.querySelectorAll('.hero__judge-item');
    expect(items.length).toBe(5);
  });
});

describe('Hero 再設計: モード別の前提前置き', () => {
  afterEach(cleanup);

  it("fireType='none' は「現役継続の前提で」を主見出し上に出す", () => {
    const { container } = renderWith(makeInput('none', 65));
    const lead = container.querySelector('.hero__lead');
    expect(lead?.textContent).toBe('現役継続の前提で');
  });

  it("fireType='full' は「△歳で完全リタイアする前提で」を出す", () => {
    const { container } = renderWith(makeInput('full', 65, 55));
    const lead = container.querySelector('.hero__lead');
    expect(lead?.textContent).toBe('55歳で完全リタイアする前提で');
  });

  it("fireType='side' は「△歳から副業中心に切り替える前提で」を出す", () => {
    const { container } = renderWith(makeInput('side', 65, 50));
    const lead = container.querySelector('.hero__lead');
    expect(lead?.textContent).toBe('50歳から副業中心に切り替える前提で');
  });
});

describe('Hero 再設計: 「動かすと変わりやすい項目」プロンプト', () => {
  beforeEach(() => store().reset());
  afterEach(cleanup);

  it("band='stable' のときは出さない", () => {
    // 安定する条件（高資産・低生活費・現役継続）
    const input = makeInput('none', 70);
    input.basic.currentAssets = field(20000, 'user_input', '資産', '', '万円');
    input.expense.monthlyLiving = field(15, 'user_input', '生活費', '', '万円');
    const result = runSimulation(applyRecommendedValues(input));
    if (result.score.band !== 'stable') {
      // テストの前提が崩れていたらスキップではなく明示失敗（将来の判定変更で気づけるように）
      throw new Error(`expected stable band for the fixture, got ${result.score.band}`);
    }
    const { container } = renderWith(input);
    expect(container.querySelector('.hero__nextstep')).toBeNull();
  });

  it('band が realistic 以下のときは weakest 項目を 1 行で表示する', () => {
    // 厳しめ条件（低資産・高生活費・FIRE フル）
    const input = makeInput('full', 65, 45);
    input.basic.currentAssets = field(100, 'user_input', '資産', '', '万円');
    input.expense.monthlyLiving = field(35, 'user_input', '生活費', '', '万円');
    const result = runSimulation(applyRecommendedValues(input));
    expect(result.score.band).not.toBe('stable');
    const weakest = weakestFactor(result.score)!;
    const { container } = renderWith(input);
    const nextstep = container.querySelector('.hero__nextstep');
    expect(nextstep).not.toBeNull();
    expect(nextstep!.textContent).toContain('動かすと変わりやすい項目');
    expect(nextstep!.textContent).toContain(weakest.label);
  });
});

describe('weakestFactor: 引数 score の最弱項目を返す', () => {
  it("band='stable' の score では null を返す", () => {
    const input = makeInput('none', 70);
    input.basic.currentAssets = field(50000, 'user_input', '資産', '', '万円');
    input.expense.monthlyLiving = field(10, 'user_input', '生活費', '', '万円');
    const result = runSimulation(applyRecommendedValues(input));
    if (result.score.band === 'stable') {
      expect(weakestFactor(result.score)).toBeNull();
    }
  });

  it('最も点数が低い項目を返す（同点なら byIndicator 順の先頭）', () => {
    const input = makeInput('full', 65, 45);
    input.basic.currentAssets = field(50, 'user_input', '資産', '', '万円');
    input.expense.monthlyLiving = field(40, 'user_input', '生活費', '', '万円');
    const score = judge(runSimulation(applyRecommendedValues(input)).indicators, 'full');
    const w = weakestFactor(score);
    expect(w).not.toBeNull();
    const minPoints = Math.min(...score.byIndicator.map((it) => it.points));
    expect(w!.points).toBe(minPoints);
  });
});
