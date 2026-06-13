import { useEffect } from 'react';
import { useInputStore } from '../../store/inputStore';
import { useLockBodyScroll } from '../../lib/useLockBodyScroll';
import { notifyModalToParent } from '../../lib/notifyModalToParent';
import { ja } from '../../strings/ja';

// 再訪時の「続きから再開しますか？」オーバーレイ。
// スマホでは画面ロック・ブラウザバック・通知割り込みで離脱しやすいため、途中再開を支援する。
// 開いている間は背面のスクロールを固定する（モーダルが動いて閉じボタンが見えなくなる症状の防止）。
// 親 WordPress ページにも postMessage で開閉を通知（listener があれば親ページのスクロールも止める）。
export function ResumePrompt() {
  const resumeSaved = useInputStore((s) => s.resumeSaved);
  const startFresh = useInputStore((s) => s.startFresh);

  useLockBodyScroll(true);

  useEffect(() => {
    notifyModalToParent(true);
    return () => notifyModalToParent(false);
  }, []);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={ja.resume.title}>
      <div className="overlay__card">
        <h2 className="overlay__title">{ja.resume.title}</h2>
        <p className="muted">{ja.resume.body}</p>
        <div className="overlay__actions">
          <button className="btn" onClick={startFresh}>
            {ja.resume.fresh}
          </button>
          <button className="btn btn--primary" onClick={resumeSaved}>
            {ja.resume.resume}
          </button>
        </div>
      </div>
    </div>
  );
}
