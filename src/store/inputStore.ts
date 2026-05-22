import { create } from 'zustand';
import { buildFullInputFromRough } from '../schema/normalize';
import { runSimulation } from '../engine/annualSimulationEngine';
import { ALL_ROUGH_QUESTIONS, ROUGH_PAGES, pageIndexByStepId } from '../schema/roughQuestions';
import type {
  Mode,
  RoughCell,
  RoughDraft,
  RoughFieldId,
  SimulationInput,
  SimulationResult,
  StepId,
} from '../schema/types';

// =============================================================================
// 入力ストア（zustand）
// 画面はここを読むだけ。計算は純粋関数 runSimulation を呼ぶ。
// ステップ遷移と計算ロジックは分離し、入力状態(roughDraft)はグローバルに保持する。
// 入力途中は localStorage に自動保存し、再訪時に「続きから再開」できる。
// =============================================================================

export type Phase = 'mode' | 'input' | 'result';

const STORAGE_KEY = 'fire-lifeplan-lab.v2.session.v1';

function emptyRoughDraft(): RoughDraft {
  const draft = {} as RoughDraft;
  for (const q of ALL_ROUGH_QUESTIONS) {
    draft[q.id] = { value: null, source: 'default_value' };
  }
  return draft;
}

const recommendedById = new Map(ALL_ROUGH_QUESTIONS.map((q) => [q.id, q.recommendedValue]));

// ---- 自動保存（localStorage） ---------------------------------------------

interface SavedSession {
  mode: Mode | null;
  roughPage: number;
  roughDraft: RoughDraft;
  phase: Phase;
}

function loadSession(): SavedSession | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedSession) : null;
  } catch {
    return null;
  }
}

function saveSession(s: SavedSession): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* 保存できなくても致命的ではない */
  }
}

function clearSession(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

function draftHasProgress(draft: RoughDraft): boolean {
  return Object.values(draft).some((c) => c.source !== 'default_value');
}

const saved = loadSession();
const canResume =
  !!saved && draftHasProgress(saved.roughDraft) && (saved.phase === 'input' || saved.phase === 'result');

// ---- ストア本体 ------------------------------------------------------------

interface InputState {
  phase: Phase;
  mode: Mode | null;
  roughPage: number;
  roughDraft: RoughDraft;
  input: SimulationInput | null;
  result: SimulationResult | null;
  /** 再訪時の「続きから再開しますか？」オーバーレイを出すか。 */
  resumePrompt: boolean;
  /** 結果画面から特定カテゴリを編集中か（編集後は結果へ戻る）。 */
  cameFromResult: boolean;

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

  // 再開
  resumeSaved: () => void;
  startFresh: () => void;

  // 結果からの再調整 / 深掘り
  editCategory: (stepId: StepId) => void;
  backToResult: () => void;
  deepenToThorough: () => void;

  // 開発用: 9問を手入力せずに結果画面まで進める（source は recommended_value 扱い）。
  loadSample: () => void;
}

// 開発用サンプル回答（本番のユーザー入力フローとは分離）。
const SAMPLE_ANSWERS: Record<RoughFieldId, string | number> = {
  age: 38,
  householdIncome: 850,
  currentAssets: 1200,
  childrenCount: '2',
  educationPolicy: 'public',
  housing: 'own',
  workStyle: 'work_a_little',
  reduceWorkAge: 55,
  investmentStyle: 'balanced',
};

function setCell(state: InputState, id: RoughFieldId, cell: RoughCell): Partial<InputState> {
  return { roughDraft: { ...state.roughDraft, [id]: cell } };
}

export const useInputStore = create<InputState>((set, get) => ({
  phase: canResume ? saved!.phase : 'mode',
  mode: canResume ? saved!.mode : null,
  roughPage: canResume ? saved!.roughPage : 0,
  roughDraft: canResume ? saved!.roughDraft : emptyRoughDraft(),
  input: null,
  result: null,
  resumePrompt: canResume,
  cameFromResult: false,

  setMode: (mode) =>
    set({ mode, phase: 'input', roughPage: 0, roughDraft: emptyRoughDraft(), cameFromResult: false, resumePrompt: false }),

  reset: () => {
    clearSession();
    set({
      phase: 'mode',
      mode: null,
      roughPage: 0,
      roughDraft: emptyRoughDraft(),
      input: null,
      result: null,
      cameFromResult: false,
      resumePrompt: false,
    });
  },

  setRoughValue: (id, value) => {
    const empty = value === '' || value === null;
    const cell: RoughCell = empty ? { value: null, source: 'default_value' } : { value, source: 'user_input' };
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
    set({ input, result, phase: 'result', cameFromResult: false });
  },

  resumeSaved: () => {
    if (get().phase === 'result') get().submitRough(); // 復元したドラフトから結果を再計算
    set({ resumePrompt: false });
  },

  startFresh: () => {
    clearSession();
    set({
      phase: 'mode',
      mode: null,
      roughPage: 0,
      roughDraft: emptyRoughDraft(),
      input: null,
      result: null,
      cameFromResult: false,
      resumePrompt: false,
    });
  },

  editCategory: (stepId) => set({ phase: 'input', roughPage: pageIndexByStepId(stepId), cameFromResult: true }),

  backToResult: () => set({ phase: 'result', cameFromResult: false }),

  deepenToThorough: () => set({ mode: 'thorough', phase: 'input', cameFromResult: false }),

  loadSample: () => {
    const draft = emptyRoughDraft();
    for (const id of Object.keys(SAMPLE_ANSWERS) as RoughFieldId[]) {
      draft[id] = { value: SAMPLE_ANSWERS[id], source: 'recommended_value' };
    }
    const input = buildFullInputFromRough(draft);
    const result = runSimulation(input);
    set({ mode: 'rough', roughDraft: draft, input, result, phase: 'result', cameFromResult: false, resumePrompt: false });
  },
}));

// 入力状態が変わるたびに自動保存する（次回の「続きから再開」用）。
useInputStore.subscribe((state) => {
  saveSession({
    mode: state.mode,
    roughPage: state.roughPage,
    roughDraft: state.roughDraft,
    phase: state.phase,
  });
});
