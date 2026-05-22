import type { SimulationInput, SimulationResult, YearRow } from '../../schema/types';

// 人生タイムライン。通常は主な節目を最大5件、詳細は全イベントを Bottom Sheet で。

export interface TimelineItem {
  age: number;
  label: string;
  year?: number;
}

/** 主な節目を最大5件に要約する。 */
export function buildTimelineSummary(result: SimulationResult, input: SimulationInput): TimelineItem[] {
  const items: TimelineItem[] = [];
  const startAge = input.basic.age.value;
  items.push({ age: startAge, label: '現在' });

  if (input.children.length > 0) {
    items.push({ age: result.indicators.eduPeakResilience.peakAge, label: '教育費ピーク' });
  }

  const fireEvent = result.rows
    .flatMap((r) => r.events)
    .find((e) => e.kind === 'fire_start' || e.kind === 'side_fire_start');
  if (fireEvent) items.push({ age: fireEvent.age, label: fireEvent.label });

  const payoff = result.rows.flatMap((r) => r.events).find((e) => e.kind === 'mortgage_payoff');
  if (payoff) items.push({ age: payoff.age, label: payoff.label });

  const longevity = result.indicators.assetLongevityAge;
  if (longevity !== null && longevity < 95) {
    items.push({ age: longevity, label: '資産が尽きる試算' });
  } else {
    items.push({ age: 95, label: '95歳まで資産を維持' });
  }

  // 年齢で重複を除き、昇順に。最大5件。
  const seen = new Set<number>();
  return items
    .sort((a, b) => a.age - b.age)
    .filter((it) => (seen.has(it.age) ? false : (seen.add(it.age), true)))
    .slice(0, 5);
}

/** 通常表示の要約タイムライン。 */
export function TimelineSummary({ items }: { items: TimelineItem[] }) {
  return (
    <ul className="timeline__list">
      {items.map((m, i) => (
        <li className="timeline__item" key={`${m.age}-${i}`}>
          <span className="timeline__age">{m.age}歳</span>
          <span className="timeline__label">{m.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** 詳細表示。全イベントを年齢・西暦つきで並べる。 */
export function TimelineFull({ rows }: { rows: YearRow[] }) {
  const markers = rows.flatMap((r) => r.events.map((e) => ({ age: e.age, year: r.year, label: e.label })));
  if (markers.length === 0) return <p className="muted">表示する節目がありません。</p>;
  return (
    <ul className="timeline__list">
      {markers.map((m, i) => (
        <li className="timeline__item" key={`${m.age}-${i}`}>
          <span className="timeline__age">{m.age}歳</span>
          <span className="timeline__year muted">{m.year}</span>
          <span className="timeline__label">{m.label}</span>
        </li>
      ))}
    </ul>
  );
}
