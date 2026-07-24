import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { approvalDocRepo, type ApprovalDraftInput } from '@/data/approvalDoc/approvalDoc.repo';
import { byRecent, matchesBox } from '@/domain/approvalDoc/engine';
import { APPROVAL_BOXES, type ApprovalBox, type ApprovalDoc } from '@/domain/approvalDoc/schema';
import { useUsers } from '@/features/user/useUsers';
import { departmentRepo } from '@/data/department/department.repo';

/**
 * 전자결재 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 전체 문서를 실시간 구독하여 결재함(5탭)·상세를 클라이언트에서 도출하고,
 * 상태 전이는 mutation 으로 처리한다.
 */
const KEY = 'approvalDocs';

/** 전체 결재 문서 조회(실시간 구독형으로 변경해 결재함 자동 갱신). */
export function useAllApprovals() {
  const qc = useQueryClient();
  const [data, setData] = useState<ApprovalDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = approvalDocRepo.subscribe((list) => {
      setData(list);
      qc.setQueryData([KEY], list);
      setIsLoading(false);
    });
    return unsub;
  }, [qc]);

  return { data, isLoading };
}

export interface ApprovalBoxes {
  byBox: Record<ApprovalBox, ApprovalDoc[]>;
  counts: Record<ApprovalBox, number>;
  isLoading: boolean;
}

/** userId 관점의 결재함 5탭 도출(대기·상신·완료·참조·임시) + 카운트. */
export function useApprovalBoxes(userId: string | undefined): ApprovalBoxes {
  const q = useAllApprovals();
  const { data: users = [] } = useUsers();
  const user = useMemo(() => users.find((u) => u.id === userId), [users, userId]);
  
  const [depts, setDepts] = useState<any[]>([]);
  useEffect(() => {
    departmentRepo.list().then(setDepts);
  }, []);

  const userDeptObj = useMemo(() => depts.find((d) => d.name === user?.dept), [depts, user?.dept]);
  const userDeptNameOrId = useMemo(() => {
    if (!user) return '';
    return userDeptObj ? `${user.dept}||${userDeptObj.id}` : user.dept;
  }, [user, userDeptObj]);

  return useMemo(() => {
    const rows = q.data ?? [];
    const byBox = {} as Record<ApprovalBox, ApprovalDoc[]>;
    const counts = {} as Record<ApprovalBox, number>;
    for (const box of APPROVAL_BOXES) {
      const list = userId ? rows.filter((d) => matchesBox(d, userId, box, userDeptNameOrId)).sort(byRecent) : [];
      byBox[box] = list;
      counts[box] = list.length;
    }
    return { byBox, counts, isLoading: q.isLoading };
  }, [q.data, q.isLoading, userId, userDeptNameOrId]);
}

/** 단일 문서 상세(전체 캐시에서 도출 — 목록과 동일 원천으로 낙관적 갱신 즉시 반영). */
export function useApprovalDoc(id: string | null | undefined): ApprovalDoc | null {
  const q = useAllApprovals();
  return useMemo(() => (id ? q.data?.find((d) => d.id === id) ?? null : null), [q.data, id]);
}

/** 임시저장 신규 작성. */
export function useCreateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ApprovalDraftInput) => approvalDocRepo.createDraft(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** 임시저장 편집. */
export function useSaveDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ApprovalDraftInput> }) =>
      approvalDocRepo.saveDraft(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** 상신/재상신. */
export function useSubmitApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => approvalDocRepo.submit(id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** 결재 결정(승인·반려·보류) 통합. */
export function useDecideStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      seq,
      userId,
      decision,
      comment = '',
    }: {
      id: string;
      seq: number;
      userId: string;
      decision: '승인' | '반려' | '보류';
      comment?: string;
    }) => {
      if (decision === '승인') return approvalDocRepo.approve(id, seq, userId, comment);
      if (decision === '반려') return approvalDocRepo.reject(id, seq, userId, comment);
      return approvalDocRepo.hold(id, seq, userId, comment);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** 회수. */
export function useRecallApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => approvalDocRepo.recall(id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** 대결(위임 승인). */
export function useDelegateStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, seq, delegateUserId, comment = '' }: { id: string; seq: number; delegateUserId: string; comment?: string }) =>
      approvalDocRepo.delegate(id, seq, delegateUserId, comment),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** 휴지통으로 보내기 (임시저장만 가능). */
export function useDeleteToTrash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approvalDocRepo.deleteToTrash(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** 휴지통에서 복구. */
export function useRestoreFromTrash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approvalDocRepo.restoreFromTrash(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** 영구 삭제. */
export function usePermanentlyDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approvalDocRepo.permanentlyDelete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** 시행 담당자 강제 지정/변경 (부서장용) */
export function useAssignExecutor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, executorId, assignerId }: { docId: string; executorId: string; assignerId: string }) =>
      approvalDocRepo.assignExecutor(docId, executorId, assignerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** 시행 담당자 자가 지정 (내가 담당하기) */
export function useSelfAssignExecutor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, userId }: { docId: string; userId: string }) =>
      approvalDocRepo.selfAssignExecutor(docId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** 시행 완료 처리 */
export function useCompleteExecution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, userId, completedAt, comment }: { docId: string; userId: string; completedAt: string; comment?: string }) =>
      approvalDocRepo.completeExecution(docId, userId, completedAt, comment),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
