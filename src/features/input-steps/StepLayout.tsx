import { useInputStore } from '../../store/inputStore';
import { ja } from '../../strings/ja';
import { QuestionCard } from './QuestionCard';
import { RoughFlow } from './rough/RoughFlow';

// 入力フローのルーター。
// ざっくり診断は本実装(RoughFlow)。しっかり診断は後のSTEPで作り込む（現状は導線と引き継ぎの骨格）。
export function StepLayout() {
  const mode = useInputStore((s) => s.mode);
  const input = useInputStore((s) => s.input);
  const result = useInputStore((s) => s.result);
  const reset = useInputStore((s) => s.reset);
  const backToResult = useInputStore((s) => s.backToResult);

  if (mode === 'rough') return <RoughFlow />;

  // しっかり診断（準備中）。ざっくり診断の入力は引き継がれている。
  return (
    <section className="screen step-layout">
      <h2 className="section-heading">しっかり診断</h2>
      <QuestionCard title="準備中">
        <p className="muted">
          しっかり診断の詳細な入力UIは次のSTEPで実装します。
          {input
            ? 'ざっくり診断で入力した内容は引き継がれています。実装後は、未入力の項目だけを追加でお聞きします。'
            : 'まずは「ざっくり診断」をお試しください。'}
        </p>
      </QuestionCard>
      <div className="step-actions">
        <button className="btn" onClick={reset}>
          {ja.nav.toModeSelect}
        </button>
        {result && (
          <button className="btn btn--primary" onClick={backToResult}>
            {ja.nav.backToResult}
          </button>
        )}
      </div>
    </section>
  );
}
