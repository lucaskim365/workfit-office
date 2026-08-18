import { useState, useMemo, useEffect } from 'react';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';
import { useUsers } from '@/features/user/useUsers';
import { departmentRepo } from '@/data/department/department.repo';
import {
  useAllExecutions,
  useClaimExecution,
  useAssignExecutorV2,
  useReleaseExecution,
  useCompleteExecutionV2,
  useReturnExecution,
  useResubmitExecution,
  useCancelExecution,
} from '@/features/gw/useApprovals';
import { fmtDateTime } from '@/modules/gw/_gw';

interface ApprovalExecutionPanelProps {
  doc: ApprovalDoc;
  userId: string;
  forceFullView?: boolean;
}

export function ApprovalExecutionPanel({ doc, userId, forceFullView = false }: ApprovalExecutionPanelProps) {
  const { data: users = [] } = useUsers();
  
  // 신규 복수 시행 훅 및 뮤테이션 연동
  const { data: deptExecutions = [] } = useAllExecutions();
  const claimM = useClaimExecution();
  const assignM = useAssignExecutorV2();
  const releaseM = useReleaseExecution();
  const completeM = useCompleteExecutionV2();
  const returnM = useReturnExecution();
  const resubmitM = useResubmitExecution();
  const cancelM = useCancelExecution();

  const [depts, setDepts] = useState<any[]>([]);
  const [activeExecId, setActiveExecId] = useState<string | null>(null);
  
  // 모달 상태
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  
  // 입력 폼 필드들
  const [completedAt, setCompletedAt] = useState(() => new Date().toISOString().split('T')[0]);
  const [comment, setComment] = useState('');
  const [returnReasonType, setReturnReasonType] = useState<'SUPPLEMENT' | 'APPROVAL_CHANGE'>('SUPPLEMENT');
  const [assigneeId, setAssigneeId] = useState('');
  
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    departmentRepo.list().then(setDepts);
  }, []);

  const meUser = useMemo(() => users.find((u) => u.id === userId), [users, userId]);

  // 이 문서와 연결된 실제 시행 임무들 필터링
  const docExecutions = useMemo(() => {
    return deptExecutions.filter((e) => e.documentId === doc.id);
  }, [deptExecutions, doc.id]);

  // 하위 호환성 (Fallback for legacy doc.execution)
  const finalExecutions = useMemo(() => {
    if (docExecutions.length > 0) return docExecutions;
    
    if (doc.execution) {
      const statusMap: Record<string, any> = {
        '시행완료': 'COMPLETED',
        '처리중': 'IN_PROGRESS',
        '대기중': 'UNASSIGNED'
      };
      return [{
        id: `${doc.id}_legacy`,
        documentId: doc.id,
        docNo: doc.docNo,
        docTitle: doc.title,
        docType: doc.docType,
        drafterId: doc.drafterId,
        drafterName: doc.drafterName ?? doc.drafterId,
        targetDeptId: doc.execution.targetId,
        targetDeptNameSnapshot: doc.execution.targetType === 'DEPT' ? doc.execution.targetId : '개인 지정',
        assigneeId: doc.execution.executorId,
        assigneeNameSnapshot: doc.execution.executorId ? (users.find(u => u.id === doc.execution!.executorId)?.name ?? doc.execution.executorId) : null,
        status: statusMap[doc.execution.status] || 'UNASSIGNED',
        visibility: doc.visibility ?? '부서',
        dispatchedAt: doc.execution.startedAt || doc.completedAt,
        receivedAt: doc.execution.startedAt || doc.completedAt,
        assignedAt: doc.execution.startedAt,
        completedAt: doc.execution.completedAt,
        updatedAt: doc.execution.startedAt || doc.completedAt || new Date().toISOString(),
        comment: doc.execution.comment,
        returnReasonType: null,
        isLegacy: true
      }];
    }
    return [];
  }, [docExecutions, doc, users]);

  // 기안자/기안부서 중심 열람 허용 + 시행 부서(수신 부서) 관점 권한 제한 필터링
  const visibleExecutions = useMemo(() => {
    if (forceFullView) return finalExecutions;

    const myDeptObj = depts.find((d) => d.name === meUser?.dept);
    const myDeptId = myDeptObj?.id;
    const drafterUser = users.find((u) => u.id === doc.drafterId);
    const drafterCurrentDeptName = drafterUser?.dept ?? '';
    const drafterCurrentDeptObj = depts.find((dept) => dept.name === drafterCurrentDeptName);
    const drafterCurrentDeptId = drafterCurrentDeptObj?.id;
    const docDeptId = doc.drafterDeptId || drafterCurrentDeptId;

    const isSameDept = docDeptId 
      ? docDeptId === myDeptId 
      : doc.drafterDept === meUser?.dept;

    const isDrafterOrDrafterDept = doc.drafterId === userId || (meUser?.dept && isSameDept);
    const isPublic = doc.visibility === '전사';
    const isAdmin = meUser?.roleGroup === 'ADMIN';

    if (isDrafterOrDrafterDept || isPublic || isAdmin) {
      return finalExecutions;
    }

    // 본인 부서 시행 건만 열람 허용
    return finalExecutions.filter((exec) => {
      return (myDeptId && exec.targetDeptId === myDeptId) || exec.targetDeptNameSnapshot === meUser?.dept;
    });
  }, [finalExecutions, doc, meUser, userId, depts, forceFullView]);

  // 문서 결재 상태가 최종 '완료', '시행대기', '시행반송'이 아니거나 표시할 시행 임무가 없으면 패널 숨김
  if (!['완료', '시행대기', '시행반송'].includes(doc.status) || visibleExecutions.length === 0) return null;

  const handleClaim = async (execId: string) => {
    setErrorMsg('');
    try {
      await claimM.mutateAsync({ executionId: execId, userId, userName: meUser?.name ?? userId });
    } catch (e: any) {
      setErrorMsg(e.message || '업무 접수에 실패했습니다.');
    }
  };

  const handleRelease = async (execId: string) => {
    setErrorMsg('');
    try {
      await releaseM.mutateAsync({ executionId: execId, userId, userName: meUser?.name ?? userId });
    } catch (e: any) {
      setErrorMsg(e.message || '담당 업무 반납에 실패했습니다.');
    }
  };

  const handleResubmit = async (execId: string) => {
    setErrorMsg('');
    try {
      await resubmitM.mutateAsync({ executionId: execId, userId, userName: meUser?.name ?? userId });
    } catch (e: any) {
      setErrorMsg(e.message || '보완 후 재상신에 실패했습니다.');
    }
  };

  const handleCancel = async (execId: string) => {
    setErrorMsg('');
    try {
      await cancelM.mutateAsync({ executionId: execId, userId, userName: meUser?.name ?? userId });
    } catch (e: any) {
      setErrorMsg(e.message || '시행 취소 처리에 실패했습니다.');
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExecId || !assigneeId) return;
    setErrorMsg('');
    const targetUser = users.find(u => u.id === assigneeId);
    try {
      await assignM.mutateAsync({
        executionId: activeExecId,
        executorId: assigneeId,
        executorName: targetUser?.name ?? assigneeId,
        actorId: userId,
        actorName: meUser?.name ?? userId
      });
      setShowAssignModal(false);
      setAssigneeId('');
      setActiveExecId(null);
    } catch (e: any) {
      setErrorMsg(e.message || '담당자 지정에 실패했습니다.');
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExecId) return;
    setErrorMsg('');
    if (comment.length > 500) {
      setErrorMsg('의견은 최대 500자까지 기입할 수 있습니다.');
      return;
    }
    try {
      await completeM.mutateAsync({
        executionId: activeExecId,
        userId,
        userName: meUser?.name ?? userId,
        completedAt,
        comment
      });
      setShowCompleteModal(false);
      setComment('');
      setActiveExecId(null);
    } catch (e: any) {
      setErrorMsg(e.message || '완료 처리에 실패했습니다.');
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExecId || !comment.trim()) {
      setErrorMsg('반송 사유를 상세히 입력해 주세요.');
      return;
    }
    setErrorMsg('');
    try {
      await returnM.mutateAsync({
        executionId: activeExecId,
        userId,
        userName: meUser?.name ?? userId,
        comment,
        reasonType: returnReasonType
      });
      setShowReturnModal(false);
      setComment('');
      setActiveExecId(null);
    } catch (e: any) {
      setErrorMsg(e.message || '반송 처리에 실패했습니다.');
    }
  };

  const statusColors: Record<string, string> = {
    WAITING: 'bg-zinc-50 border border-zinc-200 text-zinc-600 dark:bg-zinc-800/40 dark:border-zinc-700 dark:text-zinc-300',
    UNASSIGNED: 'bg-blue-50 border border-blue-200 text-blue-600 dark:bg-blue-950/20 dark:border-blue-900/30 dark:text-blue-400',
    IN_PROGRESS: 'bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400',
    COMPLETED: 'bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400',
    RETURNED: 'bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400',
    CANCELLED: 'bg-gray-50 border border-gray-200 text-gray-500 dark:bg-gray-800/40 dark:border-gray-700 dark:text-gray-400',
  };

  const statusLabels: Record<string, string> = {
    WAITING: '대기중',
    UNASSIGNED: '접수대기',
    IN_PROGRESS: '처리중',
    COMPLETED: '시행완료',
    RETURNED: '반송됨',
    CANCELLED: '시행취소',
  };

  return (
    <div className="mb-6 rounded-xl border border-border bg-panel p-5 print:hidden animate-fade-in shadow-2xs">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[16px]">📦</span>
          <span className="text-[13.5px] font-bold text-ink flex items-center gap-1.5">
            <span>시행 업무 진행 현황</span>
            <span className="rounded-full bg-teal-soft px-2 py-0.5 text-[10px] font-extrabold text-teal">
              {visibleExecutions.length}개 시행부서
            </span>
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-500">
          ⚠ {errorMsg}
        </div>
      )}

      {/* 시행 리스트 */}
      <div className="space-y-4">
        {visibleExecutions.map((exec) => {
          const targetDept = depts.find((d) => d.id === exec.targetDeptId || d.name === exec.targetDeptId);
          const isDeptHead = targetDept?.headUserId === userId;
          const isMyDept = meUser?.dept === targetDept?.name || (exec.targetDeptNameSnapshot && meUser?.dept === exec.targetDeptNameSnapshot);
          
          const hasExecutionAuthority = isMyDept;

          return (
            <div key={exec.id} className="rounded-lg border border-border-hi bg-panel-alt/30 p-4 space-y-3 shadow-3xs relative">
              {/* 시행부서 및 상태 배지 */}
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-bold text-ink flex items-center gap-1.5">
                  <span>📁</span>
                  <span>{exec.targetDeptNameSnapshot}</span>
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusColors[exec.status] || ''}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    exec.status === 'COMPLETED' ? 'bg-emerald-500' :
                    exec.status === 'RETURNED' ? 'bg-rose-500' :
                    exec.status === 'IN_PROGRESS' ? 'bg-amber-500' :
                    exec.status === 'UNASSIGNED' ? 'bg-blue-500' : 'bg-zinc-400'
                  }`} />
                  {statusLabels[exec.status]}
                </span>
              </div>

              {/* 상세 내역 */}
              <div className="grid grid-cols-2 gap-2 text-[11.5px] text-ink2">
                <div className="flex items-center gap-1.5">
                  <span className="text-ink3 shrink-0">담당 실무자:</span>
                  <span className="font-semibold text-ink">
                    {exec.assigneeNameSnapshot ? (
                      <span className="text-teal font-bold">👤 {exec.assigneeNameSnapshot}</span>
                    ) : (
                      <span className="text-ink3 font-medium flex items-center gap-1">
                        <span className="text-[12px] opacity-60">👤</span>
                        <span>미지정</span>
                      </span>
                    )}
                  </span>
                </div>
                {exec.dispatchedAt && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-ink3 shrink-0">발송 일시:</span>
                    <span>{fmtDateTime(exec.dispatchedAt)}</span>
                  </div>
                )}
                {exec.completedAt && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-ink3 shrink-0">완료/반송일:</span>
                    <span className="font-semibold text-teal">{exec.completedAt}</span>
                  </div>
                )}
                {exec.updatedAt && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-ink3 shrink-0">최종 변경:</span>
                    <span>{fmtDateTime(exec.updatedAt)}</span>
                  </div>
                )}
              </div>

              {/* 완료 사유 및 반송 사유 */}
              {exec.comment && (
                <div className="mt-2 rounded-md bg-panel border border-border p-2.5 text-[11.5px] text-ink2 whitespace-pre-wrap">
                  <span className="font-bold block text-teal mb-0.5">
                    {exec.status === 'COMPLETED' ? '💡 시행 완료 의견' : '🚨 반송 사유'}
                  </span>
                  {exec.comment}
                </div>
              )}

              {/* 부서원 및 부서장 컨트롤 액션 패널 */}
              {exec.status !== 'COMPLETED' && exec.status !== 'CANCELLED' && (
                <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-end flex-wrap gap-2">
                  {/* 부서장 전용: 시행 강제 취소 (부차적인 액션이므로 왼쪽에 배치) */}
                  {isDeptHead && (
                    <button
                      type="button"
                      onClick={() => handleCancel(exec.id)}
                      className="mr-auto rounded-md border border-danger/35 px-2.5 py-1 text-[11px] font-semibold text-danger hover:bg-danger/5 transition-all"
                    >
                      시행 취소
                    </button>
                  )}

                  {/* 접수대기 상태 && 본인 부서 업무 */}
                  {exec.status === 'UNASSIGNED' && hasExecutionAuthority && (
                    <button
                      type="button"
                      onClick={() => handleClaim(exec.id)}
                      className="rounded-md bg-teal px-3 py-1.5 text-[11px] font-bold text-white hover:bg-teal-dark transition-all shadow-3xs"
                    >
                      내가 담당하기
                    </button>
                  )}

                  {/* 부서장 전용: 담당 지정 */}
                  {isDeptHead && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveExecId(exec.id);
                        setShowAssignModal(true);
                      }}
                      className="rounded-md border border-teal/40 px-3 py-1.5 text-[11px] font-semibold text-teal hover:bg-teal-soft transition-all"
                    >
                      {exec.assigneeId ? '담당자 지정/변경' : '담당자 지정'}
                    </button>
                  )}

                  {/* 담당자 본인: 처리 가능 액션들 */}
                  {exec.status === 'IN_PROGRESS' && exec.assigneeId === userId && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRelease(exec.id)}
                        className="rounded-md border border-border-hi px-3 py-1.5 text-[11px] font-semibold text-ink2 hover:bg-panel-alt transition-all"
                      >
                        담당 반납
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveExecId(exec.id);
                          setShowReturnModal(true);
                        }}
                        className="rounded-md border border-rose-500/40 px-3.5 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50"
                      >
                        🚨 시행 반송
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveExecId(exec.id);
                          setShowCompleteModal(true);
                        }}
                        className="rounded-md bg-emerald-600 px-4 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500 transition-all shadow-3xs"
                      >
                        ✅ 시행 완료 보고
                      </button>
                    </div>
                  )}

                  {/* 기안자 전용: 반송된 건에 대해 보완 상신 */}
                  {exec.status === 'RETURNED' && doc.drafterId === userId && (
                    <button
                      type="button"
                      onClick={() => handleResubmit(exec.id)}
                      className="rounded-md bg-teal px-3.5 py-1.5 text-[11px] font-bold text-white hover:bg-teal-dark transition-all shadow-3xs"
                    >
                      🔄 보완 완료 후 재시행 상신
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── 모달 팝업 모음 ─── */}

      {/* 1. 담당 지정 모달 */}
      {showAssignModal && activeExecId && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-panel border border-border p-5 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-[13.5px] font-bold text-ink">👤 담당 집행자 지정</h3>
              <button onClick={() => { setShowAssignModal(false); setActiveExecId(null); }} className="text-[16px] text-ink3 hover:text-ink">×</button>
            </div>
            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-[11.5px] font-bold text-ink2 mb-1">소속 부서원 선택</label>
                <select
                  value={assigneeId}
                  required
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-[12px] text-ink outline-none focus:border-teal"
                >
                  <option value="">— 부서원 선택 —</option>
                  {(depts.find(d => d.id === finalExecutions.find(x => x.id === activeExecId)?.targetDeptId || d.name === finalExecutions.find(x => x.id === activeExecId)?.targetDeptId)
                    ? users.filter(u => u.dept === depts.find(d => d.id === finalExecutions.find(x => x.id === activeExecId)?.targetDeptId || d.name === finalExecutions.find(x => x.id === activeExecId)?.targetDeptId)?.name)
                    : []
                  ).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.position}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 border-t border-border pt-3 mt-4">
                <button type="button" onClick={() => { setShowAssignModal(false); setActiveExecId(null); }} className="rounded-lg border border-border-hi px-3.5 py-1.5 text-[11.5px] font-semibold text-ink2 hover:bg-panel-alt">취소</button>
                <button type="submit" className="rounded-lg bg-teal px-4 py-1.5 text-[11.5px] font-bold text-white hover:bg-teal-dark shadow-sm">지정 완료</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. 시행 완료 보고 모달 */}
      {showCompleteModal && activeExecId && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-panel border border-border p-5 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-[13.5px] font-bold text-ink">✅ 시행 완료 보고</h3>
              <button onClick={() => { setShowCompleteModal(false); setActiveExecId(null); }} className="text-[16px] text-ink3 hover:text-ink">×</button>
            </div>
            <form onSubmit={handleCompleteSubmit} className="space-y-4">
              <div>
                <label className="block text-[11.5px] font-bold text-ink2 mb-1">시행 완료일</label>
                <input
                  type="date"
                  value={completedAt}
                  required
                  onChange={(e) => setCompletedAt(e.target.value)}
                  className="w-full rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-[12px] text-ink outline-none focus:border-teal"
                />
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-ink2 mb-1">처리 의견</label>
                <textarea
                  value={comment}
                  rows={4}
                  maxLength={500}
                  placeholder="실무 집행 세부 보고 및 의견을 작성하세요 (최대 500자)"
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full resize-none rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-[12px] text-ink outline-none focus:border-teal"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-border pt-3 mt-4">
                <button type="button" onClick={() => { setShowCompleteModal(false); setActiveExecId(null); }} className="rounded-lg border border-border-hi px-3.5 py-1.5 text-[11.5px] font-semibold text-ink2 hover:bg-panel-alt">취소</button>
                <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-1.5 text-[11.5px] font-bold text-white hover:bg-emerald-500 shadow-sm">완료 보고</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. 시행 반송 모달 */}
      {showReturnModal && activeExecId && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-panel border border-border p-5 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-[13.5px] font-bold text-ink">🚨 시행 불가 및 반송 요청</h3>
              <button onClick={() => { setShowReturnModal(false); setActiveExecId(null); }} className="text-[16px] text-ink3 hover:text-ink">×</button>
            </div>
            <form onSubmit={handleReturnSubmit} className="space-y-4">
              <div>
                <label className="block text-[11.5px] font-bold text-ink2 mb-1">반송 구분</label>
                <div className="flex gap-4 mt-1">
                  <label className="flex items-center gap-1.5 text-[12px] text-ink cursor-pointer">
                    <input type="radio" checked={returnReasonType === 'SUPPLEMENT'} onChange={() => setReturnReasonType('SUPPLEMENT')} />
                    <span>단순 자료/정보 보완 (재결재 불필요)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-[12px] text-ink cursor-pointer">
                    <input type="radio" checked={returnReasonType === 'APPROVAL_CHANGE'} onChange={() => setReturnReasonType('APPROVAL_CHANGE')} />
                    <span>결재 내용 변경 필요 (재결재 수행 권장)</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-ink2 mb-1">반송 및 보완 요청 사유</label>
                <textarea
                  value={comment}
                  required
                  rows={4}
                  maxLength={500}
                  placeholder="기안자에게 전달할 구체적인 보완 요청 내역을 기입해 주세요."
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full resize-none rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-[12px] text-ink outline-none focus:border-teal"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-border pt-3 mt-4">
                <button type="button" onClick={() => { setShowReturnModal(false); setActiveExecId(null); }} className="rounded-lg border border-border-hi px-3.5 py-1.5 text-[11.5px] font-semibold text-ink2 hover:bg-panel-alt">취소</button>
                <button type="submit" className="rounded-lg bg-rose-600 px-4 py-1.5 text-[11.5px] font-bold text-white hover:bg-rose-500 shadow-sm">반송 전송</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
