import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import App from '../../src/App';
import { useInputStore } from '../../src/store/inputStore';

// iframe 埋め込み時、<html> に is-embedded が付くと CSS が単独表示時の
// inner-scroll パターン（.step-layout: 100svh + overflow:hidden、.step-content:
// overflow-y:auto、.bottom-nav: sticky）を解除する。
// jsdom は computed style の検証が限定的なため、ここではアプリの DOM 構造が
// 単独/埋め込みのどちらでも壊れていないこと（同じ siblings 構造であること）を
// 軽く確認するスモークに留める。視覚回帰は手動確認で担保する。

const store = () => useInputStore.getState();

describe('embed mode smoke', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('is-embedded');
    delete document.documentElement.dataset.embedded;
    store().reset();
  });
  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove('is-embedded');
    delete document.documentElement.dataset.embedded;
  });

  it('renders the same .step-layout > {.step-content, .bottom-nav} structure when embedded', () => {
    document.documentElement.dataset.embedded = 'true';
    document.documentElement.classList.add('is-embedded');
    store().setMode('rough');
    const { container } = render(<App />);

    const stepLayout = container.querySelector('.step-layout');
    expect(stepLayout).not.toBeNull();
    expect(stepLayout!.querySelector(':scope > .step-content')).not.toBeNull();
    expect(stepLayout!.querySelector(':scope > .bottom-nav')).not.toBeNull();

    // 埋め込み時でも .bottom-nav は .step-content の内側に入らない（CSS 上書きだけで構造は同じ）。
    expect(stepLayout!.querySelector('.step-content .bottom-nav')).toBeNull();
  });

  it('does not add is-embedded by default in jsdom (single-screen UX preserved)', () => {
    store().setMode('rough');
    render(<App />);
    // jsdom デフォルトでは window.self === window.top のため、is-embedded は付かない。
    expect(document.documentElement.classList.contains('is-embedded')).toBe(false);
    expect(document.documentElement.dataset.embedded).toBeUndefined();
  });
});
