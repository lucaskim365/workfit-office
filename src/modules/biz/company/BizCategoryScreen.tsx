import { useAuth } from '@/app/auth/AuthProvider';
import { usePermission } from '@/features/auth/usePermission';
import { newBizCategoryId, type BizCategory } from '@/domain/company/masters';
import { useBizCategories, useSaveBizCategory } from '@/features/company/useCompanies';
import { BizHead } from '../_biz';
import { MasterListView } from './MasterListView';

/** 사업관리 › 사업구분 — 정부사업 종류(부처협업형·제조AI…). 업무 기준정보. */
export default function BizCategoryScreen() {
  const { canAction } = usePermission();
  const { user } = useAuth();
  const { data = [], isLoading } = useBizCategories();
  const save = useSaveBizCategory();
  return (
    <MasterListView<BizCategory>
      head={<BizHead group="사업 관리" title="사업구분" desc="정부사업의 종류(부처협업형, 제조AI 등)를 관리합니다." />}
      label="사업구분"
      rows={data}
      isLoading={isLoading}
      canEdit={canAction('S_BIZ_CATEGORY', 'update')}
      newRow={(order) => ({ id: newBizCategoryId(), name: '', order, use: true, note: '', createdBy: '', createdAt: '', updatedBy: '', updatedAt: '' })}
      onSave={({ item, isNew }) => save.mutateAsync({ item, isNew, actorId: user?.id ?? '' })}
    />
  );
}
