import type { Suggestion } from '../../schema/types';
import { ja } from '../../strings/ja';

// 弱い指標に応じた見直しのヒント。煽らず「条件調整で改善できる」トーンで。
export function Suggestions({ suggestions }: { suggestions: Suggestion[] }) {
  if (suggestions.length === 0) return null;
  return (
    <div className="suggestions">
      <div className="suggestions__title">{ja.result.suggestionsHeading}</div>
      <ul className="suggestions__list">
        {suggestions.map((s, i) => (
          <li className="suggestion" key={i}>
            <div className="suggestion__title">{s.title}</div>
            <div className="suggestion__body">{s.body}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
