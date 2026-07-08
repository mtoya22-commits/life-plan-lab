import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { HelpTooltip, bubbleShiftX } from '../../src/features/input-steps/HelpTooltip';

// STEP11.24: 長文 help が下部ナビを覆い隠す症状の対策。
// - CSS の .help__bubble に max-height / overflow-y / z-index 制限
// - 外側タップ・Escape で bubble を閉じられる
// - aria-expanded の状態が反映される

describe('HelpTooltip behavior', () => {
  afterEach(cleanup);

  it('toggles bubble visibility when the ? icon is clicked', () => {
    const { container } = render(<HelpTooltip text="サンプル説明" />);
    const icon = container.querySelector('.help__icon') as HTMLButtonElement;
    expect(icon).not.toBeNull();
    expect(container.querySelector('.help__bubble')).toBeNull();
    expect(icon.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(icon);
    expect(container.querySelector('.help__bubble')).not.toBeNull();
    expect(icon.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.help__bubble')!.textContent).toContain('サンプル説明');

    fireEvent.click(icon);
    expect(container.querySelector('.help__bubble')).toBeNull();
    expect(icon.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes the bubble when the user taps outside (pointerdown)', () => {
    const { container } = render(
      <div>
        <HelpTooltip text="外側タップで閉じる" />
        <button type="button" data-testid="outside">outside</button>
      </div>,
    );
    fireEvent.click(container.querySelector('.help__icon')!);
    expect(container.querySelector('.help__bubble')).not.toBeNull();
    // pointerdown を outside ボタンに発火
    fireEvent.pointerDown(container.querySelector('[data-testid="outside"]')!);
    expect(container.querySelector('.help__bubble')).toBeNull();
  });

  it('closes the bubble on Escape key', () => {
    const { container } = render(<HelpTooltip text="Escape で閉じる" />);
    fireEvent.click(container.querySelector('.help__icon')!);
    expect(container.querySelector('.help__bubble')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(container.querySelector('.help__bubble')).toBeNull();
  });

  it('exposes role="tooltip" on the open bubble for assistive tech', () => {
    const { container } = render(<HelpTooltip text="role tooltip" />);
    fireEvent.click(container.querySelector('.help__icon')!);
    const bubble = container.querySelector('.help__bubble');
    expect(bubble!.getAttribute('role')).toBe('tooltip');
  });
});

describe('CSS smoke: .help__bubble has the safe-area constraints', () => {
  // 文字列マッチで CSS が含むことを固定。STEP11.24 の修正が外れて長文 help が
  // 下部ナビを覆い隠す症状に戻らないようにする。
  const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
  const bubble = (() => {
    const i = css.indexOf('.help__bubble');
    if (i === -1) return '';
    const j = css.indexOf('}', i);
    return css.slice(i, j);
  })();

  it('caps the bubble height with max-height: 50dvh and overflow scroll', () => {
    expect(bubble).toContain('max-height: 50dvh');
    expect(bubble).toContain('overflow-y: auto');
  });

  it('keeps the bubble underneath the sticky bottom nav (z-index < 40)', () => {
    expect(bubble).toContain('z-index: 30');
    // .bottom-nav の z-index を別途確認（40 のまま）
    expect(css).toMatch(/\.bottom-nav\s*\{[^}]*z-index:\s*40/);
  });
});

// モバイル375px契約: bubble を画面内へ収めるシフト量の純関数テスト。
// 実レイアウト幅は jsdom で保証しない（375px は実機/ブラウザ確認）。
describe('bubbleShiftX (viewport clamp)', () => {
  it('returns 0 when the bubble fits', () => {
    expect(bubbleShiftX(100, 340, 375)).toBe(0);
  });

  it('shifts left by the right-edge overflow', () => {
    // right=400, viewport=375, margin=12 → 375-12-400 = -37
    expect(bubbleShiftX(160, 400, 375)).toBe(-37);
  });

  it('shifts right when the left edge would go past the margin', () => {
    expect(bubbleShiftX(-20, 220, 375)).toBe(32); // 12 - (-20)
  });

  it('prioritizes the left edge when the bubble is wider than the viewport', () => {
    const dx = bubbleShiftX(0, 500, 375);
    expect(0 + dx).toBe(12); // 左端は margin に固定（右は切れても左から読める）
  });

  it('respects a custom margin', () => {
    expect(bubbleShiftX(0, 380, 375, 16)).toBe(16);
  });
});
