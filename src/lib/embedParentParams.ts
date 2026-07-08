// WordPress 等の親ページに iframe で総合版を埋め込んだ際、
// 親ページの URL に付いた「許可済みパラメータ」だけを iframe の src へ持ち越すための小さなヘルパ。
// docs/EMBED.md の vanilla JS スニペットと完全に同じアルゴリズムを実装する（テスト対象）。
//
// 用途: 生活費見直しシミュレーター・住宅ローンシミュレーターが親ページの URL に
// ?livingCostMonthly=... 等を付けて遷移したあと、iframe 内の総合版が
// window.location.search からそれらを読み取れるようにする。
// iframe は親と別 URL のため、親側で明示的に append しないと iframe の location.search には届かない。

export const ALLOWED_PARENT_PARAMS = [
  'livingCostMonthly',
  'livingCostSource',
  'mortgageMonthlyPaymentYen',
  'mortgageAnnualPaymentYen',
  'mortgageBalanceYen',
  'mortgageInterestRate',
  'mortgageRemainingYears',
  'mortgageSource',
  'mortgageBonusAnnualYen',
  'mortgageRepaymentMethod',
  'mortgageRateType',
  'educationSource',
] as const;

/** base URL に許可済みパラメータだけを ?/& で結合した URL を返す。
 *  許可外パラメータは黙って無視する。
 *  parentSearch が空・該当無しの場合は base をそのまま返す（通常アクセス時の挙動を維持）。 */
export function appendAllowedParamsToIframeSrc(
  baseSrc: string,
  parentSearch: string,
  allowList: readonly string[] = ALLOWED_PARENT_PARAMS,
): string {
  const parent = new URLSearchParams(parentSearch);
  const allowed = new URLSearchParams();
  for (const key of allowList) {
    const v = parent.get(key);
    if (v !== null && v !== '') allowed.set(key, v);
  }
  const qs = allowed.toString();
  if (!qs) return baseSrc;
  return baseSrc + (baseSrc.includes('?') ? '&' : '?') + qs;
}
