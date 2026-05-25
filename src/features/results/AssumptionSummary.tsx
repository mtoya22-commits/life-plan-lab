import type { AssumptionLine } from '../../schema/types';
import { ja } from '../../strings/ja';

// 「今回の試算条件」。入力値/おすすめ値/標準値/スキップを区別して表示する。信頼性の核心。
export function AssumptionSummary({
  assumptions,
  flags,
  notes,
}: {
  assumptions: AssumptionLine[];
  flags: string[];
  notes: string[];
}) {
  return (
    <div className="assumptions">
      <div className="assumptions__title">{ja.result.assumptionsHeading}</div>

      {/* 前提の扱い（反映済み / 簡略反映 / 記録用）を先に示し、誤解を防ぐ。 */}
      <dl className="assumptions__handling">
        <div className="handling__group">
          <dt className="handling__label handling__label--direct">反映済み</dt>
          <dd>手取り年収・現在資産・生活費・住居費・教育費・年金・老後生活費・退職金・ライフイベント・利回り・インフレ</dd>
        </div>
        <div className="handling__group">
          <dt className="handling__label handling__label--simple">簡略反映</dt>
          <dd>毎月投資額（家計の黒字の範囲・就労終了の前年まで）／暴落シナリオ（投資資産に一時下落）／持ち家維持費（定額）／世帯年収からの手取り換算</dd>
        </div>
        <div className="handling__group">
          <dt className="handling__label handling__label--record">記録用（未反映）</dt>
          <dd>住宅ローンの金利・残高・固定/変動・返済方式・ボーナス払い／配偶者年齢／税・NISA・iDeCo</dd>
        </div>
      </dl>

      {flags.length > 0 && (
        <ul className="assumptions__flags">
          {flags.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      )}

      <table className="assumptions__table">
        <tbody>
          {assumptions.map((a, i) => (
            <tr key={i}>
              <th>{a.label}</th>
              <td>{a.valueText}</td>
              <td>
                <span className="tag" data-source={a.source}>
                  {ja.source[a.source]}
                </span>
              </td>
              <td className="assumptions__note">{a.assumptionText}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {notes.length > 0 && (
        <ul className="assumptions__notes">
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
