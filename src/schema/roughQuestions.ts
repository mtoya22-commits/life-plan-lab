import type { RoughDraft, RoughFieldId, StepId } from './types';

// =============================================================================
// ざっくり診断の質問定義（宣言的・ドメイン設定）。
// 1ページ＝1カテゴリ寄り。1ページ1〜3項目で、スマホで軽く感じる粒度に保つ。
// 現実感に必要な最小限の数字（生活費・住居費・子の年齢・FIRE後生活費等）を追加。
// しっかり診断と意味が重複する項目は、同じ SimulationInput フィールドへ合流させる。
// =============================================================================

export interface ChoiceOption {
  value: string;
  label: string;
}

export interface RoughQuestion {
  id: RoughFieldId;
  label: string;
  help?: string;
  kind: 'number' | 'choice';
  unit?: string;
  placeholder?: string;
  options?: ChoiceOption[];
  min?: number;
  max?: number;
  allowSkip?: boolean;
  allowRecommended?: boolean;
  recommendedValue?: string | number;
  recommendedLabel?: string;
  /** ドラフトの状態で表示可否を決める。 */
  showIf?: (draft: RoughDraft) => boolean;
}

export interface RoughPage {
  id: StepId;
  title: string;
  purpose: string;
  questions: RoughQuestion[];
}

// ---- ドラフト読み取りヘルパー ----
function countOf(draft: RoughDraft): number {
  const c = draft.childrenCount;
  if (c.source !== 'user_input' || c.value == null) return 0;
  const n = typeof c.value === 'string' ? parseInt(c.value, 10) : c.value;
  return Number.isFinite(n) ? n : 0;
}
function housingTypeOf(draft: RoughDraft): string | null {
  const h = draft.housing;
  return h.source === 'user_input' ? String(h.value) : null;
}
function workStyleOf(draft: RoughDraft): string | null {
  const w = draft.workStyle;
  return w.source === 'user_input' ? String(w.value) : null;
}

export const ROUGH_PAGES: RoughPage[] = [
  {
    id: 'basic',
    title: 'あなたについて',
    purpose: '現在地を確認するための情報です。',
    questions: [
      { id: 'age', label: '今のご年齢', help: '現在の満年齢を入力してください。', kind: 'number', unit: '歳', placeholder: '例：38', min: 18, max: 80 },
      {
        id: 'householdIncome',
        label: '世帯年収（ざっくり）',
        help: '源泉徴収票の「支払金額」が目安です。共働きは合算してください。',
        kind: 'number',
        unit: '万円',
        placeholder: '例：850',
        min: 0,
        allowSkip: true,
      },
      {
        id: 'currentAssets',
        label: '今の資産（ざっくり）',
        help: '預貯金・投資などの合計のおおよそで構いません。',
        kind: 'number',
        unit: '万円',
        placeholder: '例：1200',
        min: 0,
        allowSkip: true,
      },
    ],
  },
  {
    id: 'housing',
    title: '住まい',
    purpose: '住宅費とFIRE時期の重なりを確認します。',
    questions: [
      {
        id: 'housing',
        label: 'お住まい',
        kind: 'choice',
        options: [
          { value: 'own', label: '持ち家' },
          { value: 'rent', label: '賃貸' },
          { value: 'considering', label: '購入検討中' },
        ],
      },
      {
        id: 'monthlyHousing',
        label: '毎月の住居費',
        help: '賃貸は家賃、持ち家は毎月のローン返済額です。ボーナス払いがある場合は月額に均してください。',
        kind: 'number',
        unit: '万円',
        placeholder: '例：11',
        min: 0,
        allowSkip: true,
      },
      {
        id: 'loanYears',
        label: '住宅ローン残年数',
        help: 'あと何年返済が残っているか、分かる範囲で。完済時期の目安に使います。',
        kind: 'number',
        unit: '年',
        placeholder: '例：30',
        min: 0,
        max: 50,
        allowSkip: true,
        allowRecommended: true,
        recommendedValue: 30,
        recommendedLabel: '例（30年）を入れる',
        showIf: (d) => {
          const t = housingTypeOf(d);
          return t === 'own' || t === 'considering';
        },
      },
    ],
  },
  {
    id: 'basic',
    title: '毎月の生活費',
    purpose: '生活費の規模を確認します。',
    questions: [
      {
        id: 'monthlyLiving',
        label: '毎月の生活費',
        help: '食費・通信費・日用品・光熱費など、毎月の生活費です。住居費・投資額は含めなくて構いません。',
        kind: 'number',
        unit: '万円',
        placeholder: '例：25',
        min: 0,
        allowSkip: true,
      },
    ],
  },
  {
    id: 'family',
    title: 'お子さま・教育',
    purpose: '教育費が大きくなる時期を概算します。',
    questions: [
      {
        id: 'childrenCount',
        label: 'お子さまの人数',
        help: '今後予定している場合も含めて、おおよその人数を選んでください。',
        kind: 'choice',
        options: [
          { value: '0', label: 'いない' },
          { value: '1', label: '1人' },
          { value: '2', label: '2人' },
          { value: '3', label: '3人' },
          { value: '4', label: '4人以上' },
        ],
      },
      {
        id: 'educationPolicy',
        label: '教育の方針',
        help: '迷う場合は「未定」で大丈夫です。あとで詳しく調整できます。',
        kind: 'choice',
        options: [
          { value: 'public', label: '公立中心' },
          { value: 'some_private', label: '一部私立' },
          { value: 'education_focused', label: '教育重視' },
          { value: 'undecided', label: '未定' },
        ],
        showIf: (d) => countOf(d) > 0,
      },
      { id: 'childAge1', label: '1人目のお子さまの年齢', kind: 'number', unit: '歳', placeholder: '例：4', min: 0, max: 30, allowSkip: true, showIf: (d) => countOf(d) >= 1 },
      { id: 'childAge2', label: '2人目のお子さまの年齢', kind: 'number', unit: '歳', placeholder: '例：2', min: 0, max: 30, allowSkip: true, showIf: (d) => countOf(d) >= 2 },
      { id: 'childAge3', label: '3人目のお子さまの年齢', kind: 'number', unit: '歳', min: 0, max: 30, allowSkip: true, showIf: (d) => countOf(d) >= 3 },
      { id: 'childAge4', label: '4人目のお子さまの年齢', kind: 'number', unit: '歳', min: 0, max: 30, allowSkip: true, showIf: (d) => countOf(d) >= 4 },
    ],
  },
  {
    id: 'fire',
    title: 'これからの働き方',
    purpose: '仕事を減らした後の暮らし方を確認します。',
    questions: [
      {
        id: 'workStyle',
        label: '将来の働き方',
        help: '完全に辞めたいか、少し働き続けたいか、まだ決めていないかを選んでください。',
        kind: 'choice',
        options: [
          { value: 'full_retire', label: '完全リタイアしたい' },
          { value: 'work_a_little', label: '少し働きたい' },
          { value: 'undecided', label: 'まだ決めていない' },
        ],
      },
      {
        id: 'reduceWorkAge',
        label: '仕事を減らしたい年齢',
        help: 'フルタイムをセーブしたい年齢の目安です。迷ったら入力例が使えます。',
        kind: 'number',
        unit: '歳',
        placeholder: '例：55',
        min: 35,
        max: 75,
        allowSkip: true,
        allowRecommended: true,
        recommendedValue: 55,
        recommendedLabel: '例（55歳）を入れる',
      },
    ],
  },
  {
    id: 'fire',
    title: 'FIRE後の暮らし',
    purpose: '仕事を減らした後の生活費と収入を確認します。',
    questions: [
      {
        id: 'postFireLiving',
        label: 'FIRE後の毎月生活費',
        help: '仕事を減らした後の毎月の生活費の目安です。未入力なら現在の生活費から概算します。',
        kind: 'number',
        unit: '万円',
        placeholder: '例：30',
        min: 0,
        allowSkip: true,
      },
      {
        id: 'sideFireIncome',
        label: 'サイドFIRE後の毎月収入',
        help: '少し働き続ける場合の毎月の収入の目安です。',
        kind: 'number',
        unit: '万円',
        placeholder: '例：20',
        min: 0,
        allowSkip: true,
        allowRecommended: true,
        recommendedValue: 10,
        recommendedLabel: '例（月10万円）を入れる',
        showIf: (d) => workStyleOf(d) !== 'full_retire',
      },
    ],
  },
  {
    id: 'investment',
    title: '投資のスタイル',
    purpose: '資産の増え方を概算します。',
    questions: [
      {
        id: 'investmentStyle',
        label: '投資のスタイル',
        help: '安定重視ほど利回りは控えめ、成長重視ほど高めで試算します。迷ったらバランス型が無難です。',
        kind: 'choice',
        options: [
          { value: 'stable', label: '安定重視' },
          { value: 'balanced', label: 'バランス型' },
          { value: 'growth', label: '成長重視' },
        ],
        allowSkip: true,
        allowRecommended: true,
        recommendedValue: 'balanced',
        recommendedLabel: '標準例（バランス型）',
      },
    ],
  },
];

/** 全質問のフラット一覧。 */
export const ALL_ROUGH_QUESTIONS: RoughQuestion[] = ROUGH_PAGES.flatMap((p) => p.questions);

/** ページ順の stepId 一覧。 */
export const STEP_ORDER: StepId[] = ROUGH_PAGES.map((p) => p.id);

/** stepId からページ番号を引く（最初の該当ページ）。 */
export function pageIndexByStepId(stepId: StepId): number {
  const i = ROUGH_PAGES.findIndex((p) => p.id === stepId);
  return i < 0 ? 0 : i;
}
