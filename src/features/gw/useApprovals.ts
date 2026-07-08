import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approvalDocRepo, type ApprovalDraftInput } from '@/data/approvalDoc/approvalDoc.repo';
import { byRecent, matchesBox } from '@/domain/approvalDoc/engine';
import { APPROVAL_BOXES, type ApprovalBox, type ApprovalDoc } from '@/domain/approvalDoc/schema';

/**
 * 전자결재 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 전체 문서를 한 번 로드해 결재함(5탭)·상세를 **클라이언트에서 도출**하고,
 * 상태 전이는 mutation 으로, 성공 시 캐시를 무효화한다.
 * ([[data-layer-pattern]] 정본 패턴 · docs/전자결재_워크플로_개발_계획서.md §6)
 */
const KEY = 'approvalDocs';

/** 전체 결재 문서 조회(결재함·상세 도출의 원천). */
export function useAllApprovals() {
  return useQuery({ queryKey: [KEY], queryFn: () => approvalDocRepo.list() });
}

export interface ApprovalBoxes {
  byBox: Record<ApprovalBox, ApprovalDoc[]>;
  counts: Record<ApprovalBox, number>;
  isLoading: boolean;
}

/** userId 관점의 결재함 5탭 도출(대기·상신·완료·참조·임시) + 카운트. */
export function useApprovalBoxes(userId: string | undefined): ApprovalBoxes {
  const q = useAllApprovals();
  return useMemo(() => {
    const rows = q.data ?? [];
    const byBox = {} as Record<ApprovalBox, ApprovalDoc[]>;
    const counts = {} as Record<ApprovalBox, number>;
    for (const box of APPROVAL_BOXES) {
      const list = userId ? rows.filter((d) => matchesBox(d, userId, box)).sort(byRecent) : [];
      byBox[box] = list;
      counts[box] = list.length;
    }
    return { byBox, counts, isLoading: q.isLoading };
  }, [q.data, q.isLoading, userId]);
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
