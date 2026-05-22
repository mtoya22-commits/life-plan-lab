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

function formatValue(v: unknown): string {
  return typeof v === 'number' ? v.toLocaleString('ja-JP') : String(v);
}
