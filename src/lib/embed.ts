// iframe 埋め込み時、親 WordPress ページに対し
//   ・実コンテンツ高さの更新（iframe.style.height を親で追従させる）
//   ・画面遷移時の「先頭へスクロール依頼」
// を postMessage で通知するユーティリティ。
//
// 単独表示時（iframe でない）は isEmbedded() が false を返し、すべて no-op になる。
// 既存の lifeplan-lab:modal namespace（src/lib/notifyModalToParent.ts）とは別の
// lifeplanlab:* namespace を使う。両方とも親ページに併存できる。

const SOURCE = 'life-plan-simulator';

/** iframe 埋め込み判定。cross-origin で読めない場合も embedded とみなす。 */
export function isEmbedded(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

/** 実コンテンツ高さを親に通知し、親 iframe 高さを追従させる。 */
export function postEmbeddedHeight(height: number): void {
  if (!isEmbedded()) return;
  try {
    window.parent.postMessage(
      { type: 'lifeplanlab:resize', source: SOURCE, height },
      '*',
    );
  } catch {
    /* cross-origin / iframe 親無し: 静かに失敗 */
  }
}

/** 画面遷移時、親 WordPress ページに先頭へのスクロール依頼を送る。 */
export function postEmbeddedScrollTop(): void {
  if (!isEmbedded()) return;
  try {
    window.parent.postMessage(
      { type: 'lifeplanlab:scrollTop', source: SOURCE },
      '*',
    );
  } catch {
    /* noop */
  }
}

/** #root や .app の実コンテンツ高さを安定して測る。下端安全余白 8px を足す。 */
export function measureContentHeight(el: HTMLElement): number {
  const scrollH = el.scrollHeight;
  const rectH = Math.ceil(el.getBoundingClientRect().height);
  return Math.max(scrollH, rectH) + 8;
}
