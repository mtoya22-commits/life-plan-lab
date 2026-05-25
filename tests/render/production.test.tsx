import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import App from '../../src/App';
import { useInputStore } from '../../src/store/inputStore';

// STEP7: 公開前MVP仕上げ。開発用要素の本番非表示・免責・試算前提の明示を確認する。
const store = () => useInputStore.getState();

describe('STEP7 production readiness', () => {
  beforeEach(() => store().reset());
  afterEach(() => {
    vi.unstubAllEnvs();
    cleanup();
  });

  it('hides the dev menu when not in DEV (production build)', () => {
    vi.stubEnv('DEV', false);
    const { container } = render(<App />);
    expect(container.textContent).not.toContain('開発用メニュー');
    // 通常導線（モードカード）はもちろん残る
    expect(container.textContent).toContain('ざっくり診断');
    expect(container.textContent).toContain('しっかり診断');
  });

  it('shows the dev menu only in DEV', () => {
    vi.stubEnv('DEV', true);
    const { container } = render(<App />);
    expect(container.textContent).toContain('開発用メニュー');
  });

  it('top screen carries an intro note and a short disclaimer', () => {
    const { container } = render(<App />);
    expect(container.textContent).toContain('まずは概算で');
    expect(container.textContent).toContain('投資助言でもありません');
  });

  it('result shows the full disclaimer (no guarantee / not investment advice / consult a pro)', () => {
    store().loadThoroughSample(true);
    const { container } = render(<App />);
    expect(container.textContent).toContain('将来の結果を保証するものではなく');
    expect(container.textContent).toContain('投資判断や金融商品の推奨を行うものではありません');
    expect(container.textContent).toContain('専門家へご確認ください');
  });

  it('assumptions group the reflection handling (direct / simplified / record-only)', () => {
    store().loadThoroughSample(true);
    const { container } = render(<App />);
    expect(container.textContent).toContain('反映済み');
    expect(container.textContent).toContain('簡略反映');
    expect(container.textContent).toContain('記録用（未反映）');
    // 記録用に住宅ローンの金利/固定変動などが明示される
    expect(container.textContent).toContain('固定/変動');
    expect(container.textContent).toContain('NISA');
  });

  it('assumptions notes state the monthly-investment reflection window', () => {
    store().loadThoroughSample(true);
    const { container } = render(<App />);
    expect(container.textContent).toContain('前年まで'); // 就労を終える◯歳の前年まで
  });

  it('offers a collapsed cautious-scenario view with its premises', () => {
    store().loadThoroughSample(true);
    const { container } = render(<App />);
    const cautious = Array.from(container.querySelectorAll<HTMLDetailsElement>('details.collapsible')).find((d) =>
      d.querySelector('summary')?.textContent?.includes('慎重条件で見る'),
    );
    expect(cautious).toBeDefined();
    expect(cautious!.open).toBe(false); // 初期は閉じ（標準結果の邪魔をしない）
    expect(cautious!.textContent).toContain('標準条件');
    expect(cautious!.textContent).toContain('慎重条件');
    // 標準/慎重を同じ表現で比較（資産寿命・95歳時点・現在価値）
    expect(cautious!.textContent).toContain('資産寿命');
    expect(cautious!.textContent).toContain('95歳時点');
    expect(cautious!.textContent).toContain('現在価値');
    expect(cautious!.textContent).toContain('前提を変えた確認用');
    // 暴落との違いを明記
    expect(cautious!.textContent).toContain('暴落シナリオは一時的');
    // 枯渇ケースでも「0万円」を主表示にしない（累計不足額で示す）
    expect(cautious!.querySelector('.scenario-card__metrics dd')!.textContent).not.toBe('0万円');
  });

  it('Hero reads as a calm summary: 資産寿命 is the focus, FIRE準備率 demoted to a footnote', () => {
    store().loadThoroughSample(true);
    const { container } = render(<App />);
    const hero = container.querySelector('.hero')!;
    const primary = hero.querySelector('.hero__primary-value')!;
    expect(primary.textContent).toMatch(/歳ごろ|維持/); // 資産寿命が主役
    expect(hero.querySelector('.hero__primary-label')!.textContent).toBe('資産寿命');
    // FIRE準備率は脚注（目安）に下げる
    const foot = hero.querySelector('.hero__foot')!;
    expect(foot.textContent).toContain('FIRE準備率');
    expect(foot.textContent).toContain('目安');
    // 旧来の3指標グリッドは廃止
    expect(hero.querySelector('.hero__metrics')).toBeNull();
  });

  it('the result assumptions section is collapsed by default (lighter first view)', () => {
    store().loadThoroughSample(true);
    const { container } = render(<App />);
    const assumptions = Array.from(container.querySelectorAll<HTMLDetailsElement>('details.collapsible')).find((d) =>
      d.querySelector('summary')?.textContent?.includes('今回の試算条件'),
    );
    expect(assumptions).toBeDefined();
    expect(assumptions!.open).toBe(false);
  });
});
