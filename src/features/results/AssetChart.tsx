import type { YearRow } from '../../schema/types';
import { formatMan } from '../../lib/format';
import { ja } from '../../strings/ja';

// 資産推移グラフ（簡易バー）。通常表示はコンパクト、詳細は拡大表示に分ける。
// TODO(将来): Recharts(AreaChart)＋節目マーカーへ差し替える。

/** 通常表示（コンパクト）。情報を詰め込みすぎない。 */
export function AssetChartMini({ rows }: { rows: YearRow[] }) {
  const sample = rows.filter((_, i) => i % 10 === 0);
  return <Bars sample={sample} max={chartMax(rows)} compact />;
}

/** 拡大表示（Bottom Sheet 内）。年ごとの収支テーブルも添える。 */
export function AssetChartFull({ rows }: { rows: YearRow[] }) {
  const sample = rows.filter((_, i) => i % 2 === 0);
  const yearly = rows.filter((_, i) => i % 5 === 0);
  return (
    <div className="asset-chart-full">
      <Bars sample={sample} max={chartMax(rows)} />
      <table className="yearly-table">
        <caption className="yearly-table__caption">{ja.result.yearlyHeading}</caption>
        <thead>
          <tr>
            <th>年齢</th>
            <th>西暦</th>
            <th>収入</th>
            <th>支出</th>
            <th>残資産</th>
          </tr>
        </thead>
        <tbody>
          {yearly.map((r) => (
            <tr key={r.age}>
              <td>{r.age}歳</td>
              <td>{r.year}</td>
              <td>{formatMan(r.income.total)}</td>
              <td>{formatMan(r.expense.total)}</td>
              <td>{formatMan(r.endAssets)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function chartMax(rows: YearRow[]): number {
  return Math.max(1, ...rows.map((r) => r.endAssets));
}

function Bars({ sample, max, compact }: { sample: YearRow[]; max: number; compact?: boolean }) {
  return (
    <div className={`asset-chart__bars${compact ? ' asset-chart__bars--compact' : ''}`}>
      {sample.map((r) => (
        <div className="asset-chart__col" key={r.age} title={`${r.age}歳: ${formatMan(r.endAssets)}`}>
          <div
            className="asset-chart__bar"
            style={{ height: `${Math.max(0, (r.endAssets / max) * 100)}%` }}
          />
          {!compact && <div className="asset-chart__age">{r.age % 10 === 0 ? r.age : ''}</div>}
        </div>
      ))}
    </div>
  );
}
