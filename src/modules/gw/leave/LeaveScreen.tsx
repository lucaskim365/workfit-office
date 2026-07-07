import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { useLeave } from '@/features/gw/useLeave';
import { activeSteps } from '@/domain/approvalDoc/engine';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';
import { fmtDateTime, GwHead, StatusBadge } from '@/modules/gw/_gw';
import { ApprovalDraftModal } from '@/modules/gw/approval/ApprovalDraftModal';

/**
 * 휴가관리(§7.4) — 상단 잔여 요약(도출) + 휴가 신청(결재 모달 재사용, 유형=휴가 고정) +
 * 내 휴가 내역(상태 배지·결재 진행 딥링크). 휴가는 별도 도메인 없이 결재 엔진을 재사용한다.
 */
export default function LeaveScreen() {
  const { user } = useAuth();
  const nav = useNavigate();
  const bal = useLeave(user?.id);
  const [open, setOpen] = useState(false);

  if (!user) return <div className="p-10 text-center text-[13px] text-ink3">로그인이 필요합니다.</div>;

  const goDoc = (d: ApprovalDoc) => nav(`/gw/approval?doc=${d.id}`);

  return (
    <div className="mx-auto max-w-5xl">
      <GwHead
        icon="🏖️"
        name="휴가관리"
        right={
          <button onClick={() => setOpen(true)} className="rounded-lg bg-teal px-3.5 py-2 text-[12.5px] font-bold text-white hover:opacity-90">
            + 휴가 신청
          </button>
        }
      />

      {/* 잔여 요약 */}
      <div className="mt-5 grid grid-cols-4 gap-3">
        <BalCard label="연차 부여" value={bal.grant} unit="일" tone="ink" />
        <BalCard label="사용" value={bal.used} unit="일" tone="blue" />
        <BalCard label="진행중" value={bal.pending} unit="일" tone="amber" />
        <BalCard label="잔여" value={bal.remaining} unit="일" tone="teal" strong />
      </div>
      {bal.otherUsed > 0 && (
        <p className="mt-2 text-[11px] text-ink3">※ 병가·경조·공가 등 기타 승인 {bal.otherUsed}일은 연차 잔여와 별도로 집계됩니다.</p>
      )}

      {/* 내 휴가 내역 */}
      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-panel">
        <div className="border-b border-border px-4 py-3 text-[13px] font-bold text-ink">내 휴가 내역 <span className="text-ink3">· {bal.myDocs.length}</span></div>
        <div className="divide-y divide-border">
          {bal.isLoading && <div className="py-10 text-center text-[12px] text-ink3">불러오는 중…</div>}
          {!bal.isLoading && bal.myDocs.length === 0 && <div className="py-14 text-center text-[12px] text-ink3">신청한 휴가가 없습니다.</div>}
          {bal.myDocs.map((d) => (
            <button key={d.id} onClick={() => goDoc(d)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-panel-alt">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-soft text-[16px]">🏖️</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-semibold text-ink">{d.form?.leaveType ?? '휴가'} · {d.form?.days ?? 0}일</span>
                  <StatusBadge status={d.status} />
                </div>
                <div className="mt-0.5 text-[11px] text-ink3">
                  {d.form ? `${d.form.startDate} ~ ${d.form.endDate}` : d.title} · {d.docNo}
                </div>
              </div>
              <div className="shrink-0 text-right text-[10.5px] text-ink3">
                <div>{fmtDateTime(d.submittedAt ?? d.createdAt)}</div>
                {d.status === '진행중' && <div className="mt-0.5 text-amber">현재: {currentApproverLabel(d)}</div>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {open && <ApprovalDraftModal me={user} fixedType="휴가" onClose={() => setOpen(false)} />}
    </div>
  );
}

const TONE: Record<string, string> = { ink: 'text-ink', blue: 'text-blue', amber: 'text-amber', teal: 'text-teal' };
function BalCard({ label, value, unit, tone, strong }: { label: string; value: number; unit: string; tone: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border bg-panel px-4 py-3.5 ${strong ? 'border-teal/40 bg-teal-soft/30' : 'border-border'}`}>
      <div className="mb-1.5 text-[11px] font-semibold text-ink2">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-[24px] font-extrabold tabular-nums ${TONE[tone]}`}>{value}</span>
        <span className="text-[11px] font-semibold text-ink3">{unit}</span>
      </div>
    </div>
  );
}

/** 진행중 문서의 현재 결재자 이름(표기용). org 미조회 — id 폴백. */
function currentApproverLabel(d: ApprovalDoc): string {
  const act = activeSteps(d);
  return act.length ? `${act.length}명 대기` : '진행';
}
