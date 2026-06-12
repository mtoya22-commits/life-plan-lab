import { create } from 'zustand';
import { buildFullInputFromRough, buildFullInputFromThorough } from '../schema/normalize';
import { draftFromAnswers } from '../schema/roughMapping';
import { runSimulation } from '../engine/annualSimulationEngine';
import { createDefaultInput } from '../schema/defaultValues';
import { ALL_ROUGH_QUESTIONS, ROUGH_PAGES, pageIndexByStepId } from '../schema/roughQuestions';
import {
  ROUGH_TO_DETAILED,
  firstThoroughPageId,
  makeDetailedChild,
  visibleThoroughPages,
} from '../schema/thoroughSteps';
import { getFieldByPath, hasUserInput, setFieldByPath } from '../schema/fieldPath';
import { field, withResolved } from '../schema/field';
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

/** 差分表示用に保持する主要指標のスナップショット。 */
function indicatorsSnapshot(result: SimulationResult) {
  return {
    assetsAt95: result.indicators.assetsAt95,
    assetsAt95PresentValue: result.indicators.assetsAt95PresentValue,
    assetLongevityAge: result.indicators.assetLongevityAge,
  };
}

function emptyRoughDraft(): RoughDraft {
  const draft = {} as RoughDraft;
  for (const q of ALL_ROUGH_QUESTIONS) {
    draft[q.id] = { value: null, source: 'default_value' };
  }
  return draft;
}

function freshThoroughInput(): SimulationInput {
  // 入力UIには「ユーザーが触っていない値」をそのまま見せる（skipped/default_value は空欄）。
  // applyRecommendedValues は submit 時の buildFullInputFromThorough で適用する。
  return createDefaultInput('thorough');
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
  /** 結果画面に戻ったあとのスクロール先指示。'adjust' は「条件を変えてみる」セクションに戻り、
   *  そこを開いた状態にする。'stay' はスクロールしない（クイック調整用）。null/'top' は従来どおり上部へ。 */
  resultReturnTarget: 'top' | 'adjust' | 'stay' | null;
  /** 直前の計算結果の主要指標。「前回の条件より ±N万円」の差分表示用。
   *  再計算のたびに「1つ前」の値で上書きされ、reset / モード選択で消える。 */
  previousIndicators: {
    assetsAt95: number;
    assetsAt95PresentValue: number;
    assetLongevityAge: number | null;
  } | null;

  setMode: (mode: Mode) => void;
  reset: () => void;

  // ざっくり診断
  setRoughValue: (id: RoughFieldId, value: string | number) => void;
  useRoughRecommended: (id: RoughFieldId) => void;
  skipRough: (id: RoughFieldId) => void;
  nextRoughPage: () => void;
  prevRoughPage: () => void;
  submitRough: () => void;
  /** 「続けて変更」: 再計算して結果画面に戻るが、結果画面では「条件を変えてみる」へジャンプして
   *  そこを開いた状態にする。試行錯誤しやすくするため。 */
  submitRoughAndContinue: () => void;

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
  /** 「続けて変更」しっかり版。 */
  submitThoroughAndContinue: () => void;
  /** スクロール処理を実行したあと、結果画面からターゲットをクリアする。 */
  clearResultReturnTarget: () => void;
  /** 結果画面のクイック調整（What-if）。ソースとなるドラフトを書き換えてから再計算する
   *  （後で「条件を変えてみる」を開いても値が一致するように）。
   *  再計算後はスクロールしない（resultReturnTarget: 'stay'）。
   *  knob: 'age' = 退職予定年齢/FIRE希望年齢、'living' = 毎月の生活費（万円/月）、
   *        'return' = 想定利回り（%、しっかり診断のみ）。範囲外への変更は no-op。 */
  nudgeCondition: (knob: 'age' | 'living' | 'return', delta: number) => void;

  // 再開
  resumeSaved: () => void;
  startFresh: () => void;

  // 結果からの再調整 / 深掘り
  editCategory: (stepId: StepId) => void;
  editThoroughStep: (stepId: ThoroughStepId) => void;
  editThoroughPage: (pageId: string) => void;
  backToResult: () => void;
  deepenToThorough: () => void;

  // 開発用
  loadSample: () => void;
  loadThoroughSample: (toResult: boolean) => void;
  loadHighIncomeSample: (pensionAnnual?: number) => void;
}

// 検証用ケース: 高収入・高資産・子ども2人・住宅ローンあり・55歳サイドFIRE。
// 結果が過度に楽観的にならないか（住宅費・教育費ピーク・FIRE後収入・インフレ）を確認する。
const HIGH_INCOME_ANSWERS: Partial<Record<RoughFieldId, string | number>> = {
  age: 38,
  householdIncome: 1200,
  currentAssets: 3200,
  monthlyLiving: 35,
  monthlyHousing: 11,
  loanYears: 30,
  childrenCount: 2,
  educationPolicy: 'some_private',
  childAge1: 4,
  childAge2: 2,
  housing: 'own',
  workStyle: 'work_a_little',
  reduceWorkAge: 55,
  postFireLiving: 30,
  sideFireIncome: 20,
  investmentStyle: 'balanced',
};

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
  ['children.0.university', 'public_humanities'],
  ['children.1.currentAge', 8],
  ['children.1.highSchool', 'private'],
  ['children.1.university', 'private_science'],
  ['children.1.uniLiving', 'away'],
];

const SAMPLE_ANSWERS: Record<RoughFieldId, string | number> = {
  age: 38,
  householdIncome: 850,
  currentAssets: 1200,
  monthlyLiving: 25,
  monthlyHousing: 10,
  loanYears: 25,
  childrenCount: '2',
  educationPolicy: 'public',
  childAge1: 10,
  childAge2: 7,
  childAge3: 0,
  childAge4: 0,
  housing: 'own',
  workStyle: 'work_a_little',
  reduceWorkAge: 55,
  postFireLiving: 22,
  sideFireIncome: 10,
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
  resultReturnTarget: null,
  previousIndicators: null,

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
        previousIndicators: null,
      });
    } else {
      set({
        mode,
        phase: 'input',
        roughPage: 0,
        roughDraft: emptyRoughDraft(),
        cameFromResult: false,
        resumePrompt: false,
        previousIndicators: null,
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
      previousIndicators: null,
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
    const prev = get().result;
    const input = buildFullInputFromRough(get().roughDraft);
    const result = runSimulation(input);
    // 通常の再計算 → 結果画面の上部へ戻る。差し替え前の結果は「前回比」用に保持。
    set({
      input,
      result,
      phase: 'result',
      cameFromResult: false,
      resultReturnTarget: 'top',
      previousIndicators: prev ? indicatorsSnapshot(prev) : null,
    });
  },

  // 「続けて変更」: 再計算後、結果画面の「条件を変えてみる」セクションへスクロールしてそこを開く。
  submitRoughAndContinue: () => {
    const prev = get().result;
    const input = buildFullInputFromRough(get().roughDraft);
    const result = runSimulation(input);
    set({
      input,
      result,
      phase: 'result',
      cameFromResult: false,
      resultReturnTarget: 'adjust',
      previousIndicators: prev ? indicatorsSnapshot(prev) : null,
    });
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
    const prev = get().result;
    const input = buildFullInputFromThorough(ti);
    const result = runSimulation(input);
    set({
      input,
      result,
      phase: 'result',
      cameFromResult: false,
      resultReturnTarget: 'top',
      previousIndicators: prev ? indicatorsSnapshot(prev) : null,
    });
  },

  submitThoroughAndContinue: () => {
    const ti = get().thoroughInput;
    if (!ti) return;
    const prev = get().result;
    const input = buildFullInputFromThorough(ti);
    const result = runSimulation(input);
    set({
      input,
      result,
      phase: 'result',
      cameFromResult: false,
      resultReturnTarget: 'adjust',
      previousIndicators: prev ? indicatorsSnapshot(prev) : null,
    });
  },

  clearResultReturnTarget: () => set({ resultReturnTarget: null }),

  nudgeCondition: (knob, delta) => {
    const { mode, input, result } = get();
    if (!input || !result) return;

    // 直近の計算に使われた「有効値」を基準に増減する（未入力でも標準値から動かせる）。
    let path: string;
    let next: number;
    if (knob === 'living') {
      next = input.expense.monthlyLiving.value + delta;
      if (next < 0) return;
      path = 'expense.monthlyLiving';
    } else if (knob === 'return') {
      // 浮動小数の蓄積誤差を避けるため 0.1 単位に丸める。
      next = Math.round((input.investment.returnRate.value + delta) * 10) / 10;
      if (next < 0 || next > 10) return;
      path = 'investment.returnRate';
    } else {
      const isNone = input.fire.type.value === 'none';
      const cur = isNone ? input.income.retirementAge.value : input.fire.targetAge.value;
      next = cur + delta;
      if (next < 35 || next > 80) return;
      path = isNone ? 'income.retirementAge' : 'fire.targetAge';
    }

    const prev = indicatorsSnapshot(result);

    if (mode === 'thorough') {
      get().setThoroughValue(path, next);
      const ti = get().thoroughInput;
      if (!ti) return;
      const newInput = buildFullInputFromThorough(ti);
      const newResult = runSimulation(newInput);
      set({ input: newInput, result: newResult, previousIndicators: prev, resultReturnTarget: 'stay' });
    } else {
      // ざっくり: living → monthlyLiving、age → reduceWorkAge（FIRE希望年齢に写像される）。
      // return は rough では UI 非表示（投資スタイルから導出のため）。
      if (knob === 'return') return;
      const id: RoughFieldId = knob === 'living' ? 'monthlyLiving' : 'reduceWorkAge';
      get().setRoughValue(id, next);
      const newInput = buildFullInputFromRough(get().roughDraft);
      const newResult = runSimulation(newInput);
      set({ input: newInput, result: newResult, previousIndicators: prev, resultReturnTarget: 'stay' });
    }
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
  // 結果画面から特定のページへ直接戻る（年金だけ・投資額だけ・車購入だけ等）。
  // thoroughInput はそのまま（入力値を保持）。再計算は submitThorough で結果へ戻る。
  editThoroughPage: (pageId) => {
    const ti = get().thoroughInput;
    if (!ti) return;
    const pages = visibleThoroughPages(ti);
    const page = pages.find((p) => p.pageId === pageId) ?? pages[0];
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
    set({
      mode: 'rough',
      roughDraft: draft,
      input,
      result,
      phase: 'result',
      cameFromResult: false,
      resumePrompt: false,
      previousIndicators: null,
    });
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
      previousIndicators: null,
      result: null,
    });
    if (toResult) get().submitThorough();
  },

  loadHighIncomeSample: (pensionAnnual = 0) => {
    const draft = draftFromAnswers(HIGH_INCOME_ANSWERS);
    const input = buildFullInputFromRough(draft);
    // 「年金あり・現実寄り」検証では、年金見込みを反映する。
    if (pensionAnnual > 0) {
      input.retirement.pension = field(pensionAnnual, 'user_input', '年金見込み', '', '万円');
    }
    const result = runSimulation(input);
    set({
      mode: 'rough',
      roughDraft: draft,
      input,
      result,
      phase: 'result',
      cameFromResult: false,
      resumePrompt: false,
      previousIndicators: null,
    });
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
