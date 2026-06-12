import { describe, expect, it } from 'vitest';
import { childAllowanceForChild, totalChildAllowance } from '../../src/engine/educationCostEngine';
import { CHILD_ALLOWANCE } from '../../src/engine/constants';
import { field } from '../../src/schema/field';
import type { ChildInput } from '../../src/schema/types';

// STEP11.17-A: 児童手当（R6 改定: 所得制限撤廃・高校生まで対象拡大）。
// 第 1〜2 子: 0〜2歳 月15,000円・3〜17歳 月10,000円 / 第 3 子以降: 0〜17歳 月30,000円。

function makeChild(currentAge: number): ChildInput {
  return {
    currentAge: field(currentAge, 'user_input', '年齢', '', '歳'),
    ageAssumed: false,
    elementarySchool: field('public', 'user_input', '小学校', ''),
    middleSchool: field('public', 'user_input', '中学', ''),
    highSchool: field('public', 'user_input', '高校', ''),
    university: field('public_humanities', 'user_input', '大学', ''),
    uniLiving: field('home', 'user_input', '住まい', ''),
  };
}

describe('childAllowanceForChild', () => {
  it('0〜2歳の第1子: 月15,000円 → 年18万円', () => {
    expect(childAllowanceForChild(makeChild(0), 0, 1)).toBe(18);
    expect(childAllowanceForChild(makeChild(0), 2, 1)).toBe(18);
  });

  it('3〜17歳の第1子: 月10,000円 → 年12万円', () => {
    expect(childAllowanceForChild(makeChild(0), 3, 1)).toBe(12);
    expect(childAllowanceForChild(makeChild(0), 17, 1)).toBe(12);
  });

  it('18歳以降は支給なし', () => {
    expect(childAllowanceForChild(makeChild(0), 18, 1)).toBe(0);
    expect(childAllowanceForChild(makeChild(0), 25, 1)).toBe(0);
  });

  it('第3子以降は0〜17歳ずっと月30,000円 → 年36万円', () => {
    expect(childAllowanceForChild(makeChild(0), 0, 3)).toBe(36);
    expect(childAllowanceForChild(makeChild(0), 5, 3)).toBe(36);
    expect(childAllowanceForChild(makeChild(0), 17, 4)).toBe(36);
    expect(childAllowanceForChild(makeChild(0), 18, 3)).toBe(0);
  });

  it('定数値が R6 改定に整合', () => {
    expect(CHILD_ALLOWANCE.firstOrSecond.under3).toBe(18);
    expect(CHILD_ALLOWANCE.firstOrSecond.age3to17).toBe(12);
    expect(CHILD_ALLOWANCE.thirdOrLater.age0to17).toBe(36);
  });
});

describe('totalChildAllowance: birth-order resolution', () => {
  it('子なしは0', () => {
    expect(totalChildAllowance([], 0)).toBe(0);
  });

  it('現時点での最年長を第1子として birthOrder を割り当てる', () => {
    // 8歳・5歳・1歳 → birthOrder = 1, 2, 3。
    // 8歳: 第1子 3〜17歳 = 12万、5歳: 第2子 3〜17歳 = 12万、1歳: 第3子 0〜2歳 = 36万
    const children = [makeChild(8), makeChild(5), makeChild(1)];
    expect(totalChildAllowance(children, 0)).toBe(12 + 12 + 36);
  });

  it('入力順序が age 順でなくても結果は変わらない（age 降順で birthOrder 決定）', () => {
    const a = [makeChild(1), makeChild(8), makeChild(5)];
    const b = [makeChild(8), makeChild(5), makeChild(1)];
    expect(totalChildAllowance(a, 0)).toBe(totalChildAllowance(b, 0));
  });

  it('yearOffset 進行で子が 18 歳を超えると手当が消える', () => {
    const children = [makeChild(16)]; // 第1子
    expect(totalChildAllowance(children, 0)).toBe(12); // 16歳
    expect(totalChildAllowance(children, 1)).toBe(12); // 17歳
    expect(totalChildAllowance(children, 2)).toBe(0); // 18歳
  });

  it('2人世帯で 16歳と 2歳: 12万 + 18万 = 30万', () => {
    const children = [makeChild(16), makeChild(2)];
    expect(totalChildAllowance(children, 0)).toBe(30);
  });

  it('4人世帯（10/7/4/1歳）: 12+12+36+36 = 96万', () => {
    const children = [makeChild(10), makeChild(7), makeChild(4), makeChild(1)];
    // 第1子(10歳)=12, 第2子(7歳)=12, 第3子(4歳)=36, 第4子(1歳)=36
    expect(totalChildAllowance(children, 0)).toBe(96);
  });
});

describe('engine integration: child allowance flows into income.other', () => {
  it('runSimulation で子持ち世帯の other 収入に手当が含まれる', async () => {
    const { runSimulation } = await import('../../src/engine/annualSimulationEngine');
    const { applyRecommendedValues } = await import('../../src/schema/recommendedValues');
    const { createDefaultInput } = await import('../../src/schema/defaultValues');

    const i = createDefaultInput('thorough');
    i.basic.age = field(35, 'user_input', '年齢', '', '歳');
    i.basic.currentAssets = field(1500, 'user_input', '資産', '', '万円');
    i.basic.householdIncome = field(700, 'user_input', '年収', '', '万円');
    i.expense.monthlyLiving = field(22, 'user_input', '生活費', '', '万円');
    i.investment.inflationRate = field(0, 'user_input', 'インフレ', '', '%'); // 額面比較のため0%
    i.investment.returnRate = field(3, 'user_input', '利回り', '', '%');
    i.children = [makeChild(5), makeChild(2)];
    // 第1子(5歳)=12, 第2子(2歳)=18 → 30万/年
    const result = runSimulation(applyRecommendedValues(i));
    const row = result.rows[0]; // 親35歳の年
    expect(row.income.other).toBeGreaterThanOrEqual(30);
  });

  it('子なし世帯では other に手当が乗らない', async () => {
    const { runSimulation } = await import('../../src/engine/annualSimulationEngine');
    const { applyRecommendedValues } = await import('../../src/schema/recommendedValues');
    const { createDefaultInput } = await import('../../src/schema/defaultValues');

    const i = createDefaultInput('thorough');
    i.basic.age = field(35, 'user_input', '年齢', '', '歳');
    i.basic.currentAssets = field(1500, 'user_input', '資産', '', '万円');
    i.basic.householdIncome = field(700, 'user_input', '年収', '', '万円');
    i.expense.monthlyLiving = field(22, 'user_input', '生活費', '', '万円');
    i.investment.inflationRate = field(0, 'user_input', 'インフレ', '', '%');
    i.investment.returnRate = field(3, 'user_input', '利回り', '', '%');
    i.children = [];
    const result = runSimulation(applyRecommendedValues(i));
    const row = result.rows[0];
    // other は退職一時金もないので 0 のはず
    expect(row.income.other).toBe(0);
  });
});
