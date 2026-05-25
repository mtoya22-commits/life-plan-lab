import { useState } from 'react';

// 「？」アイコンの補助説明。用語説明ではなく「どこを見れば入力できるか」を案内する。
export function HelpTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="help">
      <button
        type="button"
        className="help__icon"
        aria-label="補助説明"
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open && <span className="help__bubble">{text}</span>}
    </span>
  );
}
