import { useEffect } from 'react';

/**
 * モーダル/オーバーレイが開いている間、背面ページのスクロールを固定する。
 *
 * iOS Safari では `body { overflow: hidden }` だけだとタッチ慣性が残ってしまうため、
 * 古典的な「position: fixed + top: -scrollY」パターンでスナップショット → 復元する。
 * 閉じたあとは `window.scrollTo(0, scrollY)` で元の位置に正確に戻す。
 *
 * 同時に複数のモーダルが開いた場合の競合は想定外（このアプリでは BottomSheet と
 * ResumePrompt が同時に出ることはない）。
 */
export function useLockBodyScroll(active: boolean): void {
  useEffect(() => {
    if (!active) return;

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
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.left = prev.left;
      document.body.style.right = prev.right;
      document.body.style.width = prev.width;
      document.body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}
