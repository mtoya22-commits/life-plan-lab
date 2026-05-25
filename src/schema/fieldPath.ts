import type { Field, SimulationInput } from './types';

// =============================================================================
// SimulationInput の Field リーフへ「パス」でアクセスするユーティリティ。
// しっかり診断は SimulationInput を直接編集するため、'basic.age' や
// 'children.0.middleSchool' のようなドットパスで get/set する。
// =============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

/** パスの指す Field を取得する。 */
export function getFieldByPath(input: SimulationInput, path: string): Field<unknown> | undefined {
  const segs = path.split('.');
  let obj: any = input;
  for (const s of segs) {
    if (obj == null) return undefined;
    obj = obj[s];
  }
  return obj as Field<unknown> | undefined;
}

/** パスの指す Field を不変更新で置き換えた新しい SimulationInput を返す。 */
export function setFieldByPath(input: SimulationInput, path: string, newField: Field<unknown>): SimulationInput {
  const clone = structuredClone(input);
  const segs = path.split('.');
  let obj: any = clone;
  for (let i = 0; i < segs.length - 1; i++) obj = obj[segs[i]];
  obj[segs[segs.length - 1]] = newField;
  return clone;
}

/** どこかに source==='user_input' の Field があるか（入力途中の進捗判定用）。 */
export function hasUserInput(value: unknown): boolean {
  if (value == null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.source === 'string' && 'value' in obj) {
    return obj.source === 'user_input';
  }
  return Object.values(obj).some((v) => hasUserInput(v));
}
