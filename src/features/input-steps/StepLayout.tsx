import { useInputStore } from '../../store/inputStore';
import { ja } from '../../strings/ja';
import type { RoughAnswers } from '../../schema/types';
import { ProgressHeader } from './ProgressHeader';
import { QuestionCard } from './QuestionCard';

// ステップ入力のレイアウト骨格。
// TODO(実装): モード別の質問定義(step schema)を読み、QuestionCard を順番に出す。
//   - ざっくり: 9問
//   - しっかり: カテゴリ単位(基本→収入→…→ライフイベント)
//   各カードに RecommendedButton / SkipButton / HelpTooltip を配置する。

// 骨格段階の動作確認用サンプル回答（実装で本物の入力に差し替える）。
const SAMPLE_ROUGH: RoughAnswers = {
  age: 38,
  householdIncome: 850,
  currentAssets: 1200,
  childrenCount: 2,
  educationPolicy: 'public',
  housing: 'own',
  workStyle: 'work_a_little',
  reduceWorkAge: 55,
  investmentStyle: 'balanced',
};

export function StepLayout() {
  const mode = useInputStore((s) => s.mode);
  const step = useInputStore((s) => s.step);
  const reset = useInputStore((s) => s.reset);
  const submitRough = useInputStore((s) => s.submitRough);

  const total = mode === 'rough' ? 9 : 11;

  return (
    <section className="screen step-layout">
      <ProgressHeader current={step + 1} total={total} />

      <QuestionCard title={`入力ステップ（骨格）— モード: ${mode}`}>
        <p className="muted">
          ここに各質問カードが順番に表示されます。現在は骨格のため、下のボタンでサンプル入力の結果を確認できます。
        </p>
      </QuestionCard>

      <div className="step-actions">
        <button className="btn" onClick={reset}>
          {ja.common.back}
        </button>
        <button className="btn btn--primary" onClick={() => submitRough(SAMPLE_ROUGH)}>
          {ja.common.seeResult}（サンプル）
        </button>
      </div>
    </section>
  );
}
