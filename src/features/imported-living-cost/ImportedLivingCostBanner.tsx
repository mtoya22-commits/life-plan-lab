import { useInputStore } from '../../store/inputStore';
import { ja } from '../../strings/ja';
import { monthlyYenToMan } from '../../lib/importedLivingCost';

// 生活費見直しシミュレーター（別アプリ）からの取り込みを、画面上の各所で控えめに告知する小バナー。
// 取り込みが無い／ユーザーが手動編集済みのときは何も描画しない。
// 種別ごとに見出しや本文をわずかに変える:
//   - modeSelect: 起動直後の控えめな読み込み告知（モード選択画面の上部）
//   - inputPage : 生活費入力ページ上部での「読み込み済み」案内
//   - result    : 結果画面の「試算条件」直前の反映元表示

interface Props {
  variant: 'modeSelect' | 'inputPage' | 'result';
}

function manText(yen: number): string {
  const man = monthlyYenToMan(yen);
  return `${man}万円`;
}

export function ImportedLivingCostBanner({ variant }: Props) {
  const importedLivingCost = useInputStore((s) => s.importedLivingCost);
  const livingCostManuallyEdited = useInputStore((s) => s.livingCostManuallyEdited);

  if (!importedLivingCost || livingCostManuallyEdited) return null;

  const man = manText(importedLivingCost.monthlyYen);

  if (variant === 'modeSelect') {
    return (
      <p className="imported-banner" role="status">
        <span className="imported-banner__title">{ja.livingCostImport.modeSelectTitle}</span>
        <span className="imported-banner__value">{ja.livingCostImport.modeSelectValue(man)}</span>
      </p>
    );
  }

  if (variant === 'inputPage') {
    return (
      <p className="imported-banner" role="status">
        <span>{ja.livingCostImport.inputPage(man)}</span>
      </p>
    );
  }

  // variant === 'result'
  const label = ja.livingCostImport.sourceLabels[importedLivingCost.source];
  return (
    <p className="imported-banner" role="status">
      <span className="imported-banner__title">{ja.livingCostImport.resultValue(man)}</span>
      <span className="imported-banner__value">{ja.livingCostImport.resultSource(label)}</span>
    </p>
  );
}
