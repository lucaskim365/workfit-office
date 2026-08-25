import { useState, useEffect } from 'react';

interface EditableHeaderProps {
  value: string;
  onChange: (v: string) => void;
}

export function EditableHeader({ value, onChange }: EditableHeaderProps) {
  const [val, setVal] = useState(value);
  useEffect(() => {
    setVal(value);
  }, [value]);
  return (
    <input
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        if (val !== value) {
          onChange(val);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="w-full rounded border border-border bg-panel-alt px-1.5 py-1 text-[11px] text-ink outline-none focus:border-teal"
    />
  );
}
