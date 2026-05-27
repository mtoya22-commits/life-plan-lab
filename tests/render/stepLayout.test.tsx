import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import App from '../../src/App';
import { useInputStore } from '../../src/store/inputStore';

// 下部ナビが iframe 内でも常時下端に見えるよう、入力画面は
//   .step-layout (height:100dvh, flex column, overflow:hidden)
//     ├ .step-content (flex:1, overflow-y:auto)   ← ここだけがスクロール
//     └ .bottom-nav                                ← 常に下端
// という構造に保つ必要がある。リファクタで誤って .bottom-nav を
// .step-content の内側に入れてしまうと「ナビも一緒にスクロールして
// 画面外に消える」回帰が出るため、構造をテストで固定する。

const store = () => useInputStore.getState();

function enterRoughInput() {
  store().setMode('rough');
}

describe('input step layout (iframe-safe sticky bottom-nav)', () => {
  beforeEach(() => store().reset());
  afterEach(cleanup);

  it('renders .step-layout > .step-content + .bottom-nav as siblings (rough flow)', () => {
    enterRoughInput();
    const { container } = render(<App />);

    const stepLayout = container.querySelector('.step-layout');
    expect(stepLayout, '.step-layout が描画されていない').not.toBeNull();

    const stepContent = stepLayout!.querySelector(':scope > .step-content');
    expect(stepContent, '.step-content が .step-layout 直下にない').not.toBeNull();

    const bottomNav = stepLayout!.querySelector(':scope > .bottom-nav');
    expect(bottomNav, '.bottom-nav が .step-layout 直下にない').not.toBeNull();

    // 回帰防止: .bottom-nav が .step-content の内側に入ると一緒にスクロールしてしまう
    expect(stepContent!.querySelector('.bottom-nav')).toBeNull();
  });

  it('keeps question cards inside the scrollable .step-content (rough flow)', () => {
    enterRoughInput();
    const { container } = render(<App />);

    const stepContent = container.querySelector('.step-layout > .step-content');
    expect(stepContent).not.toBeNull();
    // ざっくり診断の最初のページには質問カードが少なくとも1つある
    expect(stepContent!.querySelector('.question-card')).not.toBeNull();
  });
});
