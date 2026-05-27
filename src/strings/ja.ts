// 日本語コピーの集約。エンジンを言語非依存に保つため、表示文言はここへ寄せる。
// トーン: 煽らない。「破綻/危険」ではなく「やや注意/見直し余地あり/条件調整で改善可能」。

export const ja = {
  app: {
    title: '生活設計シミュレーター',
    subtitle: '住宅ローン・教育費・投資・FIRE・老後を、ひとつの人生の流れで整理します。',
  },
  modeSelect: {
    eyebrow: '生活設計ダッシュボード',
    heading: 'まずは、見たい詳しさを選んでください',
    cta: 'この詳しさで始める',
    note: 'まずは概算で、将来の節目と資産の流れを確認できます。',
    devMenu: '開発用メニュー（DEV）',
    rough: {
      title: 'ざっくり診断',
      meta: '30〜60秒',
      badge: 'はじめての方に',
      desc: '将来の方向性を、まず手早く確認します。',
      points: ['まず試したい方向け', '未入力でも概算できます'],
    },
    thorough: {
      title: 'しっかり診断',
      meta: '約5〜8分',
      desc: '入力した分だけ、教育費・住宅ローン・FIRE後の見通しが具体的になります。',
      points: ['条件を詳しく見たい方向け', '入力した分だけ具体化'],
    },
  },
  common: {
    next: '次へ',
    back: '戻る',
    skip: '未入力で進む',
    useRecommended: '標準例を使う',
    seeResult: '結果を見る',
    redo: '最初からやり直す',
    close: '閉じる',
    detailMore: '詳しく見る',
    // 公開前提の免責（断定・保証に見えない範囲で）
    disclaimer:
      'このシミュレーションは、入力条件に基づいて将来の見通しを整理するための概算です。将来の結果を保証するものではなく、投資判断や金融商品の推奨を行うものではありません。税制・社会保険・住宅ローン控除・NISA/iDeCoなどは一部簡略化しています。実際の判断は、必要に応じて専門家へご確認ください。',
    disclaimerShort: '入力条件に基づく概算です。将来を保証するものではなく、投資助言でもありません。',
  },
  nav: {
    toModeSelect: 'モード選択へ',
    proceedAnyway: 'このまま進む',
    backToResult: '結果へ戻る',
    recompute: '再計算して結果へ',
    // 未回答時の、止めない・煽らない案内
    incompleteHint: '未入力の項目があります。標準例や「未入力で進む」も使えます。',
    // 入力中の安心感（控えめに、冒頭などで一度だけ）
    reassure: '分かる範囲で大丈夫です。未入力でも概算でき、あとから変えて再計算できます。',
    // 各ステップでの「入力済み / 未入力」の控えめな自己確認用ステータス。
    // 目的は入力強制ではなく見落とし防止。煽らないトーン。
    stepStatus: (done: number, total: number): string =>
      `このステップ：${done}/${total}項目入力済み${done < total ? '。未入力でも次へ進めます' : ''}`,
    // 未入力のまま「次へ」を押したときの軽い確認パネル
    confirmIncomplete: '未入力の項目があります。未入力のまま次へ進みますか？',
    showIncomplete: '未入力項目を見る',
    confirmProceed: 'このまま次へ',
  },
  field: {
    hintNumber: '入力すると、より正確になります。分からなければ「未入力で進む」や入力例も使えます。',
    hintChoice: 'ひとつ選ぶと、より正確になります。',
    skipped: '未入力のまま、標準値で概算します。あとから変更できます。',
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
    riskFactorsToggle: '見直しポイントを見る',
    cautiousToggle: '慎重条件で見る',
    cautiousLead: '長期の利回りを低めに、物価上昇をやや高めに見た場合の目安です。将来を予測するものではなく、前提を変えた確認用です。',
    cautiousNote: '暴落シナリオは一時的な投資資産の下落、慎重条件は長期前提を厳しめに見るもので、別の見方です。',
    editHeading: '条件を変えてみる',
    editLead: '入力内容を修正して再計算できます。気になるところだけ変えて、未来の変化を見られます。',
    deepenHeading: 'もっと正確に見る',
    deepenLead: '入力した内容を引き継いで、しっかり診断で詳しく設定できます。',
    deepenButton: 'しっかり診断で詳しく見る',
    disclaimerLead: 'これは概算です。未来を当てるためではなく、整理するためのものです。',
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
    recommended_value: '標準例',
    default_value: '標準値',
    skipped: '未入力',
  },
} as const;
