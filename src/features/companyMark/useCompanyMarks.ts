import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { companyMarkRepo } from '@/data/companyMark/companyMark.repo';
import type { CompanyMark, CompanyMarkKind } from '@/domain/companyMark/schema';

const KEY = ['companyMarks'];

/** 회사 로고·직인 목록 */
export function useCompanyMarks() {
  return useQuery({ queryKey: KEY, queryFn: () => companyMarkRepo.list(), staleTime: 5 * 60 * 1000 });
}

export function useAddCompanyMark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, name, file, order }: { kind: CompanyMarkKind; name: string; file: File; order: number }) =>
      companyMarkRepo.add(kind, name, file, order),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAddExistingCompanyMark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, name, url, path, order }: { kind: CompanyMarkKind; name: string; url: string; path: string; order: number }) =>
      companyMarkRepo.addExisting(kind, name, url, path, order),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSaveCompanyMark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mark: CompanyMark) => companyMarkRepo.save(mark),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRemoveCompanyMark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => companyMarkRepo.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
