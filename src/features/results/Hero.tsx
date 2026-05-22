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
        <Metric label="資産寿命" value={formatAge(indicators.assetLongevityAge)} />
        <Metric label="95歳時点の残資産" value={formatMan(indicators.assetsAt95)} />
        <Metric label="FIRE準備率（目安）" value={formatPct(indicators.fireAchievementRate)} />
      </div>
      {indicators.cumulativeShortfall > 0 && (
        <p className="hero__shortfall muted">
          {indicators.assetLongevityAge}歳ごろに資産が尽きる見込み・95歳時点の累計不足額：約
          {formatMan(indicators.cumulativeShortfall)}
        </p>
      )}
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
