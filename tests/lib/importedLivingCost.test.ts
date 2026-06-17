import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  monthlyYenToMan,
  readImportedLivingCost,
} from '../../src/lib/importedLivingCost';

// 生活費見直しシミュレーター（別アプリ）からの取り込み値パーサーの単体テスト。
// jsdom 上で URL と localStorage を都度差し替えて、優先順位・正規化・防御性を確認する。

function setUrl(search: string): void {
  window.history.replaceState({}, '', search ? `/?${search}` : '/');
}

describe('monthlyYenToMan', () => {
  it('converts yen/month to 万円/month with 1 decimal place', () => {
    expect(monthlyYenToMan(297000)).toBe(29.7);
    expect(monthlyYenToMan(280000)).toBe(28);
    expect(monthlyYenToMan(299500)).toBe(30); // 29.95 → 30.0 に丸める
    expect(monthlyYenToMan(0)).toBe(0);
  });
});

describe('readImportedLivingCost', () => {
  beforeEach(() => {
    setUrl('');
    localStorage.clear();
  });
  afterEach(() => {
    setUrl('');
    localStorage.clear();
  });

  it('reads URL params with all three known sources', () => {
    setUrl('livingCostMonthly=297000&livingCostSource=categoryScenario');
    expect(readImportedLivingCost()).toEqual({
      monthlyYen: 297000,
      source: 'categoryScenario',
      origin: 'url',
    });
  });

  it('treats unknown source string as "unknown" but still imports the value', () => {
    setUrl('livingCostMonthly=297000&livingCostSource=foo');
    expect(readImportedLivingCost()).toEqual({
      monthlyYen: 297000,
      source: 'unknown',
      origin: 'url',
    });
  });

  it('treats missing source as "unknown"', () => {
    setUrl('livingCostMonthly=297000');
    expect(readImportedLivingCost()).toEqual({
      monthlyYen: 297000,
      source: 'unknown',
      origin: 'url',
    });
  });

  it('maps legacy adjustedMonthlyTotal to quickAdjust', () => {
    setUrl('livingCostMonthly=297000&livingCostSource=adjustedMonthlyTotal');
    expect(readImportedLivingCost()).toEqual({
      monthlyYen: 297000,
      source: 'quickAdjust',
      origin: 'url',
    });
  });

  it('ignores invalid URL monthly values (NaN / 0 / negative) and falls back to localStorage', () => {
    localStorage.setItem(
      'lifePlanLab:livingCost',
      JSON.stringify({ selectedMonthlyTotal: 280000, selectedMonthlySource: 'breakdownTotal' }),
    );
    for (const bad of ['abc', '0', '-1', '']) {
      setUrl(`livingCostMonthly=${bad}`);
      expect(readImportedLivingCost()).toEqual({
        monthlyYen: 280000,
        source: 'breakdownTotal',
        origin: 'localStorage',
      });
    }
  });

  it('URL takes priority over localStorage when both are present', () => {
    localStorage.setItem(
      'lifePlanLab:livingCost',
      JSON.stringify({ selectedMonthlyTotal: 200000, selectedMonthlySource: 'breakdownTotal' }),
    );
    setUrl('livingCostMonthly=297000&livingCostSource=categoryScenario');
    expect(readImportedLivingCost()).toEqual({
      monthlyYen: 297000,
      source: 'categoryScenario',
      origin: 'url',
    });
  });

  it('reads localStorage when URL is absent', () => {
    localStorage.setItem(
      'lifePlanLab:livingCost',
      JSON.stringify({ selectedMonthlyTotal: 280000, selectedMonthlySource: 'quickAdjust' }),
    );
    expect(readImportedLivingCost()).toEqual({
      monthlyYen: 280000,
      source: 'quickAdjust',
      origin: 'localStorage',
    });
  });

  it('returns null when localStorage payload has invalid monthly value', () => {
    localStorage.setItem(
      'lifePlanLab:livingCost',
      JSON.stringify({ selectedMonthlyTotal: 'not a number', selectedMonthlySource: 'breakdownTotal' }),
    );
    expect(readImportedLivingCost()).toBeNull();
  });

  it('returns null when localStorage payload is malformed JSON', () => {
    localStorage.setItem('lifePlanLab:livingCost', 'not json');
    expect(readImportedLivingCost()).toBeNull();
  });

  it('returns null when neither URL nor localStorage is set', () => {
    expect(readImportedLivingCost()).toBeNull();
  });

  it('localStorage payload accepts unknown source but still imports the value', () => {
    localStorage.setItem(
      'lifePlanLab:livingCost',
      JSON.stringify({ selectedMonthlyTotal: 280000, selectedMonthlySource: 'mystery' }),
    );
    expect(readImportedLivingCost()).toEqual({
      monthlyYen: 280000,
      source: 'unknown',
      origin: 'localStorage',
    });
  });
});
