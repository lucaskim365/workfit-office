import type { ApprovalDoc } from '@/domain/approvalDoc/schema';
import { STATUS_BADGE } from '../utils/approvalUtils';

export function DocStatusBadge({ doc, me }: { doc: ApprovalDoc; me?: string }) {
  const effectiveStatus = doc.status === '시행대기' ? '완료' : doc.status === '시행반송' ? '반려' : doc.status;
  let badge = STATUS_BADGE[effectiveStatus] ?? { label: effectiveStatus, toneClass: 'bg-panel-alt text-ink2 border-border' };

  if (doc.status === '진행중' && me) {
    const isMyTurn = doc.steps.some(
      (s) => s.kind !== '참조' && s.approverId === me && s.decision === '대기'
    );
    if (isMyTurn) {
      badge = { label: '내 결재 순서', toneClass: 'bg-red-500 text-white font-extrabold border-red-500 animate-pulse' };
    }
  }

  return (
    <div className="inline-flex items-center gap-1">
      {doc.isPostApproval && (
        <span className="inline-flex items-center gap-0.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-600 dark:text-rose-400">
          <span>🚨</span>
          <span>후결</span>
        </span>
      )}
      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] border ${badge.toneClass}`}>
        {badge.label}
      </span>
    </div>
  );
}
