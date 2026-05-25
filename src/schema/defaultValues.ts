import { field } from './field';
import type { Mode, SimulationInput } from './types';

// =============================================================================
// 標準値（スキップ時のフォールバック）
// 思想: スキップした項目は 0 や控えめな仮定で計算し、結果画面で必ず明示する。
// 注意: 数値は「初期値」。確定値は別途プロダクトオーナーと擦り合わせる。
// =============================================================================

/** 完全な SimulationInput を標準値で生成する。buildFullInput のベースに使う。 */
export function createDefaultInput(mode: Mode): SimulationInput {
  return {
    meta: { mode, createdAt: new Date().toISOString() },

    basic: {
      age: field(40, 'default_value', '本人年齢', '標準値40歳で試算しています。', '歳'),
      spouseAge: field(40, 'skipped', '配偶者年齢', '未入力のため本人と同年齢で試算しています。', '歳'),
      householdIncome: field(700, 'default_value', '世帯年収', '標準値700万円で試算しています。', '万円'),
      takeHomeIncome: field(0, 'skipped', '手取り年収', '未入力のため年収から概算しています。', '万円'),
      currentAssets: field(0, 'skipped', '現在資産', '未入力のため0円で試算しています。', '万円'),
      cashRatio: field(30, 'default_value', '現金比率', '標準値30%で試算しています。', '%'),
    },

    income: {
      selfIncome: field(0, 'skipped', '本人収入', '未入力のため世帯年収に含めて扱います。', '万円'),
      spouseIncome: field(0, 'skipped', '配偶者収入', '未入力のため世帯年収に含めて扱います。', '万円'),
      raiseRate: field(0.5, 'default_value', '昇給率', '標準値0.5%で試算しています。', '%'),
      retirementAge: field(65, 'default_value', '退職予定年齢', '標準値65歳で試算しています。', '歳'),
      retirementLumpSum: field(0, 'skipped', '退職金見込み', '未入力のため0円で試算しています。', '万円'),
    },

    expense: {
      monthlyLiving: field(25, 'default_value', '毎月生活費', '標準値25万円で試算しています。', '万円'),
      annualSpecial: field(0, 'skipped', '年間特別費', '未入力のため0円で試算しています。', '万円'),
      carCost: field(0, 'skipped', '車関連費', '未入力のため0円で試算しています。', '万円'),
      travelCost: field(0, 'skipped', '旅行費', '未入力のため0円で試算しています。', '万円'),
      insuranceCost: field(0, 'skipped', '保険料', '未入力のため0円で試算しています。', '万円'),
    },

    investment: {
      monthlyInvestment: field(0, 'skipped', '毎月投資額', '未入力のため0円で試算しています。', '万円'),
      returnRate: field(5, 'recommended_value', '想定利回り', '試算用の標準例5%を使用しています。', '%'),
      inflationRate: field(2, 'recommended_value', 'インフレ率', '試算用の標準例2%を使用しています。', '%'),
      crashScenario: field(false, 'default_value', '暴落シナリオ', '織り込まずに試算しています。'),
      style: field('balanced', 'recommended_value', '投資スタイル', 'バランス型を想定しています。'),
    },

    fire: {
      type: field('side', 'recommended_value', 'FIREタイプ', '少し働くサイドFIREを想定しています。'),
      targetAge: field(55, 'default_value', 'FIRE希望年齢', '標準値55歳で試算しています。', '歳'),
      reduceWorkAge: field(55, 'default_value', '仕事を減らす年齢', '標準値55歳で試算しています。', '歳'),
      postFireLiving: field(0, 'recommended_value', 'FIRE後生活費', '現在生活費の90%を概算の初期値として使用します。', '万円'),
      postFireIncome: field(0, 'skipped', 'FIRE後収入', '未入力のため0円で試算しています。', '万円'),
      workUntilAge: field(65, 'default_value', '何歳まで働くか', '標準値65歳で試算しています。', '歳'),
    },

    children: [],

    housing: {
      type: field('rent', 'default_value', '住まい', '標準値（賃貸）で試算しています。'),
      monthlyPayment: field(0, 'skipped', '毎月返済額', '未入力のため住宅費を別途仮定します。', '万円'),
      rent: field(10, 'default_value', '家賃', '標準値10万円で試算しています。', '万円'),
      balance: field(0, 'skipped', 'ローン残高', '未入力のため残高推移は表示しません。', '万円'),
      remainingYears: field(0, 'skipped', '残年数', '未入力です。', '年'),
      rate: field(1.0, 'recommended_value', '金利', '不明な場合の入力例1.0%を使用しています。', '%'),
      rateType: field('variable', 'default_value', '金利タイプ', '標準値（変動）で試算しています。'),
      fixedEndAge: field(0, 'skipped', '固定終了年齢', '未入力です。', '歳'),
      repayMethod: field('equal_payment', 'default_value', '返済方式', '標準値（元利均等）で試算しています。'),
      bonusAnnual: field(0, 'skipped', 'ボーナス払い', '未入力のため0円で試算しています。', '万円'),
    },

    retirement: {
      pension: field(0, 'skipped', '年金見込み', '未入力のため0円で試算しています。', '万円'),
      retirementLiving: field(0, 'recommended_value', '老後生活費', '現在生活費の80〜90%を概算の初期値として使用します。', '万円'),
      medicalCareReserve: field(false, 'default_value', '医療介護予備費', '初期は織り込まずに試算しています。'),
    },

    tax: {
      effectiveRate: field(20, 'default_value', '実効税率', '簡易的に20%で試算しています。', '%'),
      useNisa: field(false, 'skipped', 'NISA', '未設定です。'),
      useIdeco: field(false, 'skipped', 'iDeCo', '未設定です。'),
      useCorporateDc: field(false, 'skipped', '企業型DC', '未設定です。'),
      useMortgageDeduction: field(false, 'skipped', '住宅ローン控除', '未設定です。'),
    },

    lifeEvents: [],
  };
}
