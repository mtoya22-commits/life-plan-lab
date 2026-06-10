import type { FireType, SimulationResult } from '../../schema/types';
import { formatMan, formatPct } from '../../lib/format';
import { ja } from '../../strings/ja';

// 結果のHero。分析ダッシュボードではなく「静かな要約」を目指す。
// 主役は資産寿命の一言。95歳時点は「ラベル小／金額大／注記極小muted」の3段で見せる。
// FIRE準備率は脚注（目安）。教育費ピーク・ローン完済・FIRE後の状態は直下の Outlook が担う。
// 現役継続（fireType === 'none'）では FIRE 準備率の脚注を出さない（FIRE を目指していないため）。
export function Hero({ result, fireType }: { result: SimulationResult; fireType: FireType }) {
  const { indicators, score } = result;
  const depleted = indicators.cumulativeShortfall > 0;

  const longevityText = depleted ? `${indicators.assetLongevityAge}歳ごろ` : '95歳以降も維持';
  // 3段表示用の主値・補足
  const supportValue = depleted
    ? '資産は枯渇済み'
    : formatMan(indicators.assetsAt95PresentValue);
  const supportSub = depleted
    ? `累計不足額 約${formatMan(indicators.cumulativeShortfallPresentValue)}（現在価値）`
    : `現在価値（将来額 約${formatMan(indicators.assetsAt95)}）`;

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

      <div className="hero__support">
        <span className="hero__support-label">95歳時点</span>
        <span className="hero__support-value">{supportValue}</span>
        <span className="hero__support-sub">{supportSub}</span>
      </div>

      {fireType !== 'none' && (
        <p className="hero__foot muted">FIRE準備率（目安）{formatPct(indicators.fireAchievementRate)}</p>
      )}
    </div>
  );
}
