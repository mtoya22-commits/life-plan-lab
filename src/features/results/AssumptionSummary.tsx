import type { AssumptionLine } from '../../schema/types';
import { ja } from '../../strings/ja';

// 「今回の試算条件」。入力値/おすすめ値/標準値/スキップを区別して表示する。信頼性の核心。
export function AssumptionSummary({
  assumptions,
  flags,
}: {
  assumptions: AssumptionLine[];
  flags: string[];
}) {
  return (
    <div className="assumptions">
      <div className="assumptions__title">{ja.result.assumptionsHeading}</div>

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
    </div>
  );
}
