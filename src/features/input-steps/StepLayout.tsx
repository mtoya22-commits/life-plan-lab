import { useInputStore } from '../../store/inputStore';
import { ja } from '../../strings/ja';
import { QuestionCard } from './QuestionCard';
import { RoughFlow } from './rough/RoughFlow';

// 入力フローのルーター。
// ざっくり診断は本実装(RoughFlow)。しっかり診断は後のSTEPで作り込む（現状は骨格）。
export function StepLayout() {
  const mode = useInputStore((s) => s.mode);
  const reset = useInputStore((s) => s.reset);

  if (mode === 'rough') return <RoughFlow />;

  return (
    <section className="screen step-layout">
      <h2 className="section-heading">しっかり診断</h2>
      <QuestionCard title="準備中">
        <p className="muted">
          しっかり診断の詳細な入力UIは次のSTEPで実装します。まずは「ざっくり診断」をお試しください。
        </p>
      </QuestionCard>
      <div className="step-actions">
        <button className="btn" onClick={reset}>
          {ja.common.back}
        </button>
      </div>
    </section>
  );
}
