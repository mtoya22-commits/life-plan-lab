import type { Field, FieldSource } from './types';

/** Field を簡潔に生成するヘルパー。 */
export function field<T>(
  value: T,
  source: FieldSource,
  label: string,
  assumptionText: string,
  unit?: string,
): Field<T> {
  return { value, source, label, assumptionText, unit };
}

/** 既存 Field のメタ情報を保ったまま、ユーザー入力値で上書きする。 */
export function withUserValue<T>(base: Field<T>, value: T, assumptionText?: string): Field<T> {
  return {
    ...base,
    value,
    source: 'user_input',
    assumptionText: assumptionText ?? `入力された値（${formatValue(value)}${base.unit ?? ''}）を使用しています。`,
  };
}

/**
 * 解決済みの (value, source) を Field に反映する。
 * skipped の場合は base の標準値を保ったまま source だけ skipped にする。
 */
export function withResolved<T>(
  base: Field<T>,
  value: T | null,
  source: FieldSource,
  texts?: { user?: string; recommended?: string; skipped?: string },
): Field<T> {
  const unit = base.unit ?? '';
  if ((source === 'user_input' || source === 'recommended_value') && value !== null) {
    const isUser = source === 'user_input';
    return {
      ...base,
      value,
      source,
      assumptionText:
        (isUser ? texts?.user : texts?.recommended) ??
        `${isUser ? '入力された値' : 'おすすめ値'}（${formatValue(value)}${unit}）を使用しています。`,
    };
  }
  return {
    ...base,
    source: 'skipped',
    assumptionText: texts?.skipped ?? `未入力のため標準値（${formatValue(base.value)}${unit}）で試算しています。`,
  };
}

function formatValue(v: unknown): string {
  return typeof v === 'number' ? v.toLocaleString('ja-JP') : String(v);
}
