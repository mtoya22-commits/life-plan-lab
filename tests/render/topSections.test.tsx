import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../../src/App';
import { useInputStore } from '../../src/store/inputStore';
import { ja } from '../../src/strings/ja';

// STEP11.8: 開始前トップ画面に「詳しい説明」「ご利用前の注意点」「関連記事」を戻す。
// - これらはモード選択画面（phase === 'mode'）のみに出す
// - ざっくり/しっかり 診断に入ったら（phase === 'input'）出ない
// - 計算ロジック・結果画面・iframe HTML は触らない

const store = () => useInputStore.getState();

describe('top-screen sections (mode select only)', () => {
  beforeEach(() => store().reset());
  afterEach(cleanup);

  it('renders the details toggle, cautions, and related-articles sections on the top screen', () => {
    render(<App />);
    // A. 詳しい説明（折りたたみ）
    expect(screen.getByText(ja.top.detailsToggle)).toBeTruthy();
    // B. ご利用前の注意点（見出し + 本文の一部）
    expect(screen.getByText(ja.top.cautionsHeading)).toBeTruthy();
    expect(screen.getByText(/将来の結果を保証するものではなく/)).toBeTruthy();
    // C. 関連記事
    expect(screen.getByText(ja.top.relatedHeading)).toBeTruthy();
    expect(screen.getByText(/詳しい解説記事を追加していく予定/)).toBeTruthy();
  });

  it('includes the "分かること" bullets and the PV/future paragraph in the collapsible body', () => {
    const { container } = render(<App />);
    // <details> はデフォルトで閉じていても中身は DOM 上に存在する
    expect(container.textContent).toContain(ja.top.whatYouLearnHeading);
    expect(container.textContent).toContain(ja.top.whatYouLearnItems[0]);
    expect(container.textContent).toContain(ja.top.whatYouLearnItems[ja.top.whatYouLearnItems.length - 1]);
    expect(container.textContent).toContain(ja.top.pvFutureHeading);
    expect(container.textContent).toContain('現在価値は、将来のお金を「今のお金の感覚」で見た金額です');
  });

  it('hides the top sections after starting ざっくり診断 (input phase)', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByText('ざっくり診断').closest('button')!);
    // モード選択画面はアンマウントされ、入力画面に切り替わる
    expect(store().phase).toBe('input');
    expect(container.textContent).not.toContain(ja.top.detailsToggle);
    expect(container.textContent).not.toContain(ja.top.cautionsHeading);
    expect(container.textContent).not.toContain(ja.top.relatedHeading);
  });

  it('hides the top sections after starting しっかり診断 (input phase)', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByText('しっかり診断').closest('button')!);
    expect(store().phase).toBe('input');
    expect(container.textContent).not.toContain(ja.top.detailsToggle);
    expect(container.textContent).not.toContain(ja.top.cautionsHeading);
    expect(container.textContent).not.toContain(ja.top.relatedHeading);
  });

  it('does not show the legacy short disclaimer one-liner on the top screen (replaced by the formal 注意点 section)', () => {
    const { container } = render(<App />);
    // 旧 .top-disclaimer の短文は出さない（B. 注意点が本文をフルで担当するため）
    expect(container.querySelector('.top-disclaimer')).toBeNull();
  });
});
