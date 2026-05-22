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

// =============================================================================
// 年次シミュレーション オーケストレーター（純粋関数・React非依存）
// 漸化式: 翌年資産 = 前年資産 ×(1+利回り) + 年間収入 − 年間支出 − 税金
// ざっくり/しっかり問わず buildFullInput 済みの SimulationInput を受け取る。
// =============================================================================

const END_AGE = 95;
const PENSION_START_AGE = 65;

export function runSimulation(input: SimulationInput): SimulationResult {
  const startAge = input.basic.age.value;
  const fireStartAge = input.fire.type.value === 'none' ? input.income.retirementAge.value : input.fire.targetAge.value;

  const rows: YearRow[] = [];
  const baseEvents = mortgageEvents(input.housing, startAge);

  let assets = input.basic.currentAssets.value;

  for (let age = startAge; age <= END_AGE; age++) {
    const offset = age - startAge;
    const startAssets = assets;

    const investmentReturn = startAssets * (input.investment.returnRate.value / 100);

    // ---- 収入 ----
    const working = age < fireStartAge && age < input.income.retirementAge.value;
    const labor = working ? input.basic.takeHomeIncome.value : 0;
    const postFire = postFireIncomeForAge(input.fire, age);
    const pension = age >= PENSION_START_AGE ? input.retirement.pension.value : 0;
    const other = sumLifeEventInflows(input, age) + (age === input.income.retirementAge.value ? input.income.retirementLumpSum.value : 0);
    const incomeTotal = labor + postFire + pension + other;

    // ---- 支出 ----
    const living = livingCostForAge(input, age, fireStartAge);
    const education = totalEducationCost(input.children, offset);
    const housing = annualHousingCost(input.housing, age);
    const special =
      input.expense.annualSpecial.value +
      input.expense.carCost.value +
      input.expense.travelCost.value +
      input.expense.insuranceCost.value +
      sumLifeEventCosts(input, age);
    const retirementExtra = medicalCareExtra(input, age);
    const expenseTotal = living + education + housing + special + retirementExtra;

    // ---- 税金（初期は簡略化: 手取りベースのため0）----
    // TODO(実装): 投資課税やFIRE後の税を簡易モデルで加える。
    const tax = 0;

    const endAssets = startAssets * (1 + input.investment.returnRate.value / 100) + incomeTotal - expenseTotal - tax;

    rows.push({
      age,
      year: new Date().getFullYear() + offset,
      startAssets,
      investmentReturn,
      income: { labor, postFire, pension, other, total: incomeTotal },
      expense: { living, education, housing, special, retirementExtra, total: expenseTotal },
      tax,
      endAssets,
      events: eventsForAge(age, startAge, fireStartAge, input, baseEvents, endAssets, startAssets),
    });

    assets = endAssets;
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
    suggestions,
  };
}

// ---- 補助関数 --------------------------------------------------------------

function livingCostForAge(input: SimulationInput, age: number, fireStartAge: number): number {
  if (age >= PENSION_START_AGE) return input.retirement.retirementLiving.value;
  if (age >= fireStartAge) return input.fire.postFireLiving.value;
  return input.expense.monthlyLiving.value * 12;
}

function medicalCareExtra(input: SimulationInput, age: number): number {
  if (!input.retirement.medicalCareReserve.value) return 0;
  if (age >= 85) return 60;
  if (age >= 75) return 30;
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
  startAge: number,
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
  if (age === PENSION_START_AGE && input.retirement.pension.value > 0) {
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
  const at95 = rows.find((r) => r.age === END_AGE);

  // 教育費ピーク年
  let peak = rows[0];
  for (const r of rows) if (r.expense.education > (peak?.expense.education ?? 0)) peak = r;
  const peakNet = peak ? peak.income.total - peak.expense.total : 0;
  const peakPct = peak && peak.startAssets > 0 ? (Math.abs(Math.min(0, peakNet)) / peak.startAssets) * 100 : 0;

  const annualHousing = annualHousingCost(input.housing, input.basic.age.value);
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
