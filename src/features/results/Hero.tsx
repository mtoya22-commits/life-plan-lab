import type { SimulationResult } from '../../schema/types';
import { formatAge, formatMan, formatPct } from '../../lib/format';
import { ja } from '../../strings/ja';

// 結果のHero。資産寿命を主に、金額は現在価値を主役に将来額を補足で見せる。
// 枯渇する場合は「95歳時点 0万円」ではなく「枯渇済み」＋累計不足額を見せる。
export function Hero({ result }: { result: SimulationResult }) {
  const { indicators, score } = result;
  const depleted = indicators.cumulativeShortfall > 0;

  return (
    <div className="hero">
      <div className="hero__band" data-band={score.band}>
        {ja.band[score.band]}
        <span className="hero__score">（{score.total} / 15）</span>
      </div>

      {depleted ? (
        <div className="hero__metrics">
          <Metric label="資産寿命" value={`${indicators.assetLongevityAge}歳ごろ`} />
          <Metric label="95歳時点" value="資産は枯渇済み" />
          <Metric
            label="累計不足額"
            value={formatMan(indicators.cumulativeShortfallPresentValue)}
            sub={`現在価値 ／ 将来額 約${formatMan(indicators.cumulativeShortfall)}`}
          />
        </div>
      ) : (
        <div className="hero__metrics">
          <Metric label="資産寿命" value={formatAge(indicators.assetLongevityAge)} />
          <Metric
            label="95歳時点の残資産"
            value={formatMan(indicators.assetsAt95PresentValue)}
            sub={`現在価値 ／ 将来額 約${formatMan(indicators.assetsAt95)}`}
          />
          <Metric label="FIRE準備率（目安）" value={formatPct(indicators.fireAchievementRate)} />
        </div>
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
