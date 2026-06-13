// iframe 埋め込み時、親ページ（WordPress）にモーダル状態を通知する。
// 親が listener を持っていれば「モーダル開いている間は親ページのスクロールを止める」等で
// 「× が画面外に流れる」「2 重スクロール感」を緩和できる。
// listener が無い親に対しては、メッセージは静かに無視されるだけで害はない。
//
// README のサンプル listener:
//   window.addEventListener('message', (e) => {
//     if (e.data && e.data.type === 'lifeplan-lab:modal') {
//       document.body.style.overflow = e.data.open ? 'hidden' : '';
//     }
//   });

export type ModalMessage = {
  type: 'lifeplan-lab:modal';
  open: boolean;
};

/** モーダルの開閉を親ページに通知する。iframe でない場合（top === self）も呼んでよい（no-op）。 */
export function notifyModalToParent(open: boolean): void {
  try {
    if (typeof window === 'undefined') return;
    if (window.parent === window) return; // 親 iframe でない場合は通知不要
    const msg: ModalMessage = { type: 'lifeplan-lab:modal', open };
    // origin 制限は受信側に任せる。送信側で固める必要はない（情報自体は無害）。
    window.parent.postMessage(msg, '*');
  } catch {
    // クロスオリジン制限などで失敗してもアプリ側の挙動には影響しない。
  }
}
