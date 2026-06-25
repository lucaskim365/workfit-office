import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { companyInfoRepo } from '@/data/companyInfo/companyInfo.repo';
import type { CompanyInfo } from '@/domain/companyInfo/schema';

/**
 * 회사 기본정보 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'companyInfo';

/** 회사 기본정보 단건 조회. */
export function useCompanyInfo() {
  return useQuery({
    queryKey: [KEY],
    queryFn: () => companyInfoRepo.get(),
  });
}

/** 회사 기본정보 수정. 성공 시 캐시 무효화. */
export function useSaveCompanyInfo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (info: CompanyInfo) => companyInfoRepo.save(info),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
