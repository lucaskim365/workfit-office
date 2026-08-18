import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  useAllApprovals,
  useAllExecutions,
} from '@/features/gw/useApprovals';
import { activeSteps, currentApproverIds, getPredecessorsOf, matchesBox, byRecent } from '@/domain/approvalDoc/engine';
import { APPROVAL_BOXES, type ApprovalBox, type ApprovalDoc } from '@/domain/approvalDoc/schema';
import type { User } from '@/domain/user/schema';




import { DOC_TYPE_ICON, fmtDateTime, KIND_TONE, won } from './utils/approvalUtils';
import { DocStatusBadge } from './components/ApprovalBadges';
import { useUsers } from '@/features/user/useUsers';

import { ApprovalOpinionModal } from './components/ApprovalOpinionModal';
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
  const navigate = useNavigate();
  const me = user?.id ?? '';
  const org = useOrgTree();
  const userObj = org.userById(me);
  const { data: users = [] } = useUsers();

  const { byBox, counts, isLoading } = useApprovalBoxes(me);
  const { data: allDocs = [] } = useAllApprovals();
  const { data: deptExecutions = [] } = useAllExecutions();

  const [params, setParams] = useSearchParams();
  const [box, setBox] = useState<ApprovalBox | '문서함'>('대기');
  const [docBoxFilter, setDocBoxFilter] = useState<'dept' | 'all'>('dept');

  const myActivePendingCount = useMemo(() => {
    const list = byBox['대기'] ?? [];
    return list.filter((d) => currentApproverIds(d).includes(me)).length;
  }, [byBox, me]);

  const [selId, setSelId] = useState<string | null>(null);
  const [doneFilter, setDoneFilter] = useState<'all' | 'draft' | 'approved'>('all');
  const [todoFilter, setTodoFilter] = useState<'all' | 'pending' | 'progress'>('all');
  const [execFilter, setExecFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [rejectFilter, setRejectFilter] = useState<'draft' | 'rejected'>('draft');



  // 다중 선택 상태 & 일괄 처리 훅
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBatchApproveConfirm, setShowBatchApproveConfirm] = useState(false);
  const [batchComment, setBatchComment] = useState('');
  const [isListCollapsed, setIsListCollapsed] = useState(false);

  const batchDecide = useBatchDecideStep();
  const batchRestore = useBatchRestoreFromTrash();
  const batchPermanentDelete = useBatchPermanentlyDelete();

  const preds = useMemo(() => getPredecessorsOf(me), [me]);

  // 본인 및 전임자(들)의 approval boxes 데이터를 병합하여 단일 결재함 리스트 구성 (권한 승계 완벽 반영)
  const list = useMemo(() => {
    if (box === '문서함') return [];
    
    // 1. 본인의 기본 문서 목록
    const myDeptObj = org.depts.find((d) => d.name === userObj?.dept);
    const myDeptNameOrId = userObj ? (myDeptObj ? `${userObj.dept}||${myDeptObj.id}` : userObj.dept) : '';
    let combined = allDocs.filter((d) => matchesBox(d, me, box as ApprovalBox, myDeptNameOrId));

    // 2. 전임자들의 문서 목록을 가져와 병합
    preds.forEach((predId) => {
      const predUser = org.userById(predId) || users.find((u) => u.id === predId);
      if (!predUser) return;
      const predDeptObj = org.depts.find((d) => d.name === predUser.dept);
      const predDeptNameOrId = predDeptObj ? `${predUser.dept}||${predDeptObj.id}` : predUser.dept;
      
      const predDocs = allDocs.filter((d) => matchesBox(d, predId, box as ApprovalBox, predDeptNameOrId));
      combined = [...combined, ...predDocs];
    });

    // 3. ID 기준 중복 제거 및 최신 상신순 재정렬
    const uniqueMap = new Map<string, ApprovalDoc>();
    combined.forEach((d) => uniqueMap.set(d.id, d));
    return Array.from(uniqueMap.values()).sort(byRecent);
  }, [box, allDocs, me, preds, org, userObj, users]);


  const selDoc = useApprovalDoc(selId);


  // 함이나 필터가 바뀌면 다중 선택 초기화
  useEffect(() => {
    setSelectedIds([]);
  }, [box, doneFilter, todoFilter, execFilter, docBoxFilter, rejectFilter]);

  // 완료함, 결재함, 시행함 필터링 적용
  const filteredList = useMemo(() => {
    if (box === '문서함') {
      if (docBoxFilter === 'dept') {
        const myDeptName = userObj?.dept ?? '';
        const myDeptObj = org.depts.find((d) => d.name === myDeptName);
        const myDeptId = myDeptObj?.id ?? '';
        return allDocs.filter((d) => {
          if (d.status !== '완료') return false; // 결재 완료된 문서만 노출
          const vis = d.visibility ?? '부서';
          if (vis === '비공개') return false; // 비공개는 제외

          // drafterDeptId 가 비어있는 과거 레거시 기결재 문서는 기안자의 현재 부서 ID를 도출해 필터 대조
          const drafterUser = org.userById(d.drafterId);
          const drafterCurrentDeptName = drafterUser?.dept ?? '';
          const drafterCurrentDeptObj = org.depts.find((dept) => dept.name === drafterCurrentDeptName);
          const drafterCurrentDeptId = drafterCurrentDeptObj?.id ?? '';
          const docDeptId = d.drafterDeptId || drafterCurrentDeptId;

          return docDeptId === myDeptId || (!docDeptId && d.drafterDept === myDeptName);
        }).sort((a, b) => {
          const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tB - tA;
        });
      } else {
        return allDocs.filter((d) => d.status === '완료' && d.visibility === '전사') // 결재 완료된 문서만 노출
          .sort((a, b) => {
            const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tB - tA;
          });
      }
    }


    if (box === '시행') {
      const myDeptId = userObj?.dept ? (org.depts.find(d => d.name === userObj.dept)?.id ?? '') : '';
      return list.filter((d: ApprovalDoc) => {
        const execs = deptExecutions.filter(e => e.documentId === d.id && e.targetDeptId === myDeptId);
        const hasLegacyMatch = d.execution && (
          d.execution.targetId === myDeptId || d.execution.targetId === userObj?.dept
        );

        if (execFilter === 'pending') {
          if (execs.length > 0) {
            return execs.some(e => e.status === 'UNASSIGNED' || e.status === 'IN_PROGRESS' || e.status === 'RETURNED');
          }
          return hasLegacyMatch && (d.execution!.status === '대기중' || d.execution!.status === '처리중');
        }
        if (execFilter === 'completed') {
          if (execs.length > 0) {
            return execs.every(e => e.status === 'COMPLETED');
          }
          return hasLegacyMatch && d.execution!.status === '시행완료';
        }
        return execs.length > 0 || hasLegacyMatch;
      });
    }
    if (box === '완료') {
      if (doneFilter === 'draft') return list.filter((d: ApprovalDoc) => d.drafterId === me);
      if (doneFilter === 'approved') {
        return list.filter((d: ApprovalDoc) => d.steps.some((s) => s.approverId === me && s.decision === '승인'));
      }
      return list;
    }
    if (box === '반려') {
      if (rejectFilter === 'draft') return list.filter((d: ApprovalDoc) => d.drafterId === me);
      if (rejectFilter === 'rejected') {
        return list.filter((d: ApprovalDoc) => d.steps.some((s) => s.approverId === me && s.decision === '반려'));
      }
      return list;
    }
    if (box === '대기') {
      const preds = getPredecessorsOf(me);
      if (todoFilter === 'pending') {
        return list.filter((d: ApprovalDoc) => {
          const approvers = currentApproverIds(d);
          return approvers.includes(me) || approvers.some(id => preds.includes(id));
        });
      }
      if (todoFilter === 'progress') {
        return list.filter((d: ApprovalDoc) => {
          const approvers = currentApproverIds(d);
          return !approvers.includes(me) && !approvers.some(id => preds.includes(id));
        });
      }
      return list;
    }
    return list;
  }, [box, list, allDocs, doneFilter, todoFilter, execFilter, rejectFilter, me, userObj?.dept, docBoxFilter, org]);


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
    if (filteredList.length === 0) {
      if (selId !== null) setSelId(null);
    } else {
      const exists = filteredList.some((d: ApprovalDoc) => d.id === selId);
      if (!exists) {
        const firstId = filteredList[0].id;
        if (selId !== firstId) setSelId(firstId);
      }
    }

    setSelectedIds((prev) => {
      const next = prev.filter((id) => filteredList.some((d: ApprovalDoc) => d.id === id));
      if (JSON.stringify(prev) === JSON.stringify(next)) return prev; // 참조 비교 우회 방어
      return next;
    });
  }, [filteredList, selId]);


  const isDocSelectable = (d: ApprovalDoc) => {
    if (box === '삭제') return true;
    if (box === '대기') {
      if (todoFilter === 'progress') return false;
      const approvers = currentApproverIds(d);
      return approvers.includes(me) || approvers.some(id => preds.includes(id));
    }
    return false;
  };

  // 다중 선택 처리 헬퍼
  const selectableList = useMemo(() => filteredList.filter(isDocSelectable), [filteredList, box, todoFilter]);
  const isAllSelected = selectableList.length > 0 && selectedIds.length === selectableList.length;
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableList.map((d: ApprovalDoc) => d.id));
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
    <div className="w-full px-6 pt-2">
      <div className="flex gap-4 items-start w-full">
        {/* 좌: 함 탭 (사이드바 - 상단 밀착형) */}
        <div className="w-[160px] rounded-xl border border-border bg-panel p-2 flex flex-col gap-1.5 self-start shadow-sm shrink-0 sticky top-[8px] z-10">

          <button
            onClick={() => navigate('/gw/approval/new')}
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
            {
              title: '문서함',
              boxes: [
                { key: '문서함', label: '문서함' },
              ] as const,
              titleBg: 'bg-teal/10 text-teal dark:text-teal-soft',
            },
            {
              title: '결재할 문서',
              boxes: [{ key: '대기', label: BOX_LABEL['대기'] }] as const,
              titleBg: 'bg-panel-alt text-ink2',
            },
            {
              title: '내가 올린 문서',
              boxes: [
                { key: '상신', label: BOX_LABEL['상신'] },
                { key: '반려', label: BOX_LABEL['반려'] },
              ] as const,
              titleBg: 'bg-panel-alt text-ink2',
            },
            {
              title: '공유 문서',
              boxes: [
                { key: '수신', label: BOX_LABEL['수신'] },
                { key: '참조', label: BOX_LABEL['참조'] },
                { key: '시행', label: BOX_LABEL['시행'] },
                { key: '후열', label: BOX_LABEL['후열'] },
              ] as const,
              titleBg: 'bg-panel-alt text-ink2',
            },
            {
              title: '관리',
              boxes: [
                { key: '완료', label: BOX_LABEL['완료'] },
                { key: '삭제', label: BOX_LABEL['삭제'] },
              ] as const,
              titleBg: 'bg-panel-alt text-ink2',
            },
          ].map((g) => (
            <div key={g.title} className="flex flex-col gap-1.5">
              <div className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase ${g.titleBg}`}>
                {g.title}
              </div>
              <div className="space-y-0.5">
                {g.boxes.map((bInfo) => {
                  const b = bInfo.key;
                  const label = bInfo.label;

                  const myDeptId = userObj?.dept ? (org.depts.find(d => d.name === userObj.dept)?.id ?? '') : '';
                  const executionCount = deptExecutions.filter(
                    (e) => e.targetDeptId === myDeptId && (e.status === 'UNASSIGNED' || e.status === 'IN_PROGRESS' || e.status === 'RETURNED')
                  ).length;
                  const unconfirmedPostReadCount = (byBox['후열'] ?? []).filter(
                    (d) => d.steps.some((s) => s.delegatedFromId === me && !s.postReadAt)
                  ).length;

                  // 배지 개수 산출
                  let badgeCount = 0;
                  if (b === '문서함') {
                    const myDeptName = userObj?.dept ?? '';
                    const myDeptObj = org.depts.find((d) => d.name === myDeptName);
                    const myDeptId = myDeptObj?.id ?? '';
                    const deptDocsCount = allDocs.filter((d) => {
                      const vis = d.visibility ?? '부서';
                      if (vis === '비공개') return false;

                      const drafterUser = org.userById(d.drafterId);
                      const drafterCurrentDeptName = drafterUser?.dept ?? '';
                      const drafterCurrentDeptObj = org.depts.find((dept) => dept.name === drafterCurrentDeptName);
                      const drafterCurrentDeptId = drafterCurrentDeptObj?.id ?? '';
                      const docDeptId = d.drafterDeptId || drafterCurrentDeptId;

                      return docDeptId === myDeptId || (!docDeptId && d.drafterDept === myDeptName);
                    }).length;
                    const companyDocsCount = allDocs.filter((d) => d.visibility === '전사').length;
                    badgeCount = deptDocsCount + companyDocsCount;
                  } else {
                    const myDeptObj = org.depts.find((d) => d.name === userObj?.dept);
                    const myDeptNameOrId = userObj ? (myDeptObj ? `${userObj.dept}||${myDeptObj.id}` : userObj.dept) : '';
                    let combined = allDocs.filter((d) => matchesBox(d, me, b as ApprovalBox, myDeptNameOrId));

                    preds.forEach((predId) => {
                      const predUser = org.userById(predId) || users.find((u) => u.id === predId);
                      if (!predUser) return;
                      const predDeptObj = org.depts.find((d) => d.name === predUser.dept);
                      const predDeptNameOrId = predDeptObj ? `${predUser.dept}||${predDeptObj.id}` : predUser.dept;
                      const predDocs = allDocs.filter((d) => matchesBox(d, predId, b as ApprovalBox, predDeptNameOrId));
                      combined = [...combined, ...predDocs];
                    });

                    const uniqueIds = new Set(combined.map((d) => d.id));
                    badgeCount = uniqueIds.size;
                  }


                  const hasBadge = badgeCount > 0;

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

                      <span className="flex items-center gap-1.5">
                        <span>{label}</span>
                      </span>
                      {hasBadge && b !== '문서함' && (
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

        {/* 우측 영역: 타이틀 바 + (목록 & 상세) */}
        <div className="flex-1 flex flex-col gap-3">
          {/* 🖥️ 상단 고정 통합 타이틀 바 ( GwHead 잘림 제거 대안 ) */}
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[20px]">🖋️</span>
              <h1 className="text-[20px] font-extrabold tracking-tight text-ink">전자결재</h1>
            </div>
            
            <button
              type="button"
              onClick={() => setIsListCollapsed(!isListCollapsed)}
              className="rounded-lg border border-teal/30 bg-white dark:bg-panel px-3 py-1.5 text-[11.5px] font-extrabold text-teal hover:border-teal hover:bg-teal-soft/20 transition-all shadow-2xs hover:scale-[1.01] active:scale-[0.99] flex items-center gap-1.5 cursor-pointer"
            >
              <span>{isListCollapsed ? '▶' : '◀'}</span>
              <span>{isListCollapsed ? '목록 펼치기' : '목록 접기'}</span>
            </button>
          </div>

          <div className="flex items-start gap-4">
            {/* 중: 목록 (목록 접기 시 hidden 처리) */}
            {!isListCollapsed && (
              <div className="overflow-hidden rounded-xl border border-border bg-panel flex flex-col w-[320px] shrink-0 min-w-0 shadow-sm self-start animate-fadeIn sticky top-[8px]">
                {/* 목록 헤더 */}

                <div className="border-b border-border px-3.5 py-2.5 flex items-center justify-between text-[12px] font-bold text-ink2 bg-panel-alt/30">
                  <div className="flex items-center gap-2">
                    {((box === '대기' && todoFilter !== 'progress') || box === '삭제') && selectedIds.length > 0 && (
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        className="rounded border-border text-teal focus:ring-teal cursor-pointer h-3.5 w-3.5 animate-fadeIn"
                        title="전체 선택/해제"
                      />
                    )}
                    <span>
                      {box === '문서함' ? '문서함' : BOX_LABEL[box as ApprovalBox]} 
                      <span className="text-ink3">· {filteredList.length}</span>
                    </span>


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
            {box === '반려' && (
              <div className="flex border-b border-border bg-panel-alt/50 p-1.5 gap-1.5">
                {(['draft', 'rejected'] as const).map((f) => {
                  const label = f === 'draft' ? '반려받은 문서' : '내가 반려한 문서';
                  return (
                    <button
                      key={f}
                      onClick={() => setRejectFilter(f)}
                      className={`flex-1 rounded-lg py-1.5 text-[10.5px] font-bold transition-all ${rejectFilter === f
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'text-ink3 hover:bg-panel-alt hover:text-ink2'
                        }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {box === '문서함' && (
              <div className="flex border-b border-border bg-panel-alt/50 p-1.5 gap-1.5">
                {(['dept', 'all'] as const).map((f) => {
                  const label = f === 'dept' ? '부서 문서' : '전사 문서';
                  return (
                    <button
                      key={f}
                      onClick={() => setDocBoxFilter(f)}
                      className={`flex-1 rounded-lg py-1.5 text-[10.5px] font-bold transition-all ${docBoxFilter === f
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
              {filteredList.map((d: ApprovalDoc) => {
                const isRecentCompleted = d.status === '완료' && d.completedAt && (Date.now() - new Date(d.completedAt).getTime() < 24 * 60 * 60 * 1000);
                const isChecked = selectedIds.includes(d.id);

                const isActive = selId === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setSelId(d.id)}
                    className={`relative flex w-full items-start gap-2 border-b border-border px-3.5 py-3 text-left transition-all ${
                      isActive
                        ? 'bg-teal-soft/50 border-l-4 border-l-teal shadow-2xs font-semibold'
                        : isRecentCompleted
                          ? 'bg-teal-soft/10 border-l-4 border-l-teal/30 hover:bg-teal-soft/20'
                          : 'hover:bg-panel-alt border-l-4 border-l-transparent'
                    }`}

                  >
                    {isDocSelectable(d) && (
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
            {((box === '대기' && todoFilter !== 'progress') || box === '삭제') && selectedIds.length > 0 && (
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
              users={users}
              onEdit={(d) => navigate(`/gw/approval/edit/${d.id}`)}
            />

          ) : (
            <div className="grid h-full place-items-center py-20 text-[12px] text-ink3">문서를 선택하세요.</div>
          )}
        </div>
      </div>
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
  users,
  onEdit,
}: {
  doc: ApprovalDoc;
  me: string;
  users: User[];
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

  const nameOf = (id: string) => {
    const u = org.userById(id) || users.find((x) => x.id === id);
    if (!u) return id;
    return u.status === '미사용' ? `${u.name}(퇴사)` : u.name;
  };

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
  const canResubmit = iAmDrafter && (doc.status === '반려' || doc.status === '긴급 조치 사후 검토 반려' || doc.status === '회수' || doc.status === '시행반송');
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
            
            // 병렬 그룹으로 묶기
            const flowGroups: any[] = [];
            approvalSteps.forEach((s) => {
              if (s.parallelGroup) {
                const existing = flowGroups.find((g) => g.isParallel && g.id === s.parallelGroup);
                if (existing) {
                  existing.steps.push(s);
                } else {
                  flowGroups.push({
                    id: s.parallelGroup,
                    isParallel: true,
                    steps: [s],
                  });
                }
              } else {
                flowGroups.push({
                  id: 'seq-' + s.seq,
                  isParallel: false,
                  steps: [s],
                });
              }
            });

            const totalCount = 1 + flowGroups.length; // 기안자 + 결재 단계 수

            // 일반 카드 크기 정의 (기존 세로 3단 카드 비율 복구)
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

            // 병렬 카드 전용 크기 정의 (가로로 넓고 슬림한 비율)
            let parallelCardWidthClass = 'w-[135px] h-[48px]';
            let parallelPaddingClass = 'px-2.5 py-1.5';
            let parallelNameFontClass = 'text-[11.5px]';
            let parallelSubFontClass = 'text-[9.5px]';

            if (totalCount >= 6) {
              parallelCardWidthClass = 'w-[110px] h-[42px]';
              parallelPaddingClass = 'px-1.5 py-1';
              parallelNameFontClass = 'text-[9.5px]';
              parallelSubFontClass = 'text-[7.5px]';
            } else if (totalCount >= 5) {
              parallelCardWidthClass = 'w-[120px] h-[44px]';
              parallelPaddingClass = 'px-2 py-1';
              parallelNameFontClass = 'text-[10px]';
              parallelSubFontClass = 'text-[8px]';
            } else if (totalCount >= 4) {
              parallelCardWidthClass = 'w-[125px] h-[46px]';
              parallelPaddingClass = 'px-2 py-1.2';
              parallelNameFontClass = 'text-[10.5px]';
              parallelSubFontClass = 'text-[8.5px]';
            }

            return (
              <div className={'flex shrink-0 items-center ' + gapClass + ' max-w-[65%] py-0.5 select-none'}>
                {/* 기안자 카드 (기존 세로 3단 카드 그대로 유지) */}
                <div className={cardWidthClass + ' ' + paddingClass + ' shrink-0 flex flex-col justify-between rounded-xl border border-teal/20 bg-teal-soft/10 text-center shadow-xs'}>
                  <div className={subFontClass + ' font-bold text-teal'}>기안</div>
                  <div className="flex flex-col items-center justify-center flex-1 min-w-0">
                    <span className={nameFontClass + ' font-semibold text-ink truncate w-full'}>
                      {doc.drafterName || nameOf(doc.drafterId)}
                    </span>
                    <span className={subFontClass + ' text-ink3 truncate w-full mt-0.5'}>
                      {doc.drafterPos || org.userById(doc.drafterId)?.position || doc.drafterDept}
                    </span>
                  </div>
                  <div className={'rounded bg-teal/15 py-0.2 ' + subFontClass + ' font-bold text-teal'}>상신</div>
                </div>

                {/* 결재권자 카드들 */}
                {flowGroups.map((group) => {
                  return (
                    <Fragment key={group.id}>
                      <span className={'text-ink3 ' + arrowFontClass + ' font-bold shrink-0'} style={{ lineHeight: '1' }}>➔</span>
                      {group.isParallel ? (
                        // 병렬 단계: 슬림 가로형 카드
                        <div className="flex flex-col gap-1 shrink-0">
                          {group.steps.map((s: typeof approvalSteps[number]) => {
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
                              <div key={s.seq} className={parallelCardWidthClass + ' ' + parallelPaddingClass + ' flex items-center justify-between rounded-xl border shadow-xs transition-all gap-1.5 ' + (isActive ? 'border-teal bg-teal-soft/30 ring-2 ring-teal/30 scale-102' : 'border-border bg-panel')}>
                                <div className="flex flex-col items-start min-w-0 flex-1">
                                  <span className={parallelNameFontClass + ' font-bold text-ink truncate w-full'}>
                                    {s.approverName || nameOf(s.approverId)}
                                  </span>
                                  <span className={parallelSubFontClass + ' text-ink3 truncate w-full'}>
                                    {s.approverPos || org.userById(s.approverId)?.position || '—'}
                                    {s.delegatedFromId && <span className="ml-1 text-[7.5px] text-amber font-bold">(대결)</span>}
                                  </span>
                                </div>
                                <div className="flex flex-col items-end shrink-0 gap-0.5">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[8px] text-ink3 font-medium">Seq{s.seq}</span>
                                    <span className={(KIND_TONE[s.kind] || 'text-ink2') + ' ' + parallelSubFontClass + ' font-bold'}>{s.kind}</span>
                                  </div>
                                  <div className={'rounded px-1 py-0.2 ' + parallelSubFontClass + ' font-bold ' + statusBg}>
                                    {statusText}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        // 단일 순차 단계: 기존 세로 3단 카드 유지
                        (() => {
                          const s = group.steps[0];
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
                            <div className={cardWidthClass + ' ' + paddingClass + ' shrink-0 flex flex-col justify-between rounded-xl border text-center shadow-xs transition-all ' + (isActive ? 'border-teal bg-teal-soft/30 ring-2 ring-teal/30 scale-102' : 'border-border bg-panel')}>
                              <div className={'flex items-center justify-between ' + subFontClass + ' font-bold'}>
                                <span className="text-ink3">Seq{s.seq}</span>
                                <span className={KIND_TONE[s.kind] || 'text-ink2'}>{s.kind}</span>
                              </div>
                              <div className="flex flex-col items-center justify-center flex-1 min-w-0">
                                <span className={nameFontClass + ' font-semibold text-ink truncate w-full'}>
                                  {s.approverName || nameOf(s.approverId)}
                                </span>
                                <span className={subFontClass + ' text-ink3 truncate w-full mt-0.5'}>
                                  {s.approverPos || org.userById(s.approverId)?.position || '—'}
                                </span>
                                {s.delegatedFromId && <span className="text-[7.5px] text-amber truncate w-full">대결</span>}
                              </div>
                              <div className={'rounded py-0.2 ' + subFontClass + ' font-bold ' + statusBg}>
                                {statusText}
                              </div>
                            </div>
                          );
                        })()
                      )}
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
                let isRetired = false;
                if (r.type === 'user') {
                  const u = org.userById(r.id) || users.find((x) => x.id === r.id);
                  if (u) {
                    detailInfo = ` (${u.dept} ${u.position})`;
                    isRetired = u.status === '미사용';
                  }
                } else if (r.type === 'dept') {
                  detailInfo = ' (부서)';
                }
                const label = r.type === 'drafter' ? '[기안자]' : '[수신]';
                const displayName = isRetired ? `${r.name.replace('(퇴사)', '')}(퇴사)` : r.name;
                return (
                  <span key={r.id} className="inline-flex items-center gap-1 text-teal font-medium">
                    <span className="text-[9.5px] opacity-75 font-bold">{label}</span>
                    <span>{r.type === 'dept' ? '📁' : '👤'}</span>
                    <span>{displayName}{detailInfo}</span>
                  </span>
                );
              })}
              {doc.steps.filter((s) => s.kind === '참조').map((s) => {
                const u = org.userById(s.approverId) || users.find((x) => x.id === s.approverId);
                const isRetired = u?.status === '미사용';
                const displayName = isRetired ? `${u?.name || s.approverName || s.approverId}(퇴사)` : (s.approverName || nameOf(s.approverId));
                
                const pos = s.approverPos || u?.position || '';
                const dept = s.approverDept || u?.dept || '';
                const posDept = dept || pos ? ` (${dept} ${pos})` : '';
                return (
                  <span key={s.approverId} className="inline-flex items-center gap-1 text-teal font-medium">
                    <span className="text-[9.5px] opacity-75 font-bold">[참조]</span>
                    <span>{displayName}{posDept}</span>
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
        {(doc.execution || (doc.executionDepts && doc.executionDepts.length > 0) || (doc.executionsSnapshot && doc.executionsSnapshot.length > 0)) && (
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
            <ApprovalDocumentView doc={doc} currentUser={{ id: me, dept: org.userById(me)?.dept }} />
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
