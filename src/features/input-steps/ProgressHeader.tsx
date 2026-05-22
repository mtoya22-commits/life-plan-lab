// 進捗表示（例: STEP 5 / 18 + プログレスバー）
export function ProgressHeader({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <header className="progress-header">
      <div className="progress-header__label">
        STEP {current} / {total}
      </div>
      <div className="progress-bar" aria-hidden>
        <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
      </div>
    </header>
  );
}
