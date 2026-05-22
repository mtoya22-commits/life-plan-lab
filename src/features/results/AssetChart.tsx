import type { YearRow } from '../../schema/types';
import { formatMan } from '../../lib/format';

// 年齢軸の資産推移グラフ（骨格）。
// TODO(実装): Recharts(AreaChart) + ReferenceLine/ReferenceDot で
//   FIRE開始・ローン完済・年金開始・枯渇などの節目マーカーを重ねる。
export function AssetChart({ rows }: { rows: YearRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.endAssets));
  // 骨格段階は簡易バーで推移を可視化する。
  const sample = rows.filter((_, i) => i % 5 === 0);

  return (
    <div className="asset-chart">
      <div className="asset-chart__title">資産推移（年齢軸）</div>
      <div className="asset-chart__bars">
        {sample.map((r) => (
          <div className="asset-chart__col" key={r.age} title={`${r.age}歳: ${formatMan(r.endAssets)}`}>
            <div
              className="asset-chart__bar"
              style={{ height: `${Math.max(0, (r.endAssets / max) * 100)}%` }}
            />
            <div className="asset-chart__age">{r.age}</div>
          </div>
        ))}
      </div>
      <p className="muted">※ 骨格表示。実装時に Recharts のグラフへ差し替えます。</p>
    </div>
  );
}
