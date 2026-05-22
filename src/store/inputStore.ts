import { create } from 'zustand';
import { buildFullInputFromRough, buildFullInputFromThorough } from '../schema/normalize';
import { runSimulation } from '../engine/annualSimulationEngine';
import { createDefaultInput } from '../schema/defaultValues';
import { applyRecommendedValues } from '../schema/recommendedValues';
import { ALL_ROUGH_QUESTIONS, ROUGH_PAGES, pageIndexByStepId } from '../schema/roughQuestions';
import {
  ROUGH_TO_DETAILED,
  firstThoroughPageId,
  makeDetailedChild,
  visibleThoroughPages,
} from '../schema/thoroughSteps';
import { getFieldByPath, hasUserInput, setFieldByPath } from '../schema/fieldPath';
import { withResolved } from '../schema/field';
import type {
  LifeEvent,
  Mode,
  RoughCell,
  RoughDraft,
  RoughFieldId,
  SimulationInput,
  SimulationResult,
  StepId,
  ThoroughStepId,
} from '../schema/types';

// =============================================================================
// 入力ストア（zustand）
// 画面はここを読むだけ。計算は純粋関数 runSimulation を呼ぶ。
// ざっくり診断は roughDraft（セル）で、しっかり診断は thoroughInput（SimulationInput を直接編集）。
// どちらも buildFullInput に合流し、source は最後まで保持する。
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

function freshThoroughInput(): SimulationInput {
  return applyRecommendedValues(createDefaultInput('thorough'));
}

const recommendedById = new Map(ALL_ROUGH_QUESTIONS.map((q) => [q.id, q.recommendedValue]));

// ---- 自動保存（localStorage） ---------------------------------------------

interface SavedSession {
  mode: Mode | null;
  phase: Phase;
  roughPage: number;
  roughDraft: RoughDraft;
  thoroughInput: SimulationInput | null;
  thoroughPageId: string | null;
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
const savedHasProgress =
  !!saved &&
  (saved.phase === 'input' || saved.phase === 'result') &&
  (saved.mode === 'thorough'
    ? !!saved.thoroughInput && hasUserInput(saved.thoroughInput)
    : draftHasProgress(saved.roughDraft));

// ---- ストア本体 ------------------------------------------------------------

interface InputState {
  phase: Phase;
  mode: Mode | null;
  // ざっくり
  roughPage: number;
  roughDraft: RoughDraft;
  // しっかり
  thoroughInput: SimulationInput | null;
  thoroughPageId: string | null;
  // 結果
  input: SimulationInput | null;
  result: SimulationResult | null;
  resumePrompt: boolean;
  cameFromResult: boolean;

  setMode: (mode: Mode) => void;
  reset: () => void;

  // ざっくり診断
  setRoughValue: (id: RoughFieldId, value: string | number) => void;
  useRoughRecommended: (id: RoughFieldId) => void;
  skipRough: (id: RoughFieldId) => void;
  nextRoughPage: () => void;
  prevRoughPage: () => void;
  submitRough: () => void;

  // しっかり診断
  setThoroughValue: (path: string, value: string | number | boolean) => void;
  useThoroughRecommended: (path: string, value: string | number | boolean) => void;
  skipThorough: (path: string) => void;
  setThoroughChildrenCount: (count: number) => void;
  upsertLifeEvent: (ev: LifeEvent) => void;
  removeLifeEvent: (id: string) => void;
  setThoroughPage: (pageId: string) => void;
  nextThoroughPage: () => void;
  prevThoroughPage: () => void;
  submitThorough: () => void;

  // 再開
  resumeSaved: () => void;
  startFresh: () => void;

  // 結果からの再調整 / 深掘り
  editCategory: (stepId: StepId) => void;
  editThoroughStep: (stepId: ThoroughStepId) => void;
  backToResult: () => void;
  deepenToThorough: () => void;

  // 開発用
  loadSample: () => void;
  loadThoroughSample: (toResult: boolean) => void;
}

// 開発用: しっかり診断のサンプル値（source は recommended_value 扱い）。
const SAMPLE_THOROUGH_FIELDS: [string, string | number | boolean][] = [
  ['basic.age', 40],
  ['basic.spouseAge', 40],
  ['basic.householdIncome', 900],
  ['basic.takeHomeIncome', 700],
  ['basic.currentAssets', 1500],
  ['basic.cashRatio', 30],
  ['income.selfIncome', 550],
  ['income.spouseIncome', 350],
  ['income.raiseRate', 1],
  ['income.retirementAge', 65],
  ['income.retirementLumpSum', 1000],
  ['expense.monthlyLiving', 28],
  ['expense.annualSpecial', 50],
  ['expense.carCost', 20],
  ['expense.travelCost', 20],
  ['expense.insuranceCost', 15],
  ['investment.monthlyInvestment', 8],
  ['investment.returnRate', 5],
  ['investment.inflationRate', 2],
  ['investment.crashScenario', false],
  ['fire.type', 'side'],
  ['fire.targetAge', 55],
  ['fire.postFireLiving', 250],
  ['fire.postFireIncome', 120],
  ['fire.workUntilAge', 65],
  ['housing.type', 'own'],
  ['housing.monthlyPayment', 12],
  ['housing.balance', 2500],
  ['housing.remainingYears', 25],
  ['housing.rate', 1],
  ['housing.rateType', 'variable'],
  ['housing.fixedEndAge', 50],
  ['housing.repayMethod', 'equal_payment'],
  ['housing.bonusAnnual', 0],
  ['retirement.pension', 180],
  ['retirement.retirementLiving', 240],
  ['retirement.medicalCareReserve', true],
  ['children.0.currentAge', 12],
  ['children.0.highSchool', 'public'],
  ['children.0.university', 'humanities'],
  ['children.1.currentAge', 8],
  ['children.1.highSchool', 'private'],
  ['children.1.university', 'science'],
  ['children.1.uniLiving', 'away'],
];

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
  phase: savedHasProgress ? saved!.phase : 'mode',
  mode: savedHasProgress ? saved!.mode : null,
  roughPage: savedHasProgress ? saved!.roughPage : 0,
  roughDraft: savedHasProgress ? saved!.roughDraft : emptyRoughDraft(),
  thoroughInput: savedHasProgress ? saved!.thoroughInput : null,
  thoroughPageId: savedHasProgress ? saved!.thoroughPageId : null,
  input: null,
  result: null,
  resumePrompt: savedHasProgress,
  cameFromResult: false,

  setMode: (mode) => {
    if (mode === 'thorough') {
      const ti = freshThoroughInput();
      set({
        mode,
        phase: 'input',
        thoroughInput: ti,
        thoroughPageId: firstThoroughPageId(ti),
        cameFromResult: false,
        resumePrompt: false,
      });
    } else {
      set({
        mode,
        phase: 'input',
        roughPage: 0,
        roughDraft: emptyRoughDraft(),
        cameFromResult: false,
        resumePrompt: false,
      });
    }
  },

  reset: () => {
    clearSession();
    set({
      phase: 'mode',
      mode: null,
      roughPage: 0,
      roughDraft: emptyRoughDraft(),
      thoroughInput: null,
      thoroughPageId: null,
      input: null,
      result: null,
      cameFromResult: false,
      resumePrompt: false,
    });
  },

  // ---- ざっくり診断 ----
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

  // ---- しっかり診断 ----
  setThoroughValue: (path, value) => {
    const ti = get().thoroughInput;
    if (!ti) return;
    const f = getFieldByPath(ti, path);
    if (!f) return;
    const empty = value === '' || value === null;
    const nf = empty ? withResolved(f, null, 'skipped') : withResolved(f, value, 'user_input');
    const next = setFieldByPath(ti, path, nf);
    const m = path.match(/^children\.(\d+)\.currentAge$/);
    if (m && !empty) next.children[Number(m[1])].ageAssumed = false;
    set({ thoroughInput: next });
  },
  useThoroughRecommended: (path, value) => {
    const ti = get().thoroughInput;
    if (!ti) return;
    const f = getFieldByPath(ti, path);
    if (!f) return;
    set({ thoroughInput: setFieldByPath(ti, path, withResolved(f, value, 'recommended_value')) });
  },
  skipThorough: (path) => {
    const ti = get().thoroughInput;
    if (!ti) return;
    const f = getFieldByPath(ti, path);
    if (!f) return;
    set({ thoroughInput: setFieldByPath(ti, path, withResolved(f, null, 'skipped')) });
  },
  setThoroughChildrenCount: (count) => {
    const ti = get().thoroughInput;
    if (!ti) return;
    const next = structuredClone(ti);
    const children = next.children;
    while (children.length < count) children.push(makeDetailedChild());
    if (children.length > count) next.children = children.slice(0, count);
    set({ thoroughInput: next });
  },
  upsertLifeEvent: (ev) => {
    const ti = get().thoroughInput;
    if (!ti) return;
    const others = ti.lifeEvents.filter((e) => e.id !== ev.id);
    set({ thoroughInput: { ...ti, lifeEvents: [...others, ev] } });
  },
  removeLifeEvent: (id) => {
    const ti = get().thoroughInput;
    if (!ti) return;
    set({ thoroughInput: { ...ti, lifeEvents: ti.lifeEvents.filter((e) => e.id !== id) } });
  },
  setThoroughPage: (pageId) => set({ thoroughPageId: pageId }),
  nextThoroughPage: () => {
    const { thoroughInput, thoroughPageId } = get();
    if (!thoroughInput) return;
    const pages = visibleThoroughPages(thoroughInput);
    const idx = pages.findIndex((p) => p.pageId === thoroughPageId);
    if (idx < pages.length - 1) set({ thoroughPageId: pages[idx + 1].pageId });
    else get().submitThorough();
  },
  prevThoroughPage: () => {
    const { thoroughInput, thoroughPageId } = get();
    if (!thoroughInput) return;
    const pages = visibleThoroughPages(thoroughInput);
    const idx = pages.findIndex((p) => p.pageId === thoroughPageId);
    if (idx > 0) set({ thoroughPageId: pages[idx - 1].pageId });
    else get().reset();
  },
  submitThorough: () => {
    const ti = get().thoroughInput;
    if (!ti) return;
    const input = buildFullInputFromThorough(ti);
    const result = runSimulation(input);
    set({ input, result, phase: 'result', cameFromResult: false });
  },

  // ---- 再開 ----
  resumeSaved: () => {
    if (get().phase === 'result') {
      if (get().mode === 'thorough') get().submitThorough();
      else get().submitRough();
    }
    set({ resumePrompt: false });
  },
  startFresh: () => get().reset(),

  // ---- 結果からの再調整 / 深掘り ----
  editCategory: (stepId) => {
    const { mode, thoroughInput } = get();
    if (mode === 'thorough' && thoroughInput) {
      const detailedId = ROUGH_TO_DETAILED[stepId];
      const pages = visibleThoroughPages(thoroughInput);
      const page = pages.find((p) => p.stepId === detailedId) ?? pages[0];
      set({ phase: 'input', thoroughPageId: page.pageId, cameFromResult: true });
    } else {
      set({ phase: 'input', roughPage: pageIndexByStepId(stepId), cameFromResult: true });
    }
  },
  editThoroughStep: (stepId) => {
    const ti = get().thoroughInput;
    if (!ti) return;
    const pages = visibleThoroughPages(ti);
    const page = pages.find((p) => p.stepId === stepId) ?? pages[0];
    set({ phase: 'input', thoroughPageId: page.pageId, cameFromResult: true });
  },
  backToResult: () => set({ phase: 'result', cameFromResult: false }),
  deepenToThorough: () => {
    const src = get().input;
    const ti = src ? structuredClone(src) : freshThoroughInput();
    ti.meta = { ...ti.meta, mode: 'thorough' };
    set({ mode: 'thorough', phase: 'input', thoroughInput: ti, thoroughPageId: firstThoroughPageId(ti), cameFromResult: false });
  },

  // ---- 開発用 ----
  loadSample: () => {
    const draft = emptyRoughDraft();
    for (const id of Object.keys(SAMPLE_ANSWERS) as RoughFieldId[]) {
      draft[id] = { value: SAMPLE_ANSWERS[id], source: 'recommended_value' };
    }
    const input = buildFullInputFromRough(draft);
    const result = runSimulation(input);
    set({ mode: 'rough', roughDraft: draft, input, result, phase: 'result', cameFromResult: false, resumePrompt: false });
  },

  loadThoroughSample: (toResult) => {
    let ti = freshThoroughInput();
    ti.children = [makeDetailedChild(), makeDetailedChild()];
    for (const [path, value] of SAMPLE_THOROUGH_FIELDS) {
      const f = getFieldByPath(ti, path);
      if (f) ti = setFieldByPath(ti, path, withResolved(f, value, 'recommended_value'));
    }
    set({
      mode: 'thorough',
      thoroughInput: ti,
      thoroughPageId: firstThoroughPageId(ti),
      phase: 'input',
      cameFromResult: false,
      resumePrompt: false,
      roughDraft: emptyRoughDraft(),
      roughPage: 0,
    });
    if (toResult) get().submitThorough();
  },
}));

// 入力状態が変わるたびに自動保存する（次回の「続きから再開」用）。
useInputStore.subscribe((state) => {
  saveSession({
    mode: state.mode,
    phase: state.phase,
    roughPage: state.roughPage,
    roughDraft: state.roughDraft,
    thoroughInput: state.thoroughInput,
    thoroughPageId: state.thoroughPageId,
  });
});
