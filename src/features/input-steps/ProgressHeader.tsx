// 進捗表示。終わりが見えるよう、現在地と「あと約○分」を控えめに表示する。
export function ProgressHeader({
  label,
  current,
  total,
  etaText,
}: {
  label?: string;
  current: number;
  total: number;
  etaText?: string;
}) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <header className="progress-header">
      <div className="progress-header__label">
        {label && <span className="progress-header__name">{label}</span>}
        <span>
          {current} / {total}
        </span>
        {etaText && <span className="progress-header__eta">・{etaText}</span>}
      </div>
      <div className="progress-bar" aria-hidden>
        <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
      </div>
    </header>
  );
}
