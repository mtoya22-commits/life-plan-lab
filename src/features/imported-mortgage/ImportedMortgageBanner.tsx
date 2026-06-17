import { useInputStore } from '../../store/inputStore';
import { ja } from '../../strings/ja';
import { balanceYenToMan, monthlyYenToMan } from '../../lib/importedMortgage';
import { formatMan } from '../../lib/format';

// 別アプリ「住宅ローンシミュレーター」からの取り込みを画面の各所で控えめに告知する小バナー。
// 取り込みが無い／ユーザーが手動編集済みのときは何も描画しない。
// 月額・残高のどちらか一方しか来ないケースを文言レベルで吸収する。
//   - modeSelect: モード選択画面上部での「読み込みました」案内
//   - inputPage : 住まい/住宅ローン入力ページ上部での「読み込み済み」案内
//   - result    : 結果画面の「試算条件」付近での「反映された住宅ローン」案内

interface Props {
  variant: 'modeSelect' | 'inputPage' | 'result';
}

function monthlyManText(yen: number | undefined): string | null {
  if (yen === undefined) return null;
  return `${monthlyYenToMan(yen)}万円`;
}
function balanceManText(yen: number | undefined): string | null {
  if (yen === undefined) return null;
  return formatMan(balanceYenToMan(yen));
}

export function ImportedMortgageBanner({ variant }: Props) {
  const importedMortgage = useInputStore((s) => s.importedMortgage);
  const mortgageManuallyEdited = useInputStore((s) => s.mortgageManuallyEdited);

  if (!importedMortgage || mortgageManuallyEdited) return null;

  const monthly = monthlyManText(importedMortgage.monthlyPaymentYen);
  const balance = balanceManText(importedMortgage.balanceYen);
  if (!monthly && !balance) return null;

  if (variant === 'modeSelect') {
    return (
      <p className="imported-banner" role="status">
        <span className="imported-banner__title">{ja.mortgageImport.modeSelectTitle}</span>
        {monthly && (
          <span className="imported-banner__value">{ja.mortgageImport.modeSelectMonthly(monthly)}</span>
        )}
        {balance && (
          <span className="imported-banner__value">{ja.mortgageImport.modeSelectBalance(balance)}</span>
        )}
      </p>
    );
  }

  if (variant === 'inputPage') {
    let body: string;
    if (monthly && balance) body = ja.mortgageImport.inputPageBoth(monthly, balance);
    else if (monthly) body = ja.mortgageImport.inputPageMonthlyOnly(monthly);
    else body = ja.mortgageImport.inputPageBalanceOnly(balance!);
    return (
      <p className="imported-banner" role="status">
        <span>{body}</span>
      </p>
    );
  }

  // variant === 'result'
  const label = ja.mortgageImport.sourceLabels[importedMortgage.source];
  return (
    <p className="imported-banner" role="status">
      {monthly && (
        <span className="imported-banner__title">{ja.mortgageImport.resultMonthly(monthly)}</span>
      )}
      {balance && (
        <span className="imported-banner__value">{ja.mortgageImport.resultBalance(balance)}</span>
      )}
      <span className="imported-banner__value">{ja.mortgageImport.resultSource(label)}</span>
    </p>
  );
}
