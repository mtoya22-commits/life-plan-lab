// =============================================================================
// 入力状態管理の中核となる型定義
// 思想: 全ての入力項目は value だけでなく「どこから来た値か(source)」を持ち、
//       結果画面の「今回の試算条件」をこのメタ情報から機械的に生成できる。
// =============================================================================

/** 値の出どころ。結果画面で入力値/おすすめ値/標準値/スキップを区別するために使う。 */
export type FieldSource =
  | 'user_input' // ユーザーが実際に入力した
  | 'recommended_value' // 「迷ったらこれ」のおすすめ値
  | 'default_value' // 標準値で補完
  | 'skipped'; // 未入力。標準値で試算するが結果に明示する

/** 全ての入力リーフはこのラッパーで包む。 */
export interface Field<T> {
  /** 計算に使う値 */
  value: T;
  /** この値の出どころ */
  source: FieldSource;
  /** 表示名（例: 想定利回り） */
  label: string;
  /** 結果画面の「今回の試算条件」に表示する説明文 */
  assumptionText: string;
  /** 表示単位（例: '%' / '万円' / '歳'）。任意。 */
  unit?: string;
}

// ---- 列挙系 ----------------------------------------------------------------

export type Mode = 'rough' | 'thorough';
export type EducationPolicy = 'public' | 'some_private' | 'education_focused' | 'undecided';
export type HousingType = 'own' | 'rent' | 'considering';
export type WorkStyle = 'full_retire' | 'work_a_little' | 'undecided';
export type InvestmentStyle = 'stable' | 'balanced' | 'growth';
export type FireType = 'full' | 'side' | 'none';
export type SchoolPath = 'public' | 'private';
export type UniversityPath = 'none' | 'humanities' | 'science';
export type UniversityLiving = 'home' | 'away';
export type RateType = 'fixed' | 'variable';
export type RepayMethod = 'equal_principal' | 'equal_payment';

// ---- 入力グループ ----------------------------------------------------------

export interface BasicGroup {
  age: Field<number>;
  spouseAge: Field<number>;
  householdIncome: Field<number>; // 世帯年収（万円）
  takeHomeIncome: Field<number>; // 手取り年収（万円）
  currentAssets: Field<number>; // 現在資産（万円）
  cashRatio: Field<number>; // 現金比率（%）
}

export interface IncomeGroup {
  selfIncome: Field<number>;
  spouseIncome: Field<number>;
  raiseRate: Field<number>; // 昇給率（%）
  retirementAge: Field<number>;
  retirementLumpSum: Field<number>; // 退職金見込み（万円）
}

export interface ExpenseGroup {
  monthlyLiving: Field<number>; // 毎月生活費（万円）
  annualSpecial: Field<number>; // 年間特別費（万円）
  carCost: Field<number>;
  travelCost: Field<number>;
  insuranceCost: Field<number>;
}

export interface InvestmentGroup {
  monthlyInvestment: Field<number>;
  returnRate: Field<number>; // 想定利回り（%）
  inflationRate: Field<number>; // インフレ率（%）
  crashScenario: Field<boolean>; // 暴落シナリオを織り込むか
  style: Field<InvestmentStyle>;
}

export interface FireGroup {
  type: Field<FireType>;
  targetAge: Field<number>; // FIRE希望年齢
  reduceWorkAge: Field<number>; // 仕事を減らしたい年齢（ざっくり用）
  postFireLiving: Field<number>; // FIRE後生活費（万円/年）
  postFireIncome: Field<number>; // FIRE後収入（万円/年, サイドFIRE）
  workUntilAge: Field<number>; // 何歳まで働くか
}

export interface ChildInput {
  currentAge: Field<number>;
  /** ざっくり診断で年齢を仮置きした場合 true。結果画面で「仮定」と明示する。 */
  ageAssumed: boolean;
  middleSchool: Field<SchoolPath>;
  highSchool: Field<SchoolPath>;
  university: Field<UniversityPath>;
  uniLiving: Field<UniversityLiving>;
}

export interface HousingGroup {
  type: Field<HousingType>;
  monthlyPayment: Field<number>; // 毎月返済額（万円）。あれば住宅費=月×12を優先
  rent: Field<number>; // 賃貸の毎月家賃（万円）
  balance: Field<number>; // ローン残高（万円）
  remainingYears: Field<number>;
  rate: Field<number>; // 金利（%）
  rateType: Field<RateType>;
  fixedEndAge: Field<number>; // 固定終了時の年齢（タイムライン用）
  repayMethod: Field<RepayMethod>;
}

export interface RetirementGroup {
  pension: Field<number>; // 年金見込み（万円/年, 65歳以降）
  retirementLiving: Field<number>; // 老後生活費（万円/年）
  medicalCareReserve: Field<boolean>; // 医療介護予備費を織り込むか
}

export interface TaxGroup {
  effectiveRate: Field<number>; // 簡易実効税率（%）。初期は簡略化
  useNisa: Field<boolean>;
  useIdeco: Field<boolean>;
  useCorporateDc: Field<boolean>;
  useMortgageDeduction: Field<boolean>;
}

export interface LifeEvent {
  id: string;
  label: Field<string>;
  atAge: Field<number>;
  /** 金額（万円）。プラス=支出、マイナス=収入（相続など）。 */
  amount: Field<number>;
  recurring?: { everyYears: number; untilAge: number };
}

/** 計算エンジンに渡す完全な入力。ざっくり/しっかり両モードとも最終的にこの形へ正規化する。 */
export interface SimulationInput {
  meta: { mode: Mode; createdAt: string };
  basic: BasicGroup;
  income: IncomeGroup;
  expense: ExpenseGroup;
  investment: InvestmentGroup;
  fire: FireGroup;
  children: ChildInput[];
  housing: HousingGroup;
  retirement: RetirementGroup;
  tax: TaxGroup;
  lifeEvents: LifeEvent[];
}

// ---- 生の回答（正規化前） --------------------------------------------------

/** ざっくり診断の生回答（9問）。buildFullInput で SimulationInput に展開する。 */
export interface RoughAnswers {
  age: number;
  householdIncome: number;
  currentAssets: number;
  childrenCount: number;
  educationPolicy: EducationPolicy;
  housing: HousingType;
  workStyle: WorkStyle;
  reduceWorkAge: number;
  investmentStyle: InvestmentStyle;
}

// =============================================================================
// シミュレーション結果の型
// =============================================================================

/** 年次タイムラインに表示する節目イベント。 */
export interface LifeEventMarker {
  age: number;
  kind:
    | 'fire_start'
    | 'side_fire_start'
    | 'full_retire'
    | 'mortgage_payoff'
    | 'fixed_rate_end'
    | 'pension_start'
    | 'education_peak'
    | 'child_university'
    | 'asset_depletion'
    | 'custom';
  label: string;
}

/** 1年分の計算結果。 */
export interface YearRow {
  age: number;
  year: number;
  startAssets: number;
  investmentReturn: number;
  income: {
    labor: number;
    postFire: number;
    pension: number;
    other: number;
    total: number;
  };
  expense: {
    living: number;
    education: number;
    housing: number;
    special: number;
    retirementExtra: number;
    total: number;
  };
  tax: number;
  endAssets: number;
  events: LifeEventMarker[];
}

export interface Indicators {
  /** FIRE達成率（%） */
  fireAchievementRate: number;
  /** 資産が0以下になる年齢。枯渇しなければ null。 */
  assetLongevityAge: number | null;
  /** 95歳時点の残資産（万円） */
  assetsAt95: number;
  /** 教育費ピーク耐性 */
  eduPeakResilience: {
    peakAge: number;
    netCashFlow: number;
    pctOfAssets: number;
  };
  /** 住宅ローン返済負担率（年間返済 / 手取り） */
  mortgageBurden: number;
}

export type ScoreBand = 'stable' | 'realistic' | 'needs_adjust' | 'tough';

export interface ScoreItem {
  key: keyof Indicators | string;
  label: string;
  points: number; // 0..3
  note: string;
}

export interface Score {
  byIndicator: ScoreItem[];
  total: number; // 0..15
  band: ScoreBand;
}

/** 結果画面の「今回の試算条件」の1行。Field のメタ情報から生成する。 */
export interface AssumptionLine {
  label: string;
  valueText: string;
  source: FieldSource;
  assumptionText: string;
}

export interface Suggestion {
  /** どの弱い指標に紐づくか */
  relatedIndicator: string;
  title: string;
  body: string;
}

export interface SimulationResult {
  rows: YearRow[];
  indicators: Indicators;
  score: Score;
  /** 今回の試算条件（入力値/おすすめ値/標準値/スキップを区別して表示） */
  assumptions: AssumptionLine[];
  /** 「子の年齢は想定値」「年金は推奨値」等の注意フラグ */
  flags: string[];
  suggestions: Suggestion[];
}
