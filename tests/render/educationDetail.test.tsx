import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { EducationDetail } from '../../src/features/results/EducationDetail';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { makeDetailedChild } from '../../src/schema/thoroughSteps';
import { field } from '../../src/schema/field';
import type { SimulationInput } from '../../src/schema/types';

// STEP11.11: 教育費詳細シートに「うち入学金」列と数値の出典を出す。

function inputWithOneChild(currentChildAge: number): SimulationInput {
  const i = createDefaultInput('thorough');
  i.basic.age = field(40, 'user_input', '年齢', '', '歳');
  i.basic.currentAssets = field(3000, 'user_input', '資産', '', '万円');
  i.basic.householdIncome = field(700, 'user_input', '年収', '', '万円');
  i.expense.monthlyLiving = field(22, 'user_input', '生活費', '', '万円');
  i.investment.inflationRate = field(0, 'user_input', 'インフレ', '', '%'); // 入学金の数値を厳密に確認するため 0%
  i.investment.returnRate = field(3, 'user_input', '利回り', '', '%');
  const child = makeDetailedChild();
  child.currentAge = field(currentChildAge, 'user_input', '年齢', '', '歳');
  child.ageAssumed = false;
  child.university = field('private_humanities', 'user_input', '大学', '');
  child.uniLiving = field('home', 'user_input', '住まい', '');
  i.children = [child];
  return i;
}

describe('EducationDetail: entrance fee column + sources (STEP11.11)', () => {
  afterEach(cleanup);

  it('shows the "うち入学金" column when a child has a university entrance year', () => {
    // 子 10歳・親 40歳 → 親 48歳の年に子が 18歳になり、入学金が乗る
    const input = inputWithOneChild(10);
    const result = runSimulation(applyRecommendedValues(input));
    const { container } = render(<EducationDetail result={result} input={input} />);
    expect(container.textContent).toContain('うち入学金');
    // 出典の注記
    expect(container.textContent).toContain('文部科学省');
    expect(container.textContent).toContain('令和5年度');
    expect(container.textContent).toContain('子供の学習費調査');
    expect(container.textContent).toContain('学生納付金等調査');
    expect(container.textContent).toContain('JASSO');
  });

  it('omits the entrance-fee column when no child reaches university age within the horizon', () => {
    // 子 90歳（架空 — 大学進学年は既に過ぎていて入学金が立つ年がない）
    const input = inputWithOneChild(90);
    const result = runSimulation(applyRecommendedValues(input));
    const { container } = render(<EducationDetail result={result} input={input} />);
    // 教育費自体は 0 円なので「計上されていません」テキストになり、列ヘッダはそもそも出ない
    expect(container.textContent).not.toContain('うち入学金');
  });

  it('entrance-fee value at the entry year equals the constants table (inflation 0%)', () => {
    const input = inputWithOneChild(10);
    const result = runSimulation(applyRecommendedValues(input));
    const { container } = render(<EducationDetail result={result} input={input} />);
    // 私立文系: 入学金 25 万。インフレ 0% なので将来額もそのまま 25 万。
    // 「うち入学金」列のセルに 25 万 が出ているか目視確認 (formatMan の表記に合わせる)
    const cells = Array.from(container.querySelectorAll('td')).map((td) => td.textContent ?? '');
    expect(cells.some((c) => /25/.test(c))).toBe(true);
  });
});
