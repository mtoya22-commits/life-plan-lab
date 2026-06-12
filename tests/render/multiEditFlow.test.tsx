import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../../src/App';
import { useInputStore } from '../../src/store/inputStore';
import { THOROUGH_PAGES } from '../../src/schema/thoroughSteps';

// STEP11.13: 結果画面からの「続けて変更」導線と、現役継続モードでの整合性のテスト。

const store = () => useInputStore.getState();

function getEditDetails(container: HTMLElement): HTMLDetailsElement | null {
  return Array.from(container.querySelectorAll<HTMLDetailsElement>('details.collapsible')).find(
    (d) => d.querySelector('summary')?.textContent?.includes('条件を変えてみる'),
  ) ?? null;
}

describe('result → multi-edit → continue (rough)', () => {
  beforeEach(() => store().reset());
  afterEach(cleanup);

  it('exposes 続けて変更 in cameFromResult mode, hidden during the normal flow', () => {
    store().setMode('rough');
    // 通常モード（cameFromResult=false）には「続けて変更」は出ない
    render(<App />);
    expect(screen.queryByText('続けて変更')).toBeNull();

    cleanup();

    // ざっくり用のサンプル結果を作って結果画面へ
    act(() => store().loadSample());
    act(() => store().editCategory('basic'));
    render(<App />);
    // cameFromResult モード → 「続けて変更」「再計算して結果へ」「結果へ戻る」が並ぶ
    expect(screen.getByText('続けて変更')).toBeTruthy();
    expect(screen.getByText('再計算して結果へ')).toBeTruthy();
    expect(screen.getByText('結果へ戻る')).toBeTruthy();
  });

  it('submitRoughAndContinue returns to result with resultReturnTarget="adjust"', () => {
    act(() => store().loadSample());
    act(() => store().editCategory('basic'));
    expect(store().phase).toBe('input');

    act(() => store().submitRoughAndContinue());
    expect(store().phase).toBe('result');
    expect(store().resultReturnTarget).toBe('adjust');
  });

  it('regular submitRough sets resultReturnTarget="top"', () => {
    act(() => store().loadSample());
    act(() => store().editCategory('basic'));
    act(() => store().submitRough());
    expect(store().phase).toBe('result');
    expect(store().resultReturnTarget).toBe('top');
  });

  it('result dashboard consumes resultReturnTarget="adjust" by opening the edit details and clearing the target', () => {
    act(() => store().loadSample());
    act(() => store().editCategory('basic'));
    // 既に手元では adjust に向かわせる
    act(() => store().submitRoughAndContinue());
    const { container } = render(<App />);
    const details = getEditDetails(container);
    expect(details).not.toBeNull();
    expect(details!.open).toBe(true);
    // 副作用で target はクリアされる
    expect(store().resultReturnTarget).toBeNull();
  });

  it('result dashboard does NOT open the edit details when target is "top"', () => {
    act(() => store().loadSample());
    act(() => store().editCategory('basic'));
    act(() => store().submitRough()); // 通常パス → 'top'
    const { container } = render(<App />);
    const details = getEditDetails(container);
    expect(details).not.toBeNull();
    expect(details!.open).toBe(false); // 開かない
    expect(store().resultReturnTarget).toBeNull();
  });

  it('clicking 続けて変更 in the input nav returns to result with the edit details opened', () => {
    act(() => store().loadSample());
    act(() => store().editCategory('basic'));
    const { container } = render(<App />);
    fireEvent.click(screen.getByText('続けて変更'));
    // 結果画面に戻り、副作用で「条件を変えてみる」が開いた状態になる。
    // target はその副作用後にクリアされるので、可視状態のほうをアサートする。
    expect(store().phase).toBe('result');
    const details = getEditDetails(container);
    expect(details).not.toBeNull();
    expect(details!.open).toBe(true);
  });
});

describe('現役継続: edit-from-result integrity (thorough)', () => {
  afterEach(cleanup);

  it('thorough edit targets do NOT include the FIRE-後 step when fire.type === "none"', () => {
    act(() => store().loadThoroughSample(true));
    // 'none' に切り替えて再計算
    const ti = store().thoroughInput!;
    ti.fire.type.value = 'none';
    act(() => store().submitThorough());
    const { container } = render(<App />);
    const details = getEditDetails(container);
    expect(details).not.toBeNull();
    details!.open = true;
    // 編集導線には FIRE-2（「FIRE後の暮らし」）は出ない
    const labels = Array.from(details!.querySelectorAll<HTMLButtonElement>('.edit-link')).map((b) => b.textContent ?? '');
    expect(labels.find((l) => l.includes('FIRE後の暮らし'))).toBeUndefined();
    // 働き方の方針ステップは出る
    expect(labels.find((l) => l.includes('働き方の方針'))).toBeDefined();
  });

  it('exposes "退職後の生活費" question only when fire.type==="none" AND income.retirementAge < 65', () => {
    const fire1 = THOROUGH_PAGES.find((p) => p.pageId === 'fire-1')!;
    const bridgeQ = fire1.questions!.find(
      (q) => q.path === 'fire.postFireLiving' && /退職後の(毎月)?生活費/.test(q.label),
    );
    expect(bridgeQ).toBeDefined();

    // 比較用の仮 input
    act(() => store().loadThoroughSample(false));
    const ti = store().thoroughInput!;

    // 現役継続 & 早期退職 → 表示
    ti.fire.type.value = 'none';
    ti.income.retirementAge.value = 60;
    expect(bridgeQ!.showIf!(ti)).toBe(true);

    // 現役継続 & 65歳退職 → 非表示（ブリッジ不要）
    ti.income.retirementAge.value = 65;
    expect(bridgeQ!.showIf!(ti)).toBe(false);

    // 完全FIRE → 非表示（FIRE 後の質問は別ページにある）
    ti.fire.type.value = 'full';
    ti.income.retirementAge.value = 60;
    expect(bridgeQ!.showIf!(ti)).toBe(false);
  });
});
