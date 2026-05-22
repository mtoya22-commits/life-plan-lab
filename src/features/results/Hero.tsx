import type { SimulationResult } from '../../schema/types';
import { formatAge, formatMan, formatPct } from '../../lib/format';
import { ja } from '../../strings/ja';

// 結果のHero。FIRE達成度・総合判定を最初に大きく見せる。
export function Hero({ result }: { result: SimulationResult }) {
  const { indicators, score } = result;
  return (
    <div className="hero">
      <div className="hero__band" data-band={score.band}>
        {ja.band[score.band]}
        <span className="hero__score">（{score.total} / 15）</span>
      </div>
      <div className="hero__metrics">
        <Metric label="FIRE達成率" value={formatPct(indicators.fireAchievementRate)} />
        <Metric label="資産寿命" value={formatAge(indicators.assetLongevityAge)} />
        <Metric label="95歳時点の残資産" value={formatMan(indicators.assetsAt95)} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metric__label">{label}</div>
      <div className="metric__value">{value}</div>
    </div>
  );
}
