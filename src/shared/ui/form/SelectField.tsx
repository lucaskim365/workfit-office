import { forwardRef, type SelectHTMLAttributes } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  options: Option[];
}

/** RHF register 호환 셀렉트(forwardRef) — 토큰 기반 + 커스텀 caret. */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ invalid, options, className = '', ...rest }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        {...rest}
        className={`h-9 w-full appearance-none rounded-md border bg-panel pl-3 pr-8 text-[13px] text-ink outline-none transition-colors ${
          invalid ? 'border-danger focus:border-danger' : 'border-border-hi focus:border-teal'
        } ${className}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[8px] text-ink3">
        ▾
      </span>
    </div>
  ),
);
SelectField.displayName = 'SelectField';
