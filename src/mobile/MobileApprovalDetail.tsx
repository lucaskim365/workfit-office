import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { useUsers } from '@/features/user/useUsers';
import { useApprovalDoc, useDecideStep } from '@/features/gw/useApprovals';
import { activeSteps, isActiveApprover } from '@/domain/approvalDoc/engine';
import type { ApprovalDoc, ApprovalStep } from '@/domain/approvalDoc/schema';
import { fmtDocDate, statusColor } from './MobileApprovalList';

/**
 * 모바일 PWA 전자결재 상세 — 문서 열람 + 승인/반려(반려 시 의견 필수).
 * Flutter approval_detail_screen 과 동일 UX. 웹 useDecideStep/엔진 재사용.
 */
export default function MobileApprovalDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const me = user!.id;
  const doc = useApprovalDoc(id);
  const { data: users = [] } = useUsers();
  const decide = useDecideStep();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const back = () => nav('/m/approval');

  const nameOf = (approverId: string, snapshot?: string | null) =>
    snapshot || users.find((u) => u.id === approverId)?.name || approverId;

  const handle = async (decision: '승인' | '반려') => {
    if (!doc) return;
    const myStep = activeSteps(doc).find((s) => s.approverId === me);
    if (!myStep) return;
    if (decision === '반려' && !comment.trim()) {
      window.alert('반려 사유(의견)를 입력하세요.');
      return;
    }
    setBusy(true);
    try {
      await decide.mutateAsync({ id: doc.id, seq: myStep.seq, userId: me, decision, comment: comment.trim() });
      back();
    } catch (e) {
      window.alert(`처리 실패: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  };

  const myTurn = !!doc && isActiveApprover(doc, me);

  return (
    <div className="flex h-full flex-col" style={{ background: '#faf6f0' }}>
      <header className="flex shrink-0 items-center gap-2 px-2 py-3 text-white" style={{ background: '#101830' }}>
        <button onClick={back} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[18px] hover:bg-white/10">←</button>
        <span className="text-[15px] font-bold">전자결재 상세</span>
      </header>

      {!doc ? (
        <div className="grid flex-1 place-items-center text-[12px] text-ink3">문서를 불러오는 중…</div>
      ) : (
        <>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {/* 문서 헤더 카드 */}
            <Card>
              <div className="flex items-center gap-1.5">
                <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: '#101830' }}>{doc.docType}</span>
                <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${statusColor(doc.status)}1f`, color: statusColor(doc.status) }}>{doc.status}</span>
                <span className="ml-auto text-[11px] tabular-nums text-ink3">{doc.docNo}</span>
              </div>
              <div className="mt-2.5 text-[17px] font-bold" style={{ color: '#101830' }}>{doc.title}</div>
              <div className="my-3 h-px bg-black/10" />
              <InfoRow label="기안자" value={`${doc.drafterName || nameOf(doc.drafterId)}${doc.drafterDept ? ` (${doc.drafterDept})` : ''}`} />
              <InfoRow label="기안일시" value={fmtDocDate(doc.submittedAt ?? doc.createdAt)} />
              {doc.amount != null && <InfoRow label="금액" value={`${fmtAmount(doc.amount)} 원`} />}
              {doc.docType === '휴가' && doc.form && (
                <>
                  <InfoRow label="휴가종류" value={doc.form.leaveType} />
                  <InfoRow label="기간" value={`${doc.form.startDate} ~ ${doc.form.endDate}${doc.form.days ? ` (${doc.form.days}일)` : ''}`} />
                </>
              )}
            </Card>

            {/* 결재선 타임라인 */}
            <div>
              <div className="mb-2 text-[14px] font-bold" style={{ color: '#101830' }}>결재선</div>
              <Card>
                <div className="flex flex-col">
                  {doc.steps.map((s) => (
                    <StepRow key={s.seq} doc={doc} step={s} name={nameOf(s.approverId, s.approverName)} />
                  ))}
                </div>
              </Card>
            </div>

            {/* 본문 */}
            <div>
              <div className="mb-2 text-[14px] font-bold" style={{ color: '#101830' }}>본문</div>
              <Card>
                <div className="whitespace-pre-line text-[13px] leading-relaxed text-ink">
                  {doc.body || '(본문 없음)'}
                </div>
              </Card>
            </div>
          </div>

          {/* 액션바 — 내 결재 차례일 때만 */}
          {myTurn && (
            <div className="shrink-0 border-t border-black/10 bg-white p-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="결재 의견 (반려 시 필수)"
                rows={2}
                className="w-full resize-none rounded-lg border border-border px-3 py-2 text-[13px] text-ink outline-none focus:border-amber"
              />
              <div className="mt-2.5 flex gap-2.5">
                <button
                  onClick={() => handle('반려')}
                  disabled={busy}
                  className="flex-1 rounded-lg border py-3 text-[15px] font-bold disabled:opacity-50"
                  style={{ borderColor: '#e0483b', color: '#e0483b' }}
                >
                  반려
                </button>
                <button
                  onClick={() => handle('승인')}
                  disabled={busy}
                  className="flex-1 rounded-lg py-3 text-[15px] font-bold text-white disabled:opacity-50"
                  style={{ background: '#16a34a' }}
                >
                  {busy ? '처리 중…' : '승인'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-black/10 bg-white p-4">{children}</div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 py-0.5">
      <span className="w-16 shrink-0 text-[12.5px] text-ink3">{label}</span>
      <span className="flex-1 text-[12.5px] font-semibold text-ink">{value}</span>
    </div>
  );
}

function StepRow({ doc, step, name }: { doc: ApprovalDoc; step: ApprovalStep; name: string }) {
  const isApproved = step.decision === '승인';
  const isRejected = step.decision === '반려';
  const isActive = activeSteps(doc).some((s) => s.seq === step.seq);
  const color = isApproved ? '#16a34a' : isRejected ? '#e0483b' : isActive ? '#e6960c' : '#c7cace';
  const badgeText = isActive && step.decision === '대기' ? '진행중' : step.decision;

  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: color }}>
        {step.seq}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="shrink-0 text-[10px] font-bold text-ink3">{step.kind}</span>
          <span className="truncate text-[12.5px] font-bold text-ink">
            {name}
            {step.approverPos ? ` ${step.approverPos}` : ''}
          </span>
        </div>
        {step.comment && <div className="mt-0.5 truncate text-[11px] italic text-ink3">“{step.comment}”</div>}
      </div>
      <span
        className="shrink-0 rounded-md px-2 py-0.5 text-[10.5px] font-bold"
        style={{ background: isActive || isApproved || isRejected ? `${color}22` : '#faf6f0', color: isActive || isApproved || isRejected ? color : '#8a8f98' }}
      >
        {badgeText}
      </span>
    </div>
  );
}

function fmtAmount(n: number): string {
  return n.toLocaleString('ko-KR');
}
