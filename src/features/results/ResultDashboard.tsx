import { lazy, Suspense, useState } from 'react';
import { useInputStore } from '../../store/inputStore';
import { ja } from '../../strings/ja';
import { formatMan } from '../../lib/format';
import type { SimulationInput, StepId, ThoroughStepId } from '../../schema/types';
import { BottomSheet } from '../../components/BottomSheet';
import { Hero } from './Hero';
import { ResultSummary } from './ResultSummary';
import { DetailCard } from './DetailCard';
import { TimelineSummary, TimelineFull } from './Timeline';

// Recharts は重いため、入力フローには含めず結果画面到達時に遅延読み込みする。
const AssetChartMini = lazy(() => import('./AssetChart').then((m) => ({ default: m.AssetChartMini })));
const AssetChartFull = lazy(() => import('./AssetChart').then((m) => ({ default: m.AssetChartFull })));
import { buildLifeEvents, summaryEvents } from './lifeEvents';
import { EducationDetail } from './EducationDetail';
import { MortgageDetail } from './MortgageDetail';
import { AssumptionSummary } from './AssumptionSummary';
import { Suggestions } from './Suggestions';

type SheetId = 'timeline' | 'chart' | 'education' | 'mortgage' | null;

// 結果ダッシュボード。
// 常時表示: 総合結果(Hero) / 今回のポイント / 主な節目の要約 / 条件変更導線（結論は隠さない）。
// 詳細(グラフ拡大・年次収支・教育費・住宅ローン・タイムライン全件・試算条件)は
// Bottom Sheet または折りたたみに逃がし、スクロール量を抑える。
export function ResultDashboard() {
  const result = useInputStore((s) => s.result);
  const input = useInputStore((s) => s.input);
  const reset = useInputStore((s) => s.reset);
  const [sheet, setSheet] = useState<SheetId>(null);

  if (!result || !input) return null;

  // タイムラインとグラフのマーカーは同じイベントデータを参照する。
  const events = buildLifeEvents(result, input);
  const timelineItems = summaryEvents(events);
  const hasChildren = input.children.length > 0;
  const peakAge = result.indicators.eduPeakResilience.peakAge;
  const mortgage = mortgageCard(input);
  const depleted = result.indicators.cumulativeShortfall > 0;
  const assetCardValue = depleted
    ? `${result.indicators.assetLongevityAge}歳ごろ枯渇`
    : `95歳時点 ${formatMan(result.indicators.assetsAt95PresentValue)}（現在価値）`;
  const assetCardCaption = depleted
    ? `95歳時点は資産枯渇済み・累計不足額 約${formatMan(result.indicators.cumulativeShortfallPresentValue)}（現在価値）`
    : 'グラフは現在価値。タップで将来額と比較できます。';

  return (
    <section className="screen result">
      <h2 className="section-heading">{ja.result.heading}</h2>

      {/* 結論（常時表示） */}
      <Hero result={result} />
      <ResultSummary result={result} input={input} />

      {/* 主な節目の要約（常時表示） */}
      <div className="timeline">
        <div className="timeline__title">{ja.result.timelineSummaryHeading}</div>
        <TimelineSummary items={timelineItems} />
        <button className="link-btn" onClick={() => setSheet('timeline')}>
          {ja.result.timelineMore} ›
        </button>
      </div>

      {/* コンパクトな詳細カード（詳細はシートへ） */}
      <DetailCard
        title={ja.result.assetCardTitle}
        value={assetCardValue}
        caption={assetCardCaption}
        onOpen={() => setSheet('chart')}
        openLabel={ja.result.assetExpand}
      >
        <Suspense fallback={<div className="asset-rc asset-rc--compact" aria-hidden />}>
          <AssetChartMini rows={result.rows} events={events} />
        </Suspense>
      </DetailCard>

      {hasChildren && (
        <DetailCard
          title={ja.result.educationCardTitle}
          value={`${peakAge}歳頃にピーク`}
          caption="大学進学の時期に支出が増える見込みです。"
          onOpen={() => setSheet('education')}
        />
      )}

      <DetailCard
        title={ja.result.mortgageCardTitle}
        value={mortgage.value}
        caption={mortgage.caption}
        onOpen={() => setSheet('mortgage')}
      />

      {/* 条件変更導線（常時表示） */}
      <EditLinks />
      <DeepenLink />

      {/* 見直しのヒント（折りたたみ） */}
      {result.suggestions.length > 0 && (
        <details className="collapsible">
          <summary>
            {ja.result.suggestionsToggle}（{result.suggestions.length}件）
          </summary>
          <div className="collapsible__body">
            <Suggestions suggestions={result.suggestions} />
          </div>
        </details>
      )}

      {/* 今回の試算条件（折りたたみ・下部） */}
      <details className="collapsible">
        <summary>{ja.result.assumptionsToggle}</summary>
        <div className="collapsible__body">
          <AssumptionSummary assumptions={result.assumptions} flags={result.flags} notes={result.notes} />
        </div>
      </details>

      <p className="muted disclaimer">{ja.result.disclaimer}</p>

      <div className="step-actions">
        <button className="btn" onClick={reset}>
          {ja.common.redo}
        </button>
      </div>

      {/* 詳細シート */}
      <BottomSheet open={sheet === 'timeline'} onClose={() => setSheet(null)} title={ja.result.timelineDetailHeading}>
        <TimelineFull events={events} />
      </BottomSheet>
      <BottomSheet open={sheet === 'chart'} onClose={() => setSheet(null)} title={ja.result.assetSheetHeading}>
        <Suspense fallback={<div className="asset-rc" />}>
          <AssetChartFull rows={result.rows} events={events} />
        </Suspense>
      </BottomSheet>
      <BottomSheet open={sheet === 'education'} onClose={() => setSheet(null)} title={ja.result.educationSheetHeading}>
        <EducationDetail result={result} />
      </BottomSheet>
      <BottomSheet open={sheet === 'mortgage'} onClose={() => setSheet(null)} title={ja.result.mortgageSheetHeading}>
        <MortgageDetail input={input} />
      </BottomSheet>
    </section>
  );
}

function mortgageCard(input: SimulationInput): { value: string; caption: string } {
  const h = input.housing;
  const baseAge = input.basic.age.value;
  const fireStartAge = input.fire.type.value === 'none' ? input.income.retirementAge.value : input.fire.targetAge.value;

  if (h.type.value === 'rent') {
    return { value: '賃貸', caption: '毎月の家賃を住宅費として試算しています。' };
  }
  if (h.remainingYears.value > 0) {
    const payoff = baseAge + h.remainingYears.value;
    const caption =
      payoff > fireStartAge ? 'FIRE後も返済が一部残る可能性があります。' : 'ローン完済までを住宅費に反映しています。';
    return { value: `${payoff}歳頃に完済予定`, caption };
  }
  if (h.monthlyPayment.value > 0) {
    return { value: '返済中', caption: '毎月の返済を住宅費に反映しています。' };
  }
  return { value: '未設定', caption: 'しっかり診断で住宅ローンを詳しく設定できます。' };
}

const ROUGH_EDIT_TARGETS: { stepId: StepId; label: string }[] = [
  { stepId: 'basic', label: ja.editLinks.basic },
  { stepId: 'family', label: ja.editLinks.family },
  { stepId: 'housing', label: ja.editLinks.housing },
  { stepId: 'fire', label: ja.editLinks.fire },
  { stepId: 'investment', label: ja.editLinks.investment },
];

const THOROUGH_EDIT_TARGETS: { stepId: ThoroughStepId; label: string }[] = [
  { stepId: 'detailed-basic', label: ja.editLinks.basic },
  { stepId: 'detailed-income', label: ja.editLinks.income },
  { stepId: 'detailed-expense', label: ja.editLinks.expense },
  { stepId: 'detailed-family', label: ja.editLinks.family },
  { stepId: 'detailed-housing', label: ja.editLinks.housing },
  { stepId: 'detailed-fire', label: ja.editLinks.fire },
  { stepId: 'detailed-investment', label: ja.editLinks.investment },
  { stepId: 'detailed-retirement', label: ja.editLinks.retirement },
  { stepId: 'detailed-events', label: ja.editLinks.events },
];

function EditLinks() {
  const mode = useInputStore((s) => s.mode);
  const editCategory = useInputStore((s) => s.editCategory);
  const editThoroughStep = useInputStore((s) => s.editThoroughStep);
  const isThorough = mode === 'thorough';

  return (
    <div className="edit-links">
      <div className="edit-links__title">{ja.result.editHeading}</div>
      <p className="muted">{ja.result.editLead}</p>
      <div className="edit-links__grid">
        {isThorough
          ? THOROUGH_EDIT_TARGETS.map((t) => (
              <button key={t.stepId} className="btn edit-link" onClick={() => editThoroughStep(t.stepId)}>
                {t.label}
              </button>
            ))
          : ROUGH_EDIT_TARGETS.map((t) => (
              <button key={t.stepId} className="btn edit-link" onClick={() => editCategory(t.stepId)}>
                {t.label}
              </button>
            ))}
      </div>
    </div>
  );
}

function DeepenLink() {
  const deepenToThorough = useInputStore((s) => s.deepenToThorough);
  return (
    <div className="deepen">
      <div className="deepen__title">{ja.result.deepenHeading}</div>
      <p className="muted">{ja.result.deepenLead}</p>
      <button className="btn btn--primary" onClick={deepenToThorough}>
        {ja.result.deepenButton}
      </button>
    </div>
  );
}
