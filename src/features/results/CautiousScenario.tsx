import { useMemo } from 'react';
import type { Indicators, SimulationInput, SimulationResult } from '../../schema/types';
import { cautiousScenarioInput, runSimulation } from '../../engine/annualSimulationEngine';
import { formatMan } from '../../lib/format';
import { ja } from '../../strings/ja';

// 慎重シナリオ（長期前提を厳しめに見る）。標準結果は変えず、折りたたみ内に標準と並べて併記する。
// 暴落（一時下落）とは別物：こちらは利回り低下・インフレ上振れの長期前提。
// スマホ優先で縦並びカード。枯渇時は「0万円」主表示にせず、資産寿命＋累計不足額(現在価値)で示す。
function longevityText(ind: Indicators): string {
  return ind.cumulativeShortfall > 0 ? `${ind.assetLongevityAge}歳ごろ枯渇` : '95歳以降も維持';
}
function assetText(ind: Indicators): string {
  return ind.cumulativeShortfall > 0
    ? `累計不足額 約${formatMan(ind.cumulativeShortfallPresentValue)}（現在価値）`
    : `現在価値 約${formatMan(ind.assetsAt95PresentValue)}`;
}

function ScenarioCard({
  label,
  rate,
  inflation,
  ind,
  cautious,
}: {
  label: string;
  rate: number;
  inflation: number;
  ind: Indicators;
  cautious?: boolean;
}) {
  return (
    <div className={`scenario-card${cautious ? ' scenario-card--cautious' : ''}`}>
      <div className="scenario-card__label">{label}</div>
      <div className="scenario-card__premise muted">
        利回り{rate}％／インフレ{inflation}％
      </div>
      <dl className="scenario-card__metrics">
        <div>
          <dt>資産寿命</dt>
          <dd>{longevityText(ind)}</dd>
        </div>
        <div>
          <dt>95歳時点</dt>
          <dd>{assetText(ind)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function CautiousScenario({ input, result }: { input: SimulationInput; result: SimulationResult }) {
  const cIn = useMemo(() => cautiousScenarioInput(input), [input]);
  const cautious = useMemo(() => runSimulation(cIn), [cIn]);

  return (
    <details className="collapsible cautious collapsible--muted">
      <summary>{ja.result.cautiousToggle}</summary>
      <div className="collapsible__body">
        <p className="muted cautious__lead">{ja.result.cautiousLead}</p>
        <div className="scenario-compare">
          <ScenarioCard
            label="標準条件"
            rate={input.investment.returnRate.value}
            inflation={input.investment.inflationRate.value}
            ind={result.indicators}
          />
          <ScenarioCard
            label="慎重条件"
            rate={cIn.investment.returnRate.value}
            inflation={cIn.investment.inflationRate.value}
            ind={cautious.indicators}
            cautious
          />
        </div>
        <p className="muted cautious__note">{ja.result.cautiousNote}</p>
      </div>
    </details>
  );
}
