import { field, withResolved } from './field';
import { returnRateForStyle } from './recommendedValues';
import type {
  ChildInput,
  EducationPolicy,
  FieldSource,
  FireType,
  HousingType,
  InvestmentStyle,
  RoughDraft,
  RoughFieldId,
  SchoolPath,
  SimulationInput,
  UniversityLiving,
  UniversityPath,
} from './types';
import { ALL_ROUGH_QUESTIONS } from './roughQuestions';

// =============================================================================
// ざっくり診断ドラフト → SimulationInput への写像
// 各セルの source（user_input / recommended_value / skipped）を尊重して反映する。
// 子の年齢は仮置きし ageAssumed=true で「仮定」と明示する。
// =============================================================================

const QMAP = new Map(ALL_ROUGH_QUESTIONS.map((q) => [q.id, q]));

/** ドラフトの1セルを解決し、計算に使う値と source を返す。 */
function resolve(id: RoughFieldId, draft: RoughDraft): { value: string | number | null; source: FieldSource } {
  const cell = draft[id];
  if (!cell) return { value: null, source: 'skipped' };
  if (cell.source === 'recommended_value') {
    const rec = QMAP.get(id)?.recommendedValue ?? cell.value;
    return { value: rec, source: 'recommended_value' };
  }
  if (cell.source === 'skipped') return { value: null, source: 'skipped' };
  if (cell.value === null || cell.value === '') return { value: null, source: 'skipped' };
  return { value: cell.value, source: 'user_input' };
}

function workStyleToFireType(style: string | number | null): FireType {
  switch (style) {
    case 'full_retire':
      return 'full';
    case 'work_a_little':
      return 'side';
    default:
      return 'side'; // 未定はサイドFIRE想定
  }
}

export function applyRoughDraft(base: SimulationInput, draft: RoughDraft): SimulationInput {
  const input = base;

  const age = resolve('age', draft);
  input.basic.age = withResolved(input.basic.age, age.value as number, age.source);

  const income = resolve('householdIncome', draft);
  input.basic.householdIncome = withResolved(input.basic.householdIncome, income.value as number, income.source);

  const assets = resolve('currentAssets', draft);
  input.basic.currentAssets = withResolved(input.basic.currentAssets, assets.value as number, assets.source);

  const housing = resolve('housing', draft);
  input.housing.type = withResolved(input.housing.type, housing.value as HousingType, housing.source);
  const isRent = (housing.value as HousingType) === 'rent';

  // 毎月の住居費 → 賃貸は家賃、それ以外は毎月返済額（同じ意味の項目に合流）
  const monthlyHousing = resolve('monthlyHousing', draft);
  if (isRent) {
    input.housing.rent = withResolved(input.housing.rent, monthlyHousing.value as number, monthlyHousing.source);
  } else {
    input.housing.monthlyPayment = withResolved(
      input.housing.monthlyPayment,
      monthlyHousing.value as number,
      monthlyHousing.source,
    );
  }

  // 住宅ローン残年数（持ち家系のみ意味を持つ）
  const loanYears = resolve('loanYears', draft);
  input.housing.remainingYears = withResolved(input.housing.remainingYears, loanYears.value as number, loanYears.source);

  // 毎月生活費
  const monthlyLiving = resolve('monthlyLiving', draft);
  input.expense.monthlyLiving = withResolved(input.expense.monthlyLiving, monthlyLiving.value as number, monthlyLiving.source);

  // 働き方 → FIREタイプ + 仕事を減らす年齢
  const work = resolve('workStyle', draft);
  input.fire.type = withResolved(input.fire.type, workStyleToFireType(work.value), work.source);
  const reduceAge = resolve('reduceWorkAge', draft);
  input.fire.reduceWorkAge = withResolved(input.fire.reduceWorkAge, reduceAge.value as number, reduceAge.source);
  input.fire.targetAge = withResolved(input.fire.targetAge, reduceAge.value as number, reduceAge.source);

  // FIRE後の毎月生活費（月額入力 → 年額に変換して合流）
  const postLiving = resolve('postFireLiving', draft);
  if (postLiving.source !== 'skipped' && postLiving.value != null) {
    input.fire.postFireLiving = withResolved(input.fire.postFireLiving, (postLiving.value as number) * 12, postLiving.source, {
      user: `FIRE後の生活費（月${postLiving.value}万円）で試算しています。`,
    });
  }

  // サイドFIRE後の毎月収入（月額入力 → 年額に変換して合流）
  const sideIncome = resolve('sideFireIncome', draft);
  if (sideIncome.source !== 'skipped' && sideIncome.value != null) {
    input.fire.postFireIncome = withResolved(input.fire.postFireIncome, (sideIncome.value as number) * 12, sideIncome.source, {
      user: `サイドFIRE後の収入（月${sideIncome.value}万円）で試算しています。`,
      recommended: `サイドFIRE後の収入（月${sideIncome.value}万円）で概算しています。`,
    });
  }

  // 投資スタイル → 想定（名目）利回り
  const style = resolve('investmentStyle', draft);
  input.investment.style = withResolved(input.investment.style, style.value as InvestmentStyle, style.source);
  if (style.source !== 'skipped' && style.value) {
    const s = style.value as InvestmentStyle;
    input.investment.returnRate = withResolved(input.investment.returnRate, returnRateForStyle(s), style.source, {
      user: `投資スタイル（${s}）に基づく利回りを使用しています。`,
      recommended: `投資スタイルに基づく利回り（標準例）を使用しています。`,
    });
  }

  // 子ども: 人数分だけ生成。年齢が入力されていれば反映（ageAssumed=false）、なければ仮置き8歳。
  const countRes = resolve('childrenCount', draft);
  const count = typeof countRes.value === 'string' ? parseInt(countRes.value, 10) : (countRes.value as number) ?? 0;
  const policyRes = resolve('educationPolicy', draft);
  const policy = (policyRes.value as EducationPolicy) ?? 'undecided';
  const childAgeIds: RoughFieldId[] = ['childAge1', 'childAge2', 'childAge3', 'childAge4'];
  input.children = Array.from({ length: Number.isFinite(count) ? count : 0 }, (_unused, i) => {
    const child = makeAssumedChild(policy, policyRes.source);
    const ageRes = resolve(childAgeIds[i], draft);
    if (ageRes.source === 'user_input' && ageRes.value != null) {
      child.currentAge = withResolved(child.currentAge, ageRes.value as number, 'user_input');
      child.ageAssumed = false;
    }
    return child;
  });

  return input;
}

// 教育方針 → 各進路の初期値。
const POLICY_PATHS: Record<
  EducationPolicy,
  { middle: SchoolPath; high: SchoolPath; uni: UniversityPath; living: UniversityLiving }
> = {
  public: { middle: 'public', high: 'public', uni: 'public_humanities', living: 'home' },
  some_private: { middle: 'public', high: 'private', uni: 'private_humanities', living: 'home' },
  education_focused: { middle: 'private', high: 'private', uni: 'private_science', living: 'away' },
  undecided: { middle: 'public', high: 'public', uni: 'undecided', living: 'undecided' },
};

function makeAssumedChild(policy: EducationPolicy, policySource: FieldSource): ChildInput {
  const paths = POLICY_PATHS[policy];
  // 未定の場合は進路は概算（recommended）扱いにする。
  const pathSource: FieldSource = policy === 'undecided' ? 'recommended_value' : policySource === 'user_input' ? 'user_input' : 'recommended_value';
  const note = policy === 'undecided' ? '教育方針が未定のため公立中心で概算しています。' : undefined;

  return {
    currentAge: field(8, 'recommended_value', '子の年齢', '年齢未入力のため仮の年齢（8歳）で試算しています。', '歳'),
    ageAssumed: true,
    middleSchool: field(paths.middle, pathSource, '中学', note ?? '教育方針に基づき概算しています。'),
    highSchool: field(paths.high, pathSource, '高校', note ?? '教育方針に基づき概算しています。'),
    university: field(paths.uni, pathSource, '大学', note ?? '教育方針に基づき概算しています。'),
    uniLiving: field(paths.living, pathSource, '大学時の住まい', note ?? '教育方針に基づき概算しています。'),
  };
}

/** テスト/サンプル用: フラットな（部分）回答から「指定分は user_input」のドラフトを作る。 */
export function draftFromAnswers(a: Partial<Record<RoughFieldId, string | number>>): RoughDraft {
  const draft = {} as RoughDraft;
  for (const q of ALL_ROUGH_QUESTIONS) {
    const v = a[q.id];
    draft[q.id] = v === undefined ? { value: null, source: 'default_value' } : { value: v, source: 'user_input' };
  }
  return draft;
}
