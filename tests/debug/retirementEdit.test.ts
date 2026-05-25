import { describe, expect, it, beforeEach } from 'vitest';
import { useInputStore } from '../../src/store/inputStore';

const store = () => useInputStore.getState();

// 実機の「結果→老後を修正→再計算」フローを store レベルで再現する。
describe('repro: edit retirement -> recompute', () => {
  beforeEach(() => store().reset());

  it('changing pension & retirement living updates the result', () => {
    store().loadThoroughSample(true); // しっかり診断サンプルで結果まで
    const before = store().result!;
    const beforeLongevity = before.indicators.assetLongevityAge;
    const beforeShortfall = before.indicators.cumulativeShortfall;
    const before66Pension = before.rows.find((r) => r.age === 66)!.income.pension;

    store().editThoroughStep('detailed-retirement');
    store().setThoroughValue('retirement.pension', 500);
    store().setThoroughValue('retirement.retirementLiving', 240);
    store().submitThorough();

    const after = store().result!;
    const after66Pension = after.rows.find((r) => r.age === 66)!.income.pension;
    const after66Living = after.rows.find((r) => r.age === 66)!.expense.living;

    // eslint-disable-next-line no-console
    console.log('REPRO', {
      beforeLongevity,
      afterLongevity: after.indicators.assetLongevityAge,
      beforeShortfall: Math.round(beforeShortfall),
      afterShortfall: Math.round(after.indicators.cumulativeShortfall),
      before66Pension,
      after66Pension,
      after66Living: Math.round(after66Living),
      thoroughPension: store().thoroughInput!.retirement.pension.value,
      thoroughPensionSource: store().thoroughInput!.retirement.pension.source,
      inputPension: store().input!.retirement.pension.value,
    });

    // 年金は現在価値入力をインフレ補正するため、66歳の名目額は500より大きい。
    expect(after66Pension).toBeGreaterThan(500);
  });
});
