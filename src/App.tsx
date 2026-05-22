import { useInputStore } from './store/inputStore';
import { ModeSelect } from './features/mode-select/ModeSelect';
import { StepLayout } from './features/input-steps/StepLayout';
import { ResultDashboard } from './features/results/ResultDashboard';

// 画面遷移: モード選択 → 入力ステップ → 結果ダッシュボード
export default function App() {
  const phase = useInputStore((s) => s.phase);

  return (
    <main className="app">
      {phase === 'mode' && <ModeSelect />}
      {phase === 'input' && <StepLayout />}
      {phase === 'result' && <ResultDashboard />}
    </main>
  );
}
