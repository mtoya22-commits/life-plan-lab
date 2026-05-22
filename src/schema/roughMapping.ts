import { field, withUserValue } from './field';
import { returnRateForStyle } from './recommendedValues';
import type { FireType, RoughAnswers, SimulationInput } from './types';

// =============================================================================
// ざっくり診断の9問 → SimulationInput への写像
// 思想: ユーザーが答えた項目だけ user_input にし、残りは後段の recommended/default に委ねる。
//       子の年齢は仮置きし ageAssumed=true を立てて「仮定」と明示する。
// =============================================================================

function workStyleToFireType(style: RoughAnswers['workStyle']): FireType {
  switch (style) {
    case 'full_retire':
      return 'full';
    case 'work_a_little':
      return 'side';
    case 'undecided':
      return 'side';
  }
}

/** ざっくり回答を、標準値ベースの input に重ねる（破壊的変更で受け取った input を更新）。 */
export function applyRoughAnswers(base: SimulationInput, a: RoughAnswers): SimulationInput {
  const input = base;

  input.basic.age = withUserValue(input.basic.age, a.age);
  input.basic.householdIncome = withUserValue(input.basic.householdIncome, a.householdIncome);
  input.basic.currentAssets = withUserValue(input.basic.currentAssets, a.currentAssets);

  // 教育方針（公立中心/一部私立/教育重視/未定）。詳細な進路は子ごとの初期値に反映する。
  // TODO(実装): educationPolicy を各 ChildInput の進路初期値へ展開する。

  // 住まい
  input.housing.type = withUserValue(input.housing.type, a.housing);

  // 働き方 → FIREタイプ + 仕事を減らす年齢
  const fireType = workStyleToFireType(a.workStyle);
  input.fire.type = withUserValue(input.fire.type, fireType);
  input.fire.reduceWorkAge = withUserValue(input.fire.reduceWorkAge, a.reduceWorkAge);
  input.fire.targetAge = withUserValue(input.fire.targetAge, a.reduceWorkAge);

  // 投資スタイル → 想定利回り
  input.investment.style = withUserValue(input.investment.style, a.investmentStyle);
  input.investment.returnRate = withUserValue(
    input.investment.returnRate,
    returnRateForStyle(a.investmentStyle),
    `投資スタイル（${a.investmentStyle}）に基づくおすすめ利回りを使用しています。`,
  );

  // 子ども: 人数分だけ年齢を仮置きで生成（ageAssumed=true）。
  // TODO(実装): 仮置き年齢ロジックを educationCostEngine と整合させる。
  input.children = Array.from({ length: a.childrenCount }, () => makeAssumedChild());

  return input;
}

function makeAssumedChild(): SimulationInput['children'][number] {
  return {
    currentAge: field(8, 'recommended_value', '子の年齢', '年齢未入力のため仮の年齢で試算しています。', '歳'),
    ageAssumed: true,
    middleSchool: field('public', 'recommended_value', '中学', '公立中心で概算しています。'),
    highSchool: field('public', 'recommended_value', '高校', '公立中心で概算しています。'),
    university: field('humanities', 'recommended_value', '大学', '文系・自宅通学で概算しています。'),
    uniLiving: field('home', 'recommended_value', '大学時の住まい', '自宅通学で概算しています。'),
  };
}
