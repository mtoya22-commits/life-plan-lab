import type { SimulationInput, SimulationResult } from '../../schema/types';
import type { LifeEventEntry } from './lifeEvents';

// =============================================================================
// 人生フェーズと「次の節目」の導出（純粋関数・UI非依存）。
// 計算ロジックは変更せず、既存の入力・結果・イベントから「今どの段階か」「次に何が来るか」を
// 静かな言葉で組み立てる。煽らず、見通しを与えることを目的とする。
// =============================================================================

export interface LifePhase {
  key: string;
  label: string;
  description: string;
}

const PENSION_AGE = 65;

/** 現在の人生フェーズ。年齢とFIRE/教育費/年金の位置関係から決める。 */
export function currentLifePhase(input: SimulationInput, result: SimulationResult): LifePhase {
  const age = input.basic.age.value;
  const fireType = input.fire.type.value;
  const fireStartAge = fireType === 'none' ? input.income.retirementAge.value : input.fire.targetAge.value;
  const hasChildren = input.children.length > 0;
  const peakAge = result.indicators.eduPeakResilience.peakAge;

  if (age >= PENSION_AGE) {
    return phase('pension', '年金生活期', '今は、年金を中心とした暮らしの時期です。');
  }
  if (fireType !== 'none' && age >= fireStartAge) {
    return fireType === 'side'
      ? phase('side_fire', 'サイドFIRE期', '今は、働き方をゆるやかにしながら暮らす時期です。')
      : phase('fire', 'FIRE期', '今は、仕事から離れて暮らしを送る時期です。');
  }
  if (age >= 60) {
    return phase('pre_retire', '老後移行期', '今は、老後の暮らしへ移っていく準備の時期です。');
  }
  if (fireType !== 'none' && fireStartAge - age <= 5) {
    return phase('pre_fire', 'FIRE準備期', '今は、FIREに向けて準備を進める時期です。');
  }
  if (hasChildren && Math.abs(age - peakAge) <= 2) {
    return phase('edu_peak', '教育費ピーク期', '今は、教育費の負担が大きくなりやすい時期です。');
  }
  if (hasChildren) {
    return phase('edu_prep', '教育費準備期', '今は、これからの教育費に備えていく時期です。');
  }
  return phase('accumulation', '資産形成期', '今は、将来に向けて資産を育てていく時期です。');
}

function phase(key: string, label: string, description: string): LifePhase {
  return { key, label, description };
}

/** 「次の節目」として案内するイベント種別（枯渇・現在・95歳は除く）。 */
const MILESTONE_TYPES = new Set<LifeEventEntry['type']>([
  'education',
  'fire',
  'mortgage',
  'pension',
  'fixed_rate_end',
  'custom',
]);

/** 現在より先で、最初に来る前向きな節目。なければ undefined。 */
export function nextMilestone(events: LifeEventEntry[], currentAge: number): LifeEventEntry | undefined {
  return upcomingMilestones(events, currentAge, 1)[0];
}

/** 現在より先の節目を、近い順に最大 max 件。 */
export function upcomingMilestones(events: LifeEventEntry[], currentAge: number, max: number): LifeEventEntry[] {
  return events
    .filter((e) => e.age > currentAge && MILESTONE_TYPES.has(e.type))
    .sort((a, b) => a.age - b.age)
    .slice(0, max);
}

/** 教育費が一段落する年齢（最後に教育費が発生する年）。children がいなければ null。 */
export function educationSettleAge(input: SimulationInput, result: SimulationResult): number | null {
  if (input.children.length === 0) return null;
  let settle: number | null = null;
  for (const r of result.rows) if (r.expense.education > 0) settle = r.age;
  return settle;
}
