import type { SimulationResult } from '../../schema/types';
import { formatMan } from '../../lib/format';

// 教育費の詳細（Bottom Sheet 内）。教育費が発生する年だけを抜き出して表示する。
export function EducationDetail({ result }: { result: SimulationResult }) {
  const years = result.rows.filter((r) => r.expense.education > 0);
  const peakAge = result.indicators.eduPeakResilience.peakAge;

  if (years.length === 0) {
    return <p className="muted">今回の条件では、教育費は計上されていません。</p>;
  }

  return (
    <div>
      <p>
        教育費が大きくなるのは <strong>{peakAge}歳ごろ</strong> の見込みです。大学進学の時期に支出が増えやすくなります。
      </p>
      <table className="yearly-table">
        <thead>
          <tr>
            <th>年齢</th>
            <th>西暦</th>
            <th>教育費</th>
          </tr>
        </thead>
        <tbody>
          {years.map((r) => (
            <tr key={r.age}>
              <td>{r.age}歳</td>
              <td>{r.year}</td>
              <td>{formatMan(r.expense.education)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">※ 教育費は今日の物価ベースの初期値にインフレを加味した概算です。</p>
    </div>
  );
}
