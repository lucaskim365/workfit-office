import type { ApprovalDoc } from '@/domain/approvalDoc/schema';
import { STATUS_BADGE } from '../utils/approvalUtils';

export function DocStatusBadge({ doc, me }: { doc: ApprovalDoc; me?: string }) {
  if (doc.status === '완료' && doc.execution) {
    const execStatus = doc.execution.status;
    let badgeClass = 'bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300';
    if (execStatus === '처리중') {
      badgeClass = 'bg-amber-500/10 text-amber-600 border-amber-500/30 font-semibold';
    } else if (execStatus === '시행완료') {
      badgeClass = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-semibold';
    }
    return (
      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] border ${badgeClass}`}>
        {execStatus}
      </span>
    );
  }

  let badge = STATUS_BADGE[doc.status] ?? { label: doc.status, toneClass: 'bg-panel-alt text-ink2 border-border' };

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
