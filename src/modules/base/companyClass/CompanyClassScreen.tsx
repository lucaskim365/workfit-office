import { useAuth } from '@/app/auth/AuthProvider';
import { usePermission } from '@/features/auth/usePermission';
import { newCompanyClassId, type CompanyClass } from '@/domain/company/masters';
import { useCompanyClasses, useSaveCompanyClass } from '@/features/company/useCompanies';
import { MasterListView } from '@/modules/biz/company/MasterListView';

/** 관리자 콘솔 › 회사·운영 › 기업분류 — 프로젝트에서 기업이 맡는 자리(도입기업·매입기업…). 시스템 기준정보. */
export default function CompanyClassScreen() {
  const { canAction } = usePermission();
  const { user } = useAuth();
  const { data = [], isLoading } = useCompanyClasses();
  const save = useSaveCompanyClass();
  return (
    <MasterListView<CompanyClass>
      head={
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">기업분류</h1>
          <p className="mt-0.5 text-xs text-ink3">회사·운영 / 기업분류</p>
        </div>
      }
      label="기업분류"
      rows={data}
      isLoading={isLoading}
      canEdit={canAction('S_ADM_COMPANY_CLASS', 'update')}
      withSingle
      newRow={(order) => ({ id: newCompanyClassId(), name: '', singlePerProject: false, order, use: true, note: '', createdBy: '', createdAt: '', updatedBy: '', updatedAt: '' })}
      onSave={({ item, isNew }) => save.mutateAsync({ item, isNew, actorId: user?.id ?? '' })}
    />
  );
}
