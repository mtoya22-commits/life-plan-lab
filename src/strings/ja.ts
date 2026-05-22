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
    redo: '条件を変えて再試算',
  },
  result: {
    heading: '今回の試算結果',
    assumptionsHeading: '今回の試算条件',
    suggestionsHeading: '見直しのヒント',
    disclaimer: 'これは概算です。未来を当てるためではなく、整理するためのものです。',
  },
  band: {
    stable: '安定',
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
