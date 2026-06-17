import { useEffect } from 'react';
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

  // 別アプリ（生活費見直しシミュレーター・住宅ローンシミュレーター）からの取り込み値を起動時に 1 回だけ読む。
  // URL パラメータ → localStorage の順に確認し、適用判定はストア側で行う。
  useEffect(() => {
    const s = useInputStore.getState();
    s.initializeImportedLivingCost();
    s.initializeImportedMortgage();
  }, []);

  return (
    <main className="app">
      {phase === 'mode' && <ModeSelect />}
      {phase === 'input' && <StepLayout />}
      {phase === 'result' && <ResultDashboard />}
      {resumePrompt && <ResumePrompt />}
    </main>
  );
}
