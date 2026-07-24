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

  // 부서원 목록 (담당자 강제 배정용)
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
    return '지정되지 않음';
  }, [execution.executorId, users]);

  // 시행 대상 명칭
  const targetName = useMemo(() => {
    if (execution.targetType === 'USER') {
      const u = users.find((x) => x.id === execution.targetId);
      return u ? `[개인] ${u.name} ${u.position}` : execution.targetId;
    } else {
      return `[부서] ${targetDept?.name || execution.targetId}`;
    }
  }, [execution, users, targetDept]);

  // [시행 완료] 가능 여부 (담당자 본인이거나 부서장인 경우)
  const canComplete = useMemo(() => {
    if (execution.status === '시행완료') return false;
    // 담당자가 정해져 있는 경우
    if (execution.executorId) {
      return execution.executorId === userId || isDeptHead;
    }
    // 담당자가 안 정해져 있는 경우, 부서원 전체 혹은 부서장
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

  const statusColors = {
    대기중: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    처리중: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    시행완료: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };

  return (
    <div className="mb-5 rounded-xl border border-border bg-panel p-4 print:hidden animate-fade-in">
      <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[15px]">📦</span>
          <span className="text-[13px] font-bold text-ink">시행 관리 정보</span>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusColors[execution.status] || ''}`}>
          {execution.status}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-[12px] text-ink2">
        <div>• 시행 대상: <span className="font-semibold text-ink">{targetName}</span></div>
        <div className="flex items-center gap-2">
          <span>• 실무 담당자:</span>
          {execution.status !== '시행완료' && isDeptHead ? (
            <select
              value={execution.executorId || ''}
              onChange={(e) => handleAssignChange(e.target.value)}
              className="rounded border border-border bg-panel-alt px-2 py-1 text-[11.5px] font-semibold text-ink outline-none focus:border-teal"
            >
              <option value="">-- 담당자 배정 --</option>
              {deptMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.position}
                </option>
              ))}
            </select>
          ) : (
            <span className="font-semibold text-ink">{executorName}</span>
          )}

          {execution.status === '대기중' && !execution.executorId && hasExecutionAuthority && (
            <button
              onClick={handleSelfAssign}
              className="rounded bg-teal-soft/80 px-2.5 py-1 text-[10.5px] font-bold text-teal hover:bg-teal hover:text-white transition-colors"
            >
              내가 담당하기
            </button>
          )}
        </div>

        {execution.startedAt && (
          <div>• 시행 시작일시: <span className="font-semibold text-ink">{fmtDateTime(execution.startedAt)}</span></div>
        )}
        {execution.completedAt && (
          <div>• 시행 완료일자: <span className="font-semibold text-ink">{execution.completedAt}</span></div>
        )}

        {execution.status === '시행완료' && execution.comment && (
          <div className="col-span-2 mt-1.5 rounded-lg border border-border bg-panel-alt/50 p-2.5">
            <div className="text-[10.5px] font-bold text-ink3 mb-1">시행 처리 의견</div>
            <div className="text-[11.5px] text-ink leading-relaxed whitespace-pre-wrap">“{execution.comment}”</div>
          </div>
        )}
      </div>

      {errorMsg && (
        <p className="mt-3.5 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-500">{errorMsg}</p>
      )}

      {/* 액션 버튼 */}
      {execution.status !== '시행완료' && (
        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
          {canComplete ? (
            <button
              onClick={() => {
                setErrorMsg('');
                setShowCompleteModal(true);
              }}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-[12px] font-bold text-white hover:bg-emerald-500 transition-colors shadow-sm"
            >
              시행 완료 처리
            </button>
          ) : (
            execution.executorId && (
              <span className="text-[10.5px] text-ink3 italic">
                (지정된 담당자 또는 부서장만 시행 완료 처리가 가능합니다)
              </span>
            )
          )}
        </div>
      )}

      {/* 시행 완료 처리 모달 */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-panel border border-border p-5 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-[14px] font-bold text-ink">시행 완료 보고</h3>
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
                <div className="text-right text-[10px] text-ink3 mt-1">
                  {comment.length} / 500자
                </div>
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
