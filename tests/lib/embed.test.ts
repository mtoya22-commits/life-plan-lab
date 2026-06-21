import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isEmbedded,
  measureContentHeight,
  postEmbeddedHeight,
  postEmbeddedScrollTop,
} from '../../src/lib/embed';

// iframe 埋め込み判定と postMessage ユーティリティの単体テスト。
// jsdom デフォルトでは window.self === window.top のため、強制的に embed を再現する補助ヘルパを使う。

function withForcedEmbed(run: () => void): void {
  const desc = Object.getOwnPropertyDescriptor(window, 'top');
  // window.top を別オブジェクトに差し替えて self !== top を成立させる。
  Object.defineProperty(window, 'top', {
    configurable: true,
    get: () => ({}) as Window,
  });
  try {
    run();
  } finally {
    if (desc) Object.defineProperty(window, 'top', desc);
    else delete (window as unknown as { top?: unknown }).top;
  }
}

describe('isEmbedded', () => {
  it('returns false in jsdom default (window.self === window.top)', () => {
    expect(isEmbedded()).toBe(false);
  });

  it('returns true when window.self !== window.top', () => {
    withForcedEmbed(() => {
      expect(isEmbedded()).toBe(true);
    });
  });
});

describe('measureContentHeight', () => {
  it('uses max of scrollHeight and rect height, plus an 8px safety margin', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'scrollHeight', { configurable: true, value: 200 });
    el.getBoundingClientRect = () => ({
      x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 180,
      toJSON() { return {}; },
    });
    expect(measureContentHeight(el)).toBe(208);
  });

  it('takes rect height when it is taller than scrollHeight', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'scrollHeight', { configurable: true, value: 180 });
    el.getBoundingClientRect = () => ({
      x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 200,
      toJSON() { return {}; },
    });
    expect(measureContentHeight(el)).toBe(208);
  });

  it('rounds up fractional rect height before adding the margin', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'scrollHeight', { configurable: true, value: 100 });
    el.getBoundingClientRect = () => ({
      x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 150.4,
      toJSON() { return {}; },
    });
    expect(measureContentHeight(el)).toBe(159); // ceil(150.4) = 151, + 8
  });
});

describe('postMessage helpers', () => {
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    spy = vi.spyOn(window.parent, 'postMessage');
  });
  afterEach(() => {
    spy.mockRestore();
  });

  it('postEmbeddedHeight is a no-op when not embedded', () => {
    postEmbeddedHeight(1234);
    expect(spy).not.toHaveBeenCalled();
  });

  it('postEmbeddedScrollTop is a no-op when not embedded', () => {
    postEmbeddedScrollTop();
    expect(spy).not.toHaveBeenCalled();
  });

  it('postEmbeddedHeight sends the right message shape when embedded', () => {
    withForcedEmbed(() => {
      postEmbeddedHeight(1234);
    });
    expect(spy).toHaveBeenCalledWith(
      { type: 'lifeplanlab:resize', source: 'life-plan-simulator', height: 1234 },
      '*',
    );
  });

  it('postEmbeddedScrollTop sends the right message shape when embedded', () => {
    withForcedEmbed(() => {
      postEmbeddedScrollTop();
    });
    expect(spy).toHaveBeenCalledWith(
      { type: 'lifeplanlab:scrollTop', source: 'life-plan-simulator' },
      '*',
    );
  });
});
