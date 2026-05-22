// =============================================================================
// 計算で使う定数を一箇所に集約する。
// 教育費テーブル・判定しきい値は引き継ぎ資料の初期値。後で調整しやすいようここに分離。
// =============================================================================

export const SIM = {
  endAge: 95,
  pensionStartAge: 65,
} as const;

/** 教育費の初期値（万円/年）。年齢区分 × 進路。 */
export const EDUCATION_COST = {
  preschool: 30, // 0〜5歳 未就学
  elementary: 35, // 6〜11歳 小学校（公立想定）
  middle: { public: 55, private: 140 }, // 12〜14歳
  high: { public: 60, private: 120 }, // 15〜17歳
  university: {
    // 18〜21歳
    humanities: { home: 120, away: 240 },
    science: { home: 160, away: 280 },
    none: { home: 0, away: 0 },
  },
} as const;

/** 医療介護予備費（万円/年）の追加額。 */
export const MEDICAL_CARE_RESERVE = {
  from75: 30,
  from85: 60,
} as const;

/** おすすめ値の導出に使う比率。 */
export const RATIOS = {
  takeHomeFromGross: 0.78, // 世帯年収 → 手取りの概算
  postFireLivingFromCurrent: 0.9, // FIRE後生活費 = 現在生活費の90%
  retirementLivingFromCurrent: 0.85, // 老後生活費 = 現在生活費の85%
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
