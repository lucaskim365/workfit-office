import { forwardRef, type InputHTMLAttributes } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

/** RHF register 호환 입력(forwardRef) — 토큰 기반. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ invalid, className = '', ...rest }, ref) => (
    <input
      ref={ref}
      {...rest}
      className={`h-9 rounded-md border bg-panel px-3 text-[13px] text-ink outline-none transition-colors placeholder:text-ink3 ${
        invalid ? 'border-danger focus:border-danger' : 'border-border-hi focus:border-teal'
      } ${className}`}
    />
  ),
);
TextField.displayName = 'TextField';
