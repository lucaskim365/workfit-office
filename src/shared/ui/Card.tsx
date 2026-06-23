import type { ReactNode } from 'react';

export function SectionTitle({ children, dot = false }: { children: ReactNode; dot?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm font-bold tracking-tight text-ink">
      {dot && <span className="h-[15px] w-1 rounded-sm bg-teal" />}
      {children}
    </div>
  );
}

interface CardProps {
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** 공통 카드 — 와이어프레임 shared.jsx Card 정본 이관(Tailwind). */
export function Card({ title, action, className = '', bodyClassName = '', children }: CardProps) {
  return (
    <div
      className={`flex min-h-0 flex-col rounded-[10px] border border-border bg-panel shadow-[0_1px_2px_rgba(23,34,65,0.04)] ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <SectionTitle>{title}</SectionTitle>
          {action}
        </div>
      )}
      <div className={`min-h-0 flex-1 p-4 ${bodyClassName}`}>{children}</div>
    </div>
  );
}
