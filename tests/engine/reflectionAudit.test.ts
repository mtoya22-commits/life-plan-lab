import { describe, expect, it } from 'vitest';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import { THOROUGH_PAGES } from '../../src/schema/thoroughSteps';
import { getFieldByPath } from '../../src/schema/fieldPath';
import { field } from '../../src/schema/field';
import type { ChildInput, LifeEvent, SimulationInput } from '../../src/schema/types';

// =============================================================================
// 全入力項目の反映状況監査（STEP6.2 追加確認）。
// - UIの全 fieldPath が実フィールドに解決できる
// - 主要入力を変えると結果が期待方向に動く（直接/間接/簡略反映）
// - 記録用項目を変えても結果が変わらない
// - showIf=false の値が計算に漏れない（賃貸/完全FIRE/変動金利/子0人/医療なし/イベント削除）
// =============================================================================

function child(age: number): ChildInput {
  return {
    currentAge: field(age, 'user_input', '子の年齢', '', '歳'),
    ageAssumed: false,
    middleSchool: field('public', 'user_input', '中学', ''),
    highSchool: field('public', 'user_input', '高校', ''),
    university: field('private_humanities', 'user_input', '大学', ''),
    uniLiving: field('away', 'user_input', '住まい', ''),
  };
}

// 95歳まで概ね資産が持つ「快適ケース」。assetsAt95 の増減で感度を見やすくする。
function base(): SimulationInput {
  const i = createDefaultInput('thorough');
  i.basic.age = field(40, 'user_input', '', '', '歳');
  i.basic.householdIncome = field(900, 'user_input', '', '', '万円');
  i.basic.takeHomeIncome = field(700, 'user_input', '', '', '万円');
  i.basic.currentAssets = field(5000, 'user_input', '', '', '万円');
  i.basic.cashRatio = field(20, 'user_input', '', '', '%');
  i.income.raiseRate = field(0.5, 'user_input', '', '', '%');
  i.income.retirementAge = field(65, 'user_input', '', '', '歳');
  i.income.retirementLumpSum = field(1000, 'user_input', '', '', '万円');
  i.expense.monthlyLiving = field(22, 'user_input', '', '', '万円');
  i.expense.annualSpecial = field(20, 'user_input', '', '', '万円');
  i.children = [];
  i.housing.type = field('own', 'user_input', '', '');
  i.housing.monthlyPayment = field(10, 'user_input', '', '', '万円');
  i.housing.remainingYears = field(20, 'user_input', '', '', '年');
  i.housing.balance = field(2000, 'user_input', '', '', '万円');
  i.housing.rate = field(1.0, 'user_input', '', '', '%');
  i.housing.rateType = field('fixed', 'user_input', '', '');
  i.housing.fixedEndAge = field(60, 'user_input', '', '', '歳');
  i.housing.repayMethod = field('equal_payment', 'user_input', '', '');
  i.housing.bonusAnnual = field(0, 'user_input', '', '', '万円');
  i.fire.type = field('none', 'user_input', '', '');
  i.investment.monthlyInvestment = field(10, 'user_input', '', '', '万円');
  i.investment.returnRate = field(5, 'user_input', '', '', '%');
  i.investment.inflationRate = field(2, 'user_input', '', '', '%');
  i.investment.crashScenario = field(false, 'user_input', '', '');
  i.retirement.pension = field(220, 'user_input', '', '', '万円');
  i.retirement.retirementLiving = field(240, 'user_input', '', '', '万円');
  i.retirement.medicalCareReserve = field(false, 'user_input', '', '');
  return i;
}

const run = (i: SimulationInput) => runSimulation(applyRecommendedValues(i));
const ind = (i: SimulationInput) => run(i).indicators;
/** 結果の「効いているか」を見る代表シグネチャ。 */
const sig = (i: SimulationInput) => {
  const x = ind(i);
  return `${x.assetsAt95}|${x.assetLongevityAge}|${Math.round(x.cumulativeShortfall)}`;
};

describe('reflection audit: every UI field path resolves', () => {
  it('maps every static thorough question to an existing Field', () => {
    const input = base();
    input.children = [child(10)]; // family ページは専用UIのため対象外（静的paths のみ検証）
    const missing: string[] = [];
    for (const page of THOROUGH_PAGES) {
      if (page.kind !== 'fields' || !page.questions) continue;
      for (const q of page.questions) {
        if (getFieldByPath(input, q.path) === undefined) missing.push(q.path);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('reflection audit:主要入力は期待方向に効く', () => {
  it('higher return rate → more assets at 95', () => {
    const hi = base();
    hi.investment.returnRate = field(7, 'user_input', '', '', '%');
    expect(ind(hi).assetsAt95).toBeGreaterThan(ind(base()).assetsAt95);
  });
  it('higher inflation → fewer assets at 95', () => {
    const hi = base();
    hi.investment.inflationRate = field(4, 'user_input', '', '', '%');
    expect(ind(hi).assetsAt95).toBeLessThan(ind(base()).assetsAt95);
  });
  it('more current assets → more assets at 95', () => {
    const hi = base();
    hi.basic.currentAssets = field(7000, 'user_input', '', '', '万円');
    expect(ind(hi).assetsAt95).toBeGreaterThan(ind(base()).assetsAt95);
  });
  it('higher monthly living → fewer assets at 95', () => {
    const hi = base();
    hi.expense.monthlyLiving = field(34, 'user_input', '', '', '万円');
    expect(ind(hi).assetsAt95).toBeLessThan(ind(base()).assetsAt95);
  });
  it('higher pension → more assets at 95', () => {
    const hi = base();
    hi.retirement.pension = field(320, 'user_input', '', '', '万円');
    expect(ind(hi).assetsAt95).toBeGreaterThan(ind(base()).assetsAt95);
  });
  it('higher retirement lump sum → more assets at 95', () => {
    const hi = base();
    hi.income.retirementLumpSum = field(2500, 'user_input', '', '', '万円');
    expect(ind(hi).assetsAt95).toBeGreaterThan(ind(base()).assetsAt95);
  });
  it('higher cash ratio → fewer assets at 95 (less compounding)', () => {
    const hi = base();
    hi.basic.cashRatio = field(80, 'user_input', '', '', '%');
    expect(ind(hi).assetsAt95).toBeLessThan(ind(base()).assetsAt95);
  });
  it('medical/care reserve on → fewer assets at 95', () => {
    const hi = base();
    hi.retirement.medicalCareReserve = field(true, 'user_input', '', '');
    expect(ind(hi).assetsAt95).toBeLessThan(ind(base()).assetsAt95);
  });
  it('crash scenario on → fewer assets at 95', () => {
    const hi = base();
    hi.investment.crashScenario = field(true, 'user_input', '', '');
    expect(ind(hi).assetsAt95).toBeLessThan(ind(base()).assetsAt95);
  });
  it('a spending life event → fewer assets at 95', () => {
    const hi = base();
    hi.lifeEvents = [
      {
        id: 'reform',
        label: field('リフォーム', 'user_input', '', ''),
        atAge: field(50, 'user_input', '', '', '歳'),
        amount: field(500, 'user_input', '', '', '万円'),
      } as LifeEvent,
    ];
    expect(ind(hi).assetsAt95).toBeLessThan(ind(base()).assetsAt95);
  });
  it('adding a child (education) → fewer assets at 95', () => {
    const hi = base();
    hi.children = [child(8)];
    expect(ind(hi).assetsAt95).toBeLessThan(ind(base()).assetsAt95);
  });
});

describe('reflection audit: 記録用項目は結果を変えない', () => {
  const baseSig = sig(base());
  it('mortgage rate is record-only', () => {
    const i = base();
    i.housing.rate = field(3.5, 'user_input', '', '', '%');
    expect(sig(i)).toBe(baseSig);
  });
  it('loan balance is record-only', () => {
    const i = base();
    i.housing.balance = field(4500, 'user_input', '', '', '万円');
    expect(sig(i)).toBe(baseSig);
  });
  it('repayment method is record-only', () => {
    const i = base();
    i.housing.repayMethod = field('equal_principal', 'user_input', '', '');
    expect(sig(i)).toBe(baseSig);
  });
  it('bonus payment is record-only', () => {
    const i = base();
    i.housing.bonusAnnual = field(60, 'user_input', '', '', '万円');
    expect(sig(i)).toBe(baseSig);
  });
  it('spouse age is record-only', () => {
    const i = base();
    i.basic.spouseAge = field(38, 'user_input', '', '', '歳');
    expect(sig(i)).toBe(baseSig);
  });
  it('fixed-rate-end age does not change the financial result', () => {
    const i = base();
    i.housing.fixedEndAge = field(70, 'user_input', '', '', '歳');
    expect(sig(i)).toBe(baseSig);
  });
});

describe('reflection audit: showIf=false の値が漏れない', () => {
  it('renter: monthly mortgage payment does not affect housing cost', () => {
    const rent = base();
    rent.housing.type = field('rent', 'user_input', '', '');
    rent.housing.rent = field(12, 'user_input', '', '', '万円');
    rent.housing.monthlyPayment = field(30, 'user_input', '', '', '万円'); // 効かないはず
    const r = run(rent);
    expect(r.rows.find((x) => x.age === 45)!.expense.housing).toBeCloseTo(12 * 12, 5);
    // 賃貸では住宅ローン完済イベントが出ない
    expect(r.rows.flatMap((x) => x.events).some((e) => e.kind === 'mortgage_payoff')).toBe(false);
  });

  it('full FIRE: side income does not leak into income or the FIRE-rate metric', () => {
    const full = base();
    full.fire.type = field('full', 'user_input', '', '');
    full.fire.targetAge = field(55, 'user_input', '', '', '歳');
    full.fire.postFireIncome = field(300, 'user_input', '', '', '万円'); // サイド専用、完全FIREでは効かない
    const r = run(full);
    expect(r.rows.find((x) => x.age === 56)!.income.postFire).toBe(0);
    // 完全FIREでは postFireIncome を差し引かない（同条件で side income 0 と一致）
    const full0 = base();
    full0.fire.type = field('full', 'user_input', '', '');
    full0.fire.targetAge = field(55, 'user_input', '', '', '歳');
    full0.fire.postFireIncome = field(0, 'user_input', '', '', '万円');
    expect(run(full).indicators.fireAchievementRate).toBeCloseTo(run(full0).indicators.fireAchievementRate, 6);
  });

  it('variable rate: fixed-rate-end produces no timeline marker', () => {
    const v = base();
    v.housing.rateType = field('variable', 'user_input', '', '');
    v.housing.fixedEndAge = field(58, 'user_input', '', '', '歳');
    const r = run(v);
    expect(r.rows.flatMap((x) => x.events).some((e) => e.kind === 'fixed_rate_end')).toBe(false);
  });

  it('no children: no education cost anywhere', () => {
    const r = run(base()); // children = []
    expect(r.rows.every((x) => x.expense.education === 0)).toBe(true);
  });

  it('medical reserve off: no retirement extra at 80', () => {
    const r = run(base());
    expect(r.rows.find((x) => x.age === 80)!.expense.retirementExtra).toBe(0);
  });

  it('removing a life event removes its effect', () => {
    const withEv = base();
    withEv.lifeEvents = [
      {
        id: 'car',
        label: field('車', 'user_input', '', ''),
        atAge: field(48, 'user_input', '', '', '歳'),
        amount: field(400, 'user_input', '', '', '万円'),
      } as LifeEvent,
    ];
    const removed = base();
    removed.lifeEvents = [];
    expect(sig(removed)).toBe(sig(base()));
    expect(ind(withEv).assetsAt95).toBeLessThan(ind(removed).assetsAt95);
  });
});
