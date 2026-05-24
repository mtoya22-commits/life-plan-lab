import { useEffect } from 'react';
import { useInputStore } from '../../../store/inputStore';
import { ja } from '../../../strings/ja';
import { visibleThoroughPages } from '../../../schema/thoroughSteps';
import { getFieldByPath } from '../../../schema/fieldPath';
import { ProgressHeader } from '../ProgressHeader';
import { ThoroughQuestionView } from './ThoroughQuestionView';
import { FamilyStep } from './FamilyStep';
import { EventsStep } from './EventsStep';

// =============================================================================
// しっかり診断のステップフロー。ざっくり診断と同じ操作感（進捗・目的説明・下部固定ナビ）。
// 全項目が任意（スキップ/おすすめあり）のため、Next は常に進める（止めない）。
// 結果からの「カテゴリ修正」(cameFromResult) では再計算を主導線にする。
// =============================================================================

export function ThoroughFlow() {
  const thoroughInput = useInputStore((s) => s.thoroughInput);
  const thoroughPageId = useInputStore((s) => s.thoroughPageId);
  const cameFromResult = useInputStore((s) => s.cameFromResult);
  const nextThoroughPage = useInputStore((s) => s.nextThoroughPage);
  const prevThoroughPage = useInputStore((s) => s.prevThoroughPage);
  const submitThorough = useInputStore((s) => s.submitThorough);
  const backToResult = useInputStore((s) => s.backToResult);

  // ステップが変わったら質問画面の先頭へスクロール。
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const advance = () => {
    nextThoroughPage(); // スクロールは thoroughPageId 変更を検知する useEffect が担当
  };

  return (
    <section className="screen step-layout">
      {cameFromResult ? (
        <header className="edit-header">編集中：{page.title}</header>
      ) : (
        <ProgressHeader label="しっかり診断" current={idx + 1} total={total} etaText={etaText} />
      )}

      <div className="step-head">
        <h2 className="section-heading">{page.title}</h2>
        <p className="step-purpose muted">{page.purpose}</p>
      </div>

      {!cameFromResult && idx === 0 && <p className="step-reassure">{ja.nav.reassure}</p>}

      {page.kind === 'family' && <FamilyStep input={thoroughInput} />}
      {page.kind === 'events' && <EventsStep input={thoroughInput} />}
      {page.kind === 'fields' &&
        page.questions
          ?.filter((q) => !q.showIf || q.showIf(thoroughInput))
          .map((q) => <ThoroughQuestionView key={q.path} q={q} field={getFieldByPath(thoroughInput, q.path)} />)}

      <div className="bottom-nav-spacer" />

      <nav className="bottom-nav" aria-label="ステップ操作">
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
              <button className="btn btn--primary" onClick={advance}>
                {isLast ? ja.common.seeResult : ja.common.next}
              </button>
            </>
          )}
        </div>
      </nav>
    </section>
  );
}
