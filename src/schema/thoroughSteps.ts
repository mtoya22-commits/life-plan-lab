import { field } from './field';
import type { ChildInput, SimulationInput, StepId, ThoroughStepId } from './types';

// =============================================================================
// しっかり診断のステップ定義（宣言的）。
// 1ページ＝原則1〜3項目。各質問は SimulationInput 内の Field をドットパスで指す。
// 計算ロジックは別、ここは入力UIの構造のみ（buildFullInput に自然合流）。
// =============================================================================

export interface ThoroughChoice {
  value: string;
  label: string;
}

export interface ThoroughQuestion {
  /** SimulationInput 内の Field へのドットパス（例: 'basic.age'）。 */
  path: string;
  label: string;
  help?: string;
  kind: 'number' | 'choice' | 'toggle';
  unit?: string;
  /** 入力欄の直下に出す短い補足（月額/年額・単位・「今のお金の感覚で」など）。 */
  inputNote?: string;
  placeholder?: string;
  options?: ThoroughChoice[];
  min?: number;
  max?: number;
  allowSkip?: boolean;
  allowRecommended?: boolean;
  recommendedValue?: string | number | boolean;
  recommendedLabel?: string;
  /** この質問を表示する条件。 */
  showIf?: (input: SimulationInput) => boolean;
}

export interface ThoroughPage {
  pageId: string;
  stepId: ThoroughStepId;
  title: string;
  purpose: string;
  /** 'fields' は questions を描画。family/events は専用UI。 */
  kind: 'fields' | 'family' | 'events';
  questions?: ThoroughQuestion[];
  /** このページを表示する条件（住宅ローン詳細・サイドFIRE等）。 */
  showIf?: (input: SimulationInput) => boolean;
}

const hasLoan = (i: SimulationInput) => i.housing.type.value !== 'rent';
const isRent = (i: SimulationInput) => i.housing.type.value === 'rent';
const isSide = (i: SimulationInput) => i.fire.type.value === 'side';
const isFiring = (i: SimulationInput) => i.fire.type.value !== 'none';

const schoolOptions: ThoroughChoice[] = [
  { value: 'public', label: '公立' },
  { value: 'private', label: '私立' },
];
const uniOptions: ThoroughChoice[] = [
  { value: 'none', label: 'なし' },
  { value: 'public_humanities', label: '国公立文系' },
  { value: 'public_science', label: '国公立理系' },
  { value: 'private_humanities', label: '私立文系' },
  { value: 'private_science', label: '私立理系' },
  { value: 'undecided', label: '未定' },
];
const livingOptions: ThoroughChoice[] = [
  { value: 'home', label: '自宅' },
  { value: 'away', label: '一人暮らし' },
  { value: 'undecided', label: '未定' },
];

// 質問順: 基本 → 収入 → 毎月固定費 → 毎年変動費 → 家族 → 住宅 → FIRE → 投資 → 老後 → 一時イベント。
// 毎月→毎年→一時 の順にし、同じ支出を二重入力しにくくする。
export const THOROUGH_PAGES: ThoroughPage[] = [
  // ── 基本情報 ──
  {
    pageId: 'basic-1',
    stepId: 'detailed-basic',
    title: '基本情報',
    purpose: '現在地を詳しく確認します。',
    kind: 'fields',
    questions: [
      { path: 'basic.age', label: '本人年齢', kind: 'number', unit: '歳', min: 18, max: 80, placeholder: '例：38' },
      {
        path: 'basic.spouseAge',
        label: '配偶者年齢',
        help: '配偶者がいる場合のみ。現在は記録用で、計算には未反映です（今後の配偶者年金・退職時期の精密化に使います）。分からなければ未入力で進めます。',
        kind: 'number',
        unit: '歳',
        min: 18,
        max: 90,
        allowSkip: true,
      },
      { path: 'basic.householdIncome', label: '世帯年収', kind: 'number', unit: '万円', min: 0, placeholder: '例：850' },
    ],
  },
  {
    pageId: 'basic-2',
    stepId: 'detailed-basic',
    title: '基本情報（資産）',
    purpose: '手取りと資産の状況を確認します。',
    kind: 'fields',
    questions: [
      {
        path: 'basic.takeHomeIncome',
        label: '手取り年収',
        help: '実際に生活に使える年間収入が分かる場合のみ。未入力なら世帯年収から推定します。',
        kind: 'number',
        unit: '万円',
        min: 0,
        allowSkip: true,
      },
      { path: 'basic.currentAssets', label: '現在資産', kind: 'number', unit: '万円', min: 0, placeholder: '例：1200' },
    ],
  },

  // ── 収入 ──
  {
    pageId: 'income',
    stepId: 'detailed-income',
    title: '収入',
    purpose: '収入の内訳と退職の予定を確認します。手取りは「手取り年収（基本情報）→ 本人＋配偶者の収入 → 世帯年収」の順に、入っているものが優先されます（どれか1つで計算できます）。',
    kind: 'fields',
    questions: [
      {
        path: 'income.selfIncome',
        label: '本人収入',
        help: '世帯年収の内訳が分かる場合のみ。本人・配偶者を入力すると手取りをより正確に推定します。',
        kind: 'number',
        unit: '万円',
        min: 0,
        allowSkip: true,
      },
      { path: 'income.spouseIncome', label: '配偶者収入', kind: 'number', unit: '万円', min: 0, allowSkip: true },
      {
        path: 'income.raiseRate',
        label: '昇給率',
        help: '毎年の収入の伸びの目安です。迷ったら控えめが無難です。',
        kind: 'number',
        unit: '%',
        min: 0,
        max: 10,
        allowSkip: true,
        allowRecommended: true,
        recommendedValue: 0.5,
        recommendedLabel: '標準例（0.5%）',
      },
      {
        path: 'income.retirementAge',
        label: '退職予定年齢',
        help: 'この年齢以降は通常の労働収入を0とします（FIRE開始がある場合はそちらを優先）。',
        kind: 'number',
        unit: '歳',
        min: 45,
        max: 80,
        allowSkip: true,
        allowRecommended: true,
        recommendedValue: 65,
        recommendedLabel: '例（65歳）を入れる',
      },
    ],
  },

  // ── 毎月の固定費 ──
  {
    pageId: 'expense-monthly',
    stepId: 'detailed-expense',
    title: '毎月の固定費',
    purpose: '毎月かかる生活費を確認します。',
    kind: 'fields',
    questions: [
      {
        path: 'expense.monthlyLiving',
        label: '毎月生活費',
        help: '食費・日用品・光熱費・通信費などの毎月の生活費です。住居費・教育費・投資額・保険料は別で入力するため含めません。',
        kind: 'number',
        unit: '万円',
        inputNote: '月額・万円で入力',
        min: 0,
        placeholder: '例：25',
        allowSkip: true,
      },
      {
        path: 'expense.insuranceCost',
        label: '保険料（年間）',
        help: '生命保険・医療保険などの年間保険料です。毎月生活費に含めた場合は入力不要です。',
        kind: 'number',
        unit: '万円',
        inputNote: '年額・万円で入力',
        min: 0,
        allowSkip: true,
      },
    ],
  },

  // ── 毎年の変動費 ──
  {
    pageId: 'expense-annual',
    stepId: 'detailed-expense',
    title: '毎年の変動費',
    purpose: '毎月ではない年間の支出を確認します。',
    kind: 'fields',
    questions: [
      {
        path: 'expense.annualSpecial',
        label: '年間特別費',
        help: '家電・帰省・冠婚葬祭・臨時出費など、毎月ではない支出です。旅行費・車関連費・車購入・リフォームを別で入力する場合は含めません。',
        kind: 'number',
        unit: '万円',
        inputNote: '年額・万円で入力',
        min: 0,
        allowSkip: true,
      },
      {
        path: 'expense.travelCost',
        label: '旅行費（年間）',
        help: '年間の旅行・レジャー費です。年間特別費に含めた場合は入力不要です。',
        kind: 'number',
        unit: '万円',
        inputNote: '年額・万円で入力',
        min: 0,
        allowSkip: true,
      },
      {
        path: 'expense.carCost',
        label: '車関連費（年間維持費）',
        help: '車検・保険・税金・ガソリンなどの毎年の維持費です。車本体の購入費はライフイベントで入力してください。',
        kind: 'number',
        unit: '万円',
        inputNote: '年額・万円で入力（車の購入はライフイベントへ）',
        min: 0,
        allowSkip: true,
      },
    ],
  },

  // ── 子ども・教育（専用UI） ──
  {
    pageId: 'family',
    stepId: 'detailed-family',
    title: 'お子さま・教育',
    purpose: '教育費の見通しを詳しくします。',
    kind: 'family',
  },

  // ── 住まい・住宅ローン ──
  {
    pageId: 'housing-1',
    stepId: 'detailed-housing',
    title: '住まい',
    purpose: '住まいの状況です。',
    kind: 'fields',
    questions: [
      {
        path: 'housing.type',
        label: 'お住まい',
        kind: 'choice',
        options: [
          { value: 'own', label: '持ち家' },
          { value: 'rent', label: '賃貸' },
          { value: 'considering', label: '購入検討中' },
        ],
      },
      {
        path: 'housing.rent',
        label: '毎月の家賃',
        help: '毎月生活費とは別に、住居費として計算します。',
        kind: 'number',
        unit: '万円',
        inputNote: '月額・万円で入力',
        min: 0,
        allowSkip: true,
        showIf: isRent,
      },
    ],
  },
  {
    pageId: 'housing-2',
    stepId: 'detailed-housing',
    title: '住宅ローン',
    purpose: '毎月返済額と残年数を中心に反映します。残高・金利・固定/変動・返済方式は現在「記録用」で、住宅費の精密計算は今後対応予定です。',
    kind: 'fields',
    showIf: hasLoan,
    questions: [
      {
        path: 'housing.monthlyPayment',
        label: '毎月返済額',
        help: '毎月のローン返済額です。ボーナス払いも含めて月額に均してください。住居費はこれを優先して計算します。',
        kind: 'number',
        unit: '万円',
        inputNote: '月額・万円で入力',
        placeholder: '例：11',
        min: 0,
        allowSkip: true,
      },
      {
        path: 'housing.balance',
        label: 'ローン残高',
        help: '銀行アプリ、返済予定表、残高証明書などで確認できます。現在は記録用で、住宅費は毎月返済額×残年数で簡易反映します。',
        kind: 'number',
        unit: '万円',
        min: 0,
        allowSkip: true,
      },
      { path: 'housing.remainingYears', label: '残年数', kind: 'number', unit: '年', min: 0, max: 50, allowSkip: true, placeholder: '例：30' },
    ],
  },
  {
    pageId: 'housing-3',
    stepId: 'detailed-housing',
    title: '住宅ローン（金利・返済方式）',
    purpose: '金利と返済方式です（現在は記録用）。',
    kind: 'fields',
    showIf: hasLoan,
    questions: [
      {
        path: 'housing.rate',
        label: '金利',
        kind: 'number',
        unit: '%',
        min: 0,
        max: 10,
        allowSkip: true,
        allowRecommended: true,
        recommendedValue: 1.0,
        recommendedLabel: '例（1.0%）を入れる',
      },
      {
        path: 'housing.rateType',
        label: '固定 / 変動',
        help: '変動金利は将来の金利上昇リスクを織り込み、入力された金利に+0.3%ポイントを上乗せして全期間試算します（慎重な仮定）。固定金利を選ぶと完済まで入力どおり、固定終了年齢を入れた場合はそれ以降+0.5%上振れます。',
        kind: 'choice',
        options: [
          { value: 'fixed', label: '固定' },
          { value: 'variable', label: '変動' },
        ],
        allowSkip: true,
      },
      {
        path: 'housing.fixedEndAge',
        label: '固定終了年齢',
        help: '固定金利が終わる年齢です。この年齢以降は金利が+0.5%ポイント上振れる慎重な仮定で計算します（変動金利では使用しません）。',
        kind: 'number',
        unit: '歳',
        min: 30,
        max: 90,
        allowSkip: true,
        showIf: (i) => i.housing.rateType.value !== 'variable',
      },
      {
        path: 'housing.repayMethod',
        label: '返済方式',
        help: '元利均等は毎月の返済額が一定、元金均等は元金返済が一定で初期負担が大きく利息総額が少なめ。固定/変動とは独立に選べます。',
        kind: 'choice',
        options: [
          { value: 'equal_payment', label: '元利均等' },
          { value: 'equal_principal', label: '元金均等' },
        ],
        allowSkip: true,
      },
      {
        path: 'housing.bonusAnnual',
        label: 'ボーナス払い（参考・年間）',
        help: '（参考）現在は毎月返済額に均して計算するため、ボーナス払いも毎月返済額に含めてください。ここは記録用です。',
        kind: 'number',
        unit: '万円',
        min: 0,
        allowSkip: true,
      },
    ],
  },

  // ── FIRE条件 ──
  {
    pageId: 'fire-1',
    stepId: 'detailed-fire',
    title: '働き方の方針',
    purpose: 'いつ・どう働き方を変えるかです。現役継続を選んだ場合は、退職年齢は「収入」ステップで設定済みの「退職予定年齢」が使われます。',
    kind: 'fields',
    questions: [
      {
        path: 'fire.type',
        label: '将来の働き方',
        help: '完全FIREはFIRE後の労働収入が0、サイドFIREは少し働き続けます。現役継続は退職年齢まで普通に働く前提（FIREイベントなし）です。',
        kind: 'choice',
        options: [
          { value: 'full', label: '完全FIRE' },
          { value: 'side', label: 'サイドFIRE' },
          { value: 'none', label: '現役継続' },
        ],
      },
      {
        path: 'fire.targetAge',
        label: 'FIRE希望年齢',
        kind: 'number',
        unit: '歳',
        min: 35,
        max: 75,
        allowSkip: true,
        placeholder: '例：55',
        // 現役継続では FIRE 自体が発生しないので非表示。退職年齢は「収入」ステップの income.retirementAge を使用。
        showIf: isFiring,
      },
      {
        // 現役継続で 65 歳より前に退職する人向けの「ブリッジ期間」生活費。
        // 内部的には fire.postFireLiving と同じフィールドを使う（engine が
        // 退職以降〜年金開始まで postFireLiving を参照するため）。
        // FIRE 用の質問とはラベル・出現条件で分けて、UI 上の意味だけ「退職後の生活費」に寄せる。
        path: 'fire.postFireLiving',
        label: '退職後の毎月生活費（年金開始まで）',
        help: '65歳より前に退職する場合、年金開始までの毎月の生活費として使います。未入力なら現在生活費の90%で概算します。',
        kind: 'number',
        unit: '万円/月',
        inputNote: '毎月の額・万円（日常生活費のみ／今のお金の感覚で）',
        placeholder: '例：23',
        min: 0,
        allowSkip: true,
        // 現役継続で、退職予定年齢が年金開始年齢（65歳）より前のときだけ意味を持つ。
        showIf: (i) => i.fire.type.value === 'none' && i.income.retirementAge.value < 65,
      },
    ],
  },
  {
    pageId: 'fire-2',
    stepId: 'detailed-fire',
    title: 'FIRE後の暮らし',
    purpose: 'FIRE後の生活費と収入を確認します。',
    kind: 'fields',
    // 現役継続を選んだ場合は FIRE 後の概念がないため、このステップ自体をスキップする。
    showIf: isFiring,
    questions: [
      {
        path: 'fire.postFireLiving',
        label: 'FIRE後の毎月生活費（日常生活費のみ）',
        help: 'FIRE開始〜65歳ごろの日常生活費です。住居費・教育費・保険・特別費・旅行・車関連費は別で加算されます。65歳以降は老後生活費を使用。未入力なら現在生活費の90%で概算します。',
        kind: 'number',
        unit: '万円/月',
        inputNote: '毎月の額・万円（日常生活費のみ／今のお金の感覚で）',
        placeholder: '例：23',
        min: 0,
        allowSkip: true,
        // 現役継続: FIRE 後の概念が発生しないため非表示（65歳以降は老後生活費が担う）。
        showIf: isFiring,
      },
      {
        path: 'fire.postFireIncome',
        label: 'FIRE後収入',
        help: 'サイドFIREで少し働く場合の年間収入です。配偶者が働き続ける場合はその分も合算した「世帯としての年間労働収入」として入力してください。今のお金の感覚で入力すると、将来額はインフレ率を反映して試算します。',
        kind: 'number',
        unit: '万円',
        inputNote: '年額・万円（世帯合算／今のお金の感覚で）',
        min: 0,
        allowSkip: true,
        allowRecommended: true,
        recommendedValue: 100,
        recommendedLabel: '例（100万円）を入れる',
        showIf: isSide,
      },
      {
        path: 'fire.workUntilAge',
        label: '何歳まで働くか',
        kind: 'number',
        unit: '歳',
        min: 40,
        max: 80,
        allowSkip: true,
        allowRecommended: true,
        recommendedValue: 65,
        recommendedLabel: '例（65歳）を入れる',
        showIf: isSide,
      },
    ],
  },

  // ── 投資 ──
  {
    pageId: 'investment-1',
    stepId: 'detailed-investment',
    title: '投資',
    purpose: 'これからの運用前提を確認します。',
    kind: 'fields',
    questions: [
      {
        path: 'investment.monthlyInvestment',
        label: '毎月投資額',
        help: '毎月の新規積立額です。現金から投資へ振り替える額として扱い、収支に二重加算しません。家計の黒字を超える分は投資されません。',
        kind: 'number',
        unit: '万円',
        inputNote: '月額・万円（家計の黒字の範囲で反映）',
        min: 0,
        allowSkip: true,
      },
      {
        path: 'investment.returnRate',
        label: '想定利回り（名目）',
        help: '投資資産にのみ適用する名目利回りです。',
        kind: 'number',
        unit: '%',
        min: 0,
        max: 15,
        allowSkip: true,
        allowRecommended: true,
        recommendedValue: 5,
        recommendedLabel: '標準例（5%）',
      },
    ],
  },
  {
    pageId: 'investment-2',
    stepId: 'detailed-investment',
    title: '投資（インフレ・現金）',
    purpose: 'インフレと資産の持ち方です。',
    kind: 'fields',
    questions: [
      {
        path: 'investment.inflationRate',
        label: 'インフレ率',
        help: '生活費・教育費などの支出の毎年の増加率として扱います。',
        kind: 'number',
        unit: '%',
        min: 0,
        max: 10,
        allowSkip: true,
        allowRecommended: true,
        recommendedValue: 2,
        recommendedLabel: '標準例（2%）',
      },
      {
        path: 'basic.cashRatio',
        label: '現金比率',
        help: '資産のうち預金・現金で持つ割合です。利回りは投資資産にのみかかります。未入力なら20%を仮定します。',
        kind: 'number',
        unit: '%',
        min: 0,
        max: 100,
        allowSkip: true,
        allowRecommended: true,
        recommendedValue: 30,
        recommendedLabel: '標準例（30%）',
      },
      {
        path: 'investment.crashScenario',
        label: '暴落シナリオ',
        // 入力時の help は「いつ・どれくらい」だけに絞る。
        // 詳しい根拠（シーケンスリスク・過去比較・回復モデル）は結果画面の試算条件 notes に記載。
        help: '「あり」にすると、FIRE開始または退職の翌年に投資資産を一度だけ30%下落させて試算します。詳しい根拠は結果画面の試算条件に記載しています。',
        kind: 'toggle',
      },
    ],
  },

  // ── 老後 ──
  {
    pageId: 'retirement-1',
    stepId: 'detailed-retirement',
    title: '老後',
    purpose: '65歳以降の収入と暮らし方を確認します。',
    kind: 'fields',
    questions: [
      {
        path: 'retirement.pension',
        label: '年金見込み（年額）',
        help: 'ねんきんネットの将来見込額（年額）を参考にしてください。65歳以降の収入に反映します。未入力なら0円で試算し結果に明示します。',
        kind: 'number',
        unit: '万円',
        inputNote: '年額・万円（今のお金の感覚で／将来額はインフレを反映）',
        placeholder: '例：180',
        min: 0,
        allowSkip: true,
      },
      {
        path: 'retirement.retirementLiving',
        label: '老後の毎月生活費（日常生活費のみ）',
        help: '65歳以降の日常生活費です。住居費・保険・特別費・旅行・車関連費は別で加算されます（FIRE後生活費とは別、65歳以降はこちら）。未入力なら現在生活費の85%で概算します。',
        kind: 'number',
        unit: '万円/月',
        inputNote: '毎月の額・万円（日常生活費のみ）',
        placeholder: '例：22',
        min: 0,
        allowSkip: true,
      },
    ],
  },
  {
    pageId: 'retirement-2',
    stepId: 'detailed-retirement',
    title: '老後（備え・退職金）',
    purpose: '医療・介護の備えと退職金です。',
    kind: 'fields',
    questions: [
      {
        path: 'retirement.medicalCareReserve',
        label: '医療介護予備費',
        help: '75歳以降に追加の備え（75歳〜年30万、85歳〜年60万）を織り込むかどうかです。',
        kind: 'toggle',
      },
      {
        path: 'income.retirementLumpSum',
        label: '退職金見込み',
        help: '退職金の見込みです。退職／FIRE開始の年に一時収入として反映します。未入力なら0円で試算します。',
        kind: 'number',
        unit: '万円',
        inputNote: '一時収入として、退職／FIREの年に反映',
        placeholder: '例：1000',
        min: 0,
        allowSkip: true,
        allowRecommended: true,
        recommendedValue: 0,
        recommendedLabel: '0円にする',
      },
    ],
  },

  // ── ライフイベント（専用UI） ──
  {
    pageId: 'events',
    stepId: 'detailed-events',
    title: 'ライフイベント',
    purpose: '一時的な大きな出費・収入の予定を確認します。',
    kind: 'events',
  },
];

/** thoroughInput の状態で表示すべきページだけを返す。 */
export function visibleThoroughPages(input: SimulationInput): ThoroughPage[] {
  return THOROUGH_PAGES.filter((p) => !p.showIf || p.showIf(input));
}

/** 最初に表示するページID。 */
export function firstThoroughPageId(input: SimulationInput): string {
  return visibleThoroughPages(input)[0]?.pageId ?? THOROUGH_PAGES[0].pageId;
}

/** ざっくり診断の結果カテゴリ → しっかり診断のステップ への対応。 */
export const ROUGH_TO_DETAILED: Record<StepId, ThoroughStepId> = {
  basic: 'detailed-basic',
  family: 'detailed-family',
  housing: 'detailed-housing',
  fire: 'detailed-fire',
  investment: 'detailed-investment',
};

/** しっかり診断で新規追加する子どもの初期値。 */
export function makeDetailedChild(): ChildInput {
  return {
    currentAge: field(10, 'default_value', '子の年齢', '未入力のため仮の年齢で試算しています。', '歳'),
    ageAssumed: true,
    elementarySchool: field('public', 'default_value', '小学校', '公立で概算しています。'),
    middleSchool: field('public', 'default_value', '中学', '公立で概算しています。'),
    highSchool: field('public', 'default_value', '高校', '公立で概算しています。'),
    university: field('undecided', 'default_value', '大学', '未定（国公立文系・自宅）で概算しています。'),
    uniLiving: field('undecided', 'default_value', '大学時の住まい', '未定（自宅）で概算しています。'),
  };
}

export const CHILD_SCHOOL_OPTIONS = schoolOptions;
export const CHILD_UNI_OPTIONS = uniOptions;
export const CHILD_LIVING_OPTIONS = livingOptions;
