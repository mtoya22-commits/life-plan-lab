import { create } from 'zustand';
import { buildFullInputFromRough } from '../schema/normalize';
import { runSimulation } from '../engine/annualSimulationEngine';
import type { Mode, RoughAnswers, SimulationInput, SimulationResult } from '../schema/types';

// =============================================================================
// 入力ストア（zustand）
// 画面はここを読むだけ。計算は純粋関数 runSimulation を呼ぶ。
// =============================================================================

export type Phase = 'mode' | 'input' | 'result';

interface InputState {
  phase: Phase;
  mode: Mode | null;
  step: number;
  input: SimulationInput | null;
  result: SimulationResult | null;

  setMode: (mode: Mode) => void;
  setStep: (step: number) => void;
  goToInput: () => void;
  reset: () => void;

  /** ざっくり診断の回答を確定し、計算まで実行して結果画面へ。 */
  submitRough: (answers: RoughAnswers) => void;
}

export const useInputStore = create<InputState>((set) => ({
  phase: 'mode',
  mode: null,
  step: 0,
  input: null,
  result: null,

  setMode: (mode) => set({ mode, phase: 'input', step: 0 }),
  setStep: (step) => set({ step }),
  goToInput: () => set({ phase: 'input' }),
  reset: () => set({ phase: 'mode', mode: null, step: 0, input: null, result: null }),

  submitRough: (answers) => {
    const input = buildFullInputFromRough(answers);
    const result = runSimulation(input);
    set({ input, result, phase: 'result' });
  },
}));
