import { educationImportStatus, useInputStore } from '../../store/inputStore';
import { ja } from '../../strings/ja';

// 教育費ピークシミュレーター（別アプリ）からの取り込みを、画面上の各所で控えめに告知する小バナー。
// 表示は fingerprint 由来の 4 状態（none / active / pending / edited）で切り替える:
//   - pending: どの variant でも通常バナー・参考行の代わりに「反映する」を優先表示する。
//   - active : 取り込み条件が計算に使われている。variant ごとの通常表示。
//   - edited : 取り込み後に総合版で手動変更済み。通常バナーは出さず、
//              結果画面は控えめな注記のみ・入力画面は「再適用する」導線のみ。
// Sim の金額（ピーク・総額）は計算に使わず「取り込み時の参考値」として表示するだけ。
// savedAt・ピーク・総額が不正・欠損のときは、該当表示を安全に省略する。

type Variant = 'modeSelect' | 'inputPageRough' | 'inputPageThorough' | 'result';

const t = ja.educationImport;

/** 円 → 「N,NNN万円」表記。不正値は undefined（呼び出し側で省略）。 */
function yenToManLabel(yen?: number): string | undefined {
  if (typeof yen !== 'number' || !Number.isFinite(yen) || yen <= 0) return undefined;
  return `${Math.round(yen / 10000).toLocaleString('ja-JP')}万円`;
}

/** savedAt → 「YYYY年M月D日」。parse できなければ undefined。 */
function savedAtLabel(savedAt?: string): string | undefined {
  if (!savedAt) return undefined;
  const time = Date.parse(savedAt);
  if (!Number.isFinite(time)) return undefined;
  const d = new Date(time);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 保存から 1 年以上経っているか（savedAt のみを基準にする。baselineYear は使わない）。 */
function isStale(savedAt?: string): boolean {
  if (!savedAt) return false;
  const time = Date.parse(savedAt);
  if (!Number.isFinite(time)) return false;
  return Date.now() - time >= 365 * 24 * 60 * 60 * 1000;
}

export function ImportedEducationBanner({ variant }: { variant: Variant }) {
  const importedEducation = useInputStore((s) => s.importedEducation);
  const educationManuallyEdited = useInputStore((s) => s.educationManuallyEdited);
  const appliedEducationImportFingerprint = useInputStore(
    (s) => s.appliedEducationImportFingerprint,
  );
  const applyNow = useInputStore((s) => s.applyImportedEducationNow);
  const release = useInputStore((s) => s.releaseImportedEducation);

  const status = educationImportStatus({
    importedEducation,
    educationManuallyEdited,
    appliedEducationImportFingerprint,
  });
  if (status === 'none' || !importedEducation) return null;

  // pending: 新しい条件がある。通常バナー・参考行は出さず「反映する」を優先表示。
  // 反映前の計算は現在の手動入力のまま維持される。
  if (status === 'pending') {
    return (
      <div className="imported-banner imported-banner--action" role="status">
        <span>{t.pendingText}</span>
        <div className="imported-banner__actions">
          <button type="button" className="btn btn--small" onClick={applyNow}>
            {t.applyButton}
          </button>
        </div>
      </div>
    );
  }

  // edited: 手動変更済み。控えめな注記＋（入力画面のみ）再適用導線。参考行は出さない。
  if (status === 'edited') {
    if (variant === 'result') {
      return (
        <p className="imported-banner imported-banner--muted" role="status">
          {t.editedNote}
        </p>
      );
    }
    if (variant === 'inputPageRough' || variant === 'inputPageThorough') {
      return (
        <div className="imported-banner imported-banner--muted imported-banner--action" role="status">
          <span>{t.editedNote}</span>
          <div className="imported-banner__actions">
            <button type="button" className="btn btn--small" onClick={applyNow}>
              {t.reapplyButton}
            </button>
          </div>
        </div>
      );
    }
    return null; // modeSelect では出さない
  }

  // ---- status === 'active' ----
  const count = importedEducation.children.length;

  if (variant === 'modeSelect') {
    return (
      <p className="imported-banner" role="status">
        <span className="imported-banner__title">{t.modeSelectTitle}</span>
        <span className="imported-banner__value">
          {t.modeSelectValue(count, importedEducation.peakYear)}
        </span>
      </p>
    );
  }

  if (variant === 'inputPageRough') {
    // ざっくり診断: 教育設問はロック表示。詳細条件が不可視でも計算に使われていることを明示し、
    // 詳細変更はしっかり診断へ誘導する。解除ボタンで通常編集へ戻せる。
    const ages = importedEducation.children.map((c) => `${c.currentAge}歳`).join('・');
    return (
      <div className="imported-banner imported-banner--action" role="status">
        <span className="imported-banner__title">{t.roughSummaryTitle}</span>
        <span>{t.roughSummaryChildren(ages)}</span>
        <span className="imported-banner__value">{t.roughSummaryNote}</span>
        <div className="imported-banner__actions">
          <button type="button" className="btn btn--small" onClick={release}>
            {t.releaseButton}
          </button>
        </div>
      </div>
    );
  }

  if (variant === 'inputPageThorough') {
    return (
      <p className="imported-banner" role="status">
        <span>{t.inputPageThorough}</span>
      </p>
    );
  }

  // variant === 'result'
  const saved = savedAtLabel(importedEducation.savedAt);
  const reference = t.resultReference(
    yenToManLabel(importedEducation.totalFutureCostYen),
    importedEducation.peakYear,
  );
  return (
    <p className="imported-banner" role="status">
      <span className="imported-banner__title">{t.resultTitle(saved)}</span>
      <span className="imported-banner__value">{t.resultRecalcNote}</span>
      {reference && <span className="imported-banner__value">{reference}</span>}
      {isStale(importedEducation.savedAt) && (
        <span className="imported-banner__value">{t.staleNote}</span>
      )}
    </p>
  );
}
