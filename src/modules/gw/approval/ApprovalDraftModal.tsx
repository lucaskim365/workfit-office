import { useEffect, useRef, useState } from 'react';
import type { User } from '@/domain/user/schema';
import {
  DOC_TYPES,
  LEAVE_TYPES,
  type ApprovalDoc,
  type ApprovalStep,
  type DocType,
  type LeaveForm,
  type LeaveType,
} from '@/domain/approvalDoc/schema';
import type { ApprovalDraftInput } from '@/data/approvalDoc/approvalDoc.repo';
import { useCreateDraft, useSaveDraft, useSubmitApproval } from '@/features/gw/useApprovals';
import { useRouteEngine } from '@/features/gw/useRouteEngine';
import { ApprovalLineBuilder } from '@/modules/gw/approval/ApprovalLineBuilder';
import { DOC_TYPE_ICON } from '@/modules/gw/_gw';

/**
 * 상신 모달(§7.2) — 유형 선택 → 결재선 빌더 → 본문/금액/휴가필드 → [임시저장][상신].
 * 신규 작성 또는 임시저장 문서 편집. 상신은 초안 저장 후 엔진 submit 으로 흐른다.
 * `fixedType` 지정 시 유형을 고정(선택기 숨김)하고 자동 상신선을 프리필한다(휴가 신청 재사용).
 */

/** 날짜 차이(일). endDate 포함. 유효하지 않으면 0. */
function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

export function ApprovalDraftModal({
  me,
  editDoc,
  fixedType,
  onClose,
}: {
  me: User;
  editDoc?: ApprovalDoc | null;
  fixedType?: DocType;
  onClose: () => void;
}) {
  const [docType, setDocType] = useState<DocType>(editDoc?.docType ?? fixedType ?? '기안');
  const [title, setTitle] = useState(editDoc?.title ?? '');
  const [body, setBody] = useState(editDoc?.body ?? '');
  const [amount, setAmount] = useState<string>(editDoc?.amount != null ? String(editDoc.amount) : '');
  const [steps, setSteps] = useState<ApprovalStep[]>(editDoc?.steps ?? []);
  // 휴가 필드
  const [leaveType, setLeaveType] = useState<LeaveType>(editDoc?.form?.leaveType ?? '연차');
  const [startDate, setStartDate] = useState(editDoc?.form?.startDate ?? '');
  const [endDate, setEndDate] = useState(editDoc?.form?.endDate ?? '');
  const [error, setError] = useState('');

  const create = useCreateDraft();
  const save = useSaveDraft();
  const submitM = useSubmitApproval();
  const route = useRouteEngine();
  const busy = create.isPending || save.isPending || submitM.isPending;

  // fixedType(예: 휴가) 신규 작성이면 룰 엔진으로 결재선을 1회 프리필(사용자가 이어서 수정 가능).
  const prefilled = useRef(false);
  useEffect(() => {
    if (!fixedType || editDoc || prefilled.current || route.isLoading) return;
    if (steps.length > 0) { prefilled.current = true; return; }
    const line = route.build({ drafterId: me.id, docType: fixedType, amount: null });
    if (line.length) { setSteps(line); prefilled.current = true; }
  }, [fixedType, editDoc, route, me.id, steps.length]);

  // 반려·회수 문서를 편집 중이면 재상신 흐름(임시저장 버튼 숨김).
  const isResubmit = !!editDoc && editDoc.status !== '임시저장';
  const isLeave = docType === '휴가';
  const isAmount = docType === '품의' || docType === '지출결의';
  const leaveDays = isLeave ? (leaveType === '반차' ? 0.5 : daysBetween(startDate, endDate)) : 0;

  const amountNum = isAmount && amount.trim() ? Number(amount.replace(/[^0-9]/g, '')) : null;

  const buildInput = (): ApprovalDraftInput => {
    const form: LeaveForm | null = isLeave ? { leaveType, startDate, endDate, days: leaveDays } : null;
    return {
      docType,
      title: title.trim(),
      drafterId: me.id,
      drafterDept: me.dept,
      steps,
      amount: amountNum,
      body: body.trim(),
      form,
    };
  };

  const validate = (forSubmit: boolean): string | null => {
    if (!title.trim()) return '제목을 입력하세요.';
    if (isLeave && (!startDate || !endDate || leaveDays <= 0)) return '휴가 기간을 올바르게 입력하세요.';
    if (isAmount && amountNum == null) return '금액을 입력하세요.';
    if (forSubmit && !steps.some((s) => s.kind !== '참조')) return '상신하려면 결재자를 1명 이상 지정하세요.';
    return null;
  };

  const persistDraft = async (): Promise<string> => {
    const input = buildInput();
    if (editDoc) {
      await save.mutateAsync({ id: editDoc.id, patch: input });
      return editDoc.id;
    }
    const created = await create.mutateAsync(input);
    return created.id;
  };

  const onSaveDraft = async () => {
    const err = validate(false);
    if (err) return setError(err);
    setError('');
    try {
      await persistDraft();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  const onSubmit = async () => {
    const err = validate(true);
    if (err) return setError(err);
    setError('');
    try {
      const id = await persistDraft();
      await submitM.mutateAsync({ id, userId: me.id });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '상신에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
          <div className="text-[15px] font-bold text-ink">
            {isResubmit ? '반려 문서 수정·재상신' : editDoc ? '기안 문서 편집' : fixedType === '휴가' ? '휴가 신청' : '새 결재 상신'}
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-[16px] text-ink3 hover:bg-panel-alt">✕</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* 유형 선택(고정 유형이면 숨김) */}
          {!fixedType && (
            <div className="mb-4">
              <div className="mb-1.5 text-[11px] font-bold text-ink2">문서 유형</div>
              <div className="grid grid-cols-4 gap-1.5">
                {DOC_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDocType(t)}
                    className={`rounded-lg border px-2 py-2 text-[12px] font-semibold ${docType === t ? 'border-teal bg-teal-soft text-teal' : 'border-border bg-panel-alt text-ink2 hover:border-border-hi'}`}
                  >
                    {DOC_TYPE_ICON[t]} {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 제목 */}
          <Field label="제목">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="문서 제목"
              className="w-full rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-[13px] text-ink outline-none focus:border-teal"
            />
          </Field>

          {/* 금액(품의·지출결의) */}
          {isAmount && (
            <Field label="금액(원)">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="numeric"
                placeholder="예: 3000000"
                className="w-full rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-[13px] text-ink outline-none focus:border-teal"
              />
              {amountNum != null && <span className="mt-1 block text-[11px] text-ink3">₩{amountNum.toLocaleString()}</span>}
            </Field>
          )}

          {/* 휴가 필드 */}
          {isLeave && (
            <div className="grid grid-cols-3 gap-2">
              <Field label="휴가 종류">
                <select value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveType)} className="w-full rounded-lg border border-border-hi bg-panel-alt px-2 py-2 text-[12.5px] text-ink outline-none focus:border-teal">
                  {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="시작일">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-lg border border-border-hi bg-panel-alt px-2 py-2 text-[12.5px] text-ink outline-none focus:border-teal" />
              </Field>
              <Field label={`종료일 (${leaveDays}일)`}>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-lg border border-border-hi bg-panel-alt px-2 py-2 text-[12.5px] text-ink outline-none focus:border-teal" />
              </Field>
            </div>
          )}

          {/* 본문 */}
          <Field label="본문">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="내용을 입력하세요"
              className="w-full resize-none rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-[12.5px] leading-relaxed text-ink outline-none focus:border-teal"
            />
          </Field>

          {/* 결재선 빌더 */}
          <div className="mt-2">
            <div className="mb-1.5 text-[11px] font-bold text-ink2">결재선</div>
            <ApprovalLineBuilder steps={steps} onChange={setSteps} drafterId={me.id} docType={docType} amount={amountNum} />
          </div>

          {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[11.5px] font-semibold text-red-500">{error}</p>}
        </div>

        {/* 푸터 액션 */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button onClick={onClose} disabled={busy} className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-ink3 hover:bg-panel-alt disabled:opacity-50">취소</button>
          {!isResubmit && <button onClick={onSaveDraft} disabled={busy} className="rounded-lg border border-border-hi bg-panel-alt px-3.5 py-2 text-[12.5px] font-semibold text-ink2 hover:border-teal hover:text-teal disabled:opacity-50">임시저장</button>}
          <button onClick={onSubmit} disabled={busy} className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50">{busy ? '처리 중…' : isResubmit ? '재상신' : '상신'}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[11px] font-bold text-ink2">{label}</span>
      {children}
    </label>
  );
}
