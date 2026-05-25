import type { ReactNode } from 'react';
import { HelpTooltip } from './HelpTooltip';

// 1問（または同系統3〜4項目）を載せるカード。
export function QuestionCard({
  title,
  help,
  children,
}: {
  title: string;
  help?: string;
  children?: ReactNode;
}) {
  return (
    <div className="question-card">
      <div className="question-card__title">
        {title}
        {help && <HelpTooltip text={help} />}
      </div>
      <div className="question-card__body">{children}</div>
    </div>
  );
}
