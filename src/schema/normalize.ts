import { createDefaultInput } from './defaultValues';
import { applyRecommendedValues } from './recommendedValues';
import { applyRoughAnswers } from './roughMapping';
import type { RoughAnswers, SimulationInput } from './types';

// =============================================================================
// buildFullInput: ざっくり/しっかり両モードの唯一の合流点
// 計算エンジンはここから先、どちらのモード由来かを意識しない。
// 優先順位: user_input > recommended_value > default_value(skipped)
// =============================================================================

/** ざっくり診断の回答から完全な入力を組み立てる。 */
export function buildFullInputFromRough(answers: RoughAnswers): SimulationInput {
  const base = createDefaultInput('rough');
  const withAnswers = applyRoughAnswers(base, answers);
  return applyRecommendedValues(withAnswers);
}

/**
 * しっかり診断の（部分的な）入力から完全な入力を組み立てる。
 * 入力済みは user_input のまま、未入力はおすすめ値/標準値で補完する。
 *
 * TODO(実装): UI の部分入力(DeepPartial)を標準値ベースへマージするロジックを追加する。
 */
export function buildFullInputFromThorough(partial: SimulationInput): SimulationInput {
  return applyRecommendedValues(partial);
}
