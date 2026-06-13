import type { ReactNode } from 'react';

// コンパクトなカード: タイトル + 重要な結論1つ + 短い説明 + 任意の inline 展開（子要素）。
// 詳細は <details> を子要素として渡すことで、その場で展開する（モーダルを使わない）。
// STEP11.21 以前は onOpen で BottomSheet を開いていたが、iframe 内の position:fixed が
// 親ページのスクロールで画面外に流れる問題を構造的に避けるため inline 化した。
export function DetailCard({
  title,
  value,
  caption,
  children,
}: {
  title: string;
  value: ReactNode;
  caption?: string;
  children?: ReactNode;
}) {
  return (
    <div className="detail-card">
      <div className="detail-card__title">{title}</div>
      <div className="detail-card__value">{value}</div>
      {caption && <p className="detail-card__caption muted">{caption}</p>}
      {children}
    </div>
  );
}
