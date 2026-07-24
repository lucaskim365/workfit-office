import { useState, useMemo, useEffect } from 'react';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';
import { useUsers } from '@/features/user/useUsers';
import { departmentRepo } from '@/data/department/department.repo';
import {
  useAssignExecutor,
  useSelfAssignExecutor,
  useCompleteExecution,
} from '@/features/gw/useApprovals';
import { fmtDateTime } from '@/modules/gw/_gw';

interface ApprovalExecutionPanelProps {
  doc: ApprovalDoc;
  userId: string;
}

export function ApprovalExecutionPanel({ doc, userId }: ApprovalExecutionPanelProps) {
  const { data: users = [] } = useUsers();
  const assignExecutorM = useAssignExecutor();
  const selfAssignExecutorM = useSelfAssignExecutor();
  const completeExecutionM = useCompleteExecution();

  const [depts, setDepts] = useState<any[]>([]);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completedAt, setCompletedAt] = useState(() => new Date().toISOString().split('T')[0]);
  const [comment, setComment] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showChangeExecutor, setShowChangeExecutor] = useState(false);
  const [changeExecutorId, setChangeExecutorId] = useState('');

  useEffect(() => {
    departmentRepo.list().then(setDepts);
  }, []);

  const execution = doc.execution;
  if (!execution) return null;

  // 부서 시행인 경우 해당 부서 정보 조회
  const targetDept = useMemo(() => {
    if (execution.targetType === 'DEPT') {
      return depts.find((d) => d.id === execution.targetId || d.name === execution.targetId);
    }
    return null;
  }, [execution, depts]);

  // 부서장 여부
  const isDeptHead = useMemo(() => {
    if (targetDept) {
      return targetDept.headUserId === userId;
    }
    return false;
  }, [targetDept, userId]);

  // 본인 소속 부서가 대상 부서인지 여부
  const isMyDept = useMemo(() => {
    if (targetDept) {
      const meUser = users.find((u) => u.id === userId);
      return meUser?.dept === targetDept.name;
    }
    return false;
  }, [targetDept, users, userId]);

  // 내가 시행 권한이 있는 사용자(또는 부서원)인가
  const hasExecutionAuthority = useMemo(() => {
    if (execution.targetType === 'USER') {
      return execution.targetId === userId;
    } else if (execution.targetType === 'DEPT') {
      return isMyDept;
    }
    return false;
  }, [execution, userId, isMyDept]);

  // 부서원 목록 (담당자 배정용)
  const deptMembers = useMemo(() => {
    if (targetDept) {
      return users.filter((u) => u.dept === targetDept.name);
    }
    return [];
  }, [targetDept, users]);

  // 담당자 명칭 매핑
  const executorName = useMemo(() => {
    if (execution.executorId) {
      const u = users.find((x) => x.id === execution.executorId);
      return u ? `${u.name} ${u.position}` : execution.executorId;
    }
    return null;
  }, [execution.executorId, users]);

  // 시행 대상 명칭
  const targetName = useMemo(() => {
    if (execution.targetType === 'USER') {
      const u = users.find((x) => x.id === execution.targetId);
      return u ? `${u.name} ${u.position}` : execution.targetId;
    } else {
      return targetDept?.name || execution.targetId;
    }
  }, [execution, users, targetDept]);

  // [시행 완료] 가능 여부 (담당자 본인이거나 부서장인 경우)
  const canComplete = useMemo(() => {
    if (execution.status === '시행완료') return false;
    if (execution.executorId) {
      return execution.executorId === userId || isDeptHead;
    }
    return hasExecutionAuthority || isDeptHead;
  }, [execution, userId, isDeptHead, hasExecutionAuthority]);



  const handleSelfAssign = async () => {
    setErrorMsg('');
    try {
      await selfAssignExecutorM.mutateAsync({ docId: doc.id, userId });
    } catch (e: any) {
      setErrorMsg(e.message || '담당자 지정에 실패했습니다.');
    }
  };

  const handleAssignChange = async (executorId: string) => {
    if (!executorId) return;
    setErrorMsg('');
    try {
      await assignExecutorM.mutateAsync({ docId: doc.id, executorId, assignerId: userId });
      setShowChangeExecutor(false);
      setChangeExecutorId('');
    } catch (e: any) {
      setErrorMsg(e.message || '담당자 변경에 실패했습니다.');
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (comment.length > 500) {
      setErrorMsg('의견은 최대 500자까지 기입할 수 있습니다.');
      return;
    }
    try {
      await completeExecutionM.mutateAsync({
        docId: doc.id,
        userId,
        completedAt,
        comment,
      });
      setShowCompleteModal(false);
      setComment('');
    } catch (e: any) {
      setErrorMsg(e.message || '시행 완료 처리에 실패했습니다.');
    }
  };

  const statusColors: Record<string, string> = {
    대기중: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
    처리중: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    시행완료: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };

  const isBusy = selfAssignExecutorM.isPending || assignExecutorM.isPending;

  return (
    <div className="mb-5 rounded-xl border border-border bg-panel p-4 print:hidden animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[15px]">📦</span>
          <span className="text-[13px] font-bold text-ink">시행 관리</span>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusColors[execution.status] || ''}`}>
          {execution.status}
        </span>
      </div>

      {/* 시행 대상 & 담당자 */}
      <div className="space-y-2.5 text-[12px]">

        {/* 시행 대상 */}
        <div className="flex items-center gap-2">
          <span className="text-ink3 w-[72px] shrink-0">시행 대상</span>
          <span className="font-semibold text-ink flex items-center gap-1.5">
            {execution.targetType === 'USER' ? '👤' : '📁'}
            {targetName}
          </span>
        </div>

        {/* 실무 담당자 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-ink3 w-[72px] shrink-0">실무 담당자</span>

          {/* 담당자가 지정된 경우 */}
          {executorName ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-teal flex items-center gap-1">
                ✅ {executorName}
              </span>
              {/* 부서장만 다른 부서원으로 변경 가능 */}
              {execution.status !== '시행완료' && isDeptHead && (
                <button
                  onClick={() => {
                    setShowChangeExecutor(!showChangeExecutor);
                    setChangeExecutorId('');
                  }}
                  className="rounded-md border border-border-hi px-2 py-0.5 text-[10.5px] font-semibold text-ink2 hover:bg-panel-alt transition-colors"
                >
                  변경
                </button>
              )}
            </div>
          ) : (
            /* 담당자 미지정 */
            <div className="flex items-center gap-2">
              {isBusy ? (
                <span className="text-ink3 text-[11px] animate-pulse">처리 중...</span>
              ) : (
                <>
                  <span className="text-ink3 text-[11px]">미지정</span>
                  {/* 부서 지정: 부서원이 직접 담당하기 */}
                  {execution.targetType === 'DEPT' && isMyDept && !isDeptHead && (
                    <button
                      onClick={handleSelfAssign}
                      className="rounded-md bg-teal-soft px-2.5 py-0.5 text-[10.5px] font-bold text-teal hover:bg-teal hover:text-white transition-colors"
                    >
                      내가 담당하기
                    </button>
                  )}
                  {/* 부서장: 자신이 담당하거나 부서원에게 배정 */}
                  {isDeptHead && (
                    <>
                      <button
                        onClick={handleSelfAssign}
                        className="rounded-md bg-teal-soft px-2.5 py-0.5 text-[10.5px] font-bold text-teal hover:bg-teal hover:text-white transition-colors"
                      >
                        내가 담당하기
                      </button>
                      {deptMembers.length > 0 && (
                        <button
                          onClick={() => setShowChangeExecutor(!showChangeExecutor)}
                          className="rounded-md border border-teal/30 px-2.5 py-0.5 text-[10.5px] font-semibold text-teal hover:bg-teal-soft transition-colors"
                        >
                          담당자 지정
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* 담당자 변경 인라인 폼 (부서장 전용) */}
        {showChangeExecutor && isDeptHead && (
          <div className="ml-[80px] flex items-center gap-2 rounded-lg bg-panel-alt border border-border p-2 mt-1">
            <select
              value={changeExecutorId}
              onChange={(e) => setChangeExecutorId(e.target.value)}
              className="flex-1 rounded border border-border-hi bg-panel px-2 py-1 text-[11px] text-ink outline-none focus:border-teal"
            >
              <option value="">— 담당자 선택 —</option>
              {deptMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.position}
                </option>
              ))}
            </select>
            <button
              onClick={() => handleAssignChange(changeExecutorId)}
              disabled={!changeExecutorId || isBusy}
              className="rounded bg-teal px-2.5 py-1 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-50 transition-colors"
            >
              확인
            </button>
            <button
              onClick={() => { setShowChangeExecutor(false); setChangeExecutorId(''); }}
              className="rounded px-2 py-1 text-[11px] text-ink3 hover:text-ink"
            >
              취소
            </button>
          </div>
        )}

        {/* 시행 시작일시 */}
        {execution.startedAt && (
          <div className="flex items-center gap-2">
            <span className="text-ink3 w-[72px] shrink-0">처리 시작</span>
            <span className="font-semibold text-ink">{fmtDateTime(execution.startedAt)}</span>
          </div>
        )}

        {/* 시행 완료일자 */}
        {execution.completedAt && (
          <div className="flex items-center gap-2">
            <span className="text-ink3 w-[72px] shrink-0">완료일</span>
            <span className="font-semibold text-ink">{execution.completedAt}</span>
          </div>
        )}

        {/* 처리 의견 */}
        {execution.status === '시행완료' && execution.comment && (
          <div className="mt-2 rounded-lg border border-border bg-panel-alt/50 p-3">
            <div className="text-[10.5px] font-bold text-ink3 mb-1">처리 의견</div>
            <div className="text-[11.5px] text-ink leading-relaxed whitespace-pre-wrap">"{execution.comment}"</div>
          </div>
        )}
      </div>

      {errorMsg && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-500">{errorMsg}</p>
      )}

      {/* 액션 버튼 */}
      <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
        {/* 개인 지정: 본인이 대상이고 대기중일 때 시행 시작 버튼 */}
        {execution.targetType === 'USER' &&
          execution.targetId === userId &&
          execution.status === '대기중' && (
            <button
              onClick={handleSelfAssign}
              disabled={isBusy}
              className="rounded-lg bg-teal px-4 py-1.5 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-50 transition-colors shadow-sm"
            >
              {isBusy ? '처리 중...' : '▶ 시행 시작'}
            </button>
          )}

        {/* 처리중일 때만 시행 완료 처리 버튼 노출 */}
        {execution.status === '처리중' && (
          canComplete ? (
            <button
              onClick={() => { setErrorMsg(''); setShowCompleteModal(true); }}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-[12px] font-bold text-white hover:bg-emerald-500 transition-colors shadow-sm"
            >
              ✅ 시행 완료 처리
            </button>
          ) : (
            execution.executorId && execution.executorId !== userId && (
              <span className="text-[10.5px] text-ink3 italic">
                (지정된 담당자 또는 부서장만 완료 처리 가능)
              </span>
            )
          )
        )}
      </div>

      {/* 시행 완료 처리 모달 */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-panel border border-border p-5 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-[14px] font-bold text-ink">✅ 시행 완료 보고</h3>
              <button
                onClick={() => setShowCompleteModal(false)}
                className="text-[16px] text-ink3 hover:text-ink"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCompleteSubmit} className="space-y-4">
              <div>
                <label className="block text-[11.5px] font-bold text-ink2 mb-1">시행완료일</label>
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
                  placeholder="실무 처리 내용 및 의견을 기입하세요 (최대 500자)"
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full resize-none rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-[12px] text-ink outline-none focus:border-teal"
                />
                <div className="text-right text-[10px] text-ink3 mt-1">{comment.length} / 500자</div>
              </div>

              {errorMsg && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-500">{errorMsg}</p>
              )}

              <div className="flex justify-end gap-2 border-t border-border pt-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  className="rounded-lg border border-border-hi px-3.5 py-2 text-[12px] font-semibold text-ink2 hover:bg-panel-alt"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={completeExecutionM.isPending}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-[12px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-sm"
                >
                  {completeExecutionM.isPending ? '처리 중...' : '완료 보고'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
