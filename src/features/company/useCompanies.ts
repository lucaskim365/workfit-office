import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { companyRepo } from '@/data/company/company.repo';
import { BANK_GROUP_CODE } from '@/domain/company/banks';
import { useMemo } from 'react';
import { useCodeOptions, useCommonCodeGroups } from '@/features/commonCode/useCommonCodes';

/** 기업 정보(사업관리) 데이터 훅. */
const COMPANIES = 'companies';
const ACCOUNTS = 'companyBankAccounts';

export function useCompanies() {
  return useQuery({ queryKey: [COMPANIES], queryFn: () => companyRepo.list() });
}

export function useCompanyAccounts() {
  return useQuery({ queryKey: [ACCOUNTS], queryFn: () => companyRepo.listAccounts() });
}

export function useSaveCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof companyRepo.saveCompanyWithAccounts>[0]) => companyRepo.saveCompanyWithAccounts(input),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [COMPANIES] });
      void qc.invalidateQueries({ queryKey: [ACCOUNTS] });
    },
  });
}

/** 은행 고르기 원천 — 공통코드 BANK 그룹(사용 중만, 순서대로). */
export function useBankOptions() {
  return useCodeOptions(BANK_GROUP_CODE);
}

/** 은행 코드 → 이름(사용 안 함 은행 포함 — 예전에 고른 계좌의 은행 이름을 보여 주려고). */
export function useBankNames(): Map<string, string> {
  const { data: groups = [] } = useCommonCodeGroups();
  return useMemo(() => new Map((groups.find((g) => g.code === BANK_GROUP_CODE)?.codes ?? []).map((c) => [c.code, c.name])), [groups]);
}
