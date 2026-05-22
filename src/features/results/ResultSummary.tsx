import type { SimulationInput, SimulationResult } from '../../schema/types';
import { ja } from '../../strings/ja';
import { buildLifeEvents } from './lifeEvents';

// 結果画面の最初に出す「今回のポイント」要約カード。
// 人生イベントの単一ソース(buildLifeEvents)から、煽らず最大3つに要約する。
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

function buildHighlights(result: SimulationResult, input: SimulationInput): string[] {
  const events = buildLifeEvents(result, input);
  const out: string[] = [];

  const fire = events.find((e) => e.type === 'fire' && e.major);
  if (fire) {
    const isSide = fire.title.includes('サイド');
    out.push(`${fire.age}歳前後で${isSide ? 'サイドFIRE' : 'FIRE'}を始める想定です。`);
  }

  const edu = events.find((e) => e.type === 'education');
  if (edu) out.push(`教育費が大きくなるのは${edu.age}歳ごろです。`);

  const depletion = events.find((e) => e.type === 'depletion');
  const payoff = events.find((e) => e.type === 'mortgage');
  const fireStartAge = input.fire.type.value === 'none' ? input.income.retirementAge.value : input.fire.targetAge.value;

  if (payoff && payoff.age > fireStartAge) {
    out.push('住宅ローンはFIRE後も残る見込みです。ゆとりをみておくと良さそうです。');
  } else if (depletion) {
    out.push(`資産は${depletion.age}歳ごろから注意が必要です。条件調整で改善できる可能性があります。`);
  } else {
    out.push('今回の条件では、95歳ごろまで資産が持つ見込みです。');
  }

  // 年金・退職金が未反映なら、現実に近づけるための入力を促す（断定しない）。
  const pensionUnset = input.retirement.pension.source !== 'user_input';
  const lumpUnset = input.income.retirementLumpSum.source !== 'user_input';
  if ((pensionUnset || lumpUnset) && out.length < 3) {
    out.push('年金や退職金を入力すると、老後の見通しがより現実に近づきます。');
  }

  return out.slice(0, 3);
}
