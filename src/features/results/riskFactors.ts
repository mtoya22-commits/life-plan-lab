import type { SimulationInput, SimulationResult } from '../../schema/types';

// 資産が不足しやすい要因（見直しが効きやすいポイント）を最大5つ抽出する。
// 「悪化要因」を煽らず、「何を見直すと効くか」をユーザーに伝えるための一覧。
export function buildRiskFactors(result: SimulationResult, input: SimulationInput): string[] {
  const out: string[] = [];
  const ind = result.indicators;
  const rows = result.rows;
  const fireStartAge =
    input.fire.type.value === 'none' ? input.income.retirementAge.value : input.fire.targetAge.value;

  if (ind.cumulativeShortfall > 0 && ind.assetLongevityAge !== null) {
    out.push(`資産が${ind.assetLongevityAge}歳ごろに尽きる見込みです。`);
  }

  if (input.children.length > 0) {
    const peakRow = rows.find((r) => r.age === ind.eduPeakResilience.peakAge);
    if (peakRow && peakRow.expense.education > 0) {
      out.push(`教育費のピーク（${ind.eduPeakResilience.peakAge}歳ごろ）に支出が大きくなります。`);
    }
  }

  // 毎月投資額が家計の黒字を上回り、満額の積立ができていないケースを明示する。
  // 「入力額」と「実際に計算へ反映された積立額」を併記し、資産が伸びにくい理由を納得できるようにする。
  if (input.investment.monthlyInvestment.source === 'user_input' && ind.investmentUnderfundedFromAge !== null) {
    const m = input.investment.monthlyInvestment.value;
    const plannedY = Math.round(ind.monthlyInvestmentPlannedAnnual);
    const firstY = Math.round(ind.monthlyInvestmentActualFirstYear);
    const firstM = Math.round((ind.monthlyInvestmentActualFirstYear / 12) * 10) / 10;
    const avgY = Math.round(ind.monthlyInvestmentActualAverage);
    out.push(
      `毎月投資額は入力上 月${m}万円（年${plannedY}万円）ですが、家計の黒字の範囲で計算するため、` +
        `実際に反映された積立額は初年度で年${firstY}万円（月約${firstM}万円）、現役期の平均で年${avgY}万円ほどです。` +
        `${ind.investmentUnderfundedFromAge}歳ごろから満額は積み立てられていません（生活費・住居費を見直すと積立余力が増えます）。`,
    );
  }

  const payoff = rows.flatMap((r) => r.events).find((e) => e.kind === 'mortgage_payoff');
  if (payoff && payoff.age > fireStartAge) {
    out.push(`住宅ローンがFIRE後（${payoff.age}歳ごろ完済）まで残ります。`);
  }

  if (input.fire.type.value === 'side') {
    const sideRow = rows.find((r) => r.age === fireStartAge + 1);
    if (sideRow && sideRow.income.total < sideRow.expense.total) {
      out.push('FIRE後は、サイド収入より支出が大きい時期があります。');
    }
  }

  const r66 = rows.find((r) => r.age === 66);
  if (r66 && r66.income.total < r66.expense.total) {
    out.push('65歳以降は、年金などの収入より支出が大きくなりやすいです。');
  }

  const discretionary =
    input.expense.annualSpecial.value + input.expense.travelCost.value + input.expense.carCost.value;
  if (discretionary > 0 && ind.cumulativeShortfall > 0) {
    out.push('特別費・旅行費・車関連費が老後まで毎年続く前提です（老後に減らすと改善します）。');
  }

  if (input.retirement.pension.source !== 'user_input') {
    out.push('年金が未入力です。入力すると65歳以降の見通しが大きく変わります。');
  }

  return out.slice(0, 5);
}
