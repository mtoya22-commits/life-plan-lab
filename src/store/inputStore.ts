import { create } from 'zustand';
import { buildFullInputFromRough } from '../schema/normalize';
import { runSimulation } from '../engine/annualSimulationEngine';
import { ALL_ROUGH_QUESTIONS, ROUGH_PAGES } from '../schema/roughQuestions';
import type { Mode, RoughCell, RoughDraft, RoughFieldId, SimulationInput, SimulationResult } from '../schema/types';

// =============================================================================
// 入力ストア（zustand）
// 画面はここを読むだけ。計算は純粋関数 runSimulation を呼ぶ。
// ざっくり診断の入力は roughDraft（セルごとに value と source を保持）で管理する。
// =============================================================================

export type Phase = 'mode' | 'input' | 'result';

function emptyRoughDraft(): RoughDraft {
  const draft = {} as RoughDraft;
  for (const q of ALL_ROUGH_QUESTIONS) {
    draft[q.id] = { value: null, source: 'default_value' };
  }
  return draft;
}

const recommendedById = new Map(ALL_ROUGH_QUESTIONS.map((q) => [q.id, q.recommendedValue]));

interface InputState {
  phase: Phase;
  mode: Mode | null;
  roughPage: number;
  roughDraft: RoughDraft;
  input: SimulationInput | null;
  result: SimulationResult | null;

  setMode: (mode: Mode) => void;
  reset: () => void;

  // ざっくり診断
  setRoughValue: (id: RoughFieldId, value: string | number) => void;
  useRoughRecommended: (id: RoughFieldId) => void;
  skipRough: (id: RoughFieldId) => void;
  setRoughPage: (page: number) => void;
  nextRoughPage: () => void;
  prevRoughPage: () => void;
  submitRough: () => void;
}

function setCell(state: InputState, id: RoughFieldId, cell: RoughCell): Partial<InputState> {
  return { roughDraft: { ...state.roughDraft, [id]: cell } };
}

export const useInputStore = create<InputState>((set, get) => ({
  phase: 'mode',
  mode: null,
  roughPage: 0,
  roughDraft: emptyRoughDraft(),
  input: null,
  result: null,

  setMode: (mode) => set({ mode, phase: 'input', roughPage: 0, roughDraft: emptyRoughDraft() }),
  reset: () => set({ phase: 'mode', mode: null, roughPage: 0, roughDraft: emptyRoughDraft(), input: null, result: null }),

  setRoughValue: (id, value) => {
    const empty = value === '' || value === null;
    const cell: RoughCell = empty
      ? { value: null, source: 'default_value' }
      : { value, source: 'user_input' };
    set((s) => setCell(s, id, cell));
  },

  useRoughRecommended: (id) => {
    const rec = recommendedById.get(id) ?? null;
    set((s) => setCell(s, id, { value: rec, source: 'recommended_value' }));
  },

  skipRough: (id) => set((s) => setCell(s, id, { value: null, source: 'skipped' })),

  setRoughPage: (page) => set({ roughPage: page }),

  nextRoughPage: () => {
    const { roughPage } = get();
    if (roughPage < ROUGH_PAGES.length - 1) set({ roughPage: roughPage + 1 });
    else get().submitRough();
  },

  prevRoughPage: () => {
    const { roughPage } = get();
    if (roughPage > 0) set({ roughPage: roughPage - 1 });
    else get().reset();
  },

  submitRough: () => {
    const input = buildFullInputFromRough(get().roughDraft);
    const result = runSimulation(input);
    set({ input, result, phase: 'result' });
  },
}));
