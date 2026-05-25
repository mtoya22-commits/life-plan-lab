import type { Indicators, Score, ScoreBand, ScoreItem, Suggestion } from '../schema/types';
import { JUDGE } from './constants';

// =============================================================================
// 判定エンジン（純粋関数）
// 単一指標では判定しない。5指標 × 各3点 = 15点満点で総合判定する。
// しきい値は constants.ts の JUDGE に集約（後で調整可能）。
// =============================================================================

function scoreFireRate(rate: number): ScoreItem {
  const t = JUDGE.fireRate;
  let points = 0;
  let note = '50%未満：厳しめ';
  if (rate >= t.full) ((points = 3), (note = '100%以上：達成圏'));
  else if (rate >= t.close) ((points = 2), (note = '80〜99%：あと少し'));
  else if (rate >= t.adjust) ((points = 1), (note = '50〜79%：要調整'));
  return { key: 'fireAchievementRate', label: 'FIRE達成率', points, note };
}

function scoreLongevity(age: number | null): ScoreItem {
  const t = JUDGE.longevityAge;
  let points = 0;
  let note = '74歳以前に枯渇：かなり厳しい';
  if (age === null || age >= t.stable) ((points = 3), (note = '95歳以上まで資産あり：安定'));
  else if (age >= t.caution) ((points = 2), (note = '85〜94歳で枯渇：やや注意'));
  else if (age >= t.improve) ((points = 1), (note = '75〜84歳で枯渇：要改善'));
  return { key: 'assetLongevityAge', label: '資産寿命', points, note };
}

function scoreAssetsAt95(assets: number): ScoreItem {
  const t = JUDGE.assetsAt95;
  let points = 0;
  let note = '0円未満：要改善';
  if (assets >= t.ample) ((points = 3), (note = '3000万円以上：かなり安定寄り'));
  else if (assets >= t.stable) ((points = 2), (note = '1000〜3000万円：安定'));
  else if (assets >= t.caution) ((points = 1), (note = '0〜1000万円：やや注意'));
  return { key: 'assetsAt95', label: '95歳時点残資産', points, note };
}

function scoreEduPeak(pctOfAssets: number, netCashFlow: number): ScoreItem {
  const t = JUDGE.eduPeakPct;
  let points = 0;
  let note = '赤字が資産の10%以上：要改善';
  if (netCashFlow >= 0) ((points = 3), (note = '黒字：問題少なめ'));
  else if (pctOfAssets <= t.allow) ((points = 2), (note = '赤字だが資産の5%以内：許容範囲'));
  else if (pctOfAssets <= t.caution) ((points = 1), (note = '赤字が資産の5〜10%：注意'));
  return { key: 'eduPeakResilience', label: '教育費ピーク耐性', points, note };
}

function scoreMortgageBurden(burden: number): ScoreItem {
  const t = JUDGE.mortgageBurden;
  let points = 0;
  let note = '40%以上：かなり重い';
  if (burden < t.light) ((points = 3), (note = '20%未満：軽め'));
  else if (burden < t.standard) ((points = 2), (note = '20〜30%：標準'));
  else if (burden < t.heavy) ((points = 1), (note = '30〜40%：重め'));
  return { key: 'mortgageBurden', label: 'ローン負担', points, note };
}

function bandForTotal(total: number): ScoreBand {
  const b = JUDGE.bands;
  if (total >= b.stable) return 'stable';
  if (total >= b.realistic) return 'realistic';
  if (total >= b.needsAdjust) return 'needs_adjust';
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
  return { byIndicator, total, band: capBandByLongevity(bandForTotal(total), indicators.assetLongevityAge) };
}

const BAND_ORDER: ScoreBand[] = ['tough', 'needs_adjust', 'realistic', 'stable'];

/**
 * 資産寿命が短い場合は、FIRE準備率（4%ルール）が高くても総合判定を「安定」と断定しない。
 * 年次シミュレーションの資産寿命を優先する。
 */
function capBandByLongevity(band: ScoreBand, longevityAge: number | null): ScoreBand {
  if (longevityAge === null) return band; // 95歳まで枯渇しない
  let cap: ScoreBand;
  if (longevityAge < 75) cap = 'tough';
  else if (longevityAge < 90) cap = 'needs_adjust';
  else cap = 'realistic'; // 95歳前に枯渇するなら最良でも「おおむね現実的」止まり
  return BAND_ORDER[Math.min(BAND_ORDER.indexOf(band), BAND_ORDER.indexOf(cap))];
}

/**
 * 弱い指標に応じた改善提案を返す。
 * TODO(実装): 引き継ぎ資料30章の提案文を各指標ごとに拡充する。
 */
export function buildSuggestions(_indicators: Indicators, score: Score): Suggestion[] {
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
