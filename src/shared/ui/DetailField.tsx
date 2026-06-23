import type { ReactNode } from 'react';

interface DetailFieldProps {
  label: string;
  value: ReactNode;
  required?: boolean;
  mono?: boolean;
  /** 셀렉트형 표시(우측 ▾ caret). */
  select?: boolean;
  /** 여러 줄 표시(비고 등). */
  multiline?: boolean;
}

/** 상세 패널의 읽기 필드 — 와이어프레임 AField 정본(라벨 88px + 값 박스). */
export function DetailField({ label, value, required, mono, select, multiline }: DetailFieldProps) {
  return (
    <div className={`grid grid-cols-[88px_1fr] gap-3.5 ${multiline ? 'items-start' : 'items-center'}`}>
      <span className={`text-[12px] font-bold text-ink2 ${multiline ? 'pt-2' : ''}`}>
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      {multiline ? (
        <div className="min-h-[52px] rounded-md border border-border-hi bg-panel px-3.5 py-2.5 text-[12px] leading-relaxed text-ink2">
          {value}
        </div>
      ) : (
        <div
          className={`flex h-[38px] items-center justify-between rounded-md border border-border-hi bg-panel px-3.5 text-[12.5px] text-ink2 ${
            mono ? 'font-mono tabular-nums' : ''
          }`}
        >
          <span className="truncate">{value}</span>
          {select && <span className="text-[8px] text-ink3">▾</span>}
        </div>
      )}
    </div>
  );
}
