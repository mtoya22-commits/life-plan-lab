import { useEffect } from 'react';
import { useInputStore } from './store/inputStore';
import { ModeSelect } from './features/mode-select/ModeSelect';
import { StepLayout } from './features/input-steps/StepLayout';
import { ResultDashboard } from './features/results/ResultDashboard';
import { ResumePrompt } from './features/resume/ResumePrompt';
import { isEmbedded, measureContentHeight, postEmbeddedHeight, postEmbeddedScrollTop } from './lib/embed';

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

  // 埋め込み時のみ: #root の実コンテンツ高さを親 WordPress ページに通知し、iframe.style.height を追従させる。
  // 1〜2px の振動は無視して自己増殖を防ぐ。
  useEffect(() => {
    if (!isEmbedded()) return;
    const root = document.getElementById('root');
    if (!root) return;
    let lastSent = 0;
    let frame = 0;
    const send = () => {
      frame = 0;
      const h = measureContentHeight(root);
      if (Math.abs(h - lastSent) < 2) return;
      lastSent = h;
      postEmbeddedHeight(h);
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(send);
    };
    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(root);
    window.addEventListener('load', schedule);
    return () => {
      ro.disconnect();
      window.removeEventListener('load', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // 埋め込み時のみ: phase 変化（mode → input → result）で親に「先頭へスクロール」を依頼する。
  // 単独表示時は postEmbeddedScrollTop が no-op で、既存のスクロール挙動を壊さない。
  useEffect(() => {
    postEmbeddedScrollTop();
  }, [phase]);

  return (
    <main className="app">
      {phase === 'mode' && <ModeSelect />}
      {phase === 'input' && <StepLayout />}
      {phase === 'result' && <ResultDashboard />}
      {resumePrompt && <ResumePrompt />}
    </main>
  );
}
