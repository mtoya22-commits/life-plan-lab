import { useInputStore } from '../../store/inputStore';
import { ja } from '../../strings/ja';
import { Hero } from './Hero';
import { AssetChart } from './AssetChart';
import { Timeline } from './Timeline';
import { AssumptionSummary } from './AssumptionSummary';
import { Suggestions } from './Suggestions';

// 結果ダッシュボード。Hero → 資産推移 → タイムライン → 試算条件 → 改善提案。
export function ResultDashboard() {
  const result = useInputStore((s) => s.result);
  const reset = useInputStore((s) => s.reset);

  if (!result) return null;

  return (
    <section className="screen result">
      <h2 className="section-heading">{ja.result.heading}</h2>

      <Hero result={result} />
      <AssetChart rows={result.rows} />
      <Timeline rows={result.rows} />
      <AssumptionSummary assumptions={result.assumptions} flags={result.flags} />
      <Suggestions suggestions={result.suggestions} />

      <p className="muted disclaimer">{ja.result.disclaimer}</p>

      <div className="step-actions">
        <button className="btn btn--primary" onClick={reset}>
          {ja.common.redo}
        </button>
      </div>
    </section>
  );
}
