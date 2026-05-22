import type { HousingGroup, LifeEventMarker } from '../schema/types';

// =============================================================================
// 住宅費エンジン（純粋関数）
// 方針: 毎月返済額が入力されていれば 住宅費 = 毎月返済額 × 12 を優先する。
//       残高/金利/方式は残高推移とタイムラインイベント（固定終了など）に使う。
// =============================================================================

/**
 * その年の住宅費（万円）。
 * - 賃貸: 家賃 × 12
 * - 持ち家/購入検討: 毎月返済額 × 12 を、残年数から決まる完済年齢まで計上
 *   （完済後は 0。完済後の維持費＝固定資産税・修繕は TODO(STEP5)）
 * @param age 評価する年齢
 * @param baseAge 現在年齢（残年数の起点）
 */
export function annualHousingCost(housing: HousingGroup, age: number, baseAge: number): number {
  if (housing.type.value === 'rent') {
    return housing.rent.value * 12;
  }

  // 持ち家/購入検討: 毎月返済額があれば最優先
  if (housing.monthlyPayment.value > 0) {
    const payoffAge = housing.remainingYears.value > 0 ? baseAge + housing.remainingYears.value : Infinity;
    if (age < payoffAge) return housing.monthlyPayment.value * 12;
    return 0; // TODO(STEP5): 完済後の維持費（固定資産税・修繕）を加味する
  }

  // TODO(STEP5): 残高×金利×返済方式から年間返済額を概算するフォールバック。
  return 0;
}

/** 住宅ローンに関するタイムラインイベント（固定終了・完済）を返す。 */
export function mortgageEvents(housing: HousingGroup, baseAge: number): LifeEventMarker[] {
  const events: LifeEventMarker[] = [];

  if (housing.fixedEndAge.value > 0) {
    events.push({
      age: housing.fixedEndAge.value,
      kind: 'fixed_rate_end',
      label: '住宅ローン固定金利期間 終了',
    });
  }

  if (housing.remainingYears.value > 0) {
    events.push({
      age: baseAge + housing.remainingYears.value,
      kind: 'mortgage_payoff',
      label: '住宅ローン完済',
    });
  }

  return events;
}

/**
 * 残高推移（年ごとの残高, 万円）。
 * TODO(実装): 元利均等/元金均等の償却スケジュールを実装する。現状は未実装。
 */
export function balanceSchedule(_housing: HousingGroup): number[] {
  return [];
}
