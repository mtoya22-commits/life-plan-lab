import type { ChildInput, UniversityLiving, UniversityPath } from '../schema/types';
import { CHILD_ALLOWANCE, EDUCATION_COST, UNIVERSITY_ENTRANCE_FEE, UNIVERSITY_UNDECIDED } from './constants';

// =============================================================================
// 教育費エンジン（純粋関数）
// 年齢区分 × 進路 から 1年あたりの教育費（万円, 今日の物価）を返す。
// 数値は constants.ts の EDUCATION_COST に集約（後で調整可能）。
// インフレ適用は年次エンジン側で支出全体に対して行う。
// =============================================================================

// 年齢区分:
//   0〜5歳   未就学 / 6〜11歳 小学校 / 12〜14歳 中学校
//   15〜17歳 高校 / 18〜21歳 大学 / 22歳〜 教育費なし
// 大学 1 年目（age=18）は経常費（学費+生活費）に加えて入学金を一度だけ加算する。
// これにより複数の子の「大学進学が重なる年」に教育費ピークが現実的に立ち上がる。

/** 指定年齢時点の、その子1人あたりの年間教育費（万円, 今日の物価）。 */
export function eduCostForChild(child: ChildInput, ageThisYear: number): number {
  if (ageThisYear < 0) return 0;
  if (ageThisYear <= 5) return EDUCATION_COST.preschool;
  if (ageThisYear <= 11) return EDUCATION_COST.elementary[child.elementarySchool.value];
  if (ageThisYear <= 14) return EDUCATION_COST.middle[child.middleSchool.value];
  if (ageThisYear <= 17) return EDUCATION_COST.high[child.highSchool.value];
  if (ageThisYear <= 21) {
    // 未定は標準的な仮定へ寄せる。
    const uni: Exclude<UniversityPath, 'undecided'> =
      child.university.value === 'undecided' ? UNIVERSITY_UNDECIDED : child.university.value;
    const living: Exclude<UniversityLiving, 'undecided'> = child.uniLiving.value === 'undecided' ? 'home' : child.uniLiving.value;
    const annual = EDUCATION_COST.university[uni][living];
    // 入学金は 1 年目（age=18）のみ加算。none（進学しない）は 0。
    const entrance = ageThisYear === 18 ? UNIVERSITY_ENTRANCE_FEE[uni] : 0;
    return annual + entrance;
  }
  return 0;
}

/** その年の全子どもの教育費合計（万円, 今日の物価）。yearOffset は現在からの経過年数。 */
export function totalEducationCost(children: ChildInput[], yearOffset: number): number {
  return children.reduce((sum, child) => {
    const ageThisYear = child.currentAge.value + yearOffset;
    return sum + eduCostForChild(child, ageThisYear);
  }, 0);
}

// =============================================================================
// 児童手当（R6 改定: 所得制限撤廃・高校生まで対象拡大）
// 教育費の対概念として、子育て期の家計を現実に近づける。年齢条件で発生する収入として
// 「income.other」に加算する（教育費から差し引かないことで、年次表上で「給付が出ている」
// 効果が見える）。手当も支出と同じ物価スライド前提でインフレ追従する（engine 側で適用）。
// =============================================================================

/** 第 N 子（1-based, 生年月日順 = 年齢の昇順）を考慮した、その子1人あたりの年間児童手当（万円, 今日の物価）。 */
export function childAllowanceForChild(child: ChildInput, ageThisYear: number, birthOrder: number): number {
  if (ageThisYear < 0 || ageThisYear > 17) return 0; // 18歳以降は支給なし
  if (birthOrder >= 3) return CHILD_ALLOWANCE.thirdOrLater.age0to17;
  return ageThisYear <= 2 ? CHILD_ALLOWANCE.firstOrSecond.under3 : CHILD_ALLOWANCE.firstOrSecond.age3to17;
}

/** その年の全子どもの児童手当合計（万円, 今日の物価）。yearOffset は現在からの経過年数。
 *  生年月日順 = 入力時点での年齢の降順で第 1 子・第 2 子…を決める（年長が第 1 子）。
 *  シミュレーションが進んでも世代順は変わらないため、初回確定 = 入力順の age 降順を保持。 */
export function totalChildAllowance(children: ChildInput[], yearOffset: number): number {
  // 年齢降順インデックスを 1-based の birthOrder にする（現時点で最年長 = 第 1 子）。
  const ordered = children
    .map((c, i) => ({ child: c, baseAge: c.currentAge.value, idx: i }))
    .sort((a, b) => b.baseAge - a.baseAge);
  let total = 0;
  ordered.forEach((entry, k) => {
    const birthOrder = k + 1;
    const ageThisYear = entry.child.currentAge.value + yearOffset;
    total += childAllowanceForChild(entry.child, ageThisYear, birthOrder);
  });
  return total;
}
