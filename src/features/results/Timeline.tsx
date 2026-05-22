import type { YearRow } from '../../schema/types';

// 人生タイムライン（骨格）。教育費ピーク・ローン完済・FIRE・年金などの節目を並べる。
// TODO(実装): 年齢軸の横並びタイムラインUIにし、AssetChart と軸を揃える。
export function Timeline({ rows }: { rows: YearRow[] }) {
  const markers = rows.flatMap((r) => r.events.map((e) => ({ age: e.age, label: e.label })));

  return (
    <div className="timeline">
      <div className="timeline__title">人生の節目</div>
      {markers.length === 0 ? (
        <p className="muted">表示する節目がありません。</p>
      ) : (
        <ul className="timeline__list">
          {markers.map((m, i) => (
            <li className="timeline__item" key={`${m.age}-${i}`}>
              <span className="timeline__age">{m.age}歳</span>
              <span className="timeline__label">{m.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
