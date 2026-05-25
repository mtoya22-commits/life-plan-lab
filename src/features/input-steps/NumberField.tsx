import { useEffect, useRef, useState } from 'react';

// 数値入力欄。iPhoneで小数点が入力でき、Backspaceで完全に空欄にできる。
// - 入力中は文字列として保持（"0." のような途中状態も保持）。
// - 空欄にしても即座にデフォルト値を再注入しない（onChange(null) を通知）。
// - フォーカス外のとき、外部値の変化（おすすめ/スキップ等）を表示へ反映する。
export function NumberField({
  value,
  onChange,
  placeholder,
  unit,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  unit?: string;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(value == null ? '' : String(value));
  }, [value]);

  const handleChange = (raw: string) => {
    if (raw !== '' && !/^[0-9]*\.?[0-9]*$/.test(raw)) return; // 数字と小数点のみ
    setText(raw);
    if (raw === '' || raw === '.') {
      onChange(null);
      return;
    }
    const n = parseFloat(raw);
    if (Number.isFinite(n)) onChange(n);
  };

  return (
    <div className="field-number">
      <input
        className="input"
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={text}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setText(value == null ? '' : String(value));
        }}
        onChange={(e) => handleChange(e.target.value)}
      />
      {unit && <span className="field-number__unit">{unit}</span>}
    </div>
  );
}
