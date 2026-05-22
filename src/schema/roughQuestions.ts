import type { RoughFieldId } from './types';

// =============================================================================
// ざっくり診断の質問定義（宣言的・ドメイン設定）。
// 1ページ1〜3項目。各質問に Help / Skip / Recommended の有無と、おすすめ値を持たせる。
// UI(RoughFlow) と 写像(roughMapping) の双方がここを参照する。
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
  /** おすすめ値（allowRecommended のとき使用）。 */
  recommendedValue?: string | number;
  recommendedLabel?: string;
  /** childrenCount が 0 のとき非表示にする等の条件。 */
  showIf?: (childrenCount: number) => boolean;
}

export interface RoughPage {
  title: string;
  questions: RoughQuestion[];
}

export const ROUGH_PAGES: RoughPage[] = [
  {
    title: 'あなたについて',
    questions: [
      {
        id: 'age',
        label: '今のご年齢',
        help: '現在の満年齢を入力してください。',
        kind: 'number',
        unit: '歳',
        placeholder: '例：38',
        min: 18,
        max: 80,
      },
      {
        id: 'householdIncome',
        label: '世帯年収（ざっくり）',
        help: '源泉徴収票の「支払金額」が目安です。共働きの場合は合算してください。分からなければスキップできます。',
        kind: 'number',
        unit: '万円',
        placeholder: '例：850',
        min: 0,
        allowSkip: true,
      },
      {
        id: 'currentAssets',
        label: '今の資産（ざっくり）',
        help: '預貯金・投資などの合計のおおよそで構いません。分からなければスキップできます。',
        kind: 'number',
        unit: '万円',
        placeholder: '例：1200',
        min: 0,
        allowSkip: true,
      },
    ],
  },
  {
    title: 'お子さま・教育',
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
        showIf: (childrenCount) => childrenCount > 0,
      },
    ],
  },
  {
    title: '住まい',
    questions: [
      {
        id: 'housing',
        label: 'お住まい',
        help: '現在の状況に近いものを選んでください。',
        kind: 'choice',
        options: [
          { value: 'own', label: '持ち家' },
          { value: 'rent', label: '賃貸' },
          { value: 'considering', label: '購入検討中' },
        ],
      },
    ],
  },
  {
    title: 'これからの働き方',
    questions: [
      {
        id: 'workStyle',
        label: '将来の働き方',
        help: '完全に仕事を辞めたいか、少し働き続けたいか、まだ決めていないかを選んでください。',
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
        help: 'フルタイムをセーブしたい年齢の目安です。迷ったらおすすめ値（55歳）が使えます。',
        kind: 'number',
        unit: '歳',
        placeholder: '例：55',
        min: 35,
        max: 75,
        allowSkip: true,
        allowRecommended: true,
        recommendedValue: 55,
        recommendedLabel: 'おすすめ（55歳）',
      },
    ],
  },
  {
    title: '投資のスタイル',
    questions: [
      {
        id: 'investmentStyle',
        label: '投資のスタイル',
        help: '安定重視ほど想定利回りは控えめ、成長重視ほど高めで試算します。迷ったらバランス型がおすすめです。',
        kind: 'choice',
        options: [
          { value: 'stable', label: '安定重視' },
          { value: 'balanced', label: 'バランス型' },
          { value: 'growth', label: '成長重視' },
        ],
        allowSkip: true,
        allowRecommended: true,
        recommendedValue: 'balanced',
        recommendedLabel: 'おすすめ（バランス型）',
      },
    ],
  },
];

/** 全質問のフラット一覧。 */
export const ALL_ROUGH_QUESTIONS: RoughQuestion[] = ROUGH_PAGES.flatMap((p) => p.questions);
