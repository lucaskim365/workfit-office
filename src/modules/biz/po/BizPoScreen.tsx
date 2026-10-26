import { useMemo } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { usePermission } from '@/features/auth/usePermission';
import { BizHead } from '../_biz';
import { PurchaseOrderArchive } from './PurchaseOrderArchive';

/** 사업관리 › 발주 현황 — 결재 완료된 발주서 목록·PDF·회신 문서(예전 문서관리 발주서 보관함) */
export default function BizPoScreen() {
  const { user } = useAuth();
  const { isAdmin, canAction } = usePermission();
  const me = useMemo(
    () => ({ id: user?.id || 'guest', name: user?.name ?? '', dept: user?.dept || '-' }),
    [user]
  );
  const isManager = isAdmin || canAction('S_BIZ_PO', 'update');

  return (
    <div className="flex flex-col gap-4">
      <BizHead group="사업 관리" title="발주 현황" desc="결재가 완료된 발주서를 모아 보고, PDF를 내려받거나 거래처 회신 문서를 올립니다." />
      <PurchaseOrderArchive me={me} isManager={isManager} />
    </div>
  );
}
