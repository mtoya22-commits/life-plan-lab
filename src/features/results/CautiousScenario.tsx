import { useMemo } from 'react';
import type { SimulationInput } from '../../schema/types';
import { cautiousScenarioInput, runSimulation } from '../../engine/annualSimulationEngine';
import { formatMan } from '../../lib/format';
import { ja } from '../../strings/ja';

// 慎重シナリオ（長期前提を厳しめに見る）。標準結果は変えず、折りたたみ内に併記する。
// 暴落（一時下落）とは別物：こちらは利回り低下・インフレ上振れの長期前提。
export function CautiousScenario({ input }: { input: SimulationInput }) {
  const cautious = useMemo(() => runSimulation(cautiousScenarioInput(input)), [input]);

  const stdReturn = input.investment.returnRate.value;
  const stdInflation = input.investment.inflationRate.value;
  const cIn = useMemo(() => cautiousScenarioInput(input), [input]);
  const cReturn = cIn.investment.returnRate.value;
  const cInflation = cIn.investment.inflationRate.value;

  const ind = cautious.indicators;
  const depleted = ind.cumulativeShortfall > 0;
  const resultText = depleted
    ? `${ind.assetLongevityAge}歳ごろ枯渇（累計不足額 約${formatMan(ind.cumulativeShortfallPresentValue)}・現在価値）`
    : `95歳時点 ${formatMan(ind.assetsAt95PresentValue)}（現在価値）`;

  return (
    <details className="collapsible cautious">
      <summary>{ja.result.cautiousToggle}</summary>
      <div className="collapsible__body">
        <p className="muted cautious__lead">{ja.result.cautiousLead}</p>
        <dl className="cautious__premise">
          <div className="cautious__row">
            <dt>標準条件</dt>
            <dd>
              利回り{stdReturn}％／インフレ{stdInflation}％
            </dd>
          </div>
          <div className="cautious__row">
            <dt>慎重条件</dt>
            <dd>
              利回り{cReturn}％／インフレ{cInflation}％
            </dd>
          </div>
        </dl>
        <div className="cautious__result">
          <span className="cautious__result-label">慎重条件での見通し</span>
          <span className="cautious__result-value">{resultText}</span>
        </div>
        <p className="muted cautious__note">{ja.result.cautiousNote}</p>
      </div>
    </details>
  );
}
