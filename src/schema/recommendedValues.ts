import { RATIOS, RETURN_RATE_BY_STYLE, takeHomeRate } from '../engine/constants';
import type { InvestmentStyle, SimulationInput } from './types';

// =============================================================================
// おすすめ値（「迷ったらこれ」）の導出
// 思想: 年齢・年収・子ども数などの分かっている情報から、未入力項目の妥当な値を導く。
// ここで埋めた値は source='recommended_value' として結果画面に明示する。
// 比率・利回りは constants.ts に集約。
// =============================================================================

/** 投資スタイルから想定（名目）利回り（%）を引く。 */
export function returnRateForStyle(style: InvestmentStyle): number {
  return RETURN_RATE_BY_STYLE[style];
}

/**
 * すでに分かっている入力を元に、おすすめ値で埋めた SimulationInput を返す。
 * buildFullInput から呼ばれ、ユーザー入力 > おすすめ値 > 標準値 の優先順位で合成される。
 *
 * TODO(実装): 年金概算など、導出項目を順次追加する。
 */
export function applyRecommendedValues(input: SimulationInput): SimulationInput {
  const next = structuredClone(input);
  const currentAnnualLiving = next.expense.monthlyLiving.value * 12;

  // FIRE後生活費が未確定なら、現在生活費の90%をおすすめ値にする。
  if (next.fire.postFireLiving.source !== 'user_input') {
    next.fire.postFireLiving.value = Math.round(currentAnnualLiving * RATIOS.postFireLivingFromCurrent);
    next.fire.postFireLiving.source = 'recommended_value';
    next.fire.postFireLiving.assumptionText = '現在生活費の90%をおすすめ値として使用しています。';
  }

  // 老後生活費が未確定なら、現在生活費の85%をおすすめ値にする。
  if (next.retirement.retirementLiving.source !== 'user_input') {
    next.retirement.retirementLiving.value = Math.round(currentAnnualLiving * RATIOS.retirementLivingFromCurrent);
    next.retirement.retirementLiving.source = 'recommended_value';
    next.retirement.retirementLiving.assumptionText = '現在生活費の85%をおすすめ値として使用しています。';
  }

  // 手取り年収が未確定なら、年収帯ごとの簡易手取り率で概算する。
  if (next.basic.takeHomeIncome.source !== 'user_input') {
    const rate = takeHomeRate(next.basic.householdIncome.value);
    next.basic.takeHomeIncome.value = Math.round(next.basic.householdIncome.value * rate);
    next.basic.takeHomeIncome.source = 'recommended_value';
    next.basic.takeHomeIncome.assumptionText = `世帯年収から簡易手取り率（${Math.round(rate * 100)}%）で概算しています。`;
  }

  return next;
}
