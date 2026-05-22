import type {
  AssumptionLine,
  Indicators,
  LifeEventMarker,
  SimulationInput,
  SimulationResult,
  YearRow,
} from '../schema/types';
import { totalEducationCost } from './educationCostEngine';
import { annualHousingCost, mortgageEvents } from './mortgageEngine';
import { fireAchievementRate, postFireIncomeForAge } from './fireEngine';
import { buildSuggestions, judge } from './judgmentEngine';
import {
  CAPTURE_NOTE,
  DEFAULT_CASH_RATIO,
  DEFAULT_INVEST_FRACTION,
  HOME_MAINTENANCE_ANNUAL,
  MEDICAL_CARE_RESERVE,
  RETURN_MODEL_NOTE,
  SIM,
  TAX_SIMPLIFIED_NOTE,
  takeHomeRate,
} from './constants';

// =============================================================================
// 年次シミュレーション オーケストレーター（純粋関数・React非依存）
// 漸化式: 翌年資産 = 前年資産 ×(1+名目利回り) + 年間収入 − 年間支出 − 税金
//
// 計算前提（初期実装）:
//   - 想定利回り = 名目利回り（資産にそのまま適用）
//   - インフレ率 = 支出（生活費・教育費など）の毎年の増加率
//   - 実質利回りとして自動で差し引く処理はしない
//   - 税金は簡略化（収入は手取りベース、投資課税・各種控除は未反映）
// ざっくり/しっかり問わず buildFullInput 済みの SimulationInput を受け取る。
//
// ── 計算反映ステータス（STEP5） ──
// 反映済み: 年齢 / 手取り年収(直接入力 > 夫婦別収入の手取り換算合算 > 世帯年収×年収帯手取り率) /
//   昇給率(現役期に年次反映) / 退職予定年齢(以降は労働収入0) / 現在資産(現金/投資に分割) /
//   現金比率(投資資産のみ利回り) / 毎月投資額(現金→投資への移動。二重加算しない) /
//   毎月生活費 / 住宅費(賃貸=家賃, 持ち家=ローン返済を完済年齢まで＋完済後維持費) /
//   子ども別年齢→教育費 / 教育方針 / 想定利回り(名目) / インフレ率(支出側) /
//   FIRE種別・希望年齢 / FIRE後生活費 / サイドFIRE後収入・就労終了年齢 /
//   年間特別費・車・旅行・保険 / 退職金(FIRE/退職年に一括) / 年金(65歳〜, 入力時) /
//   医療介護予備費(75/85歳〜) / ライフイベント支出・収入
// 簡略反映: 持ち家維持費は定額(年60万) / 教育費は初期値テーブル / 税(0) / 手取り率は年収帯ざっくり
// 未反映(次STEP): 住宅ローン残高・金利・固定変動・返済方式・ボーナス払いからの償却 /
//   配偶者年齢 / NISA・iDeCo・各種控除 / 暴落シナリオ / 夫婦別の退職年齢・年金
// 重要: 毎月投資額は二重加算しない（現金資産→投資資産の振替であり、総資産は年間収支で増減）。
//       資産は現金資産と投資資産に分け、利回りは投資資産にのみ適用する。
// =============================================================================

export function runSimulation(input: SimulationInput): SimulationResult {
  const startAge = input.basic.age.value;
  const fireStartAge = input.fire.type.value === 'none' ? input.income.retirementAge.value : input.fire.targetAge.value;
  const retirementAge = input.income.retirementAge.value;
  const returnRate = input.investment.returnRate.value / 100;
  const inflation = input.investment.inflationRate.value / 100;
  const raiseRate = input.income.raiseRate.value / 100;

  // 手取り年収（直接入力 > 夫婦別 > 世帯年収）
  const { householdTakeHome } = computeTakeHome(input);

  // 現金/投資の分割（利回りは投資資産のみ）
  const cashRatioKnown = input.basic.cashRatio.source === 'user_input';
  const cashRatio = cashRatioKnown ? clamp01(input.basic.cashRatio.value / 100) : DEFAULT_CASH_RATIO;
  let invest = input.basic.currentAssets.value * (1 - cashRatio);
  let cash = input.basic.currentAssets.value * cashRatio;

  const monthlyInvestKnown = input.investment.monthlyInvestment.source === 'user_input';
  const monthlyInvestAnnual = input.investment.monthlyInvestment.value * 12;

  const rows: YearRow[] = [];
  const baseEvents = mortgageEvents(input.housing, startAge);

  for (let age = startAge; age <= SIM.endAge; age++) {
    const offset = age - startAge;
    const startAssets = cash + invest;
    const inflationFactor = Math.pow(1 + inflation, offset); // 支出側の増加率

    // 1) 投資資産にのみ利回りを適用
    const investmentReturn = invest * returnRate;
    invest += investmentReturn;

    // ---- 収入（手取りベース。現役期は昇給を反映。FIRE後は労働収入0）----
    const working = age < fireStartAge && age < retirementAge;
    const labor = working ? householdTakeHome * Math.pow(1 + raiseRate, offset) : 0;
    const postFire = postFireIncomeForAge(input.fire, age);
    const pension = age >= SIM.pensionStartAge ? input.retirement.pension.value : 0;
    const other =
      sumLifeEventInflows(input, age) + (age === fireStartAge ? input.income.retirementLumpSum.value : 0);
    const incomeTotal = labor + postFire + pension + other;

    // ---- 支出（住宅費以外はインフレを適用）----
    const living = livingCostForAge(input, age, fireStartAge) * inflationFactor;
    const education = totalEducationCost(input.children, offset) * inflationFactor;
    const housing = annualHousingCost(input.housing, age, startAge); // ローン/維持費は名目
    const special =
      (input.expense.annualSpecial.value +
        input.expense.carCost.value +
        input.expense.travelCost.value +
        input.expense.insuranceCost.value +
        sumLifeEventCosts(input, age)) *
      inflationFactor;
    const retirementExtra = medicalCareExtra(input, age) * inflationFactor;
    const expenseTotal = living + education + housing + special + retirementExtra;

    const tax = 0; // 簡略化（手取りベース）

    // ---- デバッグ用内訳の事前計算 ----
    const lifeEventIncome = sumLifeEventInflows(input, age);
    const lifeEventExpense = sumLifeEventCosts(input, age) * inflationFactor;
    const retirementIncome = age === fireStartAge ? input.income.retirementLumpSum.value : 0;
    const isOwn = input.housing.type.value !== 'rent';
    const payoffAge =
      input.housing.remainingYears.value > 0
        ? startAge + input.housing.remainingYears.value
        : input.housing.monthlyPayment.value > 0
          ? Infinity
          : startAge;
    const homeMaintenanceCost = isOwn && age >= payoffAge ? housing : 0;
    const cashBeforeNet = cash;

    // 2) 年間収支を現金資産へ
    const net = incomeTotal - expenseTotal - tax;
    cash += net;

    // 3) 現役期のみ、毎月投資額（または黒字の保守的割合）を現金→投資へ移す
    if (working && cash > 0) {
      const target = monthlyInvestKnown ? monthlyInvestAnnual : net > 0 ? net * DEFAULT_INVEST_FRACTION : 0;
      const contribution = Math.min(Math.max(0, target), cash);
      cash -= contribution;
      invest += contribution;
    }

    // 4) 現金がマイナスなら投資資産から取り崩す
    let withdrawalFromInvestment = 0;
    if (cash < 0) {
      withdrawalFromInvestment = -cash;
      invest += cash;
      cash = 0;
    }
    const deficit = Math.max(0, -net);
    const withdrawalFromCash = Math.min(deficit, Math.max(0, cashBeforeNet));

    const endAssets = cash + invest;

    rows.push({
      age,
      year: new Date().getFullYear() + offset,
      startAssets,
      investmentReturn,
      income: { labor, postFire, pension, other, total: incomeTotal },
      expense: { living, education, housing, special, retirementExtra, total: expenseTotal },
      tax,
      endAssets,
      events: eventsForAge(age, fireStartAge, input, baseEvents, endAssets, startAssets),
      debug: {
        cashAssets: cash,
        investmentAssets: invest,
        homeMaintenanceCost,
        lifeEventIncome,
        lifeEventExpense,
        retirementIncome,
        annualNetCashflow: net,
        withdrawalFromCash,
        withdrawalFromInvestment,
      },
    });
  }

  const indicators = computeIndicators(rows, input, fireStartAge);
  const score = judge(indicators);
  const suggestions = buildSuggestions(indicators, score);

  return {
    rows,
    indicators,
    score,
    assumptions: collectAssumptions(input),
    flags: collectFlags(input),
    notes: buildNotes(input, cashRatioKnown, monthlyInvestKnown),
    suggestions,
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** 手取り年収を優先順位（直接 > 夫婦別 > 世帯）で求める。 */
function computeTakeHome(input: SimulationInput): {
  householdTakeHome: number;
  method: 'direct' | 'split' | 'household';
} {
  const th = input.basic.takeHomeIncome;
  if (th.source === 'user_input' && th.value > 0) {
    return { householdTakeHome: th.value, method: 'direct' };
  }
  const self = input.income.selfIncome;
  const spouse = input.income.spouseIncome;
  if (self.source === 'user_input' || spouse.source === 'user_input') {
    const s = self.source === 'user_input' ? self.value * takeHomeRate(self.value) : 0;
    const p = spouse.source === 'user_input' ? spouse.value * takeHomeRate(spouse.value) : 0;
    return { householdTakeHome: Math.round(s + p), method: 'split' };
  }
  // th.value は applyRecommendedValues により世帯年収×年収帯手取り率で既に概算済み
  return { householdTakeHome: th.value, method: 'household' };
}

const TAKE_HOME_METHOD_NOTE: Record<'direct' | 'split' | 'household', string> = {
  direct: '手取り年収を直接使用して計算しています。',
  split: '夫婦別収入から手取りを推定して計算しています。',
  household: '世帯年収から簡易に手取りを推定して計算しています。',
};

function buildNotes(input: SimulationInput, cashRatioKnown: boolean, monthlyInvestKnown: boolean): string[] {
  const notes = [TAX_SIMPLIFIED_NOTE, RETURN_MODEL_NOTE];

  const { method } = computeTakeHome(input);
  notes.push(TAKE_HOME_METHOD_NOTE[method]);

  notes.push(
    cashRatioKnown
      ? `現金比率${input.basic.cashRatio.value}%を反映し、投資資産にのみ利回りを適用しています。`
      : `現金比率は未入力のため${Math.round(DEFAULT_CASH_RATIO * 100)}%を仮定し、投資資産にのみ利回りを適用しています。`,
  );

  notes.push(
    monthlyInvestKnown
      ? `毎月投資額を現金から投資への新規投入として反映しています（収支への二重加算なし）。`
      : `毎月投資額は未入力のため、年間黒字の一部のみを投資に回す保守的な仮定です。`,
  );

  if (input.housing.type.value !== 'rent') {
    notes.push(`住宅ローン完済後も、持ち家維持費として年${HOME_MAINTENANCE_ANNUAL}万円を仮定しています。`);
  }

  if (input.retirement.medicalCareReserve.value) {
    notes.push('75歳以降の医療介護予備費を老後支出として反映しています。');
  }

  if (input.lifeEvents.length > 0) {
    notes.push(`ライフイベント（${input.lifeEvents.length}件）を指定年齢に反映しています。`);
    if (input.lifeEvents.some((e) => e.id === 'inherit' || e.amount.value < 0)) {
      notes.push('相続見込みは入力値に基づく仮定です（不確実性があります）。');
    }
  }

  if (input.meta.mode === 'thorough') notes.push(CAPTURE_NOTE);
  return notes;
}

// ---- 補助関数 --------------------------------------------------------------

function livingCostForAge(input: SimulationInput, age: number, fireStartAge: number): number {
  if (age >= SIM.pensionStartAge) return input.retirement.retirementLiving.value;
  if (age >= fireStartAge) return input.fire.postFireLiving.value;
  return input.expense.monthlyLiving.value * 12;
}

function medicalCareExtra(input: SimulationInput, age: number): number {
  if (!input.retirement.medicalCareReserve.value) return 0;
  if (age >= 85) return MEDICAL_CARE_RESERVE.from85;
  if (age >= 75) return MEDICAL_CARE_RESERVE.from75;
  return 0;
}

function sumLifeEventCosts(input: SimulationInput, age: number): number {
  return input.lifeEvents
    .filter((e) => e.atAge.value === age && e.amount.value > 0)
    .reduce((s, e) => s + e.amount.value, 0);
}

function sumLifeEventInflows(input: SimulationInput, age: number): number {
  return input.lifeEvents
    .filter((e) => e.atAge.value === age && e.amount.value < 0)
    .reduce((s, e) => s - e.amount.value, 0);
}

function eventsForAge(
  age: number,
  fireStartAge: number,
  input: SimulationInput,
  baseEvents: LifeEventMarker[],
  endAssets: number,
  startAssets: number,
): LifeEventMarker[] {
  const out: LifeEventMarker[] = baseEvents.filter((e) => e.age === age);

  if (age === fireStartAge) {
    out.push({
      age,
      kind: input.fire.type.value === 'side' ? 'side_fire_start' : 'fire_start',
      label: input.fire.type.value === 'side' ? 'サイドFIRE開始' : 'FIRE開始',
    });
  }
  if (age === SIM.pensionStartAge && input.retirement.pension.value > 0) {
    out.push({ age, kind: 'pension_start', label: '年金受給開始' });
  }
  if (input.fire.type.value === 'side' && age === input.fire.workUntilAge.value) {
    out.push({ age, kind: 'full_retire', label: '完全リタイア' });
  }
  if (startAssets > 0 && endAssets <= 0) {
    out.push({ age, kind: 'asset_depletion', label: '資産が尽きる試算' });
  }
  return out;
}

function computeIndicators(rows: YearRow[], input: SimulationInput, fireStartAge: number): Indicators {
  const atFire = rows.find((r) => r.age === fireStartAge);
  const assetsAtFire = atFire ? atFire.startAssets : 0;

  const depleted = rows.find((r) => r.endAssets <= 0);
  const at95 = rows.find((r) => r.age === SIM.endAge);

  // 教育費ピーク年
  let peak = rows[0];
  for (const r of rows) if (r.expense.education > (peak?.expense.education ?? 0)) peak = r;
  const peakNet = peak ? peak.income.total - peak.expense.total : 0;
  const peakPct = peak && peak.startAssets > 0 ? (Math.abs(Math.min(0, peakNet)) / peak.startAssets) * 100 : 0;

  const annualHousing = annualHousingCost(input.housing, input.basic.age.value, input.basic.age.value);
  const takeHome = input.basic.takeHomeIncome.value || 1;

  return {
    fireAchievementRate: fireAchievementRate(assetsAtFire, input.fire),
    assetLongevityAge: depleted ? depleted.age : null,
    assetsAt95: at95 ? at95.endAssets : 0,
    eduPeakResilience: {
      peakAge: peak ? peak.age : input.basic.age.value,
      netCashFlow: peakNet,
      pctOfAssets: peakPct,
    },
    mortgageBurden: annualHousing / takeHome,
  };
}

// ---- 「今回の試算条件」と注意フラグ -----------------------------------------

function collectAssumptions(input: SimulationInput): AssumptionLine[] {
  // 代表的な項目から生成。TODO(実装): 全 Field を走査して網羅する。
  const lines: AssumptionLine[] = [];
  const push = (f: { label: string; value: unknown; source: AssumptionLine['source']; assumptionText: string; unit?: string }) =>
    lines.push({
      label: f.label,
      valueText: `${typeof f.value === 'number' ? f.value.toLocaleString('ja-JP') : String(f.value)}${f.unit ?? ''}`,
      source: f.source,
      assumptionText: f.assumptionText,
    });

  push(input.investment.returnRate);
  push(input.investment.inflationRate);
  push(input.fire.postFireLiving);
  push(input.retirement.retirementLiving);
  push(input.retirement.pension);
  push(input.income.retirementLumpSum);
  return lines;
}

function collectFlags(input: SimulationInput): string[] {
  const flags: string[] = [];
  if (input.children.some((c) => c.ageAssumed)) {
    flags.push('子どもの年齢は仮定で試算しています。');
  }
  if (input.retirement.pension.source === 'skipped') {
    flags.push('年金は未入力（0円）で試算しています。');
  }
  if (input.income.retirementLumpSum.source === 'skipped') {
    flags.push('退職金は未入力（0円）で試算しています。');
  }
  return flags;
}
