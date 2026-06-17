// 生活費見直しシミュレーター（別アプリ）からの取り込み値を読むユーティリティ。
// URL パラメータ → localStorage の順で確認し、最初に valid な値を返す。
// 月額は円/月で受け取る（万円ではない）。総合版の内部は万円/月のため、呼び出し側で monthlyYenToMan する。

export type LivingCostSource =
  | 'breakdownTotal'
  | 'quickAdjust'
  | 'categoryScenario'
  | 'unknown';

export interface ImportedLivingCost {
  monthlyYen: number;
  source: LivingCostSource;
  origin: 'url' | 'localStorage';
}

const STORAGE_KEY = 'lifePlanLab:livingCost';

// 月額が valid なら取り込む。source は未知でも 'unknown' にフォールバックして取り込み自体は通す。
// adjustedMonthlyTotal は開発途中の過去名。互換のため quickAdjust 扱い。
function normalizeSource(raw: unknown): LivingCostSource {
  if (typeof raw !== 'string') return 'unknown';
  if (raw === 'adjustedMonthlyTotal') return 'quickAdjust';
  if (raw === 'breakdownTotal' || raw === 'quickAdjust' || raw === 'categoryScenario') return raw;
  return 'unknown';
}

function validMonthlyYen(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function readFromUrl(): ImportedLivingCost | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('livingCostMonthly');
  if (raw == null) return null;
  const n = Number(raw);
  if (!validMonthlyYen(n)) return null;
  return {
    monthlyYen: n,
    source: normalizeSource(params.get('livingCostSource')),
    origin: 'url',
  };
}

function readFromLocalStorage(): ImportedLivingCost | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as Record<string, unknown>;
    if (!validMonthlyYen(payload.selectedMonthlyTotal)) return null;
    return {
      monthlyYen: payload.selectedMonthlyTotal,
      source: normalizeSource(payload.selectedMonthlySource),
      origin: 'localStorage',
    };
  } catch {
    return null;
  }
}

/** URL パラメータ → localStorage の順で読み、最初に valid な月額を持つペイロードを返す。 */
export function readImportedLivingCost(): ImportedLivingCost | null {
  return readFromUrl() ?? readFromLocalStorage();
}

/** 円/月 → 万円/月（小数1桁、四捨五入）。 */
export function monthlyYenToMan(yen: number): number {
  return Math.round((yen / 10000) * 10) / 10;
}
