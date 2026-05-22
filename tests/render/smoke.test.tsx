import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import App from '../../src/App';
import { useInputStore } from '../../src/store/inputStore';

// 実DOM(jsdom)で App が例外なくマウントでき、主要UIが描画されることを確認する。
const store = () => useInputStore.getState();

function fillAll() {
  store().setMode('rough');
  store().setRoughValue('age', 38);
  store().setRoughValue('householdIncome', 850);
  store().setRoughValue('currentAssets', 1200);
  store().setRoughValue('childrenCount', '2');
  store().setRoughValue('educationPolicy', 'public');
  store().setRoughValue('housing', 'own');
  store().setRoughValue('workStyle', 'work_a_little');
  store().setRoughValue('reduceWorkAge', 55);
  store().setRoughValue('investmentStyle', 'balanced');
}

describe('render smoke (jsdom)', () => {
  beforeEach(() => store().reset());
  afterEach(cleanup);

  it('mode select renders', () => {
    const { container } = render(<App />);
    expect(container.textContent).toContain('ざっくり診断');
    expect(container.textContent).toContain('しっかり診断');
  });

  it('rough flow renders purpose text, ETA and bottom nav', () => {
    store().setMode('rough');
    const { container } = render(<App />);
    expect(container.textContent).toContain('あなたについて');
    expect(container.textContent).toContain('現在地を確認するための情報です');
    expect(container.textContent).toContain('あと約');
    expect(container.querySelector('.bottom-nav')).not.toBeNull();
  });

  it('result dashboard renders summary, assumptions, edit links and deepen', () => {
    fillAll();
    store().submitRough();
    expect(store().phase).toBe('result');
    const { container } = render(<App />);
    expect(container.textContent).toContain('今回のポイント');
    expect(container.textContent).toContain('今回の試算条件');
    expect(container.textContent).toContain('税制は簡略化');
    expect(container.textContent).toContain('条件を変えてみる');
    expect(container.textContent).toContain('しっかり診断で詳しく見る');
  });

  it('resume overlay appears when there is saved in-progress input', () => {
    store().setMode('rough');
    store().setRoughValue('age', 40);
    // 保存されたセッションがある状態をシミュレート（resumePrompt を立てる）
    useInputStore.setState({ resumePrompt: true });
    const { container } = render(<App />);
    expect(container.textContent).toContain('前回の続きから再開しますか？');
  });
});
