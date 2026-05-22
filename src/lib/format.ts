// 表示用フォーマッタ（万円単位の値を扱う）

/** 万円の値を「1,234万円」または「1.2億円」風に整形する。 */
export function formatMan(man: number): string {
  const rounded = Math.round(man);
  if (Math.abs(rounded) >= 10000) {
    const oku = rounded / 10000;
    return `${oku.toLocaleString('ja-JP', { maximumFractionDigits: 1 })}億円`;
  }
  return `${rounded.toLocaleString('ja-JP')}万円`;
}

/** パーセント表示。 */
export function formatPct(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

export function formatAge(age: number | null): string {
  return age === null ? '95歳以降も維持' : `${age}歳`;
}
