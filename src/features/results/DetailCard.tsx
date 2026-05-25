import type { ReactNode } from 'react';
import { ja } from '../../strings/ja';

// コンパクトなカード: タイトル + 重要な結論1つ + 短い説明 + 「詳しく見る」。
// 最初から詳細を全部出さず、詳細は Bottom Sheet に逃がす。
export function DetailCard({
  title,
  value,
  caption,
  onOpen,
  openLabel,
  children,
}: {
  title: string;
  value: ReactNode;
  caption?: string;
  onOpen?: () => void;
  openLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="detail-card">
      <div className="detail-card__title">{title}</div>
      <div className="detail-card__value">{value}</div>
      {caption && <p className="detail-card__caption muted">{caption}</p>}
      {children}
      {onOpen && (
        <button className="link-btn detail-card__more" onClick={onOpen}>
          {openLabel ?? ja.common.detailMore} ›
        </button>
      )}
    </div>
  );
}
