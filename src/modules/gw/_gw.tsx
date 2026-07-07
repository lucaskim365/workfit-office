import type { ReactNode } from 'react';
import type { DocStatus, DocType, StepDecision, StepKind } from '@/domain/approvalDoc/schema';

/**
 * 그룹웨어 공통 UI — 전자결재/휴가 화면이 공유하는 배지·아이콘·포맷터.
 * OrgChartScreen 과 동일한 전역 토큰(ink/panel/teal…)을 사용해 톤을 맞춘다.
 * ([[wireframe-source-of-truth]] 기존 마스터-디테일 디자인 언어 재사용)
 */

/** 화면 상단 브레드크럼 + 타이틀(그룹웨어 / {name}). */
export function GwHead({ icon, name, right }: { icon: string; name: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="mb-1 text-xs font-medium text-ink3">그룹웨어 <span className="px-1">/</span> {name}</div>
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-soft text-teal">{icon}</span>
          <h1 className="text-xl font-bold text-ink">{name}</h1>
        </div>
      </div>
      {right}
    </div>
  );
}

const STATUS_TONE: Record<DocStatus, string> = {
  임시저장: 'bg-ink3/12 text-ink2',
  진행중: 'bg-blue/12 text-blue',
  완료: 'bg-teal/15 text-teal',
  반려: 'bg-red-500/12 text-red-500',
  회수: 'bg-amber/15 text-amber',
};

export function StatusBadge({ status }: { status: DocStatus }) {
  return (
    <span className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${STATUS_TONE[status]}`}>
      {status}
    </span>
  );
}

const DECISION_TONE: Record<StepDecision, string> = {
  대기: 'bg-amber/15 text-amber',
  승인: 'bg-teal/15 text-teal',
  반려: 'bg-red-500/12 text-red-500',
  보류: 'bg-ink3/15 text-ink2',
};

export function DecisionBadge({ decision }: { decision: StepDecision }) {
  return (
    <span className={`inline-block shrink-0 rounded px-1.5 py-px text-[9.5px] font-bold ${DECISION_TONE[decision]}`}>
      {decision}
    </span>
  );
}

/** 결재 구분 라벨 색(참조는 약하게, 전결은 강조). */
export const KIND_TONE: Record<StepKind, string> = {
  결재: 'text-ink2',
  합의: 'text-blue',
  참조: 'text-ink3',
  전결: 'text-teal',
  대결: 'text-amber',
};

export const DOC_TYPE_ICON: Record<DocType, string> = {
  기안: '📝',
  품의: '📑',
  지출결의: '💳',
  휴가: '🏖️',
};

/** 원화 포맷. */
export const won = (n: number | null | undefined) => (n == null ? '—' : '₩' + n.toLocaleString());

/** ISO → 로컬 간략 표기(MM.DD HH:mm). */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}.${dd} ${hh}:${mi}`;
}
