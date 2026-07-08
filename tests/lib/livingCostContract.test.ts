import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readImportedLivingCost } from '../../src/lib/importedLivingCost';
import { useInputStore } from '../../src/store/inputStore';

// 生活費見直しシミュレーターとの送受信契約テスト（受信側）。
// tests/fixtures/contracts/livingCostPayload.v1.json は、生活費Simリポの
// tests/fixtures/livingCostPayload.v1.json と**バイト単位で同一**の契約ファイルで、
// Sim の buildStoragePayload が実際に保存するネスト形 JSON をそのまま凍結したもの。
// Sim 側は「生成物＝フィクスチャ」を、本テストは「フィクスチャを読める」ことを固定する。
// 片側テストだけでは検出できなかった「ネスト保存 vs フラット読取」の不一致の再発防止。
// フィクスチャ変更時は、送信側（Sim の生成テスト）・本テスト・両フィクスチャを
// 同じ変更単位で更新すること（sha256sum で一致確認）。

const KEY = 'lifePlanLab:livingCost';
const nestedFixture = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/contracts/livingCostPayload.v1.json'),
  'utf8',
);
// 旧フラット形。**本番の localStorage に実在したかは未確認**（総合版の旧読取実装と
// 既存テストが前提にしていた形）。互換フォールバックの維持確認用として凍結する。
const legacyFlatFixture = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/contracts/livingCostPayload.v1-legacy-flat.json'),
  'utf8',
);

function setUrl(search: string): void {
  window.history.replaceState({}, '', search ? `/?${search}` : '/');
}

describe('livingCostPayload 契約（受信側）', () => {
  beforeEach(() => {
    setUrl('');
    localStorage.clear();
  });
  afterEach(() => {
    setUrl('');
    localStorage.clear();
  });

  it('現行ネスト形フィクスチャ（Sim の実保存バイト列）をそのまま読める', () => {
    localStorage.setItem(KEY, nestedFixture);
    expect(readImportedLivingCost()).toEqual({
      monthlyYen: 195000, // livingCost.selectedMonthlyTotal
      source: 'quickAdjust', // livingCost.selectedMonthlySource
      origin: 'localStorage',
    });
  });

  it('旧フラット形（実在未確認・互換維持）も読め、旧 source 名も正規化される', () => {
    localStorage.setItem(KEY, legacyFlatFixture);
    expect(readImportedLivingCost()).toEqual({
      monthlyYen: 280000,
      source: 'quickAdjust', // adjustedMonthlyTotal → quickAdjust の既存正規化を維持
      origin: 'localStorage',
    });
  });

  it('URL パラメータはネスト形 localStorage より優先される', () => {
    localStorage.setItem(KEY, nestedFixture);
    setUrl('livingCostMonthly=297000&livingCostSource=categoryScenario');
    expect(readImportedLivingCost()).toEqual({
      monthlyYen: 297000,
      source: 'categoryScenario',
      origin: 'url',
    });
  });

  it('URL の月額が不正ならネスト形 localStorage へフォールバックする', () => {
    localStorage.setItem(KEY, nestedFixture);
    setUrl('livingCostMonthly=abc');
    expect(readImportedLivingCost()).toEqual({
      monthlyYen: 195000,
      source: 'quickAdjust',
      origin: 'localStorage',
    });
  });

  it('ネスト形の selectedMonthlyTotal が不正（0・負・非数）なら null', () => {
    for (const bad of [0, -1, 'abc', null]) {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          version: 1,
          source: 'living-cost-simulator',
          livingCost: { selectedMonthlyTotal: bad, selectedMonthlySource: 'breakdownTotal' },
        }),
      );
      expect(readImportedLivingCost()).toBeNull();
    }
  });

  it('livingCost が配列・文字列など非オブジェクトでフラット側にも値が無ければ null', () => {
    for (const nested of [[], 'x', 42]) {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, livingCost: nested }));
      expect(readImportedLivingCost()).toBeNull();
    }
  });

  it('壊れた JSON・非オブジェクトは null（既存の防御性を維持）', () => {
    localStorage.setItem(KEY, 'not json');
    expect(readImportedLivingCost()).toBeNull();
    localStorage.setItem(KEY, JSON.stringify(null));
    expect(readImportedLivingCost()).toBeNull();
  });
});

describe('livingCostPayload 契約（store 反映・手動編集保護）', () => {
  const store = () => useInputStore.getState();

  function clearImports(): void {
    useInputStore.setState({
      importedLivingCost: null,
      livingCostManuallyEdited: false,
      importedMortgage: null,
      mortgageManuallyEdited: false,
    });
  }

  beforeEach(() => {
    setUrl('');
    localStorage.clear();
    store().reset();
    clearImports();
  });
  afterEach(() => {
    setUrl('');
    localStorage.clear();
    clearImports();
  });

  it('ネスト形フィクスチャが起動時取り込みで「毎月の生活費」に反映される（19.5万円/月）', () => {
    localStorage.setItem(KEY, nestedFixture);
    store().initializeImportedLivingCost();
    expect(store().importedLivingCost).toEqual({
      monthlyYen: 195000,
      source: 'quickAdjust',
      origin: 'localStorage',
    });
    expect(store().roughDraft.monthlyLiving).toEqual({ value: 19.5, source: 'user_input' });
  });

  it('手動編集済みならネスト形 localStorage で自動上書きしない（保護維持）', () => {
    store().setRoughValue('monthlyLiving', 30); // user_input + livingCostManuallyEdited=true
    expect(store().livingCostManuallyEdited).toBe(true);

    localStorage.setItem(KEY, nestedFixture);
    store().initializeImportedLivingCost();

    expect(store().roughDraft.monthlyLiving).toEqual({ value: 30, source: 'user_input' });
    // 取り込みメタは保持される（バナー表示用）
    expect(store().importedLivingCost?.monthlyYen).toBe(195000);
  });

  it('URL 起動はネスト形 localStorage より優先で強制適用される', () => {
    store().setRoughValue('monthlyLiving', 30);
    localStorage.setItem(KEY, nestedFixture);
    setUrl('livingCostMonthly=297000&livingCostSource=categoryScenario');
    store().initializeImportedLivingCost();

    expect(store().roughDraft.monthlyLiving).toEqual({ value: 29.7, source: 'user_input' });
    expect(store().livingCostManuallyEdited).toBe(false);
  });
});
