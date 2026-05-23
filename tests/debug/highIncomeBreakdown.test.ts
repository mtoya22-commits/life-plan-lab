import { describe, expect, it } from 'vitest';
import { draftFromAnswers } from '../../src/schema/roughMapping';
import { buildFullInputFromRough } from '../../src/schema/normalize';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import type { RoughFieldId } from '../../src/schema/types';

// 実機で報告された「65歳以降の急減・80歳枯渇後に -2.3億」を再現し、年次内訳を出力する。
// 原因分析用。`npx vitest run tests/debug/highIncomeBreakdown.test.ts` で表を確認できる。
const ANSWERS: Partial<Record<RoughFieldId, string | number>> = {
  age: 38,
  householdIncome: 1200,
  currentAssets: 3200,
  monthlyLiving: 35,
  monthlyHousing: 11,
  loanYears: 30,
  childrenCount: 2,
  educationPolicy: 'some_private',
  childAge1: 4,
  childAge2: 2,
  housing: 'own',
  workStyle: 'work_a_little',
  reduceWorkAge: 55,
  postFireLiving: 30,
  sideFireIncome: 20,
  investmentStyle: 'balanced',
};

const AGES = [55, 60, 65, 68, 73, 78, 80, 83, 88, 95];

describe('debug: high income breakdown', () => {
  it('prints the yearly breakdown for the reported ages', () => {
    const input = buildFullInputFromRough(draftFromAnswers(ANSWERS));
    const result = runSimulation(input);
    const r = (n: number) => Math.round(n);

    const lines = AGES.map((age) => {
      const row = result.rows.find((x) => x.age === age)!;
      const d = row.debug!;
      return [
        `age=${row.age}`,
        `year=${row.year}`,
        `display=${r(d.displayTotalAssets)}`,
        `shortfall=${r(d.cumulativeShortfall)}`,
        `cash=${r(d.cashAssets)}`,
        `invest=${r(d.investmentAssets)}`,
        `invReturn=${r(row.investmentReturn)}`,
        `labor=${r(row.income.labor)}`,
        `side=${r(row.income.postFire)}`,
        `pension=${r(row.income.pension)}`,
        `retire=${r(d.retirementIncome)}`,
        `living=${r(row.expense.living)}`,
        `edu=${r(row.expense.education)}`,
        `housing=${r(row.expense.housing)}`,
        `maint=${r(d.homeMaintenanceCost)}`,
        `medical=${r(row.expense.retirementExtra)}`,
        `evIn=${r(d.lifeEventIncome)}`,
        `evOut=${r(d.lifeEventExpense)}`,
        `incTot=${r(row.income.total)}`,
        `expTot=${r(row.expense.total)}`,
        `net=${r(d.annualNetCashflow)}`,
        `planInv=${r(d.plannedInvestmentAmount)}`,
        `actInv=${r(d.actualInvestmentAmount)}`,
        `wCash=${r(d.withdrawalFromCash)}`,
        `wInv=${r(d.withdrawalFromInvestment)}`,
      ].join('  ');
    });

    // eslint-disable-next-line no-console
    console.log('\n===== HIGH INCOME YEARLY BREAKDOWN (万円) =====\n' + lines.join('\n') + '\n');
    console.log(
      `assetLongevityAge=${result.indicators.assetLongevityAge}  assetsAt95=${r(result.indicators.assetsAt95)}  fireRate=${r(result.indicators.fireAchievementRate)}%`,
    );

    expect(result.rows.length).toBeGreaterThan(0);
  });
});
