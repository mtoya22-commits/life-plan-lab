import type { SimulationInput, SimulationResult } from '../../schema/types';
import { ja } from '../../strings/ja';

// 結果画面の最初に出す「今回のポイント」要約カード。
// 煽らず、整理するトーンで最大3つ。将来は本格的な要約ロジックに差し替えやすい構造。
export function ResultSummary({ result, input }: { result: SimulationResult; input: SimulationInput }) {
  const points = buildHighlights(result, input);
  if (points.length === 0) return null;

  return (
    <div className="summary">
      <div className="summary__title">{ja.result.summaryHeading}</div>
      <ol className="summary__list">
        {points.map((p, i) => (
          <li className="summary__item" key={i}>
            {p}
          </li>
        ))}
      </ol>
    </div>
  );
}

// 簡易版の要約生成。TODO(将来): 指標の重み付けで「まず見るべき3つ」を精緻化する。
function buildHighlights(result: SimulationResult, input: SimulationInput): string[] {
  const out: string[] = [];

  const fireEvent = result.rows
    .flatMap((r) => r.events)
    .find((e) => e.kind === 'fire_start' || e.kind === 'side_fire_start');
  if (fireEvent) {
    const isSide = fireEvent.kind === 'side_fire_start';
    out.push(`${fireEvent.age}歳前後で${isSide ? 'サイドFIRE' : 'FIRE'}を始める想定です。`);
  }

  if (input.children.length > 0) {
    out.push(`教育費が大きくなるのは${result.indicators.eduPeakResilience.peakAge}歳ごろです。`);
  }

  const fireStartAge = input.fire.type.value === 'none' ? input.income.retirementAge.value : input.fire.targetAge.value;
  const payoff = result.rows.flatMap((r) => r.events).find((e) => e.kind === 'mortgage_payoff');
  const longevity = result.indicators.assetLongevityAge;

  if (payoff && payoff.age > fireStartAge) {
    out.push('住宅ローンはFIRE後も残る見込みです。余裕をみておくと安心です。');
  } else if (longevity !== null && longevity < 95) {
    out.push(`資産は${longevity}歳ごろから注意が必要です。条件調整で改善できる可能性があります。`);
  } else {
    out.push('今回の条件では、95歳まで資産を維持できる見込みです。');
  }

  return out.slice(0, 3);
}
