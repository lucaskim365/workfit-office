import type { ReactNode } from 'react';
import { diffDays, isDone, isLate, monthDay, type Live } from '@/domain/pm/rules';
import type { PmTask } from '@/domain/pm/schema';

/**
 * 업무 목록 작은 부품 — 데모 `d4*` 모양을 그룹웨어 토큰으로. 공용 부품에 같은 모양이 없어 PM 전용 (§3.2.2).
 */

/** 진행 막대 + 오늘 위치 눈금 (데모 d4prog) */
export function ProgressBar({ pct, todayPct, big }: { pct: number; todayPct?: number | null; big?: boolean }) {
  return (
    <div className={`relative w-full overflow-visible rounded-full bg-border ${big ? 'h-2.5' : 'h-1.5'}`}>
      <i className="block h-full rounded-full bg-teal" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      {todayPct != null && (
        <em
          className="absolute -top-1 block h-[calc(100%+8px)] w-0.5 rounded bg-navy"
          style={{ left: `${todayPct}%` }}
          title={`오늘 = 기간의 ${todayPct}%`}
        />
      )}
    </div>
  );
}

/** 작은 막대 (묶음 줄) */
export function MiniBar({ pct, w = 48 }: { pct: number; w?: number }) {
  return (
    <span className="inline-block h-1.5 overflow-hidden rounded-full bg-border align-middle" style={{ width: w }}>
      <i className="block h-full bg-teal" style={{ width: `${pct}%` }} />
    </span>
  );
}

export type TaskTone = 'ok' | 'bad' | 'run' | 'plan';
export const toneOf = (t: PmTask, l: Live, today: string): TaskTone =>
  isDone(l) ? 'ok' : isLate(t, l, today) ? 'bad' : l.status === '진행중' ? 'run' : 'plan';

const RING: Record<TaskTone, string> = { ok: 'var(--color-ok)', bad: 'var(--color-danger)', run: 'var(--color-teal)', plan: 'var(--color-ink3)' };

/** 상태 고리 — 채움 = 진행률 (데모 d4ring) */
export function StatusRing({ pct, tone }: { pct: number; tone: TaskTone }) {
  return (
    <span
      className="inline-block h-[18px] w-[18px] flex-none rounded-full"
      style={{ background: `conic-gradient(${RING[tone]} ${pct * 3.6}deg, var(--color-border) 0)`, padding: 3 }}
      title={`진행 ${pct}%`}
    >
      <span className="block h-full w-full rounded-full bg-panel" />
    </span>
  );
}

/** 작은 꼬리표 */
export function Tag({ children, tone = 'plain', title }: { children: ReactNode; tone?: 'plain' | 'bad' | 'run' | 'ok' | 'warn' | 'navy'; title?: string }) {
  const cls = {
    plain: 'bg-panel-alt text-ink2 border-border',
    bad: 'bg-danger/10 text-danger border-danger/30',
    run: 'bg-teal-soft text-teal border-teal/30',
    ok: 'bg-ok/10 text-ok border-ok/30',
    warn: 'bg-amber-soft text-amber border-amber/30',
    navy: 'bg-navy text-white border-navy',
  }[tone];
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-px text-[10.5px] font-bold ${cls}`}>
      {children}
    </span>
  );
}

/** 마감 칸 (데모 due): 일정 없음 / 완료 / N일 지남 / M/D 시작 / 오늘 마감 / D-n */
export function DueCell({ t, l, today }: { t: PmTask; l: Live; today: string }) {
  if (!t.end) {
    return (
      <span className="flex w-[64px] flex-none flex-col items-end text-right leading-tight">
        <b className="text-[12px] text-ink3">-</b>
        <small className="text-[10.5px] text-ink3">일정 없음</small>
      </span>
    );
  }
  const d = diffDays(today, t.end);
  const [c, s] = isDone(l)
    ? ['text-ok', '완료']
    : d < 0
      ? ['text-danger', `${-d}일 지남`]
      : t.start > today
        ? ['text-ink3', `${monthDay(t.start)} 시작`]
        : d === 0
          ? ['text-amber', '오늘 마감']
          : d <= 7
            ? ['text-amber', `D-${d}`]
            : ['text-ink3', `D-${d}`];
  return (
    <span className="flex w-[64px] flex-none flex-col items-end text-right leading-tight">
      <b className="text-[12px] text-ink">{monthDay(t.end)}</b>
      <small className={`text-[10.5px] font-bold ${c}`}>{s}</small>
    </span>
  );
}

/** 이름 머리글자 동그라미 */
export function Avatar({ name }: { name: string }) {
  return (
    <span className="grid h-5 w-5 flex-none place-items-center rounded-full bg-navy text-[9.5px] font-bold text-white">
      {name.slice(-2)}
    </span>
  );
}

/** 빈 화면 안내 — 숨기지 않고 "무엇을 하면 채워지는지" (§3.3, 11/12 B-3) */
export function EmptyHint({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center">
      <div className="text-[13px] font-bold text-ink2">{title}</div>
      {hint && <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink3">{hint}</p>}
    </div>
  );
}

/** 사업 꼬리표 (데모 d4tag) */
export function ProjectTag({ children }: { children: ReactNode }) {
  return <span className="whitespace-nowrap rounded bg-navy px-1.5 py-px text-[10.5px] font-bold text-white">{children}</span>;
}
