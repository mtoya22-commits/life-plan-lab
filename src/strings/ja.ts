// 日本語コピーの集約。エンジンを言語非依存に保つため、表示文言はここへ寄せる。
// トーン: 煽らない。「破綻/危険」ではなく「やや注意/見直し余地あり/条件調整で改善可能」。

export const ja = {
  app: {
    title: '生活設計シミュレーター',
    subtitle: '住宅ローン・教育費・投資・FIRE・老後を、一つの人生の流れとして整理する',
  },
  modeSelect: {
    heading: 'どちらで始めますか？',
    rough: {
      title: 'ざっくり診断',
      desc: '30〜60秒。将来の方向性をまず把握します。',
    },
    thorough: {
      title: 'しっかり診断',
      desc: '入力した分だけ精度が上がります。分からない項目はスキップできます。',
    },
  },
  common: {
    next: '次へ',
    back: '戻る',
    skip: 'スキップ',
    useRecommended: 'おすすめ値を使う',
    seeResult: '結果を見る',
    redo: '最初からやり直す',
    close: '閉じる',
    detailMore: '詳しく見る',
  },
  nav: {
    toModeSelect: 'モード選択へ',
    proceedAnyway: 'このまま進む',
    backToResult: '結果へ戻る',
    recompute: '再計算して結果へ',
    // 未回答時の、止めない・煽らない案内
    incompleteHint: '未回答の項目があります。おすすめ値やスキップも使えます。',
  },
  field: {
    hintNumber: '入力すると、より正確に計算できます。分からなければスキップやおすすめ値も使えます。',
    hintChoice: 'ひとつ選ぶと、より正確に計算できます。',
    skipped: '未入力のまま、標準値で試算します。',
    recommended: 'おすすめ値を使用します。',
    childrenAgeNote: 'お子さまの年齢は、ざっくり診断では仮の値で試算します（結果画面に明示します）。',
  },
  resume: {
    title: '前回の続きから再開しますか？',
    body: '入力した内容が保存されています。',
    resume: '続きから再開',
    fresh: '最初から始める',
  },
  result: {
    heading: 'あなたの人生ダッシュボード',
    dashboardLead: '今回の条件で見た、これからの暮らしの見通しです。',
    summaryHeading: '今回のポイント',
    assumptionsHeading: '今回の試算条件',
    assumptionsToggle: '今回の試算条件を見る',
    suggestionsHeading: '見直しのヒント',
    suggestionsToggle: '見直しのヒントを見る',
    riskFactorsToggle: '見直しが効きやすいポイントを見る',
    editHeading: '条件を変えてみる',
    editLead: '入力内容を修正して再計算できます。気になるところだけ変えて、未来の変化を見られます。',
    deepenHeading: 'もっと正確に見る',
    deepenLead: '入力した内容を引き継いで、しっかり診断で詳しく設定できます。',
    deepenButton: 'しっかり診断で詳しく見る',
    disclaimer: 'これは概算です。未来を当てるためではなく、整理するためのものです。',
    // 主な節目（要約）と詳細
    timelineSummaryHeading: '人生の主な節目',
    timelineMore: 'タイムラインを詳しく見る',
    timelineDetailHeading: '人生タイムライン',
    // カードと詳細シート
    assetCardTitle: '資産推移',
    assetExpand: 'グラフを拡大',
    assetSheetHeading: '資産推移の詳細',
    yearlyHeading: '年ごとの収支（5年ごと）',
    educationCardTitle: '教育費',
    educationSheetHeading: '教育費の詳細',
    mortgageCardTitle: '住宅ローン',
    mortgageSheetHeading: '住宅ローンの詳細',
  },
  editLinks: {
    basic: '基本情報を修正',
    income: '収入を修正',
    expense: '支出を修正',
    family: '家族・教育を修正',
    housing: '住まいを修正',
    fire: 'FIRE条件を修正',
    investment: '投資条件を修正',
    retirement: '老後を修正',
    events: 'ライフイベントを修正',
  },
  band: {
    stable: '安定寄り',
    realistic: 'おおむね現実的',
    needs_adjust: '要調整',
    tough: 'やや注意（条件調整で改善の余地あり）',
  },
  source: {
    user_input: '入力値',
    recommended_value: 'おすすめ値',
    default_value: '標準値',
    skipped: '未入力',
  },
} as const;
