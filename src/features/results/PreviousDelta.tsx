import { useInputStore } from '../../store/inputStore';
import { formatAge, formatMan } from '../../lib/format';
import { ja } from '../../strings/ja';

// 「前回の条件より ±N万円」の差分チップ。Hero 直下に置く。
// 続けて変更・クイック調整のたびに 1 つ前の結果と比較し、試行錯誤の効果を即座に見せる。
// トーン: muted ベース。プラスは band-stable / マイナスは band-needs（赤は使わない）。
export function PreviousDelta() {
  const result = useInputStore((s) => s.result);
  const prev = useInputStore((s) => s.previousIndicators);

  if (!result || !prev) return null;

  const parts: { text: string; dir: 'up' | 'down' }[] = [];

  // 95歳時点（現在価値）の差分。万円未満の変動はノイズなので出さない。
  const pvDelta = Math.round(result.indicators.assetsAt95PresentValue - prev.assetsAt95PresentValue);
  if (pvDelta !== 0) {
    parts.push({
      text: `95歳時点 ${pvDelta > 0 ? '+' : '−'}${formatMan(Math.abs(pvDelta))}（現在価値）`,
      dir: pvDelta > 0 ? 'up' : 'down',
    });
  }

  // 資産寿命の差分。null は「95歳以降も維持」。
  const prevAge = prev.assetLongevityAge;
  const nowAge = result.indicators.assetLongevityAge;
  if (prevAge !== nowAge) {
    if (prevAge !== null && nowAge !== null) {
      const d = nowAge - prevAge;
      if (d !== 0) parts.push({ text: `資産寿命 ${d > 0 ? '+' : '−'}${Math.abs(d)}年`, dir: d > 0 ? 'up' : 'down' });
    } else {
      // null ↔ 数値 の変化（枯渇しない ↔ N歳で枯渇）
      parts.push({
        text: `資産寿命 ${formatAge(prevAge)} → ${formatAge(nowAge)}`,
        dir: nowAge === null ? 'up' : 'down',
      });
    }
  }

  if (parts.length === 0) return null;

  return (
    <p className="delta-chip muted" aria-live="polite">
      {ja.result.deltaPrefix}：
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && '・'}
          <span className={`delta-chip__value delta-chip__value--${p.dir}`}>{p.text}</span>
        </span>
      ))}
    </p>
  );
}
