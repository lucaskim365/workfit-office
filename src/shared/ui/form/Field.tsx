import type { ReactNode } from 'react';

interface FieldProps {
  label?: ReactNode;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}

/** 폼 필드 래퍼 — 라벨 + 필수 표시 + 에러/힌트 메시지. */
export function Field({ label, required, error, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[11px] font-bold text-ink2">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className="text-[10.5px] font-medium text-danger">{error}</span>
      ) : hint ? (
        <span className="text-[10.5px] text-ink3">{hint}</span>
      ) : null}
    </div>
  );
}
