import { useInputStore } from '../../store/inputStore';
import { ja } from '../../strings/ja';
import type { StepId } from '../../schema/types';
import { Hero } from './Hero';
import { ResultSummary } from './ResultSummary';
import { AssetChart } from './AssetChart';
import { Timeline } from './Timeline';
import { AssumptionSummary } from './AssumptionSummary';
import { Suggestions } from './Suggestions';

// 結果ダッシュボード。
// 要約 → Hero → 資産推移 → タイムライン → 試算条件 → 改善提案 → 条件修正/深掘り。
// 「結果を見て条件を変えて再計算」を繰り返せるよう、各カテゴリへ戻る導線を用意する。
export function ResultDashboard() {
  const result = useInputStore((s) => s.result);
  const input = useInputStore((s) => s.input);
  const reset = useInputStore((s) => s.reset);

  if (!result || !input) return null;

  return (
    <section className="screen result">
      <h2 className="section-heading">{ja.result.heading}</h2>

      <ResultSummary result={result} input={input} />
      <Hero result={result} />
      <AssetChart rows={result.rows} />
      <Timeline rows={result.rows} />
      <AssumptionSummary assumptions={result.assumptions} flags={result.flags} notes={result.notes} />
      <Suggestions suggestions={result.suggestions} />

      <EditLinks />
      <DeepenLink />

      <p className="muted disclaimer">{ja.result.disclaimer}</p>

      <div className="step-actions">
        <button className="btn" onClick={reset}>
          {ja.common.redo}
        </button>
      </div>
    </section>
  );
}

const EDIT_TARGETS: { stepId: StepId; label: string }[] = [
  { stepId: 'basic', label: ja.editLinks.basic },
  { stepId: 'family', label: ja.editLinks.family },
  { stepId: 'housing', label: ja.editLinks.housing },
  { stepId: 'fire', label: ja.editLinks.fire },
  { stepId: 'investment', label: ja.editLinks.investment },
];

function EditLinks() {
  const editCategory = useInputStore((s) => s.editCategory);
  return (
    <div className="edit-links">
      <div className="edit-links__title">{ja.result.editHeading}</div>
      <p className="muted">{ja.result.editLead}</p>
      <div className="edit-links__grid">
        {EDIT_TARGETS.map((t) => (
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
