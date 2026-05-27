import { useEffect, useRef } from 'react';
import { useInputStore } from '../../../store/inputStore';
import { ja } from '../../../strings/ja';
import { visibleThoroughPages } from '../../../schema/thoroughSteps';
import { getFieldByPath } from '../../../schema/fieldPath';
import type { ReactNode } from 'react';
import { ProgressHeader } from '../ProgressHeader';
import { ThoroughQuestionView, ThoroughFieldRow } from './ThoroughQuestionView';
import { FamilyStep } from './FamilyStep';
import { EventsStep } from './EventsStep';
import type { SimulationInput } from '../../../schema/types';
import type { ThoroughPage, ThoroughQuestion } from '../../../schema/thoroughSteps';

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

  const contentRef = useRef<HTMLDivElement>(null);

  // ステップが変わったら質問画面の先頭へスクロール。
  // 通常スクロールは内側の .step-content で行うため、そちらを優先的にリセットする。
  // window.scrollTo はドキュメント自体がスクロールする旧経路への保険として残す。
  useEffect(() => {
    contentRef.current?.scrollTo?.({ top: 0, behavior: 'auto' });
    window.scrollTo({ top: 0, behavior: 'auto' });
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

        {!cameFromResult && idx === 0 && <p className="step-reassure">{ja.nav.reassure}</p>}

        {page.kind === 'family' && <FamilyStep input={thoroughInput} />}
        {page.kind === 'events' && <EventsStep input={thoroughInput} />}
        {page.kind === 'fields' && renderFieldGroups(visibleQuestions(page, thoroughInput), thoroughInput)}

        <div className="bottom-nav-spacer" />
      </div>

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

/** 表示すべき質問（showIf 適用後）。 */
function visibleQuestions(page: ThoroughPage, input: SimulationInput): ThoroughQuestion[] {
  return (page.questions ?? []).filter((q) => !q.showIf || q.showIf(input));
}

// 連続する単純な数値入力は1枚のまとめカードに（スクロール削減）。
// 選択・判断が必要な項目（choice / toggle）は従来どおり単独カードで丁寧に見せる。
function renderFieldGroups(questions: ThoroughQuestion[], input: SimulationInput): ReactNode[] {
  const out: ReactNode[] = [];
  let run: ThoroughQuestion[] = [];

  const flush = (key: string) => {
    if (run.length === 0) return;
    if (run.length === 1) {
      const q = run[0];
      out.push(<ThoroughQuestionView key={q.path} q={q} field={getFieldByPath(input, q.path)} />);
    } else {
      out.push(
        <div className="question-card group-card" key={key}>
          {run.map((q) => (
            <ThoroughFieldRow key={q.path} q={q} field={getFieldByPath(input, q.path)} />
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
      out.push(<ThoroughQuestionView key={q.path} q={q} field={getFieldByPath(input, q.path)} />);
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
