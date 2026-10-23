import { forwardRef, type InputHTMLAttributes } from 'react';
import { DateInput } from './DateInput';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

/** RHF register 호환 입력(forwardRef) — 토큰 기반. 날짜 칸은 주말·공휴일 색 달력(DateInput). */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ invalid, className = '', type, ...rest }, ref) => {
    const cls = `h-9 rounded-md border bg-panel px-3 text-[13px] text-ink outline-none transition-colors placeholder:text-ink3 ${
      invalid ? 'border-danger focus:border-danger' : 'border-border-hi focus:border-teal'
    } ${className}`;
    if (type === 'date') return <DateInput ref={ref} {...rest} className={cls} />;
    return <input ref={ref} type={type} {...rest} className={cls} />;
  },
);
TextField.displayName = 'TextField';
