import type { SimulationInput, SimulationResult } from '../../schema/types';

// 資産が不足しやすい要因（見直しが効きやすいポイント）を抽出する。
// 「悪化要因」を煽らず、各ポイントを「原因 / 時期 / どこを変えると効くか」に分解して伝える。
//
// 2 系統のソースを 1 セクションに統合:
// 1. rule-based: シミュ結果の特定条件で発火（既存ロジック、リッチな 3 行構成）
// 2. score-based fallback: 5 判定指標のうち points < 2 で、かつ rule-based で
//    拾えていないトピックだけ補完する（1 行構成、suggestions の本文を流用）
export interface RiskFactor {
  /** 見出し（短く）。 */
  title: string;
  /** 原因・時期・見直しレバーを1行ずつ（rule-based は最大3行、fallback は1行）。 */
  points: string[];
}

// rule-based の title が、判定指標のどの key を「すでにカバーしているか」を逆引きする。
// fallback ロジックでこれに該当する指標は二重表示しない。
const COVERS: Record<string, string> = {
  資産寿命: 'assetLongevityAge',
  教育費ピーク: 'eduPeakResilience',
  住宅ローン: 'mortgageBurden',
  'FIRE後の収支': 'fireAchievementRate',
  老後の収支: 'fireAchievementRate',
};

export function buildRiskFactors(result: SimulationResult, input: SimulationInput): RiskFactor[] {
  const out: RiskFactor[] = [];
  const ind = result.indicators;
  const rows = result.rows;
  const fireStartAge =
    input.fire.type.value === 'none' ? input.income.retirementAge.value : input.fire.targetAge.value;

  if (ind.cumulativeShortfall > 0 && ind.assetLongevityAge !== null) {
    out.push({
      title: '資産寿命',
      points: [
        `今回の条件では、${ind.assetLongevityAge}歳ごろに資産が尽きる見込みです。`,
        '収入より支出が上回る時期が続くことが背景です。',
        '年金・FIRE後収入・支出のどれかを見直すと、見通しが変わります。',
      ],
    });
  }

  if (input.children.length > 0) {
    const peakRow = rows.find((r) => r.age === ind.eduPeakResilience.peakAge);
    if (peakRow && peakRow.expense.education > 0) {
      const kids = input.children.length;
      out.push({
        title: '教育費ピーク',
        points: [
          `${ind.eduPeakResilience.peakAge}歳ごろに教育費の支出が大きくなります。`,
          kids >= 2 ? `お子さま${kids}人の大学などの時期が近いためです。` : '進学の時期に支出が集中するためです。',
          '進学区分や大学時の住まいを変えると、結果が変わります。',
        ],
      });
    }
  }

  // 毎月投資額が家計の黒字を上回り、満額の積立ができていないケースを明示する。
  // 「入力額」と「実際に計算へ反映された積立額」を併記し、資産が伸びにくい理由を納得できるようにする。
  if (input.investment.monthlyInvestment.source === 'user_input' && ind.investmentUnderfundedFromAge !== null) {
    const m = input.investment.monthlyInvestment.value;
    const plannedY = Math.round(ind.monthlyInvestmentPlannedAnnual);
    const firstY = Math.round(ind.monthlyInvestmentActualFirstYear);
    const firstM = Math.round((ind.monthlyInvestmentActualFirstYear / 12) * 10) / 10;
    out.push({
      title: '積立額の反映',
      points: [
        `入力は月${m}万円（年${plannedY}万円）ですが、家計の黒字の範囲で反映しています。`,
        `実際に反映された積立額は、初年度で年${firstY}万円（月約${firstM}万円）です。`,
        `${ind.investmentUnderfundedFromAge}歳ごろから満額は積み立てられていません。生活費・住居費を見直すと積立余力が増えます。`,
      ],
    });
  }

  const payoff = rows.flatMap((r) => r.events).find((e) => e.kind === 'mortgage_payoff');
  if (payoff && payoff.age > fireStartAge) {
    const isFire = input.fire.type.value !== 'none';
    const after = isFire ? 'FIRE後' : '退職後';
    out.push({
      title: '住宅ローン',
      points: [
        `住宅ローンが${after}（${payoff.age}歳ごろ完済）まで残ります。`,
        `${after}は収入が下がりやすい時期に返済が重なります。`,
        '完済年齢・毎月返済額を見直すと、負担の山が変わります。',
      ],
    });
  }

  if (input.fire.type.value === 'side') {
    const sideRow = rows.find((r) => r.age === fireStartAge + 1);
    if (sideRow && sideRow.income.total < sideRow.expense.total) {
      out.push({
        title: 'FIRE後の収支',
        points: [
          'FIRE後は、サイド収入より支出が大きい時期があります。',
          `${fireStartAge}歳ごろからの働き方の変化が背景です。`,
          'FIRE後収入・FIRE後生活費を見直すと、収支のバランスが変わります。',
        ],
      });
    }
  }

  const r66 = rows.find((r) => r.age === 66);
  if (r66 && r66.income.total < r66.expense.total) {
    out.push({
      title: '老後の収支',
      points: [
        '65歳以降は、年金などの収入より支出が大きくなりやすいです。',
        '年金収入と老後の生活費のバランスが背景です。',
        '年金見込み・老後生活費を見直すと、見通しが変わります。',
      ],
    });
  }

  const discretionary =
    input.expense.annualSpecial.value + input.expense.travelCost.value + input.expense.carCost.value;
  if (discretionary > 0 && ind.cumulativeShortfall > 0) {
    out.push({
      title: '毎年の裁量支出',
      points: [
        '特別費・旅行費・車関連費が老後まで毎年続く前提です。',
        '現役期と同じ水準が老後も続くと見積もっています。',
        '老後に少し抑えると、見通しが改善します。',
      ],
    });
  }

  if (input.retirement.pension.source !== 'user_input') {
    out.push({
      title: '年金が未入力',
      points: [
        '年金が未入力のため、65歳以降の収入を0円として計算しています。',
        '老後の見通しに大きく影響する項目です。',
        '年金見込みを入力すると、65歳以降の見通しが大きく変わります。',
      ],
    });
  }

  // score-based fallback: weak 指標で rule-based に拾えていないものを補完。
  // suggestions の本文をそのまま 1 行 bullet として表示する。
  const covered = new Set<string>();
  for (const item of out) {
    const k = COVERS[item.title];
    if (k) covered.add(k);
  }
  for (const it of result.score.byIndicator) {
    if (it.points >= 2) continue;
    if (covered.has(String(it.key))) continue;
    const s = result.suggestions.find((x) => x.relatedIndicator === String(it.key));
    if (!s) continue;
    out.push({ title: it.label, points: [s.body] });
  }

  return out.slice(0, 6);
}
