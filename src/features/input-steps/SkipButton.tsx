import { ja } from '../../strings/ja';

// スキップボタン。スキップ項目は結果画面で必ず明示する。
export function SkipButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="btn btn--skip" onClick={onClick}>
      {ja.common.skip}
    </button>
  );
}
