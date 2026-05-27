// =============================================================================
// 計算で使う定数を一箇所に集約する。
// 教育費テーブル・判定しきい値は引き継ぎ資料の初期値。後で調整しやすいようここに分離。
// =============================================================================

export const SIM = {
  endAge: 95,
  pensionStartAge: 65,
} as const;

/** 教育費の初期値（万円/年）。年齢区分 × 進路。
 *  小・中・高は R5 文科省「子供の学習費調査」、大学は R5 文科省「私立大学等の
 *  学生納付金等調査」と JASSO R4「学生生活調査」を出典に概算で揃えている。
 *  最新統計が出たらここを差し替えれば全シミュレーションに反映される。 */
export const EDUCATION_COST = {
  preschool: 30, // 0〜5歳 未就学
  // R5 文科省: 公立 約36.7 / 私立 約174.2 万円/年
  elementary: { public: 37, private: 174 },
  // R5 文科省: 公立 約54.2 / 私立 約156 万円/年
  middle: { public: 54, private: 156 },
  // R5 文科省: 公立 約59.7 / 私立 約117.9 万円/年
  high: { public: 60, private: 118 },
  university: {
    // 18〜21歳の各年の経常費（学費 + 生活費, 万円/年）。
    // 入学金は age=18 の1年目に限り UNIVERSITY_ENTRANCE_FEE で別途加算する。
    // 学費: 国公立授業料 53.58万 + 諸経費、私立は R5「学生納付金等調査」ベース。
    // 生活費: JASSO R4「学生生活調査」より、自宅 約30万 / 自宅外 約110万 を上乗せ。
    none: { home: 0, away: 0 },
    public_humanities: { home: 90, away: 170 }, // 学費 60 + 生活 30 / 110
    public_science: { home: 100, away: 180 }, // 学費 70 + 生活 30 / 110
    private_humanities: { home: 150, away: 230 }, // 学費 120 + 生活 30 / 110
    private_science: { home: 175, away: 255 }, // 学費 145 + 生活 30 / 110
  },
} as const;

/** 大学入学金（万円, age=18 の1年目に一度だけ加算）。R5 文科省データに基づく概算。 */
export const UNIVERSITY_ENTRANCE_FEE = {
  none: 0,
  public_humanities: 28,
  public_science: 28,
  private_humanities: 25,
  private_science: 26,
} as const;

/** 大学進路が未定のときに使う標準的な仮定（国公立文系・自宅）。 */
export const UNIVERSITY_UNDECIDED = 'public_humanities' as const;

/** 医療介護予備費（万円/年）の追加額。 */
export const MEDICAL_CARE_RESERVE = {
  from75: 30,
  from85: 60,
} as const;

/** おすすめ値の導出に使う比率。 */
export const RATIOS = {
  takeHomeFromGross: 0.78, // 世帯年収 → 手取りの概算（バンド未適用時のフォールバック）
  postFireLivingFromCurrent: 0.9, // FIRE後生活費 = 現在生活費の90%
  retirementLivingFromCurrent: 0.85, // 老後生活費 = 現在生活費の85%
} as const;

/** 年収帯ごとの簡易手取り率（額面年収・万円 → 手取り率）。 */
export function takeHomeRate(gross: number): number {
  if (gross < 400) return 0.8;
  if (gross < 700) return 0.78;
  if (gross < 1000) return 0.75;
  if (gross < 1500) return 0.72;
  return 0.68;
}

/** 持ち家のローン完済後に残る維持費（固定資産税・火災保険・修繕など, 万円/年）。 */
export const HOME_MAINTENANCE_ANNUAL = 60;

/** 現金比率が未入力のときに仮定する保守的な現金割合。 */
export const DEFAULT_CASH_RATIO = 0.2;

/** 毎月投資額が未入力のとき、年間黒字のうち投資へ回す保守的な割合。 */
export const DEFAULT_INVEST_FRACTION = 0.5;

/**
 * 暴落シナリオ（簡易モデル）。
 * 「あり」のとき、現在年齢＋yearsFromNow の年に投資資産を dropRate だけ一度だけ下落させる。
 * 現金資産には適用せず、下落後は通常の名目利回りで運用を継続（回復）する。
 */
export const CRASH_SCENARIO = {
  yearsFromNow: 5,
  dropRate: 0.3,
} as const;

/**
 * 慎重シナリオ（長期前提を厳しめに見る）。暴落（一時下落）とは別物。
 * 利回りを下げ（下限0%）、インフレ率を上げて再計算する。
 */
export const CAUTIOUS_SCENARIO = {
  returnDelta: -2, // 想定利回り −2%（下限0%）
  returnFloor: 0,
  inflationDelta: 1, // インフレ率 +1%
} as const;

/** 投資スタイル → 想定（名目）利回り（%）。 */
export const RETURN_RATE_BY_STYLE = {
  stable: 3,
  balanced: 5,
  growth: 7,
} as const;

/** 総合判定のしきい値（引き継ぎ資料29章ほかの初期案）。 */
export const JUDGE = {
  fireRate: { full: 100, close: 80, adjust: 50 }, // %
  longevityAge: { stable: 95, caution: 85, improve: 75 }, // 歳
  assetsAt95: { ample: 3000, stable: 1000, caution: 0 }, // 万円
  eduPeakPct: { allow: 5, caution: 10 }, // 赤字が資産の何%か
  mortgageBurden: { light: 0.2, standard: 0.3, heavy: 0.4 }, // 年間返済 / 手取り
  bands: { stable: 12, realistic: 8, needsAdjust: 4 }, // 15点満点の区切り
} as const;

/** 結果画面に表示する、税制簡略化の注記。 */
export const TAX_SIMPLIFIED_NOTE =
  '税制は簡略化しています。収入は手取りベースで扱い、投資課税・住宅ローン控除・NISA/iDeCoの税効果は未反映です。';

/** インフレ・利回りの扱いに関する注記。 */
export const RETURN_MODEL_NOTE =
  '想定利回りは名目利回り、インフレ率は支出（生活費・教育費など）の増加率として扱っています。';

/** しっかり診断の捕捉のみ項目に関する注記（入力したのに結果が変わらない不信感を避ける）。 */
export const CAPTURE_NOTE =
  '入力した詳細項目は内容として保存されます。現在の試算では一部を簡略化して反映しています（精密反映は今後対応予定）。';
