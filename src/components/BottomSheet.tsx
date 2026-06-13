import { useEffect, type ReactNode } from 'react';
import { ja } from '../strings/ja';

// スマホ優先の詳細表示。中央モーダルではなく下から出る Bottom Sheet。
// 背景は暗くしすぎず、内部スクロールで完結、閉じやすくする。
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    // iOS Safari でモーダル開いている間に背面ページが動くケースを止めるため、
    // body を fixed して現在のスクロール位置を保存する古典パターン。
    // overflow:hidden だけだと iOS は背面のタッチ慣性が残る。
    const scrollY = window.scrollY;
    const prev = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.left = prev.left;
      document.body.style.right = prev.right;
      document.body.style.width = prev.width;
      document.body.style.overflow = prev.overflow;
      // 開く前のスクロール位置に戻す（position:fixed 解除後の現状復帰）。
      window.scrollTo(0, scrollY);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet__backdrop" onClick={onClose} />
      <div className="sheet__panel">
        <div className="sheet__header">
          <span className="sheet__handle" aria-hidden />
          <div className="sheet__title">{title}</div>
          <button className="sheet__close" onClick={onClose} aria-label={ja.common.close}>
            ×
          </button>
        </div>
        <div className="sheet__body">{children}</div>
      </div>
    </div>
  );
}
