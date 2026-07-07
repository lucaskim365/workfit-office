import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approvalFormRepo } from '@/data/approvalForm/approvalForm.repo';
import type { ApprovalForm } from '@/domain/approvalForm/schema';

/**
 * 결재서식 마스터 훅 — 기준정보 결재서식 관리 CRUD + 상신 모달/문서뷰 공유.
 * 저장 즉시 상신·인쇄에 반영(캐시키 'approvalForms').
 */
const KEY = 'approvalForms';

/** 전체 서식(비활성 포함) — 관리 화면용. */
export function useApprovalForms() {
  return useQuery({ queryKey: [KEY], queryFn: () => approvalFormRepo.list() });
}

/** 활성 서식만 — 상신 유형 선택용. */
export function useActiveApprovalForms() {
  const q = useApprovalForms();
  return { ...q, data: (q.data ?? []).filter((form) => form.active) };
}

export function useUpsertApprovalForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: ApprovalForm) => approvalFormRepo.save(form),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRemoveApprovalForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approvalFormRepo.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
