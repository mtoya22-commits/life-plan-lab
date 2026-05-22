import type { ChildInput } from '../schema/types';
import { EDUCATION_COST } from './constants';

// =============================================================================
// 教育費エンジン（純粋関数）
// 年齢区分 × 進路 から 1年あたりの教育費（万円, 今日の物価）を返す。
// 数値は constants.ts の EDUCATION_COST に集約（後で調整可能）。
// インフレ適用は年次エンジン側で支出全体に対して行う。
// =============================================================================

// 年齢区分:
//   0〜5歳   未就学 / 6〜11歳 小学校 / 12〜14歳 中学校
//   15〜17歳 高校 / 18〜21歳 大学 / 22歳〜 教育費なし

/** 指定年齢時点の、その子1人あたりの年間教育費（万円, 今日の物価）。 */
export function eduCostForChild(child: ChildInput, ageThisYear: number): number {
  if (ageThisYear < 0) return 0;
  if (ageThisYear <= 5) return EDUCATION_COST.preschool;
  if (ageThisYear <= 11) return EDUCATION_COST.elementary;
  if (ageThisYear <= 14) return EDUCATION_COST.middle[child.middleSchool.value];
  if (ageThisYear <= 17) return EDUCATION_COST.high[child.highSchool.value];
  if (ageThisYear <= 21) return EDUCATION_COST.university[child.university.value][child.uniLiving.value];
  return 0;
}

/** その年の全子どもの教育費合計（万円, 今日の物価）。yearOffset は現在からの経過年数。 */
export function totalEducationCost(children: ChildInput[], yearOffset: number): number {
  return children.reduce((sum, child) => {
    const ageThisYear = child.currentAge.value + yearOffset;
    return sum + eduCostForChild(child, ageThisYear);
  }, 0);
}
