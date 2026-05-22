import { ja } from '../../strings/ja';

// 「迷ったらこれ」のおすすめ値を採用するボタン。
export function RecommendedButton({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="btn btn--recommended" onClick={onClick}>
      {label ?? ja.common.useRecommended}
    </button>
  );
}
