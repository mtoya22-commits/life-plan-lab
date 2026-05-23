import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('depleted Hero shows 資産は枯渇済み + 累計不足額 (not just 0万円)', () => {
    store().loadHighIncomeSample(0); // 年金未入力で枯渇するケース
    const { container } = render(<App />);
    expect(container.textContent).toContain('資産は枯渇済み');
    expect(container.textContent).toContain('累計不足額');
    expect(container.textContent).toContain('年金が未入力'); // 年金未入力の影響を明示
  });

  it('rough flow renders purpose text, ETA and bottom nav', () => {
    store().setMode('rough');
    const { container } = render(<App />);
    expect(container.textContent).toContain('あなたについて');
    expect(container.textContent).toContain('現在地を確認するための情報です');
    expect(container.textContent).toContain('あと約');
    expect(container.querySelector('.bottom-nav')).not.toBeNull();
  });

  it('thorough flow renders the first detailed step with help/skip and bottom nav', () => {
    store().setMode('thorough');
    const { container } = render(<App />);
    expect(container.textContent).toContain('しっかり診断');
    expect(container.textContent).toContain('本人年齢');
    expect(container.textContent).toContain('配偶者年齢');
    expect(container.textContent).toContain('世帯年収');
    expect(container.textContent).toContain('スキップ'); // 任意項目のスキップ
    expect(container.querySelector('.help')).not.toBeNull(); // Help（？）
    expect(container.querySelector('.bottom-nav')).not.toBeNull();
  });

  it('thorough family step hides per-child cards when there are 0 children', () => {
    store().setMode('thorough');
    store().setThoroughChildrenCount(0);
    store().setThoroughPage('family');
    const { container } = render(<App />);
    expect(container.textContent).toContain('お子さまの人数');
    expect(container.textContent).not.toContain('お子さま1');
  });

  it('thorough family step: university split options + unentered age label', () => {
    store().setMode('thorough');
    store().setThoroughChildrenCount(1);
    store().setThoroughPage('family');
    const { container } = render(<App />);
    expect(container.textContent).toContain('国公立文系');
    expect(container.textContent).toContain('私立理系');
    expect(container.textContent).toContain('年齢未入力'); // 仮値を確定表示しない
  });

  it('depleted asset card does not show "95歳時点 0万円" as the headline', () => {
    store().loadHighIncomeSample(0);
    const { container } = render(<App />);
    const card = Array.from(container.querySelectorAll('.detail-card')).find((el) =>
      el.textContent?.includes('資産推移'),
    );
    expect(card?.textContent).toContain('歳ごろ枯渇');
    expect(card?.textContent).not.toContain('95歳時点 0万円');
  });

  it('shows FIRE-after income only for side FIRE', () => {
    store().setMode('thorough');
    store().setThoroughValue('fire.type', 'full');
    store().setThoroughPage('fire-2');
    const full = render(<App />);
    expect(full.container.textContent).not.toContain('FIRE後収入');
    cleanup();

    store().setThoroughValue('fire.type', 'side');
    const side = render(<App />);
    expect(side.container.textContent).toContain('FIRE後収入');
  });

  it('thorough result shows all detailed edit categories', () => {
    store().loadThoroughSample(true);
    const { container } = render(<App />);
    expect(container.textContent).toContain('条件を変えてみる');
    expect(container.textContent).toContain('収入を修正');
    expect(container.textContent).toContain('老後を修正');
    expect(container.textContent).toContain('ライフイベントを修正');
  });

  it('result dashboard shows conclusions up-front and keeps details collapsed', () => {
    fillAll();
    store().submitRough();
    expect(store().phase).toBe('result');
    const { container } = render(<App />);
    // 結論は常時表示
    expect(container.textContent).toContain('今回のポイント');
    expect(container.textContent).toContain('人生の主な節目');
    expect(container.textContent).toContain('条件を変えてみる');
    expect(container.textContent).toContain('しっかり診断で詳しく見る');
    // 詳細はカード/折りたたみに（DOM上には存在する）
    expect(container.textContent).toContain('資産推移');
    expect(container.textContent).toContain('今回の試算条件を見る');
    expect(container.textContent).toContain('税制は簡略化');
    // 通常表示にコンパクトな資産推移グラフ（Recharts コンテナ）がある
    expect(container.querySelector('.asset-rc')).not.toBeNull();
  });

  it('opens the expanded asset chart in a bottom sheet (lazy-loaded)', async () => {
    fillAll();
    store().submitRough();
    render(<App />);
    fireEvent.click(screen.getByText(/グラフを拡大/));
    expect(document.querySelector('.sheet')).not.toBeNull();
    // Recharts は遅延読み込みのため、解決を待ってから内容を確認する
    await screen.findByText(/縦軸：資産/);
    expect(document.querySelector('.sheet .asset-rc')).not.toBeNull();
  });

  it('closes a bottom sheet via the close button', () => {
    fillAll();
    store().submitRough();
    render(<App />);
    fireEvent.click(screen.getByText(/タイムラインを詳しく見る/));
    expect(document.querySelector('.sheet')).not.toBeNull();
    fireEvent.click(screen.getByLabelText('閉じる'));
    expect(document.querySelector('.sheet')).toBeNull();
  });

  it('opens a bottom sheet when a detail link is tapped', () => {
    fillAll();
    store().submitRough();
    render(<App />);
    // シートは初期では閉じている
    expect(document.querySelector('.sheet')).toBeNull();
    fireEvent.click(screen.getByText(/タイムラインを詳しく見る/));
    const sheet = document.querySelector('.sheet');
    expect(sheet).not.toBeNull();
    expect(sheet?.textContent).toContain('人生タイムライン');
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
