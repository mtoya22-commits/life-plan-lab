import type { SimulationInput, SimulationResult } from '../../schema/types';
import { formatMan } from '../../lib/format';
import { UNIVERSITY_ENTRANCE_FEE, UNIVERSITY_UNDECIDED } from '../../engine/constants';

// 教育費の詳細（Bottom Sheet 内）。教育費が発生する年だけを抜き出して表示する。
// 各年の合計に加え、大学 1 年目（age=18）の入学金を別カラムで明示する。
// 数値の出典は末尾の注記に明記する。
export function EducationDetail({ result, input }: { result: SimulationResult; input: SimulationInput }) {
  const years = result.rows.filter((r) => r.expense.education > 0);
  const peakAge = result.indicators.eduPeakResilience.peakAge;

  if (years.length === 0) {
    return <p className="muted">今回の条件では、教育費は計上されていません。</p>;
  }

  // その年の入学金（将来額・インフレ反映後, 万円）を子全員ぶん合算する。
  // child.currentAge + offset === 18 になる年に限り、university 進路別の入学金を加算。
  const baseAge = input.basic.age.value;
  const inflation = input.investment.inflationRate.value / 100;
  const entranceFeeForRowAge = (rowAge: number): number => {
    const offset = rowAge - baseAge;
    if (offset < 0) return 0;
    const inflationFactor = Math.pow(1 + inflation, offset);
    let total = 0;
    for (const child of input.children) {
      if (child.currentAge.value + offset !== 18) continue;
      const uni = child.university.value === 'undecided' ? UNIVERSITY_UNDECIDED : child.university.value;
      total += UNIVERSITY_ENTRANCE_FEE[uni] * inflationFactor;
    }
    return total;
  };

  const hasAnyEntranceFee = years.some((r) => entranceFeeForRowAge(r.age) > 0);

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
            {hasAnyEntranceFee && <th>うち入学金</th>}
          </tr>
        </thead>
        <tbody>
          {years.map((r) => {
            const entrance = entranceFeeForRowAge(r.age);
            return (
              <tr key={r.age}>
                <td>{r.age}歳</td>
                <td>{r.year}</td>
                <td>{formatMan(r.expense.education)}</td>
                {hasAnyEntranceFee && <td className="muted">{entrance > 0 ? formatMan(entrance) : '—'}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted">※ 教育費は今日の物価ベースの初期値にインフレを加味した概算です。</p>
      {hasAnyEntranceFee && (
        <p className="muted">
          ※ 「うち入学金」は、お子さまの大学進学初年度（18歳）に一度だけ加算される金額の概算です。
        </p>
      )}
      <p className="muted edu-sources">
        数値の出典:
        小・中・高は 文部科学省「令和5年度 子供の学習費調査」、
        大学の学費は 文部科学省「令和5年度 私立大学等の入学者に係る学生納付金等調査」と国立大学標準授業料、
        大学の生活費は JASSO（日本学生支援機構）「令和4年度 学生生活調査」を参考にしています。
      </p>
    </div>
  );
}
