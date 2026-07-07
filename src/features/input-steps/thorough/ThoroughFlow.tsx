import { useEffect, useRef, useState } from 'react';
import { useInputStore } from '../../../store/inputStore';
import { ja } from '../../../strings/ja';
import { visibleThoroughPages } from '../../../schema/thoroughSteps';
import { getFieldByPath } from '../../../schema/fieldPath';
import type { ReactNode } from 'react';
import { ProgressHeader } from '../ProgressHeader';
import { ThoroughQuestionView, ThoroughFieldRow } from './ThoroughQuestionView';
import { FamilyStep } from './FamilyStep';
import { EventsStep } from './EventsStep';
import { ImportedLivingCostBanner } from '../../imported-living-cost/ImportedLivingCostBanner';
import { ImportedMortgageBanner } from '../../imported-mortgage/ImportedMortgageBanner';
import { ImportedEducationBanner } from '../../imported-education/ImportedEducationBanner';
import type { Field, SimulationInput } from '../../../schema/types';
import type { ThoroughPage, ThoroughQuestion } from '../../../schema/thoroughSteps';

// =============================================================================
// しっかり診断のステップフロー。ざっくり診断と同じ操作感（進捗・目的説明・下部固定ナビ）。
// 全項目が任意（スキップ/おすすめあり）のため、Next は常に進める（止めない）。
// 結果からの「カテゴリ修正」(cameFromResult) では再計算を主導線にする。
//
// 見落とし防止: 'fields' ページでは「このステップ：X/Y 項目入力済み」を
// 下部ナビに常時表示し、未入力のまま「次へ」を押した場合は軽い確認パネルを出す。
// 'family' / 'events' ページは項目という単位を持たないので無印で進む。
// =============================================================================

// しっかり診断の項目「入力済み（acknowledged）」判定。
// user_input / recommended_value はもちろん、ユーザーが per-item で
// 「未入力で進む」(source: 'skipped') を押した項目も acknowledged 扱い。
// 'default_value'（システムの初期標準値）だけはまだユーザー未確認とみなす。
function isFieldAcknowledged(field: Field<unknown> | undefined): boolean {
  if (!field) return false;
  return field.source === 'user_input' || field.source === 'recommended_value' || field.source === 'skipped';
}

export function ThoroughFlow() {
  const thoroughInput = useInputStore((s) => s.thoroughInput);
  const thoroughPageId = useInputStore((s) => s.thoroughPageId);
  const cameFromResult = useInputStore((s) => s.cameFromResult);
  const nextThoroughPage = useInputStore((s) => s.nextThoroughPage);
  const prevThoroughPage = useInputStore((s) => s.prevThoroughPage);
  const submitThorough = useInputStore((s) => s.submitThorough);
  const submitThoroughAndContinue = useInputStore((s) => s.submitThoroughAndContinue);
  const backToResult = useInputStore((s) => s.backToResult);

  const [attempted, setAttempted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // ステップが変わったら質問画面の先頭へスクロール。
  // inner-scroll 復活後は `.step-content` 内のスクロールリセットが本命。
  // body の scrollTo は防御（result→input 戻り等で body 残スクロールがある場合）。
  useEffect(() => {
    contentRef.current?.scrollTo?.({ top: 0, behavior: 'auto' });
    window.scrollTo({ top: 0, behavior: 'auto' });
    setAttempted(false);
  }, [thoroughPageId, cameFromResult]);

  if (!thoroughInput) return null;

  const pages = visibleThoroughPages(thoroughInput);
  const idx = Math.max(0, pages.findIndex((p) => p.pageId === thoroughPageId));
  const page = pages[idx];
  const total = pages.length;
  const isLast = idx === total - 1;
  const remaining = total - (idx + 1);
  const etaText =
    remaining <= 0 ? 'まもなく完了' : `あと約${Math.max(1, Math.ceil(remaining * 0.6))}分（のこり${remaining}ステップ）`;

  // 'fields' ページでのみ入力済み件数を計算（family/events には項目の概念がない）。
  const visibleQs: ThoroughQuestion[] =
    page.kind === 'fields' ? visibleQuestions(page, thoroughInput) : [];
  const totalCount = visibleQs.length;
  const completedCount = visibleQs.filter((q) => isFieldAcknowledged(getFieldByPath(thoroughInput, q.path))).length;
  const pageComplete = totalCount === 0 || completedCount === totalCount;

  const advance = () => {
    setAttempted(false);
    nextThoroughPage(); // スクロールは thoroughPageId 変更を検知する useEffect が担当
  };

  // 「次へ」: 未入力があれば確認パネルを出す。即進行はしない。
  const handleNext = () => {
    if (pageComplete) {
      advance();
    } else {
      setAttempted(true);
    }
  };

  // 「未入力項目を見る」: 最初の未入力（default_value のままの）項目を .step-content 内でセンターに表示し、
  // 補足バーは閉じる。再度「次へ」で未入力が残っていればまた出る（仕様 #7）。
  const revealFirstIncomplete = () => {
    const firstIncomplete = visibleQs.find((q) => !isFieldAcknowledged(getFieldByPath(thoroughInput, q.path)));
    if (firstIncomplete) {
      document.getElementById(`q-${firstIncomplete.path}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setAttempted(false);
  };

  // 「このまま次へ」: 仕様 #4 のとおり、未入力項目には触らず通常進行する。
  const proceedAsIs = () => {
    advance();
  };

  return (
    <section className="screen step-layout">
      <div className="step-content" ref={contentRef}>
        {cameFromResult ? (
          <header className="edit-header">編集中：{page.title}</header>
        ) : (
          <ProgressHeader label="しっかり診断" current={idx + 1} total={total} etaText={etaText} />
        )}

        <div className="step-head">
          <h2 className="section-heading">{page.title}</h2>
          <p className="step-purpose muted">{page.purpose}</p>
        </div>

        <StepOverview page={page} input={thoroughInput} />

        {/* 生活費見直しシミュレーター からの取り込み告知は、expense.monthlyLiving を含むページでだけ出す。 */}
        {page.kind === 'fields' &&
          (page.questions ?? []).some((q) => q.path === 'expense.monthlyLiving') && (
            <ImportedLivingCostBanner variant="inputPage" />
          )}
        {/* 住宅ローンシミュレーター からの取り込み告知は、housing.* を含むページでだけ出す。 */}
        {page.kind === 'fields' &&
          (page.questions ?? []).some((q) => q.path.startsWith('housing.')) && (
            <ImportedMortgageBanner variant="inputPage" />
          )}

        {!cameFromResult && idx === 0 && <p className="step-reassure">{ja.nav.reassure}</p>}

        {/* 教育費ピークシミュレーター からの取り込み告知は、家族ステップでだけ出す。 */}
        {page.kind === 'family' && <ImportedEducationBanner variant="inputPageThorough" />}
        {page.kind === 'family' && <FamilyStep input={thoroughInput} />}
        {page.kind === 'events' && <EventsStep input={thoroughInput} />}
        {page.kind === 'fields' && renderFieldGroups(visibleQuestions(page, thoroughInput), thoroughInput)}

        <div className="bottom-nav-spacer" />
      </div>

      <nav className="bottom-nav" aria-label="ステップ操作">
        {/* 通常モード時のみ、入力済み/未入力の自己確認ステータスと、
            「次へ」を押した直後の軽い確認パネルを出す。
            cameFromResult（結果からの編集）では再計算が主導線なので出さない。 */}
        {!cameFromResult && totalCount > 0 && (!attempted || pageComplete) && (
          <p className="step-status" aria-live="polite">
            {ja.nav.stepStatus(completedCount, totalCount)}
          </p>
        )}
        {!cameFromResult && attempted && !pageComplete && (
          <div className="step-confirm" role="group" aria-label="未入力項目の確認">
            <p className="step-confirm__text">{ja.nav.confirmIncomplete}</p>
            <div className="step-confirm__actions">
              <button type="button" className="btn" onClick={revealFirstIncomplete}>
                {ja.nav.showIncomplete}
              </button>
              <button type="button" className="btn btn--primary" onClick={proceedAsIs}>
                {ja.nav.confirmProceed}
              </button>
            </div>
          </div>
        )}

        {/* 結果からの編集モード時の補助ボタン（続けて変更）。 */}
        {cameFromResult && (
          <div className="recompute-continue">
            <button type="button" className="btn" onClick={submitThoroughAndContinue}>
              {ja.nav.recomputeContinue}
            </button>
          </div>
        )}

        <div className="bottom-nav__inner">
          {cameFromResult ? (
            <>
              <button className="btn" onClick={backToResult}>
                {ja.nav.backToResult}
              </button>
              <span className="bottom-nav__center muted">編集中</span>
              <button className="btn btn--primary" onClick={submitThorough}>
                {ja.nav.recompute}
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={prevThoroughPage}>
                {idx === 0 ? ja.nav.toModeSelect : ja.common.back}
              </button>
              <span className="bottom-nav__center muted">
                {idx + 1} / {total}
              </span>
              <button className="btn btn--primary" onClick={handleNext}>
                {isLast ? ja.common.seeResult : ja.common.next}
              </button>
            </>
          )}
        </div>
      </nav>
    </section>
  );
}

/** 表示すべき質問（showIf 適用後）。 */
function visibleQuestions(page: ThoroughPage, input: SimulationInput): ThoroughQuestion[] {
  return (page.questions ?? []).filter((q) => !q.showIf || q.showIf(input));
}

// 連続する単純な数値入力は1枚のまとめカードに（スクロール削減）。
// 選択・判断が必要な項目（choice / toggle）は従来どおり単独カードで丁寧に見せる。
// 各項目は `q-${path}` の id で包み、「未入力項目を見る」スクロール先として使う。
function renderFieldGroups(questions: ThoroughQuestion[], input: SimulationInput): ReactNode[] {
  const out: ReactNode[] = [];
  let run: ThoroughQuestion[] = [];

  const flush = (key: string) => {
    if (run.length === 0) return;
    if (run.length === 1) {
      const q = run[0];
      out.push(
        <div id={`q-${q.path}`} key={q.path}>
          <ThoroughQuestionView q={q} field={getFieldByPath(input, q.path)} />
        </div>,
      );
    } else {
      out.push(
        <div className="question-card group-card" key={key}>
          {run.map((q) => (
            <div id={`q-${q.path}`} key={q.path}>
              <ThoroughFieldRow q={q} field={getFieldByPath(input, q.path)} />
            </div>
          ))}
        </div>,
      );
    }
    run = [];
  };

  questions.forEach((q, i) => {
    if (q.kind === 'number') {
      run.push(q);
    } else {
      flush(`grp-${i}`);
      out.push(
        <div id={`q-${q.path}`} key={q.path}>
          <ThoroughQuestionView q={q} field={getFieldByPath(input, q.path)} />
        </div>,
      );
    }
  });
  flush('grp-last');
  return out;
}

// このページで確認する項目の概要（件数＋項目名）。スクロール前に全体量を把握できるように。
function StepOverview({ page, input }: { page: ThoroughPage; input: SimulationInput }) {
  if (page.kind === 'family') {
    return <p className="step-overview muted">お子さまの人数と、進学の見通しを確認します。</p>;
  }
  if (page.kind === 'events') {
    return <p className="step-overview muted">含めたい一時的な出費・収入だけ選びます（未選択でも進めます）。</p>;
  }
  const labels = visibleQuestions(page, input).map((q) => q.label);
  if (labels.length === 0) return null;
  return (
    <p className="step-overview muted">
      確認する項目（{labels.length}）：{labels.join('・')}
    </p>
  );
}
