import { useInputStore } from './store/inputStore';
import { ModeSelect } from './features/mode-select/ModeSelect';
import { StepLayout } from './features/input-steps/StepLayout';
import { ResultDashboard } from './features/results/ResultDashboard';
import { ResumePrompt } from './features/resume/ResumePrompt';

// 画面遷移: モード選択 → 入力ステップ → 結果ダッシュボード
// 再訪時に保存済みの入力があれば、最前面で「続きから再開」を確認する。
export default function App() {
  const phase = useInputStore((s) => s.phase);
  const resumePrompt = useInputStore((s) => s.resumePrompt);

  return (
    <main className="app">
      {phase === 'mode' && <ModeSelect />}
      {phase === 'input' && <StepLayout />}
      {phase === 'result' && <ResultDashboard />}
      {resumePrompt && <ResumePrompt />}
    </main>
  );
}
