import type { SimulationResult } from '../../schema/types';
import { formatMan, formatPct } from '../../lib/format';
import { ja } from '../../strings/ja';

// 結果のHero。分析ダッシュボードではなく「静かな要約」を目指す。
// 主役は資産寿命の一言。95歳時点は支え、FIRE準備率は脚注（目安）に下げる。
// 教育費ピーク・ローン完済・FIRE後の状態は直下の Outlook カードが担う。
export function Hero({ result }: { result: SimulationResult }) {
  const { indicators, score } = result;
  const depleted = indicators.cumulativeShortfall > 0;

  const longevityText = depleted ? `${indicators.assetLongevityAge}歳ごろ` : '95歳以降も維持';
  const supportText = depleted
    ? `95歳時点：資産は枯渇済み・累計不足額 約${formatMan(indicators.cumulativeShortfallPresentValue)}（現在価値）`
    : `95歳時点：現在価値 約${formatMan(indicators.assetsAt95PresentValue)}（将来額 約${formatMan(indicators.assetsAt95)}）`;

  return (
    <div className="hero">
      <div className="hero__band" data-band={score.band}>
        {ja.band[score.band]}
        <span className="hero__score">（{score.total} / 15）</span>
      </div>

      <div className="hero__primary">
        <span className="hero__primary-label">資産寿命</span>
        <span className="hero__primary-value">{longevityText}</span>
      </div>

      <p className="hero__support muted">{supportText}</p>
      <p className="hero__foot muted">FIRE準備率（目安）{formatPct(indicators.fireAchievementRate)}</p>
    </div>
  );
}
