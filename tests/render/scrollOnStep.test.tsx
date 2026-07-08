import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { RoughFlow } from '../../src/features/input-steps/rough/RoughFlow';
import { ThoroughFlow } from '../../src/features/input-steps/thorough/ThoroughFlow';
import { useInputStore } from '../../src/store/inputStore';

// モバイルUX: 埋め込み時、質問ページの送り（次へ・戻る等）で親 WordPress ページへ
// lifeplanlab:scrollTop を送る回帰テスト。従来は phase 変更時のみで、
// 入力内のページ送りでは親がスクロールされず前の位置に残っていた。

const store = () => useInputStore.getState();
const originalTop = Object.getOwnPropertyDescriptor(window, 'top');

function fakeEmbedded(): void {
  // isEmbedded() は window.self !== window.top で判定する。
  Object.defineProperty(window, 'top', { value: {}, configurable: true });
}

describe('ページ送り時の親スクロール通知（埋め込み時）', () => {
  let postSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    store().reset();
    fakeEmbedded();
    postSpy = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    postSpy.mockRestore();
    if (originalTop) Object.defineProperty(window, 'top', originalTop);
    localStorage.clear();
    store().reset();
  });

  function scrollTopCalls(): number {
    return postSpy.mock.calls.filter(
      (c) => (c[0] as { type?: string })?.type === 'lifeplanlab:scrollTop',
    ).length;
  }

  it('ざっくり診断: 「次へ」→「このまま次へ」でページが変わると scrollTop を親へ送る', () => {
    store().setMode('rough');
    const { getByText } = render(<RoughFlow />);
    postSpy.mockClear();

    // 未入力ページでは「次へ」は確認パネルを出すだけ。「このまま次へ」で実際に進む。
    fireEvent.click(getByText('次へ'));
    fireEvent.click(getByText('このまま次へ'));

    expect(store().roughPage).toBe(1);
    expect(scrollTopCalls()).toBeGreaterThanOrEqual(1);
    const msg = postSpy.mock.calls.find(
      (c) => (c[0] as { type?: string })?.type === 'lifeplanlab:scrollTop',
    )![0] as { type: string; source: string };
    expect(msg).toEqual({ type: 'lifeplanlab:scrollTop', source: 'life-plan-simulator' });
  });

  it('ざっくり診断: 「戻る」でも scrollTop を親へ送る', () => {
    store().setMode('rough');
    useInputStore.setState({ roughPage: 1 });
    const { getByText } = render(<RoughFlow />);
    postSpy.mockClear();

    fireEvent.click(getByText('戻る'));

    expect(store().roughPage).toBe(0);
    expect(scrollTopCalls()).toBeGreaterThanOrEqual(1);
  });

  it('しっかり診断: ページ送りで scrollTop を親へ送る', () => {
    store().setMode('thorough');
    const { getByText, queryByText } = render(<ThoroughFlow />);
    const before = store().thoroughPageId;
    postSpy.mockClear();

    fireEvent.click(getByText('次へ'));
    // 未入力確認パネルが出た場合は「このまま次へ」で進む。
    const proceed = queryByText('このまま次へ');
    if (proceed) fireEvent.click(proceed);

    expect(store().thoroughPageId).not.toBe(before);
    expect(scrollTopCalls()).toBeGreaterThanOrEqual(1);
  });

  it('入力値の変更ではページ内に留まり scrollTop を送らない', () => {
    store().setMode('rough');
    render(<RoughFlow />);
    postSpy.mockClear();

    store().setRoughValue('age', 40); // 値変更のみ（ページは変わらない）

    expect(scrollTopCalls()).toBe(0);
  });
});
