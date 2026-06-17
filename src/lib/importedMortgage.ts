// 別アプリ「住宅ローンシミュレーター」からの取り込み値を読むユーティリティ。
// URL パラメータ → localStorage の順で確認し、最初に valid な値（月額または残高）を持つペイロードを返す。
// 金額は円で受け取り、総合版内部の万円へは呼び出し側で変換する。

export type MortgageSource =
  | 'currentPlan'
  | 'rateAdjusted'
  | 'fixedPeriodScenario'
  | 'unknown';

export type ImportedRepaymentMethod = 'equalPayment' | 'equalPrincipal';
export type ImportedRateType = 'variable' | 'fixed' | 'fixedPeriod';

export interface ImportedMortgage {
  monthlyPaymentYen?: number;
  annualPaymentYen?: number;
  balanceYen?: number;
  interestRate?: number;
  remainingYears?: number;
  bonusAnnualYen?: number;
  repaymentMethod?: ImportedRepaymentMethod;
  rateType?: ImportedRateType;
  source: MortgageSource;
  origin: 'url' | 'localStorage';
}

const STORAGE_KEY = 'lifePlanLab:mortgage';

// 月額が valid なら取り込む。source は未知でも 'unknown' にフォールバックして取り込み自体は通す。
function normalizeSource(raw: unknown): MortgageSource {
  if (typeof raw !== 'string') return 'unknown';
  if (raw === 'currentPlan' || raw === 'rateAdjusted' || raw === 'fixedPeriodScenario') return raw;
  return 'unknown';
}

function validPositiveYen(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}
function validNonNegativeYen(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}
function validRate(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 20;
}
function validYears(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 50;
}
function normalizeRepaymentMethod(raw: unknown): ImportedRepaymentMethod | undefined {
  if (raw === 'equalPayment' || raw === 'equalPrincipal') return raw;
  return undefined;
}
function normalizeRateType(raw: unknown): ImportedRateType | undefined {
  if (raw === 'variable' || raw === 'fixed' || raw === 'fixedPeriod') return raw;
  return undefined;
}

// 数値文字列を数値へ。空文字や非数値は undefined。
function toNum(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

interface RawMortgagePayload {
  monthlyPaymentYen?: number;
  annualPaymentYen?: number;
  balanceYen?: number;
  interestRate?: number;
  remainingYears?: number;
  bonusAnnualYen?: number;
  repaymentMethod?: unknown;
  rateType?: unknown;
  source?: unknown;
}

// URL 由来でも localStorage 由来でも、フィールド単位の最終フィルタはここに集約する。
// 採否（取り込み対象かどうか）は monthlyPayment OR balance のどちらかが valid であること。
function finalize(raw: RawMortgagePayload, origin: 'url' | 'localStorage'): ImportedMortgage | null {
  const monthlyPaymentYen = validPositiveYen(raw.monthlyPaymentYen) ? raw.monthlyPaymentYen : undefined;
  const balanceYen = validPositiveYen(raw.balanceYen) ? raw.balanceYen : undefined;
  if (monthlyPaymentYen === undefined && balanceYen === undefined) return null;

  return {
    monthlyPaymentYen,
    annualPaymentYen: validPositiveYen(raw.annualPaymentYen) ? raw.annualPaymentYen : undefined,
    balanceYen,
    interestRate: validRate(raw.interestRate) ? raw.interestRate : undefined,
    remainingYears: validYears(raw.remainingYears) ? raw.remainingYears : undefined,
    bonusAnnualYen: validNonNegativeYen(raw.bonusAnnualYen) ? raw.bonusAnnualYen : undefined,
    repaymentMethod: normalizeRepaymentMethod(raw.repaymentMethod),
    rateType: normalizeRateType(raw.rateType),
    source: normalizeSource(raw.source),
    origin,
  };
}

function readFromUrl(): ImportedMortgage | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  // パラメータが 1 つも無ければ即 null（localStorage に譲る）。
  const hasAnyMortgageParam = [
    'mortgageMonthlyPaymentYen',
    'mortgageAnnualPaymentYen',
    'mortgageBalanceYen',
    'mortgageInterestRate',
    'mortgageRemainingYears',
    'mortgageBonusAnnualYen',
    'mortgageRepaymentMethod',
    'mortgageRateType',
    'mortgageSource',
  ].some((k) => params.has(k));
  if (!hasAnyMortgageParam) return null;

  return finalize(
    {
      monthlyPaymentYen: toNum(params.get('mortgageMonthlyPaymentYen')),
      annualPaymentYen: toNum(params.get('mortgageAnnualPaymentYen')),
      balanceYen: toNum(params.get('mortgageBalanceYen')),
      interestRate: toNum(params.get('mortgageInterestRate')),
      remainingYears: toNum(params.get('mortgageRemainingYears')),
      bonusAnnualYen: toNum(params.get('mortgageBonusAnnualYen')),
      repaymentMethod: params.get('mortgageRepaymentMethod'),
      rateType: params.get('mortgageRateType'),
      source: params.get('mortgageSource'),
    },
    'url',
  );
}

function readFromLocalStorage(): ImportedMortgage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as Record<string, unknown>;
    return finalize(
      {
        monthlyPaymentYen:
          (typeof payload.selectedMonthlyPaymentYen === 'number'
            ? payload.selectedMonthlyPaymentYen
            : typeof payload.monthlyPaymentYen === 'number'
              ? payload.monthlyPaymentYen
              : undefined),
        annualPaymentYen:
          typeof payload.selectedAnnualPaymentYen === 'number' ? payload.selectedAnnualPaymentYen : undefined,
        balanceYen: typeof payload.balanceYen === 'number' ? payload.balanceYen : undefined,
        interestRate: typeof payload.interestRate === 'number' ? payload.interestRate : undefined,
        remainingYears: typeof payload.remainingYears === 'number' ? payload.remainingYears : undefined,
        bonusAnnualYen: typeof payload.bonusAnnualYen === 'number' ? payload.bonusAnnualYen : undefined,
        repaymentMethod: payload.repaymentMethod,
        rateType: payload.rateType,
        source: payload.selectedSource,
      },
      'localStorage',
    );
  } catch {
    return null;
  }
}

/** URL パラメータ → localStorage の順で読み、最初に valid な月額または残高を持つペイロードを返す。 */
export function readImportedMortgage(): ImportedMortgage | null {
  return readFromUrl() ?? readFromLocalStorage();
}

// ---- 単位変換ヘルパー ------------------------------------------------------

/** 円/月 → 万円/月（小数 1 桁）。 */
export function monthlyYenToMan(yen: number): number {
  return Math.round((yen / 10000) * 10) / 10;
}
/** 円 → 万円（整数）。残高用。 */
export function balanceYenToMan(yen: number): number {
  return Math.round(yen / 10000);
}
/** 円/年 → 万円/年（整数）。ボーナス払い用。 */
export function bonusYenToMan(yen: number): number {
  return Math.round(yen / 10000);
}
