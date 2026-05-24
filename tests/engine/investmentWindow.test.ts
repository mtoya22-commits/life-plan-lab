import { describe, expect, it } from 'vitest';
import { createDefaultInput } from '../../src/schema/defaultValues';
import { applyRecommendedValues } from '../../src/schema/recommendedValues';
import { runSimulation } from '../../src/engine/annualSimulationEngine';
import { field } from '../../src/schema/field';
import type { SimulationInput } from '../../src/schema/types';

// STEP6.2 追加: 毎月投資額の「積立反映期間」を検証する。
// 仕様: 現在年齢〜就労終了年齢まで反映。サイドFIRE中も黒字があれば就労終了まで継続。
//       完全FIREはFIRE開始で停止。FIREなしは退職予定年齢で停止。赤字年は0。
const run = (i: SimulationInput) => runSimulation(applyRecommendedValues(i));

// サイドFIREだが、FIRE後収入が支出を上回り黒字が出るケース。
function sideSurplus(): SimulationInput {
  const i = createDefaultInput('thorough');
  i.basic.age = field(45, 'user_input', '', '', '歳');
  i.basic.currentAssets = field(4000, 'user_input', '', '', '万円');
  i.basic.cashRatio = field(20, 'user_input', '', '', '%');
  i.basic.takeHomeIncome = field(700, 'user_input', '', '', '万円');
  i.expense.monthlyLiving = field(15, 'user_input', '', '', '万円');
  i.children = [];
  i.housing.type = field('rent', 'user_input', '', '');
  i.housing.rent = field(0, 'user_input', '', '', '万円');
  i.fire.type = field('side', 'user_input', '', '');
  i.fire.targetAge = field(50, 'user_input', '', '', '歳');
  i.fire.postFireLiving = field(180, 'user_input', '', '', '万円');
  i.fire.postFireIncome = field(420, 'user_input', '', '', '万円'); // 支出を上回る側収入
  i.fire.workUntilAge = field(65, 'user_input', '', '', '歳');
  i.investment.monthlyInvestment = field(10, 'user_input', '', '', '万円'); // 120/年
  i.investment.returnRate = field(5, 'user_input', '', '', '%');
  i.investment.inflationRate = field(0, 'user_input', '', '', '%'); // 名目で見やすく
  i.retirement.pension = field(200, 'user_input', '', '', '万円');
  return i;
}

describe('STEP6.2 monthly investment reflection window', () => {
  it('continues investing during side-FIRE working years when there is a surplus', () => {
    const r = run(sideSurplus());
    const at55 = r.rows.find((x) => x.age === 55)!.debug!; // FIRE開始(50)後・就労(65)前
    expect(at55.plannedInvestmentAmount).toBe(120);
    expect(at55.actualInvestmentAmount).toBeGreaterThan(0); // 黒字があるので積立継続
  });

  it('stops new investment after the work-until age (full retirement)', () => {
    const r = run(sideSurplus());
    const at66 = r.rows.find((x) => x.age === 66)!.debug!;
    expect(at66.plannedInvestmentAmount).toBe(0);
    expect(at66.actualInvestmentAmount).toBe(0);
  });

  it('does not invest in a deficit year even within the window', () => {
    const i = sideSurplus();
    i.fire.postFireIncome = field(50, 'user_input', '', '', '万円'); // 支出割れ → 赤字
    const at55 = run(i).rows.find((x) => x.age === 55)!.debug!;
    expect(at55.plannedInvestmentAmount).toBe(120); // 反映対象ではある
    expect(at55.actualInvestmentAmount).toBe(0); // 赤字なので積立0
  });

  it('full FIRE stops investing at FIRE start (no work continuation)', () => {
    const i = sideSurplus();
    i.fire.type = field('full', 'user_input', '', '');
    i.fire.targetAge = field(50, 'user_input', '', '', '歳');
    const r = run(i);
    expect(r.rows.find((x) => x.age === 49)!.debug!.plannedInvestmentAmount).toBe(120);
    expect(r.rows.find((x) => x.age === 51)!.debug!.plannedInvestmentAmount).toBe(0);
  });

  it('no-FIRE stops investing at the retirement age', () => {
    const i = sideSurplus();
    i.fire.type = field('none', 'user_input', '', '');
    i.income.retirementAge = field(60, 'user_input', '', '', '歳');
    const r = run(i);
    expect(r.rows.find((x) => x.age === 59)!.debug!.plannedInvestmentAmount).toBe(120);
    expect(r.rows.find((x) => x.age === 61)!.debug!.plannedInvestmentAmount).toBe(0);
  });

  it('notes state the contribution period (before work-until age) and the surplus cap', () => {
    const notes = run(sideSurplus()).notes;
    expect(notes.some((n) => n.includes('65歳の前年まで') && n.includes('黒字の範囲'))).toBe(true);
  });
});
