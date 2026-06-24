import type { ReactNode } from 'react';

export { C, MKpis, FBar, FField, FSel, FInput, Bar, th, td } from '../mat/_mat';

/** 영업관리 화면 머리말 — 영업 관리 / {sub}. */
export function MHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">{title}</h1>
        <p className="mt-0.5 whitespace-nowrap text-xs text-ink3">영업 관리 / {sub || title}</p>
      </div>
      {actions}
    </div>
  );
}

export const won = (n: number) => '₩' + n.toLocaleString();
