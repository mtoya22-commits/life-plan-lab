import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../../src/App';
import { useInputStore } from '../../src/store/inputStore';

// STEP11.6: 入力ステップで未入力項目の見落としを防ぐソフト案内のテスト。
// - 下部ナビに「このステップ：X/Y 項目入力済み」を常時表示する
// - 未入力のまま「次へ」を押すと、すぐ進まずに軽い確認パネルを出す
// - 「未入力項目を見る」/「このまま次へ」の二択で進路を選ばせる
// - per-item の「未入力で進む」ボタンを押した項目は入力済み扱いになる

const store = () => useInputStore.getState();

describe('oversight prevention: rough flow', () => {
  beforeEach(() => {
    store().reset();
    store().setMode('rough');
  });
  afterEach(cleanup);

  it('shows a step status with "0/3 項目入力済み" and the soft hint when nothing is entered', () => {
    render(<App />);
    // 「あなたについて」ステップは age / householdIncome / currentAssets の 3 項目
    expect(screen.getByText(/このステップ：0\/3項目入力済み/)).toBeTruthy();
    expect(screen.getByText(/未入力でも次へ進めます/)).toBeTruthy();
  });

  it('counts answered items as the user fills them', () => {
    render(<App />);
    act(() => {
      store().setRoughValue('age', 38);
      store().setRoughValue('householdIncome', 800);
    });
    expect(screen.getByText(/このステップ：2\/3項目入力済み/)).toBeTruthy();
    // まだ未入力があるので「未入力でも次へ進めます」が付く
    expect(screen.getByText(/未入力でも次へ進めます/)).toBeTruthy();
  });

  it('shows the confirm panel and does NOT advance when "次へ" is pressed with incomplete items', () => {
    render(<App />);
    const before = store().roughPage;
    fireEvent.click(screen.getByText('次へ'));
    // 確認パネル
    expect(screen.getByText('未入力の項目があります。未入力のまま次へ進みますか？')).toBeTruthy();
    expect(screen.getByText('未入力項目を見る')).toBeTruthy();
    expect(screen.getByText('このまま次へ')).toBeTruthy();
    // ページは進んでいない
    expect(store().roughPage).toBe(before);
  });

  it('"このまま次へ" advances normally and does not mutate unanswered items', () => {
    render(<App />);
    fireEvent.click(screen.getByText('次へ')); // 確認パネルを出す
    const before = store().roughPage;
    fireEvent.click(screen.getByText('このまま次へ'));
    // ページが進む
    expect(store().roughPage).toBe(before + 1);
    // 「次へ」で未入力にしていた項目は仕様 #4 で状態変更しない（source が default のまま）
    expect(store().roughDraft.age.source).toBe('default_value');
  });

  it('"未入力項目を見る" triggers scrollIntoView and keeps the panel open', () => {
    render(<App />);
    // jsdom では scrollIntoView は Element.prototype 上で未実装。先にスタブを置いてから spy する。
    const proto = Element.prototype as unknown as { scrollIntoView: (..._args: unknown[]) => void };
    if (typeof proto.scrollIntoView !== 'function') {
      proto.scrollIntoView = () => {};
    }
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    try {
      fireEvent.click(screen.getByText('次へ'));
      fireEvent.click(screen.getByText('未入力項目を見る'));
      expect(scrollSpy).toHaveBeenCalled();
      // パネルは残ったまま（ユーザーが項目を埋めるか「このまま次へ」を選ぶまで）
      expect(screen.getByText('未入力の項目があります。未入力のまま次へ進みますか？')).toBeTruthy();
    } finally {
      scrollSpy.mockRestore();
    }
  });

  it('counts per-item "未入力で進む" (skipped) as acknowledged, not as an oversight', () => {
    render(<App />);
    // 全 3 項目に対し、ユーザーが個別に「未入力で進む」を押した想定（store 経由で再現）
    act(() => {
      store().skipRough('age');
      store().skipRough('householdIncome');
      store().skipRough('currentAssets');
    });
    // すべて入力済み扱い → 「未入力でも...」のソフト案内は消える
    expect(screen.getByText(/このステップ：3\/3項目入力済み/)).toBeTruthy();
    expect(screen.queryByText(/未入力でも次へ進めます/)).toBeNull();
    // 「次へ」で確認パネルを経由せずに進む
    const before = store().roughPage;
    fireEvent.click(screen.getByText('次へ'));
    expect(store().roughPage).toBe(before + 1);
    expect(screen.queryByText('未入力の項目があります。未入力のまま次へ進みますか？')).toBeNull();
  });
});

describe('oversight prevention: thorough flow (fields page)', () => {
  beforeEach(() => {
    store().reset();
    store().setMode('thorough');
  });
  afterEach(cleanup);

  it('shows a step status on the first fields page', () => {
    render(<App />);
    // 最初の「基本情報」ページの可視項目数は実装依存だが、必ず "X/Y 項目入力済み" 形式で出る
    expect(screen.getByText(/このステップ：\d+\/\d+項目入力済み/)).toBeTruthy();
  });

  it('shows confirm panel when "次へ" is pressed with default-only values', () => {
    render(<App />);
    fireEvent.click(screen.getByText('次へ'));
    expect(screen.getByText('未入力の項目があります。未入力のまま次へ進みますか？')).toBeTruthy();
    expect(screen.getByText('未入力項目を見る')).toBeTruthy();
    expect(screen.getByText('このまま次へ')).toBeTruthy();
  });
});
