import type { Indicators, Score, ScoreBand, ScoreItem, Suggestion } from '../schema/types';

// =============================================================================
// 判定エンジン（純粋関数）
// 単一指標では判定しない。5指標 × 各3点 = 15点満点で総合判定する。
// しきい値は引き継ぎ資料の初期案。確定値はプロダクトオーナーと擦り合わせる。
// =============================================================================

function scoreFireRate(rate: number): ScoreItem {
  let points = 0;
  let note = '50%未満：厳しめ';
  if (rate >= 100) ((points = 3), (note = '100%以上：達成圏'));
  else if (rate >= 80) ((points = 2), (note = '80〜99%：あと少し'));
  else if (rate >= 50) ((points = 1), (note = '50〜79%：要調整'));
  return { key: 'fireAchievementRate', label: 'FIRE達成率', points, note };
}

function scoreLongevity(age: number | null): ScoreItem {
  let points = 0;
  let note = '74歳以前に枯渇：かなり厳しい';
  if (age === null || age >= 95) ((points = 3), (note = '95歳以上まで資産あり：安定'));
  else if (age >= 85) ((points = 2), (note = '85〜94歳で枯渇：やや注意'));
  else if (age >= 75) ((points = 1), (note = '75〜84歳で枯渇：要改善'));
  return { key: 'assetLongevityAge', label: '資産寿命', points, note };
}

function scoreAssetsAt95(assets: number): ScoreItem {
  let points = 0;
  let note = '0円未満：要改善';
  if (assets >= 3000) ((points = 3), (note = '3000万円以上：かなり余裕'));
  else if (assets >= 1000) ((points = 2), (note = '1000〜3000万円：安定'));
  else if (assets >= 0) ((points = 1), (note = '0〜1000万円：やや注意'));
  return { key: 'assetsAt95', label: '95歳時点残資産', points, note };
}

function scoreEduPeak(pctOfAssets: number, netCashFlow: number): ScoreItem {
  // 黒字 or 赤字が資産の何%か で判定
  let points = 0;
  let note = '赤字が資産の10%以上：要改善';
  if (netCashFlow >= 0) ((points = 3), (note = '黒字：問題少なめ'));
  else if (pctOfAssets <= 5) ((points = 2), (note = '赤字だが資産の5%以内：許容範囲'));
  else if (pctOfAssets <= 10) ((points = 1), (note = '赤字が資産の5〜10%：注意'));
  return { key: 'eduPeakResilience', label: '教育費ピーク耐性', points, note };
}

function scoreMortgageBurden(burden: number): ScoreItem {
  // burden = 年間住宅返済 / 手取り（割合）
  let points = 0;
  let note = '40%以上：かなり重い';
  if (burden < 0.2) ((points = 3), (note = '20%未満：軽め'));
  else if (burden < 0.3) ((points = 2), (note = '20〜30%：標準'));
  else if (burden < 0.4) ((points = 1), (note = '30〜40%：重め'));
  return { key: 'mortgageBurden', label: 'ローン負担', points, note };
}

function bandForTotal(total: number): ScoreBand {
  if (total >= 12) return 'stable';
  if (total >= 8) return 'realistic';
  if (total >= 4) return 'needs_adjust';
  return 'tough';
}

export function judge(indicators: Indicators): Score {
  const byIndicator: ScoreItem[] = [
    scoreFireRate(indicators.fireAchievementRate),
    scoreLongevity(indicators.assetLongevityAge),
    scoreAssetsAt95(indicators.assetsAt95),
    scoreEduPeak(indicators.eduPeakResilience.pctOfAssets, indicators.eduPeakResilience.netCashFlow),
    scoreMortgageBurden(indicators.mortgageBurden),
  ];
  const total = byIndicator.reduce((s, i) => s + i.points, 0);
  return { byIndicator, total, band: bandForTotal(total) };
}

/**
 * 弱い指標に応じた改善提案を返す。
 * TODO(実装): 引き継ぎ資料30章の提案文を各指標ごとに拡充する。
 */
export function buildSuggestions(indicators: Indicators, score: Score): Suggestion[] {
  const out: Suggestion[] = [];
  for (const item of score.byIndicator) {
    if (item.points >= 2) continue;
    out.push({
      relatedIndicator: String(item.key),
      title: `${item.label}の改善余地`,
      body: '条件を調整すると改善する可能性があります。', // TODO: 指標別の具体提案へ
    });
  }
  return out;
}
