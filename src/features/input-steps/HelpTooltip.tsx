import { useEffect, useRef, useState } from 'react';

// 「？」アイコンの補助説明。用語説明ではなく「どこを見れば入力できるか」を案内する。
// STEP11.24 以降: bubble を開いたままにすると下部ナビと被るので、外側タップ・Escape で
// 閉じられるようにし、長文 help でも UI を覆い隠さない（CSS 側で max-height + scroll）。
export function HelpTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className="help" ref={rootRef}>
      <button
        type="button"
        className="help__icon"
        aria-label="補助説明"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open && (
        <span className="help__bubble" role="tooltip">
          {text}
        </span>
      )}
    </span>
  );
}
