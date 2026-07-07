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
import {
  monthlyYenToMan,
  readImportedLivingCost,
  type ImportedLivingCost,
} from '../lib/importedLivingCost';
import {
  monthlyYenToMan as mortgageMonthlyYenToMan,
  balanceYenToMan,
  bonusYenToMan,
  readImportedMortgage,
  type ImportedMortgage,
} from '../lib/importedMortgage';
import {
  educationImportFingerprint,
  hasEducationSourceCurrentPlan,
  mapToChildInputs,
  readImportedEducation,
  type ImportedEducation,
} from '../lib/importedEducation';
import type {
  Field,
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

/** UI 入力は月額・内部値は年額として扱うパス。setThoroughValue で ×12 する。
 *  ユーザーが「毎月の生活費」で思考するため、入力ラベルを月額に統一しても
 *  engine（年額前提）と既存テストが壊れないように、書き込み時にここで吸収する。 */
const MONTHLY_INPUT_PATHS = new Set<string>([
  'fire.postFireLiving',
  'retirement.retirementLiving',
]);
function isMonthlyInputPath(path: string): boolean {
  return MONTHLY_INPUT_PATHS.has(path);
}

/** 月額入力パスの内部年額値を、表示用の月額に換算する。 */
export function monthlyDisplayValue(annualValue: number): number {
  return Math.round((annualValue / 12) * 10) / 10;
}

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
  // 生活費見直しシミュレーター からの取り込みメタ。古い保存に存在しないことがある。
  importedLivingCost?: ImportedLivingCost | null;
  livingCostManuallyEdited?: boolean;
  // 住宅ローンシミュレーター からの取り込みメタ。同じく古い保存に存在しないことがある。
  importedMortgage?: ImportedMortgage | null;
  mortgageManuallyEdited?: boolean;
  // 教育費ピークシミュレーター からの取り込みメタ。同じく古い保存に存在しないことがある。
  importedEducation?: ImportedEducation | null;
  educationManuallyEdited?: boolean;
  appliedEducationImportFingerprint?: string | null;
}

// 生活費見直しシミュレーター からの取り込み値を、ざっくり/しっかりそれぞれの「現在生活費」
// 入力欄に反映する。書き込み先はあくまで:
//   ・ざっくり: roughDraft.monthlyLiving （applyRoughDraft 経由で SimulationInput.expense.monthlyLiving に合流）
//   ・しっかり: SimulationInput.expense.monthlyLiving （path: 'expense.monthlyLiving'）
// この 2 つだけが「現在の家計／毎月の生活費／現在生活費」として表示・計算で使われる
// source of truth。fire.postFireLiving (FIRE後生活費) や retirement.retirementLiving (老後生活費)
// は recommendedValues.ts が現在生活費から派生させる別フィールドで、ここでは直接書き換えない。
// 反映後の source は 'user_input'（他アプリでユーザーが下した判断を尊重し、recommendedValues
// 側の派生処理を壊さない）。
function applyLivingCostToRoughDraft(draft: RoughDraft, monthlyMan: number): RoughDraft {
  return { ...draft, monthlyLiving: { value: monthlyMan, source: 'user_input' } };
}
function applyLivingCostToThoroughExpense(ti: SimulationInput, monthlyMan: number): SimulationInput {
  const f = ti.expense.monthlyLiving;
  const next = withResolved(f, monthlyMan, 'user_input', {
    user: `生活費見直しシミュレーターから${monthlyMan}万円/月を反映しています。`,
  });
  return setFieldByPath(ti, 'expense.monthlyLiving', next);
}

// 住宅ローンシミュレーター 取り込み: ざっくり側に反映できるのは housing.type / monthlyHousing / loanYears のみ。
// 残高・金利・ボーナス・返済方式・金利タイプはざっくりでは表現できないので、しっかり側でのみ書き込む。
// 住宅ローン情報が来た時点で「持ち家」と扱い、housing.type='own' を強制する。
const MORTGAGE_ROUGH_IDS: ReadonlySet<RoughFieldId> = new Set<RoughFieldId>([
  'housing',
  'monthlyHousing',
  'loanYears',
]);
function isMortgageThoroughPath(path: string): boolean {
  return path.startsWith('housing.');
}
function applyImportedMortgageToRoughDraft(draft: RoughDraft, imported: ImportedMortgage): RoughDraft {
  const next: RoughDraft = { ...draft };
  next.housing = { value: 'own', source: 'user_input' };
  if (imported.monthlyPaymentYen !== undefined) {
    next.monthlyHousing = {
      value: mortgageMonthlyYenToMan(imported.monthlyPaymentYen),
      source: 'user_input',
    };
  }
  if (imported.remainingYears !== undefined) {
    next.loanYears = { value: imported.remainingYears, source: 'user_input' };
  }
  return next;
}
function applyImportedMortgageToThoroughInput(
  ti: SimulationInput,
  imported: ImportedMortgage,
): SimulationInput {
  let next = ti;
  // 住宅ローンが来た = 持ち家として扱う。
  next = setFieldByPath(
    next,
    'housing.type',
    withResolved(next.housing.type, 'own', 'user_input', {
      user: '住宅ローンシミュレーターからの取り込みにより持ち家として試算しています。',
    }),
  );
  const writeNumber = (path: string, value: number) => {
    const f = getFieldByPath(next, path);
    if (!f) return;
    next = setFieldByPath(next, path, withResolved(f, value, 'user_input', {
      user: `住宅ローンシミュレーターから${value}${f.unit ?? ''}を反映しています。`,
    }));
  };
  const writeChoice = <T>(path: string, value: T) => {
    const f = getFieldByPath(next, path);
    if (!f) return;
    next = setFieldByPath(next, path, withResolved(f as Field<T>, value, 'user_input', {
      user: `住宅ローンシミュレーターから反映しています。`,
    }) as Field<unknown>);
  };
  if (imported.monthlyPaymentYen !== undefined) {
    writeNumber('housing.monthlyPayment', mortgageMonthlyYenToMan(imported.monthlyPaymentYen));
  }
  if (imported.balanceYen !== undefined) {
    writeNumber('housing.balance', balanceYenToMan(imported.balanceYen));
  }
  if (imported.interestRate !== undefined) {
    writeNumber('housing.rate', imported.interestRate);
  }
  if (imported.remainingYears !== undefined) {
    writeNumber('housing.remainingYears', imported.remainingYears);
  }
  if (imported.bonusAnnualYen !== undefined) {
    writeNumber('housing.bonusAnnual', bonusYenToMan(imported.bonusAnnualYen));
  }
  if (imported.repaymentMethod !== undefined) {
    writeChoice<'equal_payment' | 'equal_principal'>(
      'housing.repayMethod',
      imported.repaymentMethod === 'equalPrincipal' ? 'equal_principal' : 'equal_payment',
    );
  }
  if (imported.rateType !== undefined) {
    // fixedPeriod は総合版に型がないため fixed として扱う。
    writeChoice<'fixed' | 'variable'>(
      'housing.rateType',
      imported.rateType === 'variable' ? 'variable' : 'fixed',
    );
  }
  return next;
}

// 教育費ピークシミュレーター 取り込み（Stage 2・B案）:
// 引き継ぐのは「条件」のみ。子どもの対応付けは入力順。Sim の金額（ピーク・総額）は
// 計算へ注入せず、結果画面の参考表示だけに使う。下宿は uniLiving='away' で表現し
// 追加イベントは作らない（総合版の大学年額に自宅外生活費が内包されているため）。
//
// pending 判定は fingerprint 方式:
//   incoming = 現在 localStorage にある payload の教育条件 fingerprint
//   applied  = 最後に総合版へ適用した fingerprint（appliedEducationImportFingerprint）
//   incoming === applied のときは savedAt だけの再保存を含め「新しい条件なし」として扱い、
//   手動編集の有無にかかわらず pending を出さない。
export const EDUCATION_ROUGH_IDS: ReadonlySet<RoughFieldId> = new Set<RoughFieldId>([
  'childrenCount',
  'educationPolicy',
  'childAge1',
  'childAge2',
  'childAge3',
  'childAge4',
]);
function isEducationThoroughPath(path: string): boolean {
  return path.startsWith('children.');
}

const CHILD_AGE_ROUGH_IDS: RoughFieldId[] = ['childAge1', 'childAge2', 'childAge3', 'childAge4'];

// ざっくり側には childrenCount と childAge1〜4 だけを反映する。
// educationPolicy は取り込み条件の近似変換をせず触らない（詳細条件は結果ビルド時に
// children を直接構成することで計算へ反映する。UI 側はロック表示で整合を取る）。
function applyImportedEducationToRoughDraft(draft: RoughDraft, imported: ImportedEducation): RoughDraft {
  const next: RoughDraft = { ...draft };
  // childrenCount の選択肢は '0'〜'4' の文字列（roughQuestions）なので文字列で書く。
  next.childrenCount = { value: String(imported.children.length), source: 'user_input' };
  CHILD_AGE_ROUGH_IDS.forEach((id, i) => {
    next[id] =
      i < imported.children.length
        ? { value: imported.children[i].currentAge, source: 'user_input' }
        : { value: null, source: 'default_value' };
  });
  return next;
}

// 原子的適用の共通部。roughDraft / thoroughInput / applied fingerprint を 1 回の set() 分の
// 更新として返す。通常入力 setter は経由しない（educationManuallyEdited を立てないため）。
function buildEducationApplyUpdates(
  imported: ImportedEducation,
  roughDraft: RoughDraft,
  thoroughInput: SimulationInput | null,
): Partial<InputState> {
  const updates: Partial<InputState> = {
    roughDraft: applyImportedEducationToRoughDraft(roughDraft, imported),
    appliedEducationImportFingerprint: educationImportFingerprint(imported),
  };
  if (thoroughInput) {
    updates.thoroughInput = { ...thoroughInput, children: mapToChildInputs(imported) };
  }
  return updates;
}

type EducationImportSlice = Pick<
  InputState,
  'importedEducation' | 'appliedEducationImportFingerprint' | 'educationManuallyEdited'
>;

/** 取り込みが現に計算を支配している状態か（rough ロック・children 差し替えの共通判定）。 */
export function educationImportIsActive(s: EducationImportSlice): boolean {
  return (
    !!s.importedEducation &&
    !s.educationManuallyEdited &&
    s.appliedEducationImportFingerprint === educationImportFingerprint(s.importedEducation)
  );
}

/** バナー表示用の状態。
 *  none    … 取り込みなし
 *  active  … 取り込み条件が計算に使われている（通常バナー＋参考行）
 *  pending … 新しい条件があるが自動上書きできない（「反映する」を優先表示。通常バナーは出さない）
 *  edited  … 取り込み後に総合版で手動変更済み（控えめな注記のみ。参考行は出さない） */
export type EducationImportStatus = 'none' | 'active' | 'pending' | 'edited';
export function educationImportStatus(s: EducationImportSlice): EducationImportStatus {
  if (!s.importedEducation) return 'none';
  const incoming = educationImportFingerprint(s.importedEducation);
  if (incoming !== s.appliedEducationImportFingerprint) return 'pending';
  return s.educationManuallyEdited ? 'edited' : 'active';
}

// 初回取り込み前（applied fingerprint が無い）に存在する教育関連のローカル手入力。
// 取り込み適用は source を user_input にするため、この判定は applied === null のときにしか使わない
// （後続の新 payload 自動適用を取り込み由来の user_input が阻止しないようにする）。
function hasExistingEducationUserInput(draft: RoughDraft, ti: SimulationInput | null): boolean {
  for (const id of EDUCATION_ROUGH_IDS) {
    if (draft[id]?.source === 'user_input') return true;
  }
  if (!ti) return false;
  return ti.children.some(
    (c) =>
      c.currentAge.source === 'user_input' ||
      c.elementarySchool.source === 'user_input' ||
      c.middleSchool.source === 'user_input' ||
      c.highSchool.source === 'user_input' ||
      c.university.source === 'user_input' ||
      c.uniLiving.source === 'user_input',
  );
}

/** 取り込みがアクティブなら、計算入力の children を取り込み条件（入力順）で直接構成する。
 *  ざっくり診断の POLICY_PATHS 近似を経由しないための、結果ビルド時の合流点。 */
function withImportedEducationChildren(input: SimulationInput, s: EducationImportSlice): SimulationInput {
  if (!educationImportIsActive(s)) return input;
  return { ...input, children: mapToChildInputs(s.importedEducation!) };
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
  /** 生活費見直しシミュレーター（別アプリ）から取り込んだ月額生活費のメタ。
   *  URL パラメータまたは localStorage で受け取り、起動時に 1 回だけ反映する。
   *  バナー表示・反映元ラベルの判定にも使う。 */
  importedLivingCost: ImportedLivingCost | null;
  /** 生活費入力欄をユーザーが総合版上で手動編集したら true。
   *  以降、URL パラメータが新たに来ない限り、localStorage からの自動上書きを抑止する。 */
  livingCostManuallyEdited: boolean;
  /** 住宅ローンシミュレーター（別アプリ）から取り込んだ住宅ローン情報のメタ。
   *  URL パラメータまたは localStorage で受け取り、起動時に 1 回だけ反映する。
   *  バナー表示・反映元ラベルの判定にも使う。 */
  importedMortgage: ImportedMortgage | null;
  /** 住宅ローン関連項目をユーザーが総合版上で手動編集したら true。
   *  以降、URL パラメータが新たに来ない限り、localStorage からの自動上書きを抑止する。 */
  mortgageManuallyEdited: boolean;
  /** 教育費ピークシミュレーター（別アプリ）から取り込んだ教育条件のメタ。
   *  データは localStorage `lifePlanLab:education` のみ（URL は educationSource フラグだけ）。 */
  importedEducation: ImportedEducation | null;
  /** 教育関連項目（子ども人数・年齢・進学方針）を総合版上で手動編集したら true。
   *  true の間は新しい payload が来ても自動上書きせず pending として保持する
   *  （educationSource=currentPlan の明示遷移でも上書きしない）。 */
  educationManuallyEdited: boolean;
  /** 最後に総合版へ適用した教育条件の fingerprint。incoming と一致する限り
   *  「新しい条件なし」として扱う（savedAt だけの再保存で pending を出さないため）。 */
  appliedEducationImportFingerprint: string | null;

  setMode: (mode: Mode) => void;
  reset: () => void;
  /** 起動時に 1 回だけ呼ぶ。URL → localStorage の順で取り込み、適用判定を行う。 */
  initializeImportedLivingCost: () => void;
  /** 起動時に 1 回だけ呼ぶ。住宅ローン取り込みの URL → localStorage 読込と適用。 */
  initializeImportedMortgage: () => void;
  /** 起動時に 1 回だけ呼ぶ。教育費取り込みの読込と fingerprint 判定・適用。 */
  initializeImportedEducation: () => void;
  /** pending の「反映する」と、解除後の「条件を再適用する」の共通アクション。
   *  原子的に適用し、educationManuallyEdited を false へ戻す。 */
  applyImportedEducationNow: () => void;
  /** rough ロックの「取り込みを解除して自分で入力する」。取り込みの計算支配を外す。 */
  releaseImportedEducation: () => void;

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
  importedLivingCost: saved?.importedLivingCost ?? null,
  livingCostManuallyEdited: saved?.livingCostManuallyEdited ?? false,
  importedMortgage: saved?.importedMortgage ?? null,
  mortgageManuallyEdited: saved?.mortgageManuallyEdited ?? false,
  importedEducation: saved?.importedEducation ?? null,
  educationManuallyEdited: saved?.educationManuallyEdited ?? false,
  appliedEducationImportFingerprint: saved?.appliedEducationImportFingerprint ?? null,

  setMode: (mode) => {
    // 起動時に取り込んだ生活費／住宅ローン／教育費があり、まだ手動編集されていなければ、新規モードの初期値に反映する。
    const {
      importedLivingCost,
      livingCostManuallyEdited,
      importedMortgage,
      mortgageManuallyEdited,
      importedEducation,
      educationManuallyEdited,
    } = get();
    const monthlyMan =
      importedLivingCost && !livingCostManuallyEdited
        ? monthlyYenToMan(importedLivingCost.monthlyYen)
        : null;
    const mortgageToApply = importedMortgage && !mortgageManuallyEdited ? importedMortgage : null;
    // 新規モード開始はまっさらな入力から始まるため、手動編集さえなければ取り込みを再適用してよい。
    const educationToApply = importedEducation && !educationManuallyEdited ? importedEducation : null;
    const eduFingerprint = educationToApply
      ? { appliedEducationImportFingerprint: educationImportFingerprint(educationToApply) }
      : {};

    if (mode === 'thorough') {
      let ti = freshThoroughInput();
      if (monthlyMan !== null) ti = applyLivingCostToThoroughExpense(ti, monthlyMan);
      if (mortgageToApply) ti = applyImportedMortgageToThoroughInput(ti, mortgageToApply);
      if (educationToApply) ti = { ...ti, children: mapToChildInputs(educationToApply) };
      set({
        mode,
        phase: 'input',
        thoroughInput: ti,
        thoroughPageId: firstThoroughPageId(ti),
        cameFromResult: false,
        resumePrompt: false,
        previousIndicators: null,
        ...eduFingerprint,
      });
    } else {
      let draft = emptyRoughDraft();
      if (monthlyMan !== null) draft = applyLivingCostToRoughDraft(draft, monthlyMan);
      if (mortgageToApply) draft = applyImportedMortgageToRoughDraft(draft, mortgageToApply);
      if (educationToApply) draft = applyImportedEducationToRoughDraft(draft, educationToApply);
      set({
        mode,
        phase: 'input',
        roughPage: 0,
        roughDraft: draft,
        cameFromResult: false,
        resumePrompt: false,
        previousIndicators: null,
        ...eduFingerprint,
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
      // 「最初からやり直す」「最初から始める」は完全な新規スタートとして扱う。
      // 取り込み値・取り込みバナーも完全クリアする（再反映したい場合はリロードで対応）。
      livingCostManuallyEdited: false,
      importedLivingCost: null,
      mortgageManuallyEdited: false,
      importedMortgage: null,
      educationManuallyEdited: false,
      importedEducation: null,
      appliedEducationImportFingerprint: null,
    });
  },

  initializeImportedLivingCost: () => {
    const imported = readImportedLivingCost();
    if (!imported) return;

    const { livingCostManuallyEdited, roughDraft, thoroughInput } = get();
    const isUrl = imported.origin === 'url';

    // localStorage 由来で、すでに手動編集済み「かつフィールドに実際に user_input がある」なら自動上書きしない。
    // flag だけ古いセッションから残っているケース（フィールドは空欄の default_value）では rescue として反映する。
    // 「未入力で進む」「標準例を使う」「モード選択遷移」などは flag を立てないため、ここに引っかからない。
    const fieldHasUserInput =
      roughDraft.monthlyLiving.source === 'user_input' ||
      thoroughInput?.expense.monthlyLiving.source === 'user_input';
    if (!isUrl && livingCostManuallyEdited && fieldHasUserInput) {
      set({ importedLivingCost: imported });
      return;
    }

    // URL は明示的な反映指示として手動編集履歴をリセットして強制適用する。
    const monthlyMan = monthlyYenToMan(imported.monthlyYen);
    const updates: Partial<InputState> = {
      importedLivingCost: imported,
      livingCostManuallyEdited: false,
      roughDraft: applyLivingCostToRoughDraft(roughDraft, monthlyMan),
    };
    if (thoroughInput) {
      updates.thoroughInput = applyLivingCostToThoroughExpense(thoroughInput, monthlyMan);
    }
    set(updates);
  },

  initializeImportedMortgage: () => {
    const imported = readImportedMortgage();
    if (!imported) return;

    const { mortgageManuallyEdited, roughDraft, thoroughInput } = get();
    const isUrl = imported.origin === 'url';

    if (!isUrl && mortgageManuallyEdited) {
      set({ importedMortgage: imported });
      return;
    }

    const updates: Partial<InputState> = {
      importedMortgage: imported,
      mortgageManuallyEdited: false,
      roughDraft: applyImportedMortgageToRoughDraft(roughDraft, imported),
    };
    if (thoroughInput) {
      updates.thoroughInput = applyImportedMortgageToThoroughInput(thoroughInput, imported);
    }
    set(updates);
  },

  initializeImportedEducation: () => {
    const imported = readImportedEducation();
    if (!imported) return;

    const incoming = educationImportFingerprint(imported);
    const {
      appliedEducationImportFingerprint: applied,
      educationManuallyEdited,
      roughDraft,
      thoroughInput,
    } = get();

    // 同一条件の再読込（savedAt・peak・総額だけの再保存を含む）。
    // メタ（保存日・参考値）だけ最新へ差し替え、再適用も pending もしない。
    if (incoming === applied) {
      set({ importedEducation: imported });
      return;
    }

    // 取り込み後に総合版で手動編集済み。educationSource=currentPlan の明示遷移でも
    // 自動上書きせず、pending として保持する（「反映する」の明示操作でのみ適用）。
    if (educationManuallyEdited) {
      set({ importedEducation: imported });
      return;
    }

    // 初回取り込み前（applied が無い）に存在するローカル手入力の保護。
    // 明示遷移（educationSource=currentPlan）のときは取り込む。
    // 取り込み適用は source を user_input にするため、この保護は applied === null 限定
    // （後続の新 payload は educationManuallyEdited を主判定として自動適用する）。
    if (
      applied === null &&
      !hasEducationSourceCurrentPlan() &&
      hasExistingEducationUserInput(roughDraft, thoroughInput)
    ) {
      set({ importedEducation: imported });
      return;
    }

    set({
      importedEducation: imported,
      ...buildEducationApplyUpdates(imported, roughDraft, thoroughInput),
    });
  },

  applyImportedEducationNow: () => {
    const { importedEducation, roughDraft, thoroughInput } = get();
    if (!importedEducation) return;
    set({
      educationManuallyEdited: false,
      ...buildEducationApplyUpdates(importedEducation, roughDraft, thoroughInput),
    });
  },

  releaseImportedEducation: () => set({ educationManuallyEdited: true }),

  // ---- ざっくり診断 ----
  setRoughValue: (id, value) => {
    const empty = value === '' || value === null;
    const cell: RoughCell = empty ? { value: null, source: 'default_value' } : { value, source: 'user_input' };
    // 「実際に値を変更した」場合だけ livingCostManuallyEdited を立てる。
    // 空文字に戻すケース（クリア）や「未入力で進む」「標準例を使う」では flag を変えない。
    // これにより取り込み再適用のゲートを誤って閉じない。
    const isLivingEdit = id === 'monthlyLiving' && !empty;
    set((s) => ({
      ...setCell(s, id, cell),
      ...(isLivingEdit ? { livingCostManuallyEdited: true } : {}),
      ...(MORTGAGE_ROUGH_IDS.has(id) ? { mortgageManuallyEdited: true } : {}),
      ...(EDUCATION_ROUGH_IDS.has(id) ? { educationManuallyEdited: true } : {}),
    }));
  },
  useRoughRecommended: (id) => {
    const rec = recommendedById.get(id) ?? null;
    set((s) => ({
      ...setCell(s, id, { value: rec, source: 'recommended_value' }),
      // 「標準例を使う」はユーザーが直接値を入力する操作ではないため、生活費 flag は立てない。
      ...(MORTGAGE_ROUGH_IDS.has(id) ? { mortgageManuallyEdited: true } : {}),
      ...(EDUCATION_ROUGH_IDS.has(id) ? { educationManuallyEdited: true } : {}),
    }));
  },
  skipRough: (id) =>
    set((s) => ({
      ...setCell(s, id, { value: null, source: 'skipped' }),
      // 「未入力で進む」は値変更ではなくスキップ操作。生活費 flag は立てない。
      ...(MORTGAGE_ROUGH_IDS.has(id) ? { mortgageManuallyEdited: true } : {}),
      ...(EDUCATION_ROUGH_IDS.has(id) ? { educationManuallyEdited: true } : {}),
    })),
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
    // 教育費取り込みがアクティブなら、POLICY_PATHS 近似ではなく取り込み条件で children を直接構成する。
    const input = withImportedEducationChildren(buildFullInputFromRough(get().roughDraft), get());
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
    const input = withImportedEducationChildren(buildFullInputFromRough(get().roughDraft), get());
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
    // FIRE後生活費・老後生活費は内部的に年額で保持するが、UI 入力は月額に統一する。
    // ユーザーは「毎月の生活費」で思考するため、フィールド書き込み時にここで ×12 する。
    // engine 側の意味は不変（postFireLiving / retirementLiving は年額）。
    const storedValue = !empty && isMonthlyInputPath(path) ? Number(value) * 12 : value;
    const nf = empty ? withResolved(f, null, 'skipped') : withResolved(f, storedValue, 'user_input');
    const next = setFieldByPath(ti, path, nf);
    const m = path.match(/^children\.(\d+)\.currentAge$/);
    if (m && !empty) next.children[Number(m[1])].ageAssumed = false;
    // 「実際に値を変更した」場合だけ livingCostManuallyEdited を立てる。空入力（skipped 化）では立てない。
    const isLivingEdit = path === 'expense.monthlyLiving' && !empty;
    set({
      thoroughInput: next,
      ...(isLivingEdit ? { livingCostManuallyEdited: true } : {}),
      ...(isMortgageThoroughPath(path) ? { mortgageManuallyEdited: true } : {}),
      ...(isEducationThoroughPath(path) ? { educationManuallyEdited: true } : {}),
    });
  },
  useThoroughRecommended: (path, value) => {
    const ti = get().thoroughInput;
    if (!ti) return;
    const f = getFieldByPath(ti, path);
    if (!f) return;
    // 質問定義の recommendedValue は月額（postFireLiving/retirementLiving の場合）。
    // setThoroughValue と同じく ×12 してフィールドに格納する。
    const storedValue = isMonthlyInputPath(path) && typeof value === 'number' ? value * 12 : value;
    set({
      thoroughInput: setFieldByPath(ti, path, withResolved(f, storedValue, 'recommended_value')),
      // 「標準例を使う」は値変更ではなく提案受け入れ。生活費 flag は立てない。
      ...(isMortgageThoroughPath(path) ? { mortgageManuallyEdited: true } : {}),
      ...(isEducationThoroughPath(path) ? { educationManuallyEdited: true } : {}),
    });
  },
  skipThorough: (path) => {
    const ti = get().thoroughInput;
    if (!ti) return;
    const f = getFieldByPath(ti, path);
    if (!f) return;
    set({
      thoroughInput: setFieldByPath(ti, path, withResolved(f, null, 'skipped')),
      // 「未入力で進む」は値変更ではないため、生活費 flag は立てない。
      ...(isMortgageThoroughPath(path) ? { mortgageManuallyEdited: true } : {}),
      ...(isEducationThoroughPath(path) ? { educationManuallyEdited: true } : {}),
    });
  },
  setThoroughChildrenCount: (count) => {
    const ti = get().thoroughInput;
    if (!ti) return;
    if (ti.children.length === count) return; // 変更なしなら flag も立てない
    const next = structuredClone(ti);
    const children = next.children;
    while (children.length < count) children.push(makeDetailedChild());
    if (children.length > count) next.children = children.slice(0, count);
    // 人数変更は教育条件の手動編集（取り込み値の自動上書きを止める）。
    set({ thoroughInput: next, educationManuallyEdited: true });
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
      const newInput = withImportedEducationChildren(buildFullInputFromRough(get().roughDraft), get());
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
    let ti = src ? structuredClone(src) : freshThoroughInput();
    ti.meta = { ...ti.meta, mode: 'thorough' };
    // ざっくり→深掘り遷移で取り込み済みの「現在生活費」を再適用する safety net。
    // 通常は state.input.expense.monthlyLiving 経由で引き継がれるが、state.input が
    // null のままで深掘りに遷移するエッジケース（dev 経路等）でも値を保つ。
    // 住宅ローン詳細（balance/rate/bonus 等）はざっくり側で持てないので必ず再適用する。
    const { importedLivingCost, livingCostManuallyEdited, importedMortgage, mortgageManuallyEdited } = get();
    if (importedLivingCost && !livingCostManuallyEdited) {
      ti = applyLivingCostToThoroughExpense(ti, monthlyYenToMan(importedLivingCost.monthlyYen));
    }
    if (importedMortgage && !mortgageManuallyEdited) {
      ti = applyImportedMortgageToThoroughInput(ti, importedMortgage);
    }
    // 教育費取り込みがアクティブなら深掘り側の children も取り込み条件で構成する
    // （state.input 経由でも引き継がれるが、input が null のエッジケースの safety net）。
    if (educationImportIsActive(get())) {
      ti = { ...ti, children: mapToChildInputs(get().importedEducation!) };
    }
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
    importedLivingCost: state.importedLivingCost,
    livingCostManuallyEdited: state.livingCostManuallyEdited,
    importedMortgage: state.importedMortgage,
    mortgageManuallyEdited: state.mortgageManuallyEdited,
    importedEducation: state.importedEducation,
    educationManuallyEdited: state.educationManuallyEdited,
    appliedEducationImportFingerprint: state.appliedEducationImportFingerprint,
  });
});
