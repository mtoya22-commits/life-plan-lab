import type { SimulationInput } from '../../schema/types';
import { formatMan } from '../../lib/format';

// 住宅ローンの詳細（Bottom Sheet 内）。入力済みの範囲で表示し、未入力は深掘りを案内する。
export function MortgageDetail({ input }: { input: SimulationInput }) {
  const h = input.housing;
  const baseAge = input.basic.age.value;

  if (h.type.value === 'rent') {
    return (
      <p>
        賃貸として試算しています。毎月の家賃 <strong>{formatMan(h.rent.value)}</strong> を住宅費に反映しています。
      </p>
    );
  }

  const hasLoanDetail = h.monthlyPayment.value > 0 || h.balance.value > 0 || h.remainingYears.value > 0;
  if (!hasLoanDetail) {
    return (
      <p className="muted">
        住宅ローンの詳細は未入力です。しっかり診断で、残高・毎月返済額・金利・固定/変動などを設定すると精度が上がります。
      </p>
    );
  }

  const rows: { label: string; value: string }[] = [];
  if (h.monthlyPayment.value > 0) {
    rows.push({ label: '毎月返済額', value: formatMan(h.monthlyPayment.value) });
    rows.push({ label: '年間住宅費', value: formatMan(h.monthlyPayment.value * 12) });
  }
  if (h.balance.value > 0) rows.push({ label: 'ローン残高', value: formatMan(h.balance.value) });
  if (h.remainingYears.value > 0) {
    rows.push({ label: '残年数', value: `${h.remainingYears.value}年` });
    rows.push({ label: '完済予定', value: `${baseAge + h.remainingYears.value}歳ごろ` });
  }
  if (h.rate.value > 0) rows.push({ label: '金利', value: `${h.rate.value}%（${h.rateType.value === 'fixed' ? '固定' : '変動'}）` });
  if (h.fixedEndAge.value > 0) rows.push({ label: '固定終了', value: `${h.fixedEndAge.value}歳` });

  return (
    <table className="yearly-table">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <th>{r.label}</th>
            <td>{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
