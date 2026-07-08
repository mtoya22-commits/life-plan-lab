import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// 「？」アイコンの補助説明。用語説明ではなく「どこを見れば入力できるか」を案内する。
// STEP11.24 以降: bubble を開いたままにすると下部ナビと被るので、外側タップ・Escape で
// 閉じられるようにし、長文 help でも UI を覆い隠さない（CSS 側で max-height + scroll）。
// モバイル375px契約: bubble はアイコン位置に依存せず必ず画面内に収める
// （右側の ? から開いても右にはみ出さない）。translateX クランプで実現する。

/** bubble を画面内へ収めるための X 方向シフト量（px）。
 *  右端が viewport を超えた分だけ左へ寄せ、左端が margin を割る場合は右へ戻す（左端保護を優先）。
 *  収まっている場合は 0。純関数（テスト対象）。 */
export function bubbleShiftX(
  left: number,
  right: number,
  viewportWidth: number,
  margin = 12,
): number {
  let dx = 0;
  if (right > viewportWidth - margin) dx = viewportWidth - margin - right;
  if (left + dx < margin) dx = margin - left;
  return dx;
}

export function HelpTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);

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

  // 開いている間、実測位置から画面内へクランプする。resize / 画面回転でも再計算し、
  // 閉じたら transform をリセットする（次回オープン時の実測を汚さない）。
  useLayoutEffect(() => {
    if (!open) return;
    const el = bubbleRef.current;
    if (!el) return;
    const apply = () => {
      el.style.transform = ''; // 素の位置で実測してからシフト量を決める
      const rect = el.getBoundingClientRect();
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const dx = bubbleShiftX(rect.left, rect.right, vw);
      if (dx !== 0) el.style.transform = `translateX(${dx}px)`;
    };
    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    return () => {
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
      el.style.transform = '';
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
        <span className="help__bubble" role="tooltip" ref={bubbleRef}>
          {text}
        </span>
      )}
    </span>
  );
}
