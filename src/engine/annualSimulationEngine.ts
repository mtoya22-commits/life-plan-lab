import type {
  AssumptionLine,
  Indicators,
  LifeEventMarker,
  SimulationInput,
  SimulationResult,
  YearRow,
} from '../schema/types';
import { totalChildAllowance, totalEducationCost } from './educationCostEngine';
import { annualHousingCost, mortgageEvents } from './mortgageEngine';
import { fireAchievementRate, postFireIncomeForAge } from './fireEngine';
import { buildSuggestions, judge } from './judgmentEngine';
import {
  CAPTURE_NOTE,
  CAUTIOUS_SCENARIO,
  CRASH_SCENARIO,
  DEFAULT_CASH_RATIO,
  DEFAULT_INVEST_FRACTION,
  HOME_MAINTENANCE_ANNUAL,
  MEDICAL_CARE_RESERVE,
  RATE_RISE_AFTER_FIXED,
  VARIABLE_RATE_PREMIUM,
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
// 運用順序（保守的）: 利回りは「年初の投資資産」にのみ適用し、その年の新規投入は翌年から運用する。
// 枯渇の扱い: 現金・投資資産はマイナスにしない。取り崩せない不足分は cumulativeShortfall に蓄積し、
//       マイナス残高に負の利回りをかけない（負の複利を発生させない）。表示資産は0でクランプ。
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

  // 暴落シナリオ（簡易）: 「あり」のとき、取崩開始（FIRE開始 or 退職）の翌年に
  // 投資資産を一度だけ下落させる。シーケンスリスクの織り込みのため取崩期初期に置く。
  const crashEnabled = input.investment.crashScenario.value === true;
  const crashAge = getCrashAge(input);

  // 毎月投資額の積立を反映する期間の終わり（就労終了年齢）。
  // サイドFIRE: 働き方を軽くしても就労終了(workUntilAge)まで黒字の範囲で継続。
  // 完全FIRE: FIRE開始で停止。FIREなし: 退職予定年齢で停止。
  const contributionEndAge = contributionEndAgeOf(input);

  const rows: YearRow[] = [];
  const baseEvents = mortgageEvents(input.housing, startAge);

  let cumulativeShortfall = 0;
  let cumulativeShortfallPresentValue = 0;

  for (let age = startAge; age <= SIM.endAge; age++) {
    const offset = age - startAge;
    const beginningCashAssets = cash;
    const beginningInvestmentAssets = invest;
    const startAssets = cash + invest;
    const inflationFactor = Math.pow(1 + inflation, offset); // 支出側の増加率
    const presentValueFactor = 1 / inflationFactor; // 将来額 → 現在価値

    // 1) 投資資産にのみ利回りを適用（運用順序: 年初投資資産のみ＝保守的。
    //    その年の新規投入は翌年から運用。マイナス残高には利回りをかけない）
    const investmentBeforeReturn = invest;
    const investmentReturn = Math.max(0, invest) * returnRate;
    invest += investmentReturn;
    const investmentAfterReturn = invest;

    // 1.5) 暴落シナリオ（簡易）: 該当年に投資資産のみを一度だけ下落させる（現金には適用しない）。
    //      下落後は通常の名目利回りで運用を継続（回復）する。
    const crashLoss = crashEnabled && age === crashAge ? Math.max(0, invest) * CRASH_SCENARIO.dropRate : 0;
    invest -= crashLoss;

    // ---- 収入（手取りベース。現役期は昇給を反映。FIRE後は労働収入0）----
    // 収入も「現在価値入力」とみなし、支出と同じインフレ率で将来額へ換算する
    //（収入だけ名目固定にすると、長期で実質収入が目減りし過度に厳しくなるため）。
    const working = age < fireStartAge && age < retirementAge;
    const labor = working ? householdTakeHome * Math.pow(1 + raiseRate, offset) : 0;
    const postFire = postFireIncomeForAge(input.fire, age) * inflationFactor;
    const pension = (age >= SIM.pensionStartAge ? input.retirement.pension.value : 0) * inflationFactor;
    const lifeEventIncome = sumLifeEventInflows(input, age) * inflationFactor;
    const retirementIncome = (age === fireStartAge ? input.income.retirementLumpSum.value : 0) * inflationFactor;
    // 児童手当 (R6 改定): 0〜17歳の子に年単位で給付。物価スライド前提でインフレ追従。
    const childAllowance = totalChildAllowance(input.children, offset) * inflationFactor;
    const other = lifeEventIncome + retirementIncome + childAllowance;
    const incomeTotal = labor + postFire + pension + other;

    // ---- 支出（住宅費以外はインフレを適用）----
    const living = livingCostForAge(input, age, fireStartAge) * inflationFactor;
    const education = totalEducationCost(input.children, offset) * inflationFactor;
    const housing = annualHousingCost(input.housing, age, startAge); // ローン/維持費は名目
    const lifeEventExpense = sumLifeEventCosts(input, age) * inflationFactor;
    const special =
      (input.expense.annualSpecial.value +
        input.expense.carCost.value +
        input.expense.travelCost.value +
        input.expense.insuranceCost.value) *
        inflationFactor +
      lifeEventExpense;
    const retirementExtra = medicalCareExtra(input, age) * inflationFactor;
    const expenseTotal = living + education + housing + special + retirementExtra;

    const tax = 0; // 簡略化（手取りベース）

    // 完済後維持費（デバッグ内訳用）
    const isOwn = input.housing.type.value !== 'rent';
    const payoffAge =
      input.housing.remainingYears.value > 0
        ? startAge + input.housing.remainingYears.value
        : input.housing.monthlyPayment.value > 0
          ? Infinity
          : startAge;
    const homeMaintenanceCost = isOwn && age >= payoffAge ? housing : 0;

    // 2) 年間収支を現金資産へ
    const cashBeforeNet = cash;
    const net = incomeTotal - expenseTotal - tax;
    cash += net;

    // 2.5) 一度枯渇した後の黒字は、まず累計不足額の返済に充てる（穴を埋めてから資産を再形成）。
    let shortfallRepaid = 0;
    if (cumulativeShortfall > 0 && cash > 0) {
      shortfallRepaid = Math.min(cash, cumulativeShortfall);
      const ratio = shortfallRepaid / cumulativeShortfall;
      cumulativeShortfallPresentValue *= 1 - ratio; // PVも比例して減らす
      cumulativeShortfall -= shortfallRepaid;
      cash -= shortfallRepaid;
    }

    const cashBeforeInvestmentTransfer = cash;

    // 3) 就労終了年齢まで、毎月投資額（満額の意図）を現金→投資へ振替。
    //    サイドFIRE中も就労終了(workUntilAge)までは黒字があれば積立を継続する。
    //    ただし実際に回せるのは「その年の家計の黒字」かつ「手元現金」の範囲まで。
    //    満額に届かない分（黒字不足・赤字）は積み立てられず skipped として記録する。
    //    毎月投資額が未入力のときは、黒字の一定割合を控えめに積み立てる仮定。
    const contributing = age < contributionEndAge;
    let plannedInvestmentAmount = 0;
    let actualInvestmentAmount = 0;
    let skippedInvestmentAmount = 0;
    if (contributing) {
      plannedInvestmentAmount = monthlyInvestKnown
        ? monthlyInvestAnnual
        : Math.max(0, net) * DEFAULT_INVEST_FRACTION;
      actualInvestmentAmount = Math.min(plannedInvestmentAmount, Math.max(0, net), Math.max(0, cash));
      skippedInvestmentAmount = Math.max(0, plannedInvestmentAmount - actualInvestmentAmount);
      cash -= actualInvestmentAmount;
      invest += actualInvestmentAmount;
    }
    const cashAfterInvestmentTransfer = cash;

    // 4) 現金がマイナスなら投資資産から取り崩す。なお足りなければ累計不足額へ。
    //    現金・投資はマイナスにしない（負の複利を防ぐ）。
    let withdrawalFromInvestment = 0;
    let shortfallAdded = 0;
    if (cash < 0) {
      const need = -cash;
      withdrawalFromInvestment = Math.min(Math.max(0, invest), need);
      invest -= withdrawalFromInvestment;
      shortfallAdded = need - withdrawalFromInvestment;
      if (shortfallAdded > 0) {
        cumulativeShortfall += shortfallAdded;
        cumulativeShortfallPresentValue += shortfallAdded * presentValueFactor; // 各年の不足額を現在価値で割り戻して累計
      }
      cash = 0;
    }
    invest = Math.max(0, invest);
    const withdrawalFromCash = net < 0 ? Math.min(-net, Math.max(0, cashBeforeNet)) : 0;

    const endAssets = cash + invest; // 0未満にはならない
    // 貸借一致: 当年末 = 前年末 + 運用益 − 暴落損 + 年間収支 − 不足返済 + 不足追加
    const reconciliationDiff =
      endAssets - (startAssets + investmentReturn - crashLoss + net - shortfallRepaid + shortfallAdded);

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
        displayTotalAssets: endAssets,
        cumulativeShortfall,
        cashAssets: cash,
        investmentAssets: invest,
        investmentBeforeReturn,
        investmentAfterReturn,
        crashLoss,
        homeMaintenanceCost,
        lifeEventIncome,
        lifeEventExpense,
        retirementIncome,
        annualNetCashflow: net,
        plannedInvestmentAmount,
        actualInvestmentAmount,
        skippedInvestmentAmount,
        cashBeforeInvestmentTransfer,
        cashAfterInvestmentTransfer,
        withdrawalFromCash,
        withdrawalFromInvestment,
        presentValueFactor,
        totalAssetsPresentValue: endAssets * presentValueFactor,
        cumulativeShortfallPresentValue,
        annualExpenseTotalPresentValue: expenseTotal * presentValueFactor,
        livingCostPresentValue: living * presentValueFactor,
        beginningCashAssets,
        beginningInvestmentAssets,
        beginningTotalAssets: startAssets,
        oneTimeIncome: retirementIncome + lifeEventIncome,
        oneTimeExpense: lifeEventExpense,
        netCashflowBeforeShortfallRepayment: net,
        shortfallRepaid,
        shortfallAdded,
        reconciliationDiff,
      },
    });
  }

  const indicators = computeIndicators(
    rows,
    input,
    fireStartAge,
    cumulativeShortfall,
    cumulativeShortfallPresentValue,
    monthlyInvestKnown ? monthlyInvestAnnual : 0,
  );
  const score = judge(indicators, input.fire.type.value);
  const suggestions = buildSuggestions(indicators, score);

  return {
    rows,
    indicators,
    score,
    assumptions: collectAssumptions(input),
    flags: collectFlags(input),
    notes: buildNotes(input, cashRatioKnown, monthlyInvestKnown),
    suggestions,
    calculatedAt: Date.now(),
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * 慎重シナリオ用の入力を返す（純粋関数）。
 * 利回りを下げ（下限0%）、インフレ率を上げる。暴落など他の条件はそのまま引き継ぐ。
 * これを runSimulation に渡すと、長期前提を厳しめに見た結果が得られる。
 */
export function cautiousScenarioInput(input: SimulationInput): SimulationInput {
  const next = structuredClone(input);
  const r = input.investment.returnRate.value;
  const inf = input.investment.inflationRate.value;
  next.investment.returnRate = {
    ...next.investment.returnRate,
    value: Math.max(CAUTIOUS_SCENARIO.returnFloor, r + CAUTIOUS_SCENARIO.returnDelta),
  };
  next.investment.inflationRate = {
    ...next.investment.inflationRate,
    value: inf + CAUTIOUS_SCENARIO.inflationDelta,
  };
  return next;
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

  // 現役継続（FIREなし）では注記の「FIRE後」を「退職後」と表現する。
  const isNone = input.fire.type.value === 'none';
  const afterLabel = isNone ? '退職後' : 'FIRE後';

  // 名目利回りとインフレ率から実質利回りの目安を示す。
  const nominal = input.investment.returnRate.value;
  const inflationPct = input.investment.inflationRate.value;
  const realRate = ((1 + nominal / 100) / (1 + inflationPct / 100) - 1) * 100;
  notes.push(
    `名目利回り${nominal}%、支出インフレ${inflationPct}%で試算しています。現在価値ベースの実質利回り目安は約${realRate.toFixed(1)}%です。`,
  );

  const { method } = computeTakeHome(input);
  notes.push(TAKE_HOME_METHOD_NOTE[method]);

  // 収入も現在価値入力としてインフレ補正している旨（収入と支出の前提を揃える）。
  notes.push(
    `${afterLabel}収入・年金・退職金は現在価値で入力し、支出と同じインフレ率で将来額に換算しています（収入だけ名目固定にしません）。`,
  );

  // FIRE後/退職後生活費・老後生活費は日常生活費のみ（住居費・教育費・保険・特別費等は別加算）。
  notes.push(
    `${afterLabel}生活費・老後生活費は日常生活費のみです。住居費・教育費・保険料・年間特別費・旅行費・車関連費は別途加算されます。`,
  );

  // 特別費・旅行費・車関連費は老後まで毎年継続する旨。
  if (
    input.expense.annualSpecial.value > 0 ||
    input.expense.travelCost.value > 0 ||
    input.expense.carCost.value > 0
  ) {
    notes.push('年間特別費・旅行費・車関連費は、老後を含め毎年継続する前提です（老後に減らす場合は値を調整してください）。');
  }

  // 暴落シナリオ（簡易反映）。投資資産に一時的な下落として反映する。
  // タイミングは「取崩開始（FIRE開始 or 退職）の翌年」= シーケンスリスクが最大になる時期に置く。
  if (input.investment.crashScenario.value) {
    const crashAge = getCrashAge(input);
    notes.push(
      `暴落シナリオは、${crashAge}歳ごろ（FIRE開始または退職の翌年）に投資資産を約${Math.round(CRASH_SCENARIO.dropRate * 100)}%下落させる簡易反映です（現金資産は対象外、その後は通常の利回りで回復を試算）。取崩期初期の暴落は資産寿命への影響が最も大きいため（シーケンスリスク）、備えとしてその時期に置いています。過去の参考: コロナショック（2020）約-34% / リーマンショック（2008）約-38%。`,
    );
  }

  // 年金未入力の明示（誤解防止・資産寿命への影響を案内）。
  if (input.retirement.pension.source !== 'user_input') {
    notes.push(
      'この試算では年金が未入力のため、65歳以降の収入を0円として計算しています。年金見込みを入力すると、資産寿命が大きく変わる可能性があります。',
    );
  }

  notes.push(
    cashRatioKnown
      ? `現金比率${input.basic.cashRatio.value}%を反映し、投資資産にのみ利回りを適用しています。`
      : `現金比率は未入力のため${Math.round(DEFAULT_CASH_RATIO * 100)}%を仮定し、投資資産にのみ利回りを適用しています。`,
  );

  const contributionEndAge = contributionEndAgeOf(input);
  notes.push(
    monthlyInvestKnown
      ? `毎月投資額は、就労を終える${contributionEndAge}歳の前年まで、家計の黒字の範囲で現金から投資へ振り替えます（黒字を超える分・赤字の年は積み立てません）。サイドFIRE中も同様に継続します。`
      : `毎月投資額は未入力のため、就労を終える${contributionEndAge}歳の前年まで、年間黒字の一部のみを投資に回す保守的な仮定です。`,
  );

  if (input.housing.type.value !== 'rent') {
    const h = input.housing;
    const hasFull = h.balance.value > 0 && h.remainingYears.value > 0;
    if (hasFull) {
      const method = h.repayMethod.value === 'equal_principal' ? '元金均等' : '元利均等';
      notes.push(
        `住宅費は残高${h.balance.value}万円・金利${h.rate.value}%・${method}方式・残り${h.remainingYears.value}年で年次返済（元金＋利息）を計算しています。完済後は持ち家維持費（年${HOME_MAINTENANCE_ANNUAL}万円）に切り替わります。`,
      );
      if (h.rateType.value === 'variable') {
        notes.push(
          `変動金利は将来の金利上昇リスクを織り込み、入力された${h.rate.value}%に+${VARIABLE_RATE_PREMIUM}%ポイントを上乗せした${(h.rate.value + VARIABLE_RATE_PREMIUM).toFixed(1)}%で全期間試算しています（慎重な仮定）。固定金利を選ぶとこの上振れは適用されません。`,
        );
      } else if (h.fixedEndAge.value > 0) {
        notes.push(
          `固定金利は${h.fixedEndAge.value}歳で終了する想定です。固定終了以降は金利が+${RATE_RISE_AFTER_FIXED}%ポイント上振れる慎重な仮定で試算しています。`,
        );
      } else {
        notes.push(`固定金利は完済まで${h.rate.value}%で計算しています（固定終了年齢の入力なし）。`);
      }
      if (h.bonusAnnual.value > 0) {
        notes.push(`ボーナス払いとして年間${h.bonusAnnual.value}万円を毎年の元金返済に上乗せしています。`);
      }
    } else {
      notes.push(`住宅費は毎月返済額×12（残り${h.remainingYears.value}年）＋完済後の持ち家維持費（年${HOME_MAINTENANCE_ANNUAL}万円）で計算しています。残高・金利を入れると元利均等の精密計算に切り替わります。`);
    }
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

  // 現在価値換算の説明。
  notes.push(
    '将来額はその年に実際に表示される額面、現在価値は「今のお金の感覚」で見た金額です。生活感覚としては現在価値を中心に見てください。',
  );

  // 4%ルール系の達成率は参考指標である旨（現役継続ではスコア項目名に合わせて「老後資金準備率」）。
  notes.push(
    `${isNone ? '老後資金準備率' : 'FIRE準備率'}は4%ルールに基づく簡易的な目安です。教育費・住宅費・年金未入力なども含む年次シミュレーションの資産寿命とあわせてご確認ください。`,
  );

  // 児童手当（R6 改定: 所得制限撤廃・高校生まで対象）を子の年齢に応じて毎年自動加算。
  if (input.children.length > 0) {
    notes.push(
      '児童手当（令和6年改定: 所得制限撤廃・高校生まで対象拡大）を、お子さまの年齢に応じて毎年の収入に自動で加算しています。第3子以降は多子加算（月3万円）を反映します。',
    );
  }

  if (input.meta.mode === 'thorough') notes.push(CAPTURE_NOTE);
  return notes;
}

// ---- 補助関数 --------------------------------------------------------------

/** 毎月投資額の積立を反映する終わりの年齢（就労終了年齢）。 */
function contributionEndAgeOf(input: SimulationInput): number {
  const retirementAge = input.income.retirementAge.value;
  const fireType = input.fire.type.value;
  if (fireType === 'side') return input.fire.workUntilAge.value;
  if (fireType === 'full') return input.fire.targetAge.value;
  return retirementAge;
}

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

  if (input.investment.crashScenario.value === true && age === getCrashAge(input)) {
    out.push({ age, kind: 'market_crash', label: '暴落シナリオ（投資資産の一時下落）' });
  }
  // FIRE開始イベントは FIRE を選んだ場合のみ。FIREなし（通常の退職）では出さない。
  if (input.fire.type.value !== 'none' && age === fireStartAge) {
    out.push({
      age,
      kind: input.fire.type.value === 'side' ? 'side_fire_start' : 'fire_start',
      label: input.fire.type.value === 'side' ? 'サイドFIRE開始' : 'FIRE開始',
    });
  }
  // 現役継続（FIREなし）では、代わりに退職予定年齢に「退職」マーカーを出す。
  // タイムラインに働き方の節目が一切出ないと寂しいため。kind は既存の full_retire を再利用。
  if (input.fire.type.value === 'none' && age === fireStartAge) {
    out.push({ age, kind: 'full_retire', label: '退職' });
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

function computeIndicators(
  rows: YearRow[],
  input: SimulationInput,
  fireStartAge: number,
  cumulativeShortfall: number,
  cumulativeShortfallPresentValue: number,
  monthlyInvestmentPlannedAnnual: number,
): Indicators {
  const atFire = rows.find((r) => r.age === fireStartAge);
  const assetsAtFire = atFire ? atFire.startAssets : 0;

  const depleted = rows.find((r) => r.endAssets <= 0);
  const at95 = rows.find((r) => r.age === SIM.endAge);
  const assetsAt95 = at95 ? at95.endAssets : 0;
  const assetsAt95PresentValue = at95 ? at95.endAssets * (at95.debug?.presentValueFactor ?? 1) : 0;

  // 教育費ピーク年
  let peak = rows[0];
  for (const r of rows) if (r.expense.education > (peak?.expense.education ?? 0)) peak = r;
  const peakNet = peak ? peak.income.total - peak.expense.total : 0;
  const peakPct = peak && peak.startAssets > 0 ? (Math.abs(Math.min(0, peakNet)) / peak.startAssets) * 100 : 0;

  const annualHousing = annualHousingCost(input.housing, input.basic.age.value, input.basic.age.value);
  const takeHome = input.basic.takeHomeIncome.value || 1;

  // 毎月投資額の満額に届かない最初の年齢（黒字不足で積立が削られる年）。
  const underfunded =
    monthlyInvestmentPlannedAnnual > 0
      ? rows.find((r) => (r.debug?.skippedInvestmentAmount ?? 0) > 0.5)
      : undefined;

  // 実際に計算へ反映された積立額（満額を計画した現役期）。
  const plannedRows =
    monthlyInvestmentPlannedAnnual > 0 ? rows.filter((r) => (r.debug?.plannedInvestmentAmount ?? 0) > 0) : [];
  const monthlyInvestmentActualFirstYear = plannedRows[0]?.debug?.actualInvestmentAmount ?? 0;
  const monthlyInvestmentActualAverage =
    plannedRows.length > 0
      ? plannedRows.reduce((s, r) => s + (r.debug?.actualInvestmentAmount ?? 0), 0) / plannedRows.length
      : 0;

  return {
    fireAchievementRate: fireAchievementRate(assetsAtFire, input.fire),
    assetLongevityAge: depleted ? depleted.age : null,
    assetsAt95,
    assetsAt95PresentValue,
    eduPeakResilience: {
      peakAge: peak ? peak.age : input.basic.age.value,
      netCashFlow: peakNet,
      pctOfAssets: peakPct,
    },
    mortgageBurden: annualHousing / takeHome,
    cumulativeShortfall,
    cumulativeShortfallPresentValue,
    monthlyInvestmentPlannedAnnual,
    monthlyInvestmentActualFirstYear,
    monthlyInvestmentActualAverage,
    investmentUnderfundedFromAge: underfunded ? underfunded.age : null,
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
  // 現役継続では「FIRE後生活費」は質問していない。
  // 退職が65歳より前のとき（年金開始までのブリッジ年に postFireLiving を使う）だけ、
  // 「退職後の生活費」というラベルで表示する。65歳以降退職なら行ごと省く。
  if (input.fire.type.value !== 'none') {
    push(input.fire.postFireLiving);
  } else if (input.income.retirementAge.value < SIM.pensionStartAge) {
    push({ ...input.fire.postFireLiving, label: '退職後の生活費' });
  }
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

/** 暴落シナリオ発生年齢を「取崩開始（FIRE開始 or 退職）+ オフセット」で算出する。
 *  シーケンスリスクの織り込みのため取崩期初期に置く。
 *  既に取崩開始済みのユーザー（startAge >= drawdownStart）の場合は、最低でも今から1年後にずらす。 */
export function getCrashAge(input: SimulationInput): number {
  const startAge = input.basic.age.value;
  const drawdownStart =
    input.fire.type.value === 'none' ? input.income.retirementAge.value : input.fire.targetAge.value;
  return Math.max(startAge + 1, drawdownStart + CRASH_SCENARIO.yearsAfterDrawdownStart);
}
