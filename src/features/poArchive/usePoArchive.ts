import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { poReplyRepo, poTaxInvoiceRepo, type PoFileRepo } from '@/data/poArchive/poReply.repo';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';
import { canViewPurchaseOrder, isArchivedPurchaseOrder, isPurchaseOrderForm, type PoReply, type PoViewer } from '@/domain/poArchive/schema';
import { useAllApprovals } from '@/features/gw/useApprovals';
import { useApprovalForms } from '@/features/gw/useApprovalForms';
import { useOrgTree } from '@/features/gw/useOrgTree';

/**
 * 발주서 보관함 문서 — 결재 완료된 발주서 중 내가 볼 수 있는 것.
 * 결재 문서 구독(useAllApprovals)에서 바로 골라내므로 완료되는 순간 보관함에 나타난다.
 */
export function usePurchaseOrderArchive(viewer: Omit<PoViewer, 'deptId'> | null) {
  const { data: allDocs = [], isLoading } = useAllApprovals();
  const { data: forms = [] } = useApprovalForms();
  const org = useOrgTree();

  const docs = useMemo((): ApprovalDoc[] => {
    if (!viewer) return [];
    const poCodes = new Set(forms.filter(isPurchaseOrderForm).map((f) => f.code));
    const deptIdOf = (deptName: string) => org.depts.find((d) => d.name === deptName)?.id ?? '';
    const v: PoViewer = { ...viewer, deptId: deptIdOf(viewer.deptName) };
    const drafterDeptIdOf = (drafterId: string) => deptIdOf(org.userById(drafterId)?.dept ?? '');
    return allDocs.filter((d) => isArchivedPurchaseOrder(d, poCodes) && canViewPurchaseOrder(d, v, drafterDeptIdOf));
  }, [allDocs, forms, org, viewer]);

  return { docs, isLoading };
}

/**
 * 보관함 첨부(회신 문서·매입 세금계산서) 조회·올리기·삭제 — 둘 다 결재 문서당 파일 1건이라 같은 훅을 쓴다.
 * 올리거나 지운 즉시 해당 행에 보이게 캐시를 먼저 고치고, 서버 목록으로 다시 맞춘다.
 */
function poFileHooks(key: string, repo: PoFileRepo) {
  const useList = () => useQuery({ queryKey: [key], queryFn: () => repo.list() });

  const useUpload = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (args: { doc: Pick<ApprovalDoc, 'id' | 'docNo'>; file: File; actor: { id: string; name: string } }) =>
        repo.upload(args.doc, args.file, args.actor),
      onSuccess: (row) => {
        qc.setQueryData<PoReply[]>([key], (prev = []) => [...prev.filter((r) => r.docId !== row.docId), row]);
        return qc.invalidateQueries({ queryKey: [key] });
      },
    });
  };

  const useDelete = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (file: PoReply) => repo.remove(file),
      onSuccess: (_, file) => {
        qc.setQueryData<PoReply[]>([key], (prev = []) => prev.filter((r) => r.docId !== file.docId));
        return qc.invalidateQueries({ queryKey: [key] });
      },
    });
  };

  return { useList, useUpload, useDelete };
}

const replyHooks = poFileHooks('poArchiveReplies', poReplyRepo);
export const usePoReplies = replyHooks.useList;
export const useUploadPoReply = replyHooks.useUpload;
export const useDeletePoReply = replyHooks.useDelete;

const taxInvoiceHooks = poFileHooks('poTaxInvoices', poTaxInvoiceRepo);
export const usePoTaxInvoices = taxInvoiceHooks.useList;
export const useUploadPoTaxInvoice = taxInvoiceHooks.useUpload;
export const useDeletePoTaxInvoice = taxInvoiceHooks.useDelete;
