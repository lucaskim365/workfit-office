import { useState, useEffect } from 'react';

interface OptionsInputProps {
  value: string[];
  onChange: (val: string[]) => void;
}

export function OptionsInput({ value, onChange }: OptionsInputProps) {
  const [text, setText] = useState(value.join(', '));
  
  useEffect(() => {
    setText(value.join(', '));
  }, [value]);

  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const parsed = text.split(',').map((s) => s.trim()).filter(Boolean);
        onChange(parsed);
      }}
      placeholder="옵션(콤마 구분): 영업, 교육, 회의"
      className="mt-1.5 w-full rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none"
    />
  );
}
