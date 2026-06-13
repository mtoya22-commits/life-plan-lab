import { useEffect, type ReactNode } from 'react';
import { ja } from '../strings/ja';
import { useLockBodyScroll } from '../lib/useLockBodyScroll';

// スマホ優先の詳細表示。中央モーダルではなく下から出る Bottom Sheet。
// 背景は暗くしすぎず、内部スクロールで完結、閉じやすくする。
// パネル本体は固定、ヘッダー（× ボタン）は常に見える、body だけが縦スクロールする構造。
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
  // 背面のスクロールを固定（iOS Safari のタッチ慣性対策込み）
  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
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
