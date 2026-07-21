import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { jobTitleRepo } from '@/data/jobTitle/jobTitle.repo';
import type { JobTitle } from '@/domain/jobTitle/schema';

/** 직책 마스터 훅 — 기준정보 직책관리 CRUD. */
const KEY = 'jobTitles';

export function useJobTitles() {
  return useQuery({ queryKey: [KEY, null], queryFn: () => jobTitleRepo.list() });
}

export function useUpsertJobTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (j: JobTitle) => jobTitleRepo.save(j),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRemoveJobTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => jobTitleRepo.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
