import type { LifeEventEntry } from './lifeEvents';

// 人生タイムライン。通常は主な節目（要約）、詳細は全イベントを Bottom Sheet で。
// イベントは lifeEvents.ts の単一ソースを参照する（グラフのマーカーと同一データ）。

/** 通常表示の要約タイムライン。 */
export function TimelineSummary({ items }: { items: LifeEventEntry[] }) {
  return (
    <ul className="timeline__list">
      {items.map((m, i) => (
        <li className="timeline__item" key={`${m.age}-${i}`}>
          <span className="timeline__age">{m.age}歳</span>
          <span className="timeline__label">{m.title}</span>
        </li>
      ))}
    </ul>
  );
}

/** 詳細表示。全イベントを年齢・西暦・説明つきで並べる。 */
export function TimelineFull({ events }: { events: LifeEventEntry[] }) {
  if (events.length === 0) return <p className="muted">表示する節目がありません。</p>;
  return (
    <ul className="timeline__list timeline__list--detail">
      {events.map((m, i) => (
        <li className="timeline__item timeline__item--detail" key={`${m.age}-${i}`}>
          <div className="timeline__row">
            <span className="timeline__age">{m.age}歳</span>
            <span className="timeline__year muted">{m.year}</span>
            <span className="timeline__label">{m.title}</span>
          </div>
          <p className="timeline__desc muted">{m.description}</p>
        </li>
      ))}
    </ul>
  );
}
