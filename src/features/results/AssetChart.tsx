import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { YearRow } from '../../schema/types';
import type { LifeEventEntry, LifeEventType } from './lifeEvents';
import { formatMan } from '../../lib/format';

// =============================================================================
// 資産推移グラフ（Recharts）。横軸=年齢、縦軸=資産。系列は総資産1本のみ。
// 通常表示はコンパクト、詳細は Bottom Sheet 内で拡大（ツールチップ・節目マーカー）。
// 株価チャートのような細かさより、年齢軸・人生イベント・資産の大きな流れを優先する。
// =============================================================================

const COLORS = {
  line: '#2f5246', // 深い青緑（メイン）
  grid: '#e7e3d9', // 薄いウォームグレー
  muted: '#8c918a',
  depletion: '#8a6749', // 落ち着いたブラウン（赤は使わない）
};

const COLORS_PV = '#2f5246'; // 現在価値（主線・深緑）
const COLORS_NOMINAL = '#a39c8a'; // 将来額（補助線・ウォームグレー。主線より控えめ）

interface ChartPoint {
  age: number;
  year: number;
  assets: number; // 将来額（名目）
  assetsPV: number; // 現在価値
}

function toChartData(rows: YearRow[]): ChartPoint[] {
  if (rows.length === 0) return [];
  // 先頭は「現在」＝入力した現在資産（年初）。以降は各年の年末資産。
  const first = rows[0];
  const current: ChartPoint = {
    age: first.age,
    year: first.year,
    assets: Math.round(first.startAssets),
    assetsPV: Math.round(first.startAssets * (first.debug?.presentValueFactor ?? 1)),
  };
  const rest = rows.slice(1).map((r) => ({
    age: r.age,
    year: r.year,
    assets: Math.round(r.endAssets),
    assetsPV: Math.round(r.endAssets * (r.debug?.presentValueFactor ?? 1)),
  }));
  return [current, ...rest];
}

function buildTicks(startAge: number): number[] {
  const ticks: number[] = [];
  if (startAge % 5 !== 0) ticks.push(startAge);
  for (let a = Math.ceil(startAge / 5) * 5; a <= 95; a += 5) ticks.push(a);
  if (ticks[ticks.length - 1] !== 95) ticks.push(95);
  return ticks;
}

function yDomainOf(data: ChartPoint[]): [number, number] {
  const values = data.map((d) => d.assets);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  return [Math.floor(min), Math.ceil(max * 1.05) || 1];
}

function formatYTick(v: number): string {
  if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(1)}億`;
  return v.toLocaleString('ja-JP');
}

function markerColor(type: LifeEventType): string {
  if (type === 'depletion') return COLORS.depletion;
  if (type === 'now' || type === 'horizon') return COLORS.line;
  return COLORS.muted;
}

function ChartFallback() {
  return <p className="muted">グラフを表示するには追加条件が必要です。</p>;
}

/** 通常表示（コンパクト）。現在価値ベース1本。主要イベントのみ、ツールチップなし。 */
export function AssetChartMini({ rows, events }: { rows: YearRow[]; events: LifeEventEntry[] }) {
  const data = toChartData(rows);
  if (data.length < 2) return <ChartFallback />;

  const startAge = data[0].age;
  const ticks = buildTicks(startAge);
  const yDomain = yDomainOf(data);
  const markers = events.filter((e) => e.major);

  return (
    <div className="asset-rc asset-rc--compact">
      <ResponsiveContainer width="100%" height={120}>
        <ComposedChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="assetFillMini" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS_PV} stopOpacity={0.18} />
              <stop offset="100%" stopColor={COLORS_PV} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="age"
            type="number"
            domain={[startAge, 95]}
            ticks={ticks}
            tickFormatter={(a) => `${a}`}
            tick={{ fontSize: 10, fill: COLORS.muted }}
            tickLine={false}
            axisLine={{ stroke: COLORS.grid }}
            interval="preserveStartEnd"
          />
          <YAxis hide domain={yDomain} />
          {markers.map((e) => (
            <ReferenceLine
              key={`${e.type}-${e.age}`}
              x={e.age}
              stroke={markerColor(e.type)}
              strokeDasharray="3 3"
              strokeWidth={1}
            />
          ))}
          <Area
            dataKey="assetsPV"
            stroke={COLORS_PV}
            strokeWidth={2}
            fill="url(#assetFillMini)"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 拡大表示（Bottom Sheet 内）。ツールチップ・全イベントマーカー・年次テーブル。 */
export function AssetChartFull({ rows, events }: { rows: YearRow[]; events: LifeEventEntry[] }) {
  const data = toChartData(rows);
  if (data.length < 2) return <ChartFallback />;

  const startAge = data[0].age;
  const ticks = buildTicks(startAge);
  const yDomain = yDomainOf(data);

  const eventsByAge = new Map<number, string[]>();
  for (const e of events) {
    const list = eventsByAge.get(e.age) ?? [];
    list.push(e.title);
    eventsByAge.set(e.age, list);
  }

  return (
    <div className="asset-rc">
      <p className="muted chart-axis-note">
        縦軸：資産（万円）／横軸：年齢。将来額はインフレを反映した金額、現在価値は今のお金に割り戻した目安です。
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 16, right: 14, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="assetFillFull" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS_PV} stopOpacity={0.18} />
              <stop offset="100%" stopColor={COLORS_PV} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={COLORS.grid} vertical={false} />
          <XAxis
            dataKey="age"
            type="number"
            domain={[startAge, 95]}
            ticks={ticks}
            tickFormatter={(a) => `${a}歳`}
            tick={{ fontSize: 11, fill: COLORS.muted }}
          />
          <YAxis domain={yDomain} width={46} tickFormatter={formatYTick} tick={{ fontSize: 10, fill: COLORS.muted }} />
          <Tooltip content={(props) => <ChartTooltip {...props} eventsByAge={eventsByAge} />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {events.map((e) => (
            <ReferenceLine
              key={`${e.type}-${e.age}`}
              x={e.age}
              stroke={markerColor(e.type)}
              strokeDasharray="3 3"
              strokeWidth={1}
            />
          ))}
          {/* 将来額（補助線）と現在価値（主線・塗り） */}
          <Line
            dataKey="assets"
            name="将来額"
            stroke={COLORS_NOMINAL}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
          />
          <Area
            dataKey="assetsPV"
            name="現在価値"
            stroke={COLORS_PV}
            strokeWidth={2}
            fill="url(#assetFillFull)"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <ul className="chart-markers">
        {events.map((e) => (
          <li className="chart-markers__item" key={`${e.type}-${e.age}`}>
            <span className="chart-markers__age">{e.age}歳</span>
            <span className="chart-markers__title">{e.title}</span>
          </li>
        ))}
      </ul>

      <YearlyTable rows={rows} eventsByAge={eventsByAge} />
    </div>
  );
}

// Recharts Tooltip のペイロード型は緩いので最小限で受ける。
function ChartTooltip(props: {
  active?: boolean;
  payload?: Array<{ payload?: ChartPoint }>;
  eventsByAge: Map<number, string[]>;
}) {
  const { active, payload, eventsByAge } = props;
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  if (!d) return null;
  const evs = eventsByAge.get(d.age);
  return (
    <div className="rc-tooltip">
      <div className="rc-tooltip__head">
        {d.age}歳（{d.year}年）
      </div>
      <div>現在価値：{formatMan(d.assetsPV)}</div>
      <div className="muted">将来額：{formatMan(d.assets)}</div>
      {evs?.map((t, i) => (
        <div className="rc-tooltip__event" key={i}>
          ● {t}
        </div>
      ))}
    </div>
  );
}

function YearlyTable({ rows, eventsByAge }: { rows: YearRow[]; eventsByAge: Map<number, string[]> }) {
  const startAge = rows[0]?.age;
  const picked = rows.filter((r, i) => i % 5 === 0 || eventsByAge.has(r.age));
  // 各行は「その年齢時点」の資産。先頭(現在)は入力した現在資産＝年初、それ以外は年末。
  const assetAt = (r: YearRow) => (r.age === startAge ? r.startAssets : r.endAssets);
  return (
    <table className="yearly-table">
      <caption className="yearly-table__caption">年齢ごとの資産と主なイベント（5年ごと＋イベント年）</caption>
      <thead>
        <tr>
          <th>年齢</th>
          <th>西暦</th>
          <th>資産額（将来）</th>
          <th>現在価値</th>
          <th>主なイベント</th>
        </tr>
      </thead>
      <tbody>
        {picked.map((r) => (
          <tr key={r.age}>
            <td>{r.age === startAge ? `${r.age}歳（現在）` : `${r.age}歳`}</td>
            <td>{r.year}</td>
            <td>{formatMan(assetAt(r))}</td>
            <td>{formatMan(assetAt(r) * (r.debug?.presentValueFactor ?? 1))}</td>
            <td className="yearly-table__event">{eventsByAge.get(r.age)?.join('・') ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
