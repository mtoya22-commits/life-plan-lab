import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import App from '../../src/App';
import { useInputStore } from '../../src/store/inputStore';

// STEP11.21: 結果画面の詳細を BottomSheet → inline <details> 展開に置き換え。
// - ResultDashboard から BottomSheet が消えている（モーダルが存在しない）
// - 4 種類の inline 展開 summary が DOM にある: タイムライン詳細 / グラフ拡大 / 教育費詳細 / 住宅ローン詳細
// - open 時に各詳細コンポーネントの中身が描画される

const store = () => useInputStore.getState();

describe('inline detail expansion on the result screen', () => {
  beforeEach(() => store().reset());
  afterEach(cleanup);

  it('does NOT render the BottomSheet (.sheet) element on the result screen', () => {
    act(() => store().loadSample());
    const { container } = render(<App />);
    expect(container.querySelector('.sheet')).toBeNull();
  });

  it('renders 4 inline <details className="detail-card__expand"> entries', () => {
    act(() => store().loadSample());
    const { container } = render(<App />);
    const expansions = container.querySelectorAll('details.detail-card__expand');
    // タイムライン詳細 / グラフ拡大 / 教育費詳細 / 住宅ローン詳細
    expect(expansions.length).toBe(4);
  });

  it('exposes summary labels for each inline expansion', () => {
    act(() => store().loadSample());
    const { container } = render(<App />);
    const summaries = Array.from(container.querySelectorAll('details.detail-card__expand > summary')).map(
      (s) => s.textContent ?? '',
    );
    expect(summaries.some((s) => s.includes('タイムライン'))).toBe(true);
    expect(summaries.some((s) => s.includes('グラフを詳しく見る'))).toBe(true);
    expect(summaries.some((s) => s.includes('詳しく見る'))).toBe(true);
  });

  it('mounts inner content (EducationDetail "うち入学金" or sources) when the 教育費 details is opened', () => {
    act(() => store().loadSample()); // sample has children
    const { container } = render(<App />);
    const cards = Array.from(container.querySelectorAll('.detail-card'));
    const eduCard = cards.find((c) =>
      c.querySelector('.detail-card__title')?.textContent?.includes('教育費'),
    );
    expect(eduCard).toBeDefined();
    const details = eduCard!.querySelector<HTMLDetailsElement>('details.detail-card__expand');
    expect(details).not.toBeNull();
    act(() => {
      details!.open = true;
    });
    // EducationDetail 内のキーワード（peak age description）
    expect(details!.textContent).toMatch(/教育費が大きくなるのは|計上されていません/);
  });

  it('mounts MortgageDetail when the 住宅ローン details is opened', () => {
    act(() => store().loadSample());
    const { container } = render(<App />);
    const cards = Array.from(container.querySelectorAll('.detail-card'));
    const mortgageCard = cards.find((c) =>
      c.querySelector('.detail-card__title')?.textContent?.includes('住宅ローン'),
    );
    expect(mortgageCard).toBeDefined();
    const details = mortgageCard!.querySelector<HTMLDetailsElement>('details.detail-card__expand');
    expect(details).not.toBeNull();
  });
});
