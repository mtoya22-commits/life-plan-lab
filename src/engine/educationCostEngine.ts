import type { ChildInput } from '../schema/types';

// =============================================================================
// 教育費エンジン（純粋関数）
// 年齢区分 × 進路 から 1年あたりの教育費（万円）を返す。
// 数値は引き継ぎ資料の初期値。確定値はプロダクトオーナーと擦り合わせる。
// =============================================================================

// 年齢区分:
//   0〜5歳   未就学
//   6〜11歳  小学校
//   12〜14歳 中学校
//   15〜17歳 高校
//   18〜21歳 大学
//   22歳〜   教育費なし

const PRESCHOOL = 30;
const ELEMENTARY = 35; // 公立想定

const MIDDLE = { public: 55, private: 140 } as const;
const HIGH = { public: 60, private: 120 } as const;
const UNIVERSITY = {
  humanities: { home: 120, away: 240 },
  science: { home: 160, away: 280 },
  none: { home: 0, away: 0 },
} as const;

/** 指定年齢時点の、その子1人あたりの年間教育費（万円）。 */
export function eduCostForChild(child: ChildInput, ageThisYear: number): number {
  if (ageThisYear < 0) return 0;
  if (ageThisYear <= 5) return PRESCHOOL;
  if (ageThisYear <= 11) return ELEMENTARY;
  if (ageThisYear <= 14) return MIDDLE[child.middleSchool.value];
  if (ageThisYear <= 17) return HIGH[child.highSchool.value];
  if (ageThisYear <= 21) return UNIVERSITY[child.university.value][child.uniLiving.value];
  return 0;
}

/** その年の全子どもの教育費合計（万円）。yearOffset は現在からの経過年数。 */
export function totalEducationCost(children: ChildInput[], yearOffset: number): number {
  return children.reduce((sum, child) => {
    const ageThisYear = child.currentAge.value + yearOffset;
    return sum + eduCostForChild(child, ageThisYear);
  }, 0);
}
