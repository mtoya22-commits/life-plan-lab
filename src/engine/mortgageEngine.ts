import type { HousingGroup, LifeEventMarker, RepayMethod } from '../schema/types';
import { HOME_MAINTENANCE_ANNUAL, RATE_RISE_AFTER_FIXED, VARIABLE_RATE_PREMIUM } from './constants';

// =============================================================================
// 住宅費エンジン（純粋関数）
//
// 計算方針:
// 1. 賃貸: 家賃 × 12（変更なし）。
// 2. 持ち家/購入検討で残高・金利・残年数が揃っているとき:
//    元利均等(equal_payment) or 元金均等(equal_principal)で年次の元金返済 + 利息を計算。
//    固定→変動切替（rateType === 'fixed' かつ fixedEndAge）以降は金利が
//    +RATE_RISE_AFTER_FIXED 上昇する慎重な仮定で計算。
//    ボーナス払い(bonusAnnual) は年次追加返済として残高から引く。
//    残高が 0 以下になった年から維持費に切り替わる（完済年は計算で出る）。
// 3. 残高や金利が無い既存ユーザー: 毎月返済額 × 12 を残年数の間ずっと払う旧挙動を維持。
// 4. 住居タイプが不明 / 入力不足: 維持費のみ。
//
// インフレ: 住宅費は名目固定（インフレ非適用）。エンジン側で乗算しない仕様を維持。
//
// 出力: その年の住宅費（万円）。年内訳（うち利息）はデバッグ用途に
//       mortgageBreakdownForYear で別途取得できる。
// =============================================================================

/** その年の住宅費（万円）。 */
export function annualHousingCost(housing: HousingGroup, age: number, baseAge: number): number {
  return mortgageBreakdownForYear(housing, age, baseAge).total;
}

/** その年の住宅費内訳（万円）。total = principal + interest + bonus + maintenance。 */
export function mortgageBreakdownForYear(
  housing: HousingGroup,
  age: number,
  baseAge: number,
): { total: number; principal: number; interest: number; bonus: number; maintenance: number; remainingBalance: number } {
  if (housing.type.value === 'rent') {
    return {
      total: housing.rent.value * 12,
      principal: 0,
      interest: 0,
      bonus: 0,
      maintenance: 0,
      remainingBalance: 0,
    };
  }

  // 持ち家ロジック: 償却スケジュールを毎年積み上げる。
  const schedule = buildSchedule(housing, baseAge);
  const entry = schedule.find((e) => e.age === age);
  if (entry) return { ...entry, total: entry.principal + entry.interest + entry.bonus };

  // age がスケジュール期間外 = 完済済み。維持費のみ。
  return {
    total: HOME_MAINTENANCE_ANNUAL,
    principal: 0,
    interest: 0,
    bonus: 0,
    maintenance: HOME_MAINTENANCE_ANNUAL,
    remainingBalance: 0,
  };
}

interface ScheduleEntry {
  age: number;
  principal: number;
  interest: number;
  bonus: number;
  maintenance: number;
  remainingBalance: number;
}

/** 持ち家ローンの年次償却スケジュールを baseAge から完済まで構築する。
 *  残高・金利・残年数が揃っているときは正規モデル（元利均等/元金均等）。
 *  情報不足の場合は monthlyPayment × 12 を残年数の間ずっと払う旧挙動を再現する。 */
function buildSchedule(housing: HousingGroup, baseAge: number): ScheduleEntry[] {
  const out: ScheduleEntry[] = [];
  const balanceInput = housing.balance.value;
  const rateBase = housing.rate.value / 100; // %
  const years = housing.remainingYears.value;
  const monthlyPayment = housing.monthlyPayment.value;
  const bonusAnnual = housing.bonusAnnual.value;
  const repayMethod: RepayMethod = housing.repayMethod.value;

  const hasFullData = balanceInput > 0 && years > 0;

  // フォールバック: 残高/金利の入力が無いユーザーには旧来挙動を維持。
  if (!hasFullData) {
    const fallbackYears = years > 0 ? years : 0;
    const annualPay = monthlyPayment * 12;
    for (let i = 0; i < fallbackYears; i++) {
      out.push({
        age: baseAge + i,
        principal: annualPay,
        interest: 0,
        bonus: 0,
        maintenance: 0,
        remainingBalance: Math.max(0, annualPay * (fallbackYears - i - 1)),
      });
    }
    return out;
  }

  // 元利均等は「最初に確定した annualPayment を固定」が本来の挙動。
  // ボーナス払いや金利上振れで残高が前倒し減少しても返済額は変わらず、結果として完済が早まる。
  // 元金均等は「毎年の元金 = 当初の balance / years 固定」。これも本来の挙動。
  //
  // 初期返済額の計算には「初年度に実際に適用される金利」を使う。変動なら rateBase + 0.3%、
  // 固定なら rateBase そのまま。ここでブレると変動と固定の差が初期返済額にも反映されない。
  const initialRate = rateForYearIndex(housing, baseAge, rateBase);
  let balance = balanceInput;
  const fixedAnnualPayment =
    repayMethod === 'equal_payment'
      ? initialRate === 0
        ? balanceInput / years
        : (balanceInput * initialRate) / (1 - Math.pow(1 + initialRate, -years))
      : 0;
  const fixedPrincipal = repayMethod === 'equal_principal' ? balanceInput / years : 0;

  for (let i = 0; i < years && balance > 0.0001; i++) {
    const age = baseAge + i;
    const rate = rateForYearIndex(housing, age, rateBase);

    let interest = balance * rate;
    let principal: number;

    if (repayMethod === 'equal_principal') {
      principal = Math.min(fixedPrincipal, balance);
    } else {
      // 元利均等: 当初の annualPayment 固定。固定金利期間の終了などで適用利率が
      // 変わった場合は、その時点の残高・残年数で当年返済額を再算定する。
      // 変動は全期間同じ rate なので initial と一致 → 再計算は走らない（性能影響なし）。
      const annualPayment =
        rate === initialRate
          ? fixedAnnualPayment
          : rate === 0
            ? balance / (years - i)
            : (balance * rate) / (1 - Math.pow(1 + rate, -(years - i)));
      principal = Math.min(annualPayment - interest, balance);
      if (principal < 0) principal = 0;
    }

    // ボーナス払い（年間額）を残高から追加で引く。残高超過は当年最終回として吸収。
    const bonus = Math.min(bonusAnnual, balance - principal);
    balance = Math.max(0, balance - principal - bonus);

    out.push({
      age,
      principal: round1(principal),
      interest: round1(interest),
      bonus: round1(Math.max(0, bonus)),
      maintenance: 0,
      remainingBalance: round1(balance),
    });

    if (balance <= 0.0001) break;
  }

  return out;
}

/** その年の適用金利（小数）。
 *  - 変動: 全期間にわたり rateBase + VARIABLE_RATE_PREMIUM（金利上昇リスクの慎重な織り込み）
 *  - 固定 + fixedEndAge: fixedEndAge までは rateBase、それ以降は rateBase + RATE_RISE_AFTER_FIXED
 *  - 固定 + fixedEndAge なし: 全期間 rateBase 固定（完済まで真の固定金利商品の想定） */
function rateForYearIndex(housing: HousingGroup, age: number, rateBase: number): number {
  if (housing.rateType.value === 'variable') {
    return rateBase + VARIABLE_RATE_PREMIUM / 100;
  }
  // fixed
  if (housing.fixedEndAge.value > 0 && age >= housing.fixedEndAge.value) {
    return rateBase + RATE_RISE_AFTER_FIXED / 100;
  }
  return rateBase;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 住宅ローンに関するタイムラインイベント（固定終了・完済）を返す。 */
export function mortgageEvents(housing: HousingGroup, baseAge: number): LifeEventMarker[] {
  const events: LifeEventMarker[] = [];

  // 賃貸では住宅ローン関連のイベントを出さない（持ち家→賃貸に変更した際の古い値が漏れないように）。
  if (housing.type.value === 'rent') return events;

  // 変動金利の場合は固定終了の概念がないため、タイムラインに出さない。
  if (housing.rateType.value !== 'variable' && housing.fixedEndAge.value > 0) {
    events.push({
      age: housing.fixedEndAge.value,
      kind: 'fixed_rate_end',
      label: '住宅ローン固定金利期間 終了',
    });
  }

  // 完済年齢: スケジュールが組めるなら計算結果を、組めないなら remainingYears を採用。
  const schedule = buildSchedule(housing, baseAge);
  const payoff =
    schedule.length > 0
      ? schedule[schedule.length - 1].age + 1
      : housing.remainingYears.value > 0
        ? baseAge + housing.remainingYears.value
        : null;
  if (payoff !== null) {
    events.push({
      age: payoff,
      kind: 'mortgage_payoff',
      label: '住宅ローン完済',
    });
  }

  return events;
}

/** 残高推移（年ごとの残高, 万円）。償却スケジュール末尾までの残高列。 */
export function balanceSchedule(housing: HousingGroup, baseAge = 0): number[] {
  return buildSchedule(housing, baseAge).map((e) => e.remainingBalance);
}
