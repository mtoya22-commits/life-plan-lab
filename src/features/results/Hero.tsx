import type { FireType, SimulationInput, SimulationResult } from '../../schema/types';
import { formatMan, formatPct } from '../../lib/format';
import { ja } from '../../strings/ja';
import { weakestFactor } from '../../engine/judgmentEngine';

// 結果の Hero。分析ダッシュボードではなく「静かな要約」を目指す。
// - 帯バッジは <details>。表面はラベル 1 語、開くと判定の根拠（5項目の状況）を表示。
// - 主見出しは資産寿命で統一。その上に「FIRE/現役継続の前提」を 1 行で添えてモード差を吸収。
// - band が realistic 以下のときだけ「動かすと変わりやすい項目」を 1 行で添え、QuickAdjust
//   または カテゴリ編集への内部リンクを置く（課題の送り付け）。
// - FIRE 準備率は脚注（目安）。現役継続（fireType === 'none'）では出さない。
export function Hero({
  result,
  input,
  fireType,
}: {
  result: SimulationResult;
  input: SimulationInput;
  fireType: FireType;
}) {
  const { indicators, score } = result;
  const depleted = indicators.cumulativeShortfall > 0;

  const longevityText = depleted ? `${indicators.assetLongevityAge}歳ごろ` : '95歳以降も維持';
  const supportValue = depleted ? '資産は枯渇済み' : formatMan(indicators.assetsAt95PresentValue);
  const supportSub = depleted
    ? `累計不足額 約${formatMan(indicators.cumulativeShortfallPresentValue)}（現在価値）`
    : `現在価値（将来額 約${formatMan(indicators.assetsAt95)}）`;

  const leadIn = modeLeadIn(fireType, input);
  const weakest = weakestFactor(score);
  const nextStep = weakest ? nextStepFor(weakest.key) : null;

  return (
    <div className="hero">
      <div className="hero__band" data-band={score.band}>
        {ja.band[score.band]}
      </div>

      {leadIn && <p className="hero__lead muted">{leadIn}</p>}

      <div className="hero__primary">
        <span className="hero__primary-label">資産寿命</span>
        <span className="hero__primary-value">{longevityText}</span>
      </div>

      <div className="hero__support">
        <span className="hero__support-label">95歳時点</span>
        <span className="hero__support-value">{supportValue}</span>
        <span className="hero__support-sub">{supportSub}</span>
      </div>

      {weakest && nextStep && (
        <p className="hero__nextstep">
          動かすと変わりやすい項目: <strong>{weakest.label}</strong>
          <a className="hero__nextstep-link" href={nextStep.href}>
            {nextStep.text}
          </a>
        </p>
      )}

      {/* 判定の根拠の展開トグル。バッジ内に隠さず、独立した行として置くことで
          タップ可能であることを明示する。チェブロンは open 時に 180deg 回転。 */}
      <details className="hero__judge">
        <summary className="hero__judge-summary">
          <span className="hero__judge-chevron" aria-hidden="true">▾</span>
          <span className="hero__judge-summary-text">判定の根拠を見る</span>
        </summary>
        <ul className="hero__judge-list">
          {score.byIndicator.map((it) => (
            <li key={String(it.key)} className="hero__judge-item">
              <span className="hero__judge-item-label">{it.label}</span>
              {it.explainer && (
                <span className="hero__judge-item-explainer">{it.explainer}</span>
              )}
              <span className="hero__judge-item-note">{it.note}</span>
            </li>
          ))}
        </ul>
      </details>

      {fireType !== 'none' && (
        <p className="hero__foot muted">
          FIRE準備率（目安）{formatPct(indicators.fireAchievementRate)}（4%ルールベース）
        </p>
      )}
    </div>
  );
}

// fireType ごとに「主見出しの前提」を 1 行で示す。FIRE 系は希望年齢を埋め、none は短く。
function modeLeadIn(fireType: FireType, input: SimulationInput): string | null {
  if (fireType === 'none') return '現役継続の前提で';
  const age = input.fire.targetAge.value;
  if (fireType === 'full') return `${age}歳で完全リタイアする前提で`;
  return `${age}歳から副業中心に切り替える前提で`;
}

// weakest 項目から、Hero 下のリンク先テキストとアンカーを決める。
// QuickAdjust が直接動かせる 3 ノブ（年齢・生活費・利回り）に対応する項目は #quick-adjust へ、
// 教育費・住宅は QuickAdjust 範囲外なので、ResultDashboard の編集導線（EditLinks）へ落とす。
function nextStepFor(key: string | number): { text: string; href: string } {
  switch (key) {
    case 'eduPeakResilience':
      return { text: '教育費を見直す', href: '#edit-links' };
    case 'mortgageBurden':
      return { text: '住宅を見直す', href: '#edit-links' };
    default:
      return { text: '下で試す', href: '#quick-adjust' };
  }
}
