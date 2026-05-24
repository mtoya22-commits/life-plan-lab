import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../../src/App';
import { useInputStore } from '../../src/store/inputStore';

// 実DOM(jsdom)で App が例外なくマウントでき、主要UIが描画されることを確認する。
const store = () => useInputStore.getState();

function findDetailsBySummary(container: HTMLElement, text: string): HTMLDetailsElement | undefined {
  return Array.from(container.querySelectorAll<HTMLDetailsElement>('details.collapsible')).find((d) =>
    d.querySelector('summary')?.textContent?.includes(text),
  );
}

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

  it('top screen shows the life-dashboard framing and mode card details', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.top-hero')).not.toBeNull();
    expect(container.textContent).toContain('生活設計ダッシュボード'); // eyebrow
    expect(container.textContent).toContain('まずは、見たい詳しさを選んでください'); // 柔らかい見出し
    expect(container.textContent).toContain('30〜60秒'); // ざっくりの目安時間
    expect(container.textContent).toContain('約5〜8分'); // しっかりの目安時間
    expect(container.querySelectorAll('.mode-card').length).toBe(2);
  });

  it('starts the rough flow from its mode card', () => {
    render(<App />);
    fireEvent.click(screen.getByText('ざっくり診断').closest('button')!);
    expect(store().mode).toBe('rough');
    expect(store().phase).toBe('input');
  });

  it('starts the thorough flow from its mode card', () => {
    render(<App />);
    fireEvent.click(screen.getByText('しっかり診断').closest('button')!);
    expect(store().mode).toBe('thorough');
    expect(store().phase).toBe('input');
  });

  it('keeps dev sample links tucked into a collapsed dev menu (DEV only)', () => {
    const { container } = render(<App />);
    const dev = Array.from(container.querySelectorAll<HTMLDetailsElement>('details.collapsible')).find((d) =>
      d.querySelector('summary')?.textContent?.includes('開発用メニュー'),
    );
    expect(dev).toBeDefined();
    expect(dev!.open).toBe(false); // 初期は閉じている＝世界観を壊さない
    expect(dev!.querySelectorAll('.dev-sample').length).toBeGreaterThan(0);
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
    expect(container.textContent).toContain('未入力で進む'); // 任意項目の「未入力で進む」（旧スキップ）
    expect(container.querySelector('.help')).not.toBeNull(); // Help（？）
    expect(container.querySelector('.bottom-nav')).not.toBeNull();
    expect(container.textContent).toContain('分かる範囲で大丈夫です'); // 冒頭の安心感
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

  it('thorough result shows page-level edit links and hides the deepen link', () => {
    store().loadThoroughSample(true);
    const { container } = render(<App />);
    expect(container.textContent).toContain('条件を変えてみる');
    // ページ単位の導線（特定ステップへ直接戻れる）
    expect(container.textContent).toContain('収入');
    expect(container.textContent).toContain('老後');
    expect(container.textContent).toContain('投資（インフレ・現金）');
    expect(container.textContent).toContain('ライフイベント');
    // しっかり診断の結果では「もっと正確に見る」は出さない
    expect(container.textContent).not.toContain('しっかり診断で詳しく見る');
  });

  it('risk factors and edit links are collapsed by default and openable', () => {
    store().loadThoroughSample(true);
    const { container } = render(<App />);
    const risk = findDetailsBySummary(container, '見直しが効きやすいポイントを見る');
    const edit = findDetailsBySummary(container, '条件を変えてみる');
    expect(risk).toBeDefined();
    expect(edit).toBeDefined();
    // 初期状態は閉じている
    expect(risk!.open).toBe(false);
    expect(edit!.open).toBe(false);
    // 開閉インジケータ（矢印）と件数が出る
    expect(risk!.querySelector('summary')!.textContent).toMatch(/（\d+件）/);
    // 開くと詳細（修正ボタン・項目）が利用できる
    edit!.open = true;
    expect(edit!.querySelectorAll('.edit-link').length).toBeGreaterThan(0);
    risk!.open = true;
    expect(risk!.querySelectorAll('.risk-factor').length).toBeGreaterThan(0);
  });

  it('edit buttons still navigate to the matching step after collapsing', () => {
    store().loadThoroughSample(true);
    const { container } = render(<App />);
    const edit = findDetailsBySummary(container, '条件を変えてみる')!;
    edit.open = true;
    const pensionBtn = Array.from(edit.querySelectorAll<HTMLButtonElement>('.edit-link')).find(
      (b) => b.textContent === '老後',
    )!;
    fireEvent.click(pensionBtn);
    expect(store().phase).toBe('input');
    expect(store().cameFromResult).toBe(true);
    expect(store().thoroughPageId).toBe('retirement-1');
  });

  it('scrolls to the top of the result screen on submit and on recompute (rough & thorough)', () => {
    const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    // ざっくり: 入力完了 → 結果は最上部から（behavior:auto で確実に先頭へ）
    fillAll();
    store().submitRough();
    render(<App />);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ top: 0, behavior: 'auto' }));
    cleanup();

    // しっかり: サンプルで結果へ → 最上部
    spy.mockClear();
    store().loadThoroughSample(true);
    render(<App />);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ top: 0, behavior: 'auto' }));
    cleanup();

    // 結果から編集 → 再計算して戻る → 再び最上部（calculatedAt 更新で発火）
    spy.mockClear();
    store().editThoroughPage('retirement-1');
    store().setThoroughValue('retirement.pension', 300);
    store().submitThorough();
    render(<App />);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ top: 0, behavior: 'auto' }));

    spy.mockRestore();
  });

  it('rough result keeps risk/edit collapsible and the deepen link visible', () => {
    store().loadHighIncomeSample(0);
    const { container } = render(<App />);
    expect(findDetailsBySummary(container, '条件を変えてみる')).toBeDefined();
    expect(container.textContent).toContain('しっかり診断で詳しく見る');
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

  it('shows the life-phase outlook card with phase and next milestone', () => {
    store().loadThoroughSample(true);
    const { container } = render(<App />);
    // 自分専用感の見出し
    expect(container.textContent).toContain('あなたの人生ダッシュボード');
    // 人生フェーズ
    const outlook = container.querySelector('.outlook');
    expect(outlook).not.toBeNull();
    expect(outlook!.querySelector('.outlook__phase-label')!.textContent).toMatch(/期$/);
    // 次の節目（煽らない静かな見出し）
    expect(container.textContent).toContain('次に確認したい節目');
    expect(container.textContent).toContain('次の大きな節目は');
  });

  it('emphasizes end-in-sight info: education peak and mortgage payoff', () => {
    store().loadThoroughSample(true);
    const { container } = render(<App />);
    const seeahead = container.querySelector('.outlook__seeahead')!;
    expect(seeahead).not.toBeNull();
    expect(seeahead.textContent).toContain('教育費');
    expect(seeahead.textContent).toContain('ピーク');
    expect(seeahead.textContent).toContain('住宅ローン');
    expect(seeahead.textContent).toContain('完済');
  });

  it('shows the main always-visible cards in both rough and thorough', () => {
    fillAll();
    store().submitRough();
    let r = render(<App />);
    expect(r.container.querySelector('.hero')).not.toBeNull();
    expect(r.container.querySelector('.outlook')).not.toBeNull();
    expect(r.container.textContent).toContain('資産推移');
    expect(r.container.textContent).toContain('住宅ローン');
    cleanup();

    store().loadThoroughSample(true);
    r = render(<App />);
    expect(r.container.querySelector('.hero')).not.toBeNull();
    expect(r.container.querySelector('.outlook')).not.toBeNull();
    expect(r.container.textContent).toContain('資産推移');
  });

  it('renders structured risk factors (title + decomposed points) inside the collapsible', () => {
    store().loadThoroughSample(true);
    const { container } = render(<App />);
    const risk = findDetailsBySummary(container, '見直しが効きやすいポイントを見る')!;
    risk.open = true;
    const items = risk.querySelectorAll('.risk-factor');
    expect(items.length).toBeGreaterThan(0);
    // 各ポイントが見出し＋分解された箇条書きを持つ
    expect(items[0].querySelector('.risk-factor__title')!.textContent!.length).toBeGreaterThan(0);
    expect(items[0].querySelectorAll('.risk-factor__points li').length).toBeGreaterThan(0);
  });

  it('opens the expanded asset chart in a bottom sheet (lazy-loaded)', async () => {
    fillAll();
    store().submitRough();
    render(<App />);
    fireEvent.click(screen.getByText(/グラフを拡大/));
    expect(document.querySelector('.sheet')).not.toBeNull();
    // Recharts は遅延読み込みのため、解決を待ってから内容を確認する
    const note = await screen.findByText(/縦軸：資産/);
    expect(document.querySelector('.sheet .asset-rc')).not.toBeNull();
    // 将来額と現在価値の両方を扱う旨が示される
    expect(note.textContent).toContain('将来額');
    expect(note.textContent).toContain('現在価値');
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
