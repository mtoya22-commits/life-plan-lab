import type { SimulationResult } from '../../schema/types';
import { formatAge, formatMan, formatPct } from '../../lib/format';
import { ja } from '../../strings/ja';

// 結果のHero。資産寿命・95歳残資産を主に、FIRE準備率は目安として併記。
// 金額は現在価値を主役、将来額（名目）を補足で見せる。
export function Hero({ result }: { result: SimulationResult }) {
  const { indicators, score } = result;
  const depleted = indicators.cumulativeShortfall > 0;
  return (
    <div className="hero">
      <div className="hero__band" data-band={score.band}>
        {ja.band[score.band]}
        <span className="hero__score">（{score.total} / 15）</span>
      </div>
      <div className="hero__metrics">
        <Metric label="資産寿命" value={formatAge(indicators.assetLongevityAge)} />
        <Metric
          label="95歳時点の残資産"
          value={formatMan(indicators.assetsAt95PresentValue)}
          sub={depleted ? '現在価値' : `将来額 ${formatMan(indicators.assetsAt95)}`}
        />
        <Metric label="FIRE準備率（目安）" value={formatPct(indicators.fireAchievementRate)} />
      </div>
      {depleted && (
        <p className="hero__shortfall muted">
          {indicators.assetLongevityAge}歳ごろに資産が尽きる見込み・累計不足額：約
          {formatMan(indicators.cumulativeShortfallPresentValue)}（現在価値）／将来額 約
          {formatMan(indicators.cumulativeShortfall)}
        </p>
      )}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="metric">
      <div className="metric__label">{label}</div>
      <div className="metric__value">{value}</div>
      {sub && <div className="metric__sub muted">{sub}</div>}
    </div>
  );
}
