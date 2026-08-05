import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { useOrgTree } from '@/features/gw/useOrgTree';
import {
  useApprovalBoxes,
  useApprovalDoc,
  useDecideStep,
  useRecallApproval,
  useSubmitApproval,
  useDeleteToTrash,
  useRestoreFromTrash,
  usePermanentlyDelete,
  useConfirmPostRead,
  useBatchDecideStep,
  useBatchRestoreFromTrash,
  useBatchPermanentlyDelete,
} from '@/features/gw/useApprovals';
import { activeSteps, currentApproverIds } from '@/domain/approvalDoc/engine';
import { APPROVAL_BOXES, type ApprovalBox, type ApprovalDoc } from '@/domain/approvalDoc/schema';
import { GwHead } from '@/modules/gw/_gw';
import { DOC_TYPE_ICON, fmtDateTime, KIND_TONE, won } from './utils/approvalUtils';
import { DocStatusBadge } from './components/ApprovalBadges';
import { ApprovalOpinionModal } from './components/ApprovalOpinionModal';
import { ApprovalDraftModal } from '@/modules/gw/approval/ApprovalDraftModal';
import { ApprovalDocumentView } from '@/modules/gw/approval/ApprovalDocumentView';
import { absenceRepo } from '@/data/absence/absence.repo';
import { approvalProcessRepo } from '@/data/approvalProcess/approvalProcess.repo';
import { ApprovalExecutionPanel } from '@/modules/gw/approval/ApprovalExecutionPanel';

/**
 * 전자결재 결재함(§7.2) — 좌 함 탭(대기·상신·완료·참조·임시) + 중 목록 + 우 상세.
 * 상세는 결재선 진행 타임라인 + 내 차례면 승인/반려/보류 액션, 기안자면 회수/재상신/편집.
 * 모든 전이는 features 훅(엔진 위임) → 성공 시 캐시 무효화로 함·배지 자동 갱신.
 */
const BOX_LABEL: Record<ApprovalBox, string> = {
  대기: '결재함',
  상신: '상신함',
  반려: '반려함',
  임시: '임시저장',
  수신: '수신함',
  참조: '참조함',
  시행: '시행함',
  후열: '후열함',
  완료: '완료함',
  삭제: '휴지통',
};



export default function ApprovalScreen() {
  const { user } = useAuth();
  const me = user?.id ?? '';
  const { byBox, counts, isLoading } = useApprovalBoxes(me);
  const [params, setParams] = useSearchParams();
  const [box, setBox] = useState<ApprovalBox>('대기');

  const myActivePendingCount = useMemo(() => {
    const list = byBox['대기'] ?? [];
    return list.filter((d) => currentApproverIds(d).includes(me)).length;
  }, [byBox, me]);

  const [selId, setSelId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ edit?: ApprovalDoc | null } | null>(null);
  const [doneFilter, setDoneFilter] = useState<'all' | 'draft' | 'approved'>('all');
  const [todoFilter, setTodoFilter] = useState<'all' | 'pending' | 'progress'>('all');
  const [execFilter, setExecFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // 다중 선택 상태 & 일괄 처리 훅
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBatchApproveConfirm, setShowBatchApproveConfirm] = useState(false);
  const [batchComment, setBatchComment] = useState('');
  const [isListCollapsed, setIsListCollapsed] = useState(false);

  const batchDecide = useBatchDecideStep();
  const batchRestore = useBatchRestoreFromTrash();
  const batchPermanentDelete = useBatchPermanentlyDelete();

  const list = byBox[box] ?? [];
  const selDoc = useApprovalDoc(selId);

  // 함이나 필터가 바뀌면 다중 선택 초기화
  useEffect(() => {
    setSelectedIds([]);
  }, [box, doneFilter, todoFilter, execFilter]);

  // 완료함, 결재함, 시행함 필터링 적용
  const filteredList = useMemo(() => {
    if (box === '시행') {
      if (execFilter === 'pending') {
        return list.filter((d) => d.execution?.status === '대기중' || d.execution?.status === '처리중');
      }
      if (execFilter === 'completed') {
        return list.filter((d) => d.execution?.status === '시행완료');
      }
      return list;
    }
    if (box === '완료') {
      if (doneFilter === 'draft') return list.filter((d) => d.drafterId === me);
      if (doneFilter === 'approved') {
        return list.filter((d: ApprovalDoc) => d.steps.some((s) => s.approverId === me && s.decision === '승인'));
      }
      return list;
    }
    if (box === '대기') {
      if (todoFilter === 'pending') {
        return list.filter((d: ApprovalDoc) => currentApproverIds(d).includes(me));
      }
      if (todoFilter === 'progress') {
        return list.filter((d: ApprovalDoc) => !currentApproverIds(d).includes(me));
      }
      return list;
    }
    return list;
  }, [box, list, doneFilter, todoFilter, execFilter, me]);

  // 딥링크(?doc=ID) → 해당 문서를 품은 함으로 이동 + 선택.
  useEffect(() => {
    const docId = params.get('doc');
    if (!docId) return;
    for (const b of APPROVAL_BOXES) {
      if ((byBox[b] ?? []).some((d) => d.id === docId)) {
        setBox(b);
        setSelId(docId);
        break;
      }
    }
    params.delete('doc');
    setParams(params, { replace: true });
  }, [params, byBox, setParams]);

  // 함 전환/목록/필터 변화 시 선택 보정(현재 필터링된 목록에 없으면 첫 항목).
  useEffect(() => {
    if (filteredList.length === 0) { setSelId(null); }
    else if (!filteredList.some((d) => d.id === selId)) { setSelId(filteredList[0].id); }
    setSelectedIds((prev) => prev.filter((id) => filteredList.some((d) => d.id === id)));
  }, [box, filteredList, selId]);

  // 다중 선택 처리 헬퍼
  const isAllSelected = filteredList.length > 0 && selectedIds.length === filteredList.length;
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredList.map((d) => d.id));
    }
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // 일괄 승인 실행
  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    try {
      await batchDecide.mutateAsync({
        docIds: selectedIds,
        userId: me,
        comment: batchComment.trim() || '일괄 승인 처리되었습니다.',
      });
      setShowBatchApproveConfirm(false);
      setBatchComment('');
      setSelectedIds([]);
    } catch (err: any) {
      alert(`일괄 승인 중 오류가 발생했습니다: ${err.message || String(err)}`);
    }
  };

  // 일괄 복원 실행
  const handleBatchRestore = async () => {
    if (selectedIds.length === 0) return;
    if (confirm(`선택한 ${selectedIds.length}건의 문서를 휴지통에서 복원하시겠습니까?`)) {
      try {
        await batchRestore.mutateAsync(selectedIds);
        setSelectedIds([]);
      } catch (err: any) {
        alert(`일괄 복원 중 오류가 발생했습니다: ${err.message || String(err)}`);
      }
    }
  };

  // 일괄 영구 삭제 실행
  const handleBatchPermanentDelete = async () => {
    if (selectedIds.length === 0) return;
    if (confirm(`⚠️ 경고: 선택한 ${selectedIds.length}건의 문서를 영구 삭제하시겠습니까?\n이 작업은 복구할 수 없습니다.`)) {
      try {
        await batchPermanentDelete.mutateAsync(selectedIds);
        setSelectedIds([]);
      } catch (err: any) {
        alert(`일괄 삭제 중 오류가 발생했습니다: ${err.message || String(err)}`);
      }
    }
  };

  if (!user) return <div className="p-10 text-center text-[13px] text-ink3">로그인이 필요합니다.</div>;

  return (
    <div className="w-full px-6">
      <div className="flex items-center justify-between">
        <GwHead
          icon="🖋️"
          name="전자결재"
        />
        <button
          type="button"
          onClick={() => setIsListCollapsed(!isListCollapsed)}
          className="mt-2 self-end rounded-xl border-2 border-teal/40 bg-white dark:bg-panel px-4 py-2 text-[12.5px] font-extrabold text-teal hover:border-teal hover:bg-teal-soft/30 transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer shrink-0 hover:scale-[1.02] active:scale-[0.98]"
          title={isListCollapsed ? '문서 목록 펼치기' : '문서 목록 접고 상세 넓게 보기'}
        >
          <span className="text-[13px]">{isListCollapsed ? '▶' : '◀'}</span>
          <span>{isListCollapsed ? '문서 목록 펼치기' : '문서 목록 접기'}</span>
        </button>
      </div>

      <div className={`mt-5 grid transition-all duration-300 gap-4 items-start ${isListCollapsed ? 'grid-cols-[160px_1fr]' : 'grid-cols-[160px_320px_1fr]'}`}>
        {/* 좌: 함 탭 (목록 콘텐츠 길이에 딱 맞게 하단 흰색 여백 제거 & 스크롤 시 상단 고정) */}
        <div className="rounded-xl border border-border bg-panel p-2 flex flex-col gap-1.5 self-start shadow-sm shrink-0 sticky top-4">
          <button
            onClick={() => setModal({})}
            className="w-full rounded-lg bg-teal py-2 text-[12.5px] font-bold text-white hover:opacity-90 transition-all flex items-center justify-center gap-1 shadow-sm mb-0.5"
          >
            + 새 상신
          </button>
          <button
            onClick={() => setBox('임시')}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors ${box === '임시' ? 'bg-teal-soft font-bold text-teal' : 'text-ink2 hover:bg-panel-alt'}`}
          >
            <span>{BOX_LABEL['임시']}</span>
            {(counts['임시'] ?? 0) > 0 && (
              <span className={`grid h-[18px] min-w-[18px] place-items-center rounded-full px-1.5 text-[10px] font-bold ${box === '임시' ? 'bg-teal text-white' : 'bg-ink3/15 text-ink2'}`}>
                {counts['임시']}
              </span>
            )}
          </button>
          <div className="h-px bg-border -mt-0.5 mb-1" />
          {[
            { title: '결재할 문서', boxes: ['대기'] as const, titleBg: 'bg-panel-alt text-ink2' },
            { title: '내가 올린 문서', boxes: ['상신', '반려'] as const, titleBg: 'bg-panel-alt text-ink2' },
            { title: '공유 문서', boxes: ['수신', '참조', '시행', '후열'] as const, titleBg: 'bg-panel-alt text-ink2' },
            { title: '관리', boxes: ['완료', '삭제'] as const, titleBg: 'bg-panel-alt text-ink2' },
          ].map((g) => (
            <div key={g.title} className="flex flex-col gap-1.5">
              <div className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase ${g.titleBg}`}>
                {g.title}
              </div>
              <div className="space-y-0.5">
                {g.boxes.map((b) => {
                  const executionCount = (byBox['시행'] ?? []).filter(
                    (d) => d.execution?.status === '대기중' || d.execution?.status === '처리중'
                  ).length;
                  const unconfirmedPostReadCount = (byBox['후열'] ?? []).filter(
                    (d) => d.steps.some((s) => s.delegatedFromId === me && !s.postReadAt)
                  ).length;

                  const hasBadge = b === '대기'
                    ? (byBox['대기'] ?? []).length > 0
                    : b === '시행'
                      ? executionCount > 0
                      : b === '후열'
                        ? (counts['후열'] ?? 0) > 0
                        : (counts[b] ?? 0) > 0;

                  const badgeCount = b === '대기'
                    ? (myActivePendingCount > 0 ? myActivePendingCount : (byBox['대기'] ?? []).length)
                    : b === '시행'
                      ? executionCount
                      : counts[b];

                  const badgeClass = b === '대기'
                    ? (myActivePendingCount > 0
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-ink3/15 text-ink2')
                    : b === '시행'
                      ? (executionCount > 0
                        ? 'bg-amber-500 text-white animate-pulse'
                        : 'bg-ink3/15 text-ink2')
                      : b === '후열'
                        ? (unconfirmedPostReadCount > 0
                          ? 'bg-amber-500 text-white animate-pulse'
                          : 'bg-ink3/15 text-ink2')
                        : (box === b ? 'bg-teal text-white' : 'bg-ink3/15 text-ink2');

                  return (
                    <button
                      key={b}
                      onClick={() => setBox(b)}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors ${box === b ? 'bg-teal-soft font-bold text-teal' : 'text-ink2 hover:bg-panel-alt'}`}
                    >
                      <span>{BOX_LABEL[b]}</span>
                      {hasBadge && (
                        <span className={`grid h-[18px] min-w-[18px] place-items-center rounded-full px-1.5 text-[10px] font-bold ${badgeClass}`}>
                          {badgeCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 중: 목록 (목록 접기 시 hidden 처리) */}
        {!isListCollapsed && (
          <div className="overflow-hidden rounded-xl border border-border bg-panel flex flex-col w-full min-w-0 shadow-sm self-start animate-fadeIn sticky top-4">
            {/* 목록 헤더 */}
            <div className="border-b border-border px-3.5 py-2.5 flex items-center justify-between text-[12px] font-bold text-ink2 bg-panel-alt/30">
              <div className="flex items-center gap-2">
                {(box === '대기' || box === '삭제') && selectedIds.length > 0 && (
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-border text-teal focus:ring-teal cursor-pointer h-3.5 w-3.5 animate-fadeIn"
                    title="전체 선택/해제"
                  />
                )}
                <span>{BOX_LABEL[box]} <span className="text-ink3">· {filteredList.length}</span></span>
              </div>
            </div>

            {box === '대기' && (
              <div className="flex border-b border-border bg-panel-alt/50 p-1.5 gap-1.5">
                {(['all', 'pending', 'progress'] as const).map((f) => {
                  const label = f === 'all' ? '전체' : f === 'pending' ? '결재대기중' : '진행중';
                  return (
                    <button
                      key={f}
                      onClick={() => setTodoFilter(f)}
                      className={`flex-1 rounded-lg py-1.5 text-[10.5px] font-bold transition-all ${todoFilter === f
                        ? 'bg-teal text-white shadow-sm'
                        : 'text-ink3 hover:bg-panel-alt hover:text-ink2'
                        }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            {box === '시행' && (
              <div className="flex border-b border-border bg-panel-alt/50 p-1.5 gap-1.5">
                {(['all', 'pending', 'completed'] as const).map((f) => {
                  const label = f === 'all' ? '전체' : f === 'pending' ? '미처리·진행중' : '시행완료';
                  return (
                    <button
                      key={f}
                      onClick={() => setExecFilter(f)}
                      className={`flex-1 rounded-lg py-1.5 text-[10.5px] font-bold transition-all ${execFilter === f
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'text-ink3 hover:bg-panel-alt hover:text-ink2'
                        }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            {box === '완료' && (
              <div className="flex border-b border-border bg-panel-alt/50 p-1.5 gap-1.5">
                {(['all', 'draft', 'approved'] as const).map((f) => {
                  const label = f === 'all' ? '전체' : f === 'draft' ? '기안한 문서' : '결재한 문서';
                  return (
                    <button
                      key={f}
                      onClick={() => setDoneFilter(f)}
                      className={`flex-1 rounded-lg py-1.5 text-[10.5px] font-bold transition-all ${doneFilter === f
                        ? 'bg-teal text-white shadow-sm'
                        : 'text-ink3 hover:bg-panel-alt hover:text-ink2'
                        }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 목록 데이터 영역 */}
            <div>
              {isLoading && <div className="py-10 text-center text-[12px] text-ink3">불러오는 중…</div>}
              {!isLoading && filteredList.length === 0 && <div className="py-14 text-center text-[12px] text-ink3">문서가 없습니다.</div>}
              {filteredList.map((d) => {
                const isRecentCompleted = d.status === '완료' && d.completedAt && (Date.now() - new Date(d.completedAt).getTime() < 24 * 60 * 60 * 1000);
                const isChecked = selectedIds.includes(d.id);
                return (
                  <button
                    key={d.id}
                    onClick={() => setSelId(d.id)}
                    className={`relative flex w-full items-start gap-2 border-b border-border px-3.5 py-2.5 text-left transition-all ${selId === d.id
                      ? 'bg-teal-soft/60'
                      : isRecentCompleted
                        ? 'bg-teal-soft/10 hover:bg-teal-soft/20'
                        : 'hover:bg-panel-alt'
                      } ${isRecentCompleted ? 'border-l-4 border-l-teal' : ''}`}
                  >
                    {(box === '대기' || box === '삭제') && (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => { }}
                        onClick={(e) => toggleSelectOne(d.id, e)}
                        className="mt-1 rounded border-border text-teal focus:ring-teal cursor-pointer h-3.5 w-3.5 shrink-0"
                      />
                    )}
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px]">{DOC_TYPE_ICON[d.docType] ?? '📄'}</span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">{d.title}</span>
                        {isRecentCompleted && (
                          <span className="flex items-center gap-1 bg-teal/10 text-teal text-[9px] px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                            <span className="h-1.5 w-1.5 rounded-full bg-teal"></span>
                            최근 완료
                          </span>
                        )}
                        <DocStatusBadge doc={d} me={me} />
                      </div>
                      <div className="flex items-center justify-between text-[10.5px] text-ink3">
                        <span className="truncate">{d.docNo} · {org_nameFallback(d)}</span>
                        <span>{fmtDateTime(d.submittedAt ?? d.createdAt)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 목록 하단 풋터 액션 바 (선택 항목 존재 시 목록 바로 아래에 조밀하게 표시) */}
            {(box === '대기' || box === '삭제') && selectedIds.length > 0 && (
              <div className="border-t border-border bg-panel-alt/60 p-2.5 flex items-center justify-between animate-fadeIn">
                <span className="text-[11px] font-extrabold text-teal bg-teal/10 border border-teal/20 px-2 py-0.5 rounded-md">
                  {selectedIds.length}개 선택됨
                </span>

                {box === '대기' && (
                  <button
                    onClick={() => setShowBatchApproveConfirm(true)}
                    className="group relative inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-teal to-emerald-600 text-white rounded-lg text-[11.5px] font-bold shadow-sm shadow-teal/20 hover:shadow-md hover:shadow-teal/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150"
                  >
                    <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>일괄 승인</span>
                  </button>
                )}

                {box === '삭제' && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleBatchRestore}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal text-white rounded-lg text-[11.5px] font-bold shadow-sm shadow-emerald-500/20 hover:shadow-md hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150"
                    >
                      <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>일괄 복원</span>
                    </button>
                    <button
                      onClick={handleBatchPermanentDelete}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-500/20 hover:border-rose-500 rounded-lg text-[11.5px] font-bold shadow-xs hover:shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all duration-150"
                    >
                      <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>영구 삭제</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 우: 상세 */}
        <div className="overflow-hidden rounded-xl border border-border bg-panel flex-1 min-w-0 shadow-sm">
          {selDoc ? (
            <DocDetail
              doc={selDoc}
              me={me}
              onEdit={(d) => setModal({ edit: d })}
            />
          ) : (
            <div className="grid h-full place-items-center py-20 text-[12px] text-ink3">문서를 선택하세요.</div>
          )}
        </div>
      </div>

      {/* 일괄 승인 경고 및 의견 입력 모달 */}
      {showBatchApproveConfirm && (
        <ApprovalOpinionModal
          title="일괄 결재 승인 확인"
          description={
            <div className="space-y-1 text-amber-700 dark:text-amber-300 font-semibold">
              <p>선택하신 <span className="font-extrabold underline">{selectedIds.length}건</span>의 결재 문서를 일괄 승인하시겠습니까?</p>
              <p className="text-[11.5px] font-normal text-amber-600 dark:text-amber-400">
                ※ 일괄 승인 처리 후에는 결재를 취소하거나 이전 상태로 되돌릴 수 없습니다.
              </p>
            </div>
          }
          confirmText="일괄 승인 확정"
          confirmTone="bg-teal"
          busy={batchDecide.isPending}
          onConfirm={(comment) => {
            setBatchComment(comment);
            handleBatchApprove();
          }}
          onClose={() => setShowBatchApproveConfirm(false)}
        />
      )}

      {modal && <ApprovalDraftModal me={user} editDoc={modal.edit ?? null} onClose={() => setModal(null)} />}
    </div>
  );
}

/** 목록 보조 표기(기안자명은 상세에서 org 로 해석 — 목록은 부서 비정규화 사용). */
function org_nameFallback(d: ApprovalDoc): string {
  return d.drafterDept || '기안';
}

function DocDetail({
  doc,
  me,
  onEdit,
}: {
  doc: ApprovalDoc;
  me: string;
  onEdit: (d: ApprovalDoc) => void;
}) {
  const org = useOrgTree();
  const decide = useDecideStep();
  const submitM = useSubmitApproval();
  const recallM = useRecallApproval();
  const deleteM = useDeleteToTrash();
  const restoreM = useRestoreFromTrash();
  const permDeleteM = usePermanentlyDelete();
  const confirmPostReadM = useConfirmPostRead();
  const [reject, setReject] = useState<{ seq: number; comment: string } | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveComment, setApproveComment] = useState('');
  const [err, setErr] = useState('');

  const nameOf = (id: string) => org.userById(id)?.name ?? id;
  const busy = decide.isPending || submitM.isPending || recallM.isPending || deleteM.isPending || restoreM.isPending || permDeleteM.isPending || confirmPostReadM.isPending;

  const postReadStep = useMemo(() => doc.steps.find((s) => s.delegatedFromId === me), [doc.steps, me]);

  // 내 차례(직접 활성 결재자 또는 대결자)의 seq.
  const [mySeq, setMySeq] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function resolveMySeq() {
      if (!doc || !me) {
        if (isMounted) setMySeq(null);
        return;
      }
      const acts = activeSteps(doc);
      // 1) 본인이 직접 결재자인 경우
      const direct = acts.find((s) => s.approverId === me && s.kind !== '참조');
      if (direct) {
        if (isMounted) setMySeq(direct.seq);
        return;
      }
      // 2) 본인이 대결자로 지정된 부재자의 결재 단계인 경우 (옵션 ON 상태일 때만)
      const isProxyEnabled = await approvalProcessRepo.isOptionEnabled('proxy_approval');
      if (isProxyEnabled) {
        for (const actStep of acts) {
          if (actStep.kind === '참조') continue;
          const abs = await absenceRepo.get(actStep.approverId);
          if (abs.isAbsent && abs.delegateUserId === me) {
            const now = new Date();
            const startValid = !abs.startDate || now >= new Date(abs.startDate);
            const endValid = !abs.endDate || now <= new Date(abs.endDate);
            if (startValid && endValid) {
              if (isMounted) setMySeq(actStep.seq);
              return;
            }
          }
        }
      }
      if (isMounted) setMySeq(null);
    }
    resolveMySeq();
    return () => {
      isMounted = false;
    };
  }, [doc, me]);
  const iAmDrafter = doc.drafterId === me;
  const canRecall = iAmDrafter && doc.status === '진행중' && !doc.steps.some((s) => s.kind !== '참조' && s.decision === '승인');
  const canResubmit = iAmDrafter && (doc.status === '반려' || doc.status === '긴급 조치 사후 검토 반려' || doc.status === '회수');
  const canEditDraft = iAmDrafter && doc.status === '임시저장';
  const isInTrash = iAmDrafter && doc.status === '삭제';

  const run = async (fn: () => Promise<unknown>) => {
    setErr('');
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : '처리 중 오류가 발생했습니다.'); }
  };

  const toTrash = () => {
    if (window.confirm('이 임시저장 문서를 휴지통으로 보내시겠습니까?')) {
      run(() => deleteM.mutateAsync(doc.id));
    }
  };
  const restoreTrash = () => run(() => restoreM.mutateAsync(doc.id));
  const permDelete = () => {
    if (window.confirm('이 문서를 영구 삭제하시겠습니까? 복구할 수 없습니다.')) {
      run(() => permDeleteM.mutateAsync(doc.id));
    }
  };

  const handleConfirmApprove = () => {
    if (mySeq == null) return;
    run(() =>
      decide.mutateAsync({
        id: doc.id,
        seq: mySeq,
        userId: me,
        decision: '승인',
        comment: approveComment.trim() || undefined,
      })
    ).then(() => {
      setShowApproveModal(false);
      setApproveComment('');
    });
  };

  const hold = () => mySeq != null && run(() => decide.mutateAsync({ id: doc.id, seq: mySeq, userId: me, decision: '보류' }));
  const doReject = () => {
    if (!reject) return;
    if (!reject.comment.trim()) { setErr('반려 사유를 입력하세요.'); return; }
    run(() => decide.mutateAsync({ id: doc.id, seq: reject.seq, userId: me, decision: '반려', comment: reject.comment }))
      .then(() => setReject(null));
  };

  const activeIds = currentApproverIds(doc);

  return (
    <div className="flex h-full flex-col">
      {/* 상세 헤더 & 미니 결재선 */}
      <div className="border-b border-border px-5 py-3.5">
        <div className="flex items-center justify-between gap-4">
          {/* 좌측: 문서 기본 정보 */}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <DocStatusBadge doc={doc} me={me} />
              <span className="text-[16px]">{DOC_TYPE_ICON[doc.docType] ?? '📄'}</span>
              <h2 className="truncate text-[16px] font-bold text-ink">{doc.title}</h2>
            </div>
            <div className="text-[11.5px] text-ink3">
              {doc.docNo} · {doc.docType} · 기안 <span className="font-medium text-ink2">{nameOf(doc.drafterId)}</span>({doc.drafterDept}) · {fmtDateTime(doc.submittedAt ?? doc.createdAt)}
            </div>
            {(doc.amount != null || doc.form) && (
              <div className="pt-0.5 flex flex-wrap gap-1.5 text-[11px]">
                {doc.amount != null && <span className="rounded-md bg-panel-alt px-2 py-0.5 font-semibold text-ink2">금액 {won(doc.amount)}</span>}
                {doc.form && (
                  <span className="rounded-md bg-panel-alt px-2 py-0.5 font-semibold text-ink2">
                    {doc.form.leaveType} · {doc.form.startDate}~{doc.form.endDate} · {doc.form.days}일
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 우측: 결재 단계 수에 따른 동적 크기 결재선 플로우차트 (스크롤바 없이 한눈에 맞춤) */}
          {(() => {
            const approvalSteps = doc.steps.filter((s) => s.kind !== '참조').sort((a, b) => a.seq - b.seq);
            const totalCount = 1 + approvalSteps.length; // 기안자 + 결재자 수

            // 단계 수에 따른 동적 스타일 도출
            let cardWidthClass = 'w-[92px] h-[80px]';
            let nameFontClass = 'text-[11.5px]';
            let subFontClass = 'text-[9px]';
            let arrowFontClass = 'text-[11px]';
            let gapClass = 'gap-1.5';
            let paddingClass = 'p-2';

            if (totalCount >= 6) {
              cardWidthClass = 'w-[64px] h-[64px]';
              nameFontClass = 'text-[9.5px]';
              subFontClass = 'text-[7.5px]';
              arrowFontClass = 'text-[8.5px]';
              gapClass = 'gap-0.5';
              paddingClass = 'p-1';
            } else if (totalCount >= 5) {
              cardWidthClass = 'w-[74px] h-[70px]';
              nameFontClass = 'text-[10px]';
              subFontClass = 'text-[8px]';
              arrowFontClass = 'text-[9px]';
              gapClass = 'gap-1';
              paddingClass = 'p-1.5';
            } else if (totalCount >= 4) {
              cardWidthClass = 'w-[84px] h-[74px]';
              nameFontClass = 'text-[10.5px]';
              subFontClass = 'text-[8.5px]';
              arrowFontClass = 'text-[10px]';
              gapClass = 'gap-1';
              paddingClass = 'p-1.5';
            }

            return (
              <div className={`flex shrink-0 items-center ${gapClass} max-w-[65%] py-0.5 select-none`}>
                {/* 기안자 카드 */}
                <div className={`${cardWidthClass} ${paddingClass} shrink-0 flex flex-col justify-between rounded-xl border border-teal/20 bg-teal-soft/10 text-center shadow-xs`}>
                  <div className={`${subFontClass} font-bold text-teal`}>기안</div>
                  <div className="flex flex-col items-center justify-center flex-1 min-w-0">
                    <span className={`${nameFontClass} font-semibold text-ink truncate w-full`}>
                      {doc.drafterName || nameOf(doc.drafterId)}
                    </span>
                    <span className={`${subFontClass} text-ink3 truncate w-full mt-0.5`}>
                      {doc.drafterPos || org.userById(doc.drafterId)?.position || doc.drafterDept}
                    </span>
                  </div>
                  <div className={`rounded bg-teal/15 py-0.2 ${subFontClass} font-bold text-teal`}>상신</div>
                </div>

                {/* 결재권자 카드들 */}
                {approvalSteps.map((s) => {
                  const isActive = activeIds.includes(s.approverId) && (s.decision === '대기' || s.decision === '보류') && s.kind !== '참조';

                  let statusText: string = s.decision;
                  let statusBg = 'bg-ink3/10 text-ink3';
                  if (s.decision === '승인') {
                    statusText = '승인';
                    statusBg = 'bg-teal-soft text-teal';
                  } else if (s.decision === '반려') {
                    statusText = '반려';
                    statusBg = 'bg-red-500/10 text-red-500';
                  } else if (s.decision === '보류') {
                    statusText = '보류';
                    statusBg = 'bg-amber/10 text-amber';
                  } else if (isActive) {
                    statusText = '결재대기';
                    statusBg = 'bg-amber text-white animate-pulse';
                  }

                  return (
                    <Fragment key={s.seq}>
                      <span className={`text-ink3 ${arrowFontClass} font-bold shrink-0`}>➔</span>
                      <div className={`${cardWidthClass} ${paddingClass} shrink-0 flex flex-col justify-between rounded-xl border text-center shadow-xs transition-all ${isActive ? 'border-teal bg-teal-soft/30 ring-2 ring-teal/30 scale-102' : 'border-border bg-panel'}`}>
                        <div className={`flex items-center justify-between ${subFontClass} font-bold`}>
                          <span className="text-ink3">Seq{s.seq}</span>
                          <span className={KIND_TONE[s.kind] || 'text-ink2'}>{s.kind}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center flex-1 min-w-0">
                          <span className={`${nameFontClass} font-semibold text-ink truncate w-full`}>
                            {s.approverName || nameOf(s.approverId)}
                          </span>
                          <span className={`${subFontClass} text-ink3 truncate w-full mt-0.5`}>
                            {s.approverPos || org.userById(s.approverId)?.position || '—'}
                          </span>
                          {s.delegatedFromId && <span className="text-[7.5px] text-amber truncate w-full">대결</span>}
                        </div>
                        <div className={`rounded py-0.2 ${subFontClass} font-bold ${statusBg}`}>
                          {statusText}
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* 헤더 아래 본문 영역 */}
      <div className="px-5 py-4">
        {/* 수신/참조자 목록 (슬림 인라인 배치 & 수신/참조 태그 명시) */}
        {((doc.recipients && doc.recipients.length > 0) || doc.steps.some((s) => s.kind === '참조')) && (
          <div className="mb-2.5 flex items-center gap-2 text-[11px] leading-none">
            <span className="text-ink3 font-semibold shrink-0 select-none">└─ 📨 공유처:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {doc.recipients?.map((r) => {
                let detailInfo = '';
                if (r.type === 'user') {
                  const u = org.userById(r.id);
                  if (u) detailInfo = ` (${u.dept} ${u.position})`;
                } else if (r.type === 'dept') {
                  detailInfo = ' (부서)';
                }
                const label = r.type === 'drafter' ? '[기안자]' : '[수신]';
                return (
                  <span key={r.id} className="inline-flex items-center gap-1 text-teal font-medium">
                    <span className="text-[9.5px] opacity-75 font-bold">{label}</span>
                    <span>{r.type === 'dept' ? '📁' : '👤'}</span>
                    <span>{r.name}{detailInfo}</span>
                  </span>
                );
              })}
              {doc.steps.filter((s) => s.kind === '참조').map((s) => {
                const u = org.userById(s.approverId);
                const posDept = s.approverPos || u?.position ? ` (${s.approverDept || u?.dept || ''} ${s.approverPos || u?.position || ''})` : '';
                return (
                  <span key={s.approverId} className="inline-flex items-center gap-1 text-teal font-medium">
                    <span className="text-[9.5px] opacity-75 font-bold">[참조]</span>
                    <span>{s.approverName || nameOf(s.approverId)}{posDept}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
        {doc.status === '반려' && (() => {
          const rejectStep = doc.steps.find((s) => s.decision === '반려');
          const rejectUser = rejectStep ? org.userById(rejectStep.approverId) : null;
          const rejectUserName = rejectUser ? `${rejectUser.name} ${rejectUser.position}` : rejectStep?.approverId ?? '알 수 없음';
          return (
            <div className="mb-4 rounded-xl border border-danger/30 bg-danger/5 p-3.5 text-[12px] text-ink animate-fade-in">
              <div className="flex items-center gap-1.5 font-bold text-danger mb-1.5">
                <span>⚠</span>
                <span>반려 정보</span>
              </div>
              <div className="grid grid-cols-2 gap-y-1.5 text-ink2">
                <div>• 반려자: <span className="font-semibold text-ink">{rejectUserName}</span></div>
                <div>• 반려일시: <span className="font-semibold text-ink">{rejectStep?.decidedAt ? fmtDateTime(rejectStep.decidedAt) : '—'}</span></div>
                <div className="col-span-2 mt-1 bg-white/60 dark:bg-black/10 rounded-lg p-2.5 border border-border/40">
                  <div className="text-[11px] text-ink3 font-semibold mb-1">반려 사유</div>
                  <div className="italic text-ink leading-relaxed">“{rejectStep?.comment || '반려 사유 없음'}”</div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 시행 정보 및 제어 영역 */}
        {doc.execution && (
          <ApprovalExecutionPanel doc={doc} userId={me} />
        )}

        {/* 하단: 결재 문서 */}
        <div className="border-t border-border pt-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[11.5px] font-bold text-ink2">결재 문서</div>
            {/* 인쇄 버튼을 결재 문서 섹션으로 이동 */}
            <button
              onClick={() => window.print()}
              title="결재 문서 인쇄"
              className="rounded-lg border border-border-hi bg-panel px-2.5 py-1 text-[11px] font-semibold text-ink2 hover:border-teal hover:text-teal transition-all print:hidden"
            >
              🖨 인쇄
            </button>
          </div>
          <div className="rounded-xl border border-border bg-white dark:bg-zinc-900 overflow-hidden shadow-sm p-4">
            <ApprovalDocumentView doc={doc} />
          </div>
        </div>

        {err && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[11.5px] font-semibold text-red-500">{err}</p>}

        {/* 반려 사유 입력 */}
        {reject && (
          <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/5 p-3">
            <div className="mb-1.5 text-[11.5px] font-bold text-red-500">반려 사유</div>
            <textarea
              value={reject.comment}
              onChange={(e) => setReject({ ...reject, comment: e.target.value })}
              rows={2}
              autoFocus
              placeholder="반려 사유를 입력하세요(필수)"
              className="w-full resize-none rounded-lg border border-border-hi bg-panel px-3 py-2 text-[12px] text-ink outline-none focus:border-red-500"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={() => setReject(null)} className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-ink3 hover:bg-panel-alt">취소</button>
              <button onClick={doReject} disabled={busy} className="rounded-lg bg-red-500 px-3.5 py-1.5 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-50">반려 확정</button>
            </div>
          </div>
        )}
      </div>

      {/* 액션 바 */}
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
        {mySeq != null && !reject && (
          <>
            <button onClick={() => setReject({ seq: mySeq, comment: '' })} disabled={busy} className="rounded-lg border border-red-500/50 px-3.5 py-2 text-[12.5px] font-bold text-red-500 hover:bg-red-500/5 disabled:opacity-50">반려</button>
            <button onClick={hold} disabled={busy} className="rounded-lg border border-border-hi px-3.5 py-2 text-[12.5px] font-bold text-ink2 hover:border-ink3 disabled:opacity-50">보류</button>
            <button onClick={() => setShowApproveModal(true)} disabled={busy} className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50">승인</button>
          </>
        )}
        {canRecall && <button onClick={() => run(() => recallM.mutateAsync({ id: doc.id, userId: me }))} disabled={busy} className="rounded-lg border border-border-hi px-3.5 py-2 text-[12.5px] font-bold text-ink2 hover:border-amber hover:text-amber disabled:opacity-50">회수</button>}
        {canEditDraft && (
          <>
            <button onClick={toTrash} disabled={busy} className="rounded-lg border border-red-500/50 px-3.5 py-2 text-[12.5px] font-bold text-red-500 hover:bg-red-500/5 disabled:opacity-50">삭제</button>
            <button onClick={() => onEdit(doc)} disabled={busy} className="rounded-lg border border-border-hi px-3.5 py-2 text-[12.5px] font-bold text-ink2 hover:border-teal hover:text-teal disabled:opacity-50">편집</button>
            <button onClick={() => run(() => submitM.mutateAsync({ id: doc.id, userId: me }))} disabled={busy} className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50">상신</button>
          </>
        )}
        {isInTrash && (
          <>
            <button onClick={permDelete} disabled={busy} className="rounded-lg border border-red-500/50 px-3.5 py-2 text-[12.5px] font-bold text-red-500 hover:bg-red-500/5 disabled:opacity-50">영구삭제</button>
            <button onClick={restoreTrash} disabled={busy} className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50">복구</button>
          </>
        )}
        {canResubmit && (
          <>
            <button onClick={() => onEdit(doc)} disabled={busy} className="rounded-lg border border-border-hi px-3.5 py-2 text-[12.5px] font-bold text-ink2 hover:border-teal hover:text-teal disabled:opacity-50">편집</button>
            <button onClick={() => run(() => submitM.mutateAsync({ id: doc.id, userId: me }))} disabled={busy} className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50">재상신</button>
          </>
        )}
        {postReadStep && (
          postReadStep.postReadAt ? (
            <span className="rounded-lg bg-teal/15 px-3 py-1.5 text-[12px] font-bold text-teal border border-teal/30 flex items-center gap-1.5">
              <span>✓</span>
              <span>후열 확인 완료 ({fmtDateTime(postReadStep.postReadAt)})</span>
            </span>
          ) : (
            <button
              onClick={() => run(() => confirmPostReadM.mutateAsync({ id: doc.id, seq: postReadStep.seq, userId: me }))}
              disabled={busy}
              className="rounded-lg bg-amber-500 text-white px-4 py-2 text-[12.5px] font-bold shadow-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              <span>👁️</span>
              <span>후열 확인</span>
            </button>
          )
        )}
        {mySeq == null && !canRecall && !canEditDraft && !canResubmit && !isInTrash && !postReadStep && (
          <span className="text-[11px] text-ink3">
            {doc.status === '완료' ? '결재가 완료된 문서입니다.' : doc.status === '진행중' ? '다른 결재자의 차례입니다.' : ''}
          </span>
        )}
      </div>

      {/* 단일 결재 승인 의견 입력 모달 */}
      {showApproveModal && (
        <ApprovalOpinionModal
          title="결재 승인 확인"
          description={
            <div className="space-y-1 text-teal-800 dark:text-teal-200 font-semibold">
              <p className="font-extrabold text-[13px] text-ink">{doc.title}</p>
              <p className="text-[11.5px] font-normal text-ink2">위 결재 문서를 승인하시겠습니까?</p>
            </div>
          }
          confirmText="승인 확정"
          confirmTone="bg-teal"
          busy={decide.isPending}
          onConfirm={(comment) => {
            setApproveComment(comment);
            handleConfirmApprove();
          }}
          onClose={() => setShowApproveModal(false)}
        />
      )}
    </div>
  );
}
