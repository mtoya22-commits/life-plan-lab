import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import App from '../../src/App';
import { useInputStore } from '../../src/store/inputStore';

// STEP8: 「おすすめ」表示の方針見直し。
// 個人差の強い項目は「例（…）を入れる」、試算用の標準値は「標準例」。
// ローン年数・FIRE年齢などを一般的なおすすめ値のように見せない。
const store = () => useInputStore.getState();

describe('STEP8 recommended-value framing', () => {
  beforeEach(() => store().reset());
  afterEach(cleanup);

  it('income step: rate uses 標準例, retirement age uses an example label (not おすすめ)', () => {
    store().setMode('thorough');
    store().setThoroughPage('income');
    const { container } = render(<App />);
    expect(container.textContent).toContain('標準例（0.5%）'); // 昇給率
    expect(container.textContent).toContain('例（65歳）を入れる'); // 退職予定年齢
    expect(container.textContent).not.toContain('おすすめ');
  });

  it('investment step: return/inflation/cash use 標準例 framing', () => {
    store().setMode('thorough');
    store().setThoroughValue('investment.crashScenario', false);
    store().setThoroughPage('investment-1');
    let r = render(<App />);
    expect(r.container.textContent).toContain('標準例（5%）');
    expect(r.container.textContent).not.toContain('おすすめ');
    cleanup();
    store().setThoroughPage('investment-2');
    r = render(<App />);
    expect(r.container.textContent).toContain('標準例（2%）');
    expect(r.container.textContent).toContain('標準例（30%）');
  });

  it('FIRE/old-age personal fields use example labels, not おすすめ', () => {
    store().setMode('thorough');
    store().setThoroughValue('fire.type', 'side');
    store().setThoroughPage('fire-2');
    const { container } = render(<App />);
    expect(container.textContent).toContain('例（100万円）を入れる'); // FIRE後収入
    expect(container.textContent).toContain('例（65歳）を入れる'); // 何歳まで働くか
    expect(container.textContent).not.toContain('おすすめ');
  });

  it('result assumptions tag reads 標準例, never おすすめ', () => {
    store().loadThoroughSample(true);
    const { container } = render(<App />);
    const recTag = Array.from(container.querySelectorAll('.tag[data-source="recommended_value"]'))[0];
    expect(recTag).toBeDefined();
    expect(recTag!.textContent).toBe('標準例');
    expect(container.textContent).not.toContain('おすすめ');
  });
});
