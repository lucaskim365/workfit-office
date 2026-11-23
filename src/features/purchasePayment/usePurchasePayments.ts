import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/auth/AuthProvider';
import { purchasePaymentRepo } from '@/data/purchasePayment/purchasePayment.repo';
import { PURCHASE_LEDGER_SYNC_ENABLED, paymentsFromDoc } from '@/domain/purchasePayment/fromDoc';
import { toLedgerRows, vendorKey, type PurchasePayment, type VendorAccount } from '@/domain/purchasePayment/ledger';
import type { PurchasePaymentPatch, PurchasePaymentRecord } from '@/domain/purchasePayment/schema';
import { useAllApprovals } from '@/features/gw/useApprovals';
import { useBankNames, useCompanies, useCompanyAccounts } from '@/features/company/useCompanies';

const KEY = 'purchasePayments';

/** 저장된 매입 결제 줄 전체 */
export function usePurchasePaymentRecords() {
  return useQuery({ queryKey: [KEY], queryFn: () => purchasePaymentRepo.list() });
}

/** 매입 결제 대장의 화면 줄 — 저장된 줄에 대장 번호와 지출결의서 진행을 붙인다(취소·삭제된 발주는 뺀다) */
export function usePurchaseLedger(): { rows: PurchasePayment[]; isLoading: boolean; error: unknown } {
  const records = usePurchasePaymentRecords();
  const docs = useAllApprovals();
  const rows = useMemo(() => {
    const statusOf = new Map(docs.data.map((d) => [d.id, d.status]));
    return toLedgerRows(records.data ?? [], (id) => statusOf.get(id));
  }, [records.data, docs.data]);
  return { rows, isLoading: records.isLoading || docs.isLoading, error: records.error };
}

/**
 * 결재가 끝난 발주서를 대장에 올린다 — 대장을 **열 때**(enabled 인 사람이 열 때) 대장에 없는 줄을 찾아 넣는다.
 * 결재 완료 순간에 넣지 않는 까닭은 발주 현황과 같다 — 완료 경로(PC·휴대폰·일괄 결재)마다 걸어야 하고 하나라도 빠지면 대장에서 빠진다.
 *
 * 있는지는 **줄 id** 로 본다(문서 id 가 아니라) — 줄 일부만 들어가고 끊긴 발주서의 나머지 줄을 다음에 채운다.
 * 못 올린 줄은 failed 로 알리고, 이 화면에서는 retry() 를 부를 때까지 다시 넣지 않는다(실패가 되풀이되지 않게).
 */
export function usePurchaseOrderSync(enabled: boolean): { failed: number; retry: () => void } {
  const qc = useQueryClient();
  const { data: records } = usePurchasePaymentRecords();
  const docs = useAllApprovals();
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(new Set());
  /** 올리는 중 — 겹쳐 돌지 않게 */
  const busy = useRef(false);

  useEffect(() => {
    // 발주서 → 대장 올리기는 지금 꺼 두었다(PURCHASE_LEDGER_SYNC_ENABLED) — 대장을 열어도 줄을 만들지 않는다
    if (!PURCHASE_LEDGER_SYNC_ENABLED || !enabled || !records || docs.isLoading || busy.current) return;
    const have = new Set(records.map((r) => r.id));
    const now = new Date().toISOString();
    const missing = docs.data.flatMap((doc) => paymentsFromDoc(doc, now)).filter((line) => !have.has(line.id) && !failedIds.has(line.id));
    if (!missing.length) return;
    busy.current = true;
    purchasePaymentRepo
      .addMissing(missing)
      .then(({ added, failed }) => {
        if (failed.length) setFailedIds((prev) => new Set([...prev, ...failed]));
        if (added > 0) void qc.invalidateQueries({ queryKey: [KEY] });
      })
      .finally(() => {
        busy.current = false;
      });
  }, [enabled, records, docs.data, docs.isLoading, failedIds, qc]);

  const retry = useCallback(() => setFailedIds(new Set()), []);
  return { failed: failedIds.size, retry };
}

/** 대장 칸 고치기 — 바로 화면에 반영하고, 저장에 실패하면 그 줄만 고치기 전 값으로 되돌린다 */
export function usePatchPurchasePayment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: PurchasePaymentPatch }) => purchasePaymentRepo.patch(id, change, user?.id ?? ''),
    onMutate: async ({ id, change }) => {
      await qc.cancelQueries({ queryKey: [KEY] });
      const before = qc.getQueryData<PurchasePaymentRecord[]>([KEY])?.find((r) => r.id === id);
      qc.setQueryData<PurchasePaymentRecord[]>([KEY], (list) => list?.map((r) => (r.id === id ? { ...r, ...change } : r)));
      return { before };
    },
    // 그 줄만 되돌린다 — 목록 전체를 되돌리면 그 사이 고친 다른 줄의 화면 값까지 옛 값으로 돌아간다
    onError: (_e, { id }, ctx) => {
      const before = ctx?.before;
      if (before) qc.setQueryData<PurchasePaymentRecord[]>([KEY], (list) => list?.map((r) => (r.id === id ? before : r)));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/**
 * 발주처 이름 → 계좌·사업자 정보. 사업관리 › 기업 정보에 같은 이름으로 등록된 기업의 기본 계좌(없으면 첫 계좌).
 * 발주서의 발주처는 아직 글자라 이름으로 맞춘다(vendorKey). 같은 이름이 둘이면 사용 중인 기업을 먼저 쓴다
 */
export function useVendorAccounts(): Record<string, VendorAccount> {
  const { data: companies = [] } = useCompanies();
  const { data: accounts = [] } = useCompanyAccounts();
  const bankNames = useBankNames();
  return useMemo(() => {
    const out: Record<string, VendorAccount> = {};
    // 사용 안 함 기업을 먼저 넣고 사용 중인 기업으로 덮는다
    for (const c of [...companies].sort((a, b) => Number(a.use) - Number(b.use))) {
      const mine = accounts.filter((a) => a.companyId === c.id && a.use);
      const acc = mine.find((a) => a.isDefault) ?? mine[0];
      out[vendorKey(c.name)] = {
        bank: acc ? (bankNames.get(acc.bankCode) ?? acc.bankCode) : '',
        account: acc?.accountNo ?? '',
        holder: acc?.holder ?? '',
        ceo: c.ceoName,
        bizNo: c.bizNo,
      };
    }
    return out;
  }, [companies, accounts, bankNames]);
}
