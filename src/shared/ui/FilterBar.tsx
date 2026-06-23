import type { ReactNode } from 'react';
import { ActionButton } from './ActionBar';

const CONTROL =
  'h-8 rounded-md border border-border-hi bg-panel px-3 text-[12px] text-ink outline-none transition-colors placeholder:text-ink3 focus:border-teal';

export interface Option {
  value: string;
  label: string;
}

/** 라벨 + 컨트롤 한 쌍 — 와이어프레임 OeeLab 정본. */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="whitespace-nowrap text-[11px] font-semibold text-ink3">{label}</span>
      {children}
    </div>
  );
}

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  width?: number;
}

/** 셀렉트 — 토큰 기반 네이티브 select. */
export function Select({ value, onChange, options, width }: SelectProps) {
  return (
    <div className="relative inline-flex">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={width ? { width } : undefined}
        className={`${CONTROL} appearance-none pr-7 font-semibold`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[8px] text-ink3">
        ▾
      </span>
    </div>
  );
}

interface TextInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: number;
  onEnter?: () => void;
}

/** 텍스트 입력 — 토큰 기반. */
export function TextInput({ value, onChange, placeholder, width, onEnter }: TextInputProps) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
      placeholder={placeholder}
      style={width ? { width } : undefined}
      className={CONTROL}
    />
  );
}

interface FilterBarProps {
  children?: ReactNode;
  /** 우측 추가 슬롯(상태 표시 등). */
  right?: ReactNode;
  /** 지정 시 우측에 기본 '조회' 버튼을 렌더. */
  onSearch?: () => void;
  className?: string;
}

/**
 * 필터 바 — 와이어프레임 화면 상단 필터 카드 정본.
 * FilterField/Select/TextInput을 children으로 배치하고,
 * onSearch를 주면 우측에 '조회' 버튼이 붙는다.
 */
export function FilterBar({ children, right, onSearch, className = '' }: FilterBarProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2.5 rounded-[10px] border border-border bg-panel p-3.5 ${className}`}
    >
      {children}
      {(right || onSearch) && (
        <div className="ml-auto flex items-center gap-2">
          {right}
          {onSearch && (
            <ActionButton icon="search" label="조회" variant="primary" onClick={onSearch} />
          )}
        </div>
      )}
    </div>
  );
}
