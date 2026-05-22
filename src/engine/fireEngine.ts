import type { FireGroup } from '../schema/types';

// =============================================================================
// FIREエンジン（純粋関数）
// 重要: 完全FIRE / サイドFIRE で資産計算式は分けない。
//       違いは「FIRE後の年間労働収入」だけ（年次エンジン側で扱う）。
//       同条件ならサイドFIRE ≧ 完全FIRE になることを単体テストで固定する。
// =============================================================================

/** 4%ルールに基づく必要資産（万円）。マイナスは0にクランプ。 */
export function neededAssets(fire: FireGroup): number {
  const annualGap = fire.postFireLiving.value - fire.postFireIncome.value;
  return Math.max(0, annualGap) * 25;
}

/** FIRE達成率（%）。必要資産が0なら達成済み(=100以上)とみなす。 */
export function fireAchievementRate(assetsAtFire: number, fire: FireGroup): number {
  const needed = neededAssets(fire);
  if (needed <= 0) return 100;
  return (assetsAtFire / needed) * 100;
}

/**
 * その年のFIRE後労働収入（万円）。
 * 完全FIRE: 0 / サイドFIRE: 指定年齢まで postFireIncome / それ以外: 通常の労働収入(別管理)。
 */
export function postFireIncomeForAge(fire: FireGroup, age: number): number {
  if (age < fire.targetAge.value) return 0; // まだFIRE前（労働収入は年次エンジンが別途加算）
  if (fire.type.value === 'side' && age < fire.workUntilAge.value) {
    return fire.postFireIncome.value;
  }
  return 0;
}
