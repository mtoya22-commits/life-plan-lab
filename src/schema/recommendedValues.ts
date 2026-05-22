import type { InvestmentStyle, SimulationInput } from './types';

// =============================================================================
// おすすめ値（「迷ったらこれ」）の導出
// 思想: 年齢・年収・子ども数などの分かっている情報から、未入力項目の妥当な値を導く。
// ここで埋めた値は source='recommended_value' として結果画面に明示する。
// =============================================================================

/** 投資スタイルから想定利回り（%）を引く。 */
export function returnRateForStyle(style: InvestmentStyle): number {
  switch (style) {
    case 'stable':
      return 3;
    case 'balanced':
      return 5;
    case 'growth':
      return 7;
  }
}

/**
 * すでに分かっている入力を元に、おすすめ値で埋めた SimulationInput を返す。
 * buildFullInput から呼ばれ、ユーザー入力 > おすすめ値 > 標準値 の優先順位で合成される。
 *
 * TODO(実装): 現状は代表的な3項目のみ。FIRE後生活費・老後生活費・年金概算などを順次追加する。
 */
export function applyRecommendedValues(input: SimulationInput): SimulationInput {
  const next = structuredClone(input);

  // FIRE後生活費が未確定なら、現在生活費(月)×12×90% をおすすめ値にする。
  if (next.fire.postFireLiving.source !== 'user_input') {
    next.fire.postFireLiving.value = Math.round(next.expense.monthlyLiving.value * 12 * 0.9);
    next.fire.postFireLiving.source = 'recommended_value';
    next.fire.postFireLiving.assumptionText = '現在生活費の90%をおすすめ値として使用しています。';
  }

  // 老後生活費が未確定なら、現在生活費(月)×12×85% をおすすめ値にする。
  if (next.retirement.retirementLiving.source !== 'user_input') {
    next.retirement.retirementLiving.value = Math.round(next.expense.monthlyLiving.value * 12 * 0.85);
    next.retirement.retirementLiving.source = 'recommended_value';
    next.retirement.retirementLiving.assumptionText = '現在生活費の85%をおすすめ値として使用しています。';
  }

  // 手取り年収が未確定なら、世帯年収の約78%を概算で使う。
  if (next.basic.takeHomeIncome.source !== 'user_input') {
    next.basic.takeHomeIncome.value = Math.round(next.basic.householdIncome.value * 0.78);
    next.basic.takeHomeIncome.source = 'recommended_value';
    next.basic.takeHomeIncome.assumptionText = '世帯年収の約78%を手取りの概算として使用しています。';
  }

  return next;
}
