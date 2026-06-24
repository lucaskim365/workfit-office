import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backupPolicyRepo, type BackupPolicyFilter } from '@/data/backupPolicy/backupPolicy.repo';
import type { BackupPolicy } from '@/domain/backupPolicy/schema';

/**
 * 백업 정책 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'backupPolicies';

/** 백업 정책 목록(필터 포함) 조회. */
export function useBackupPolicies(filter?: BackupPolicyFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => backupPolicyRepo.list(filter),
  });
}

/** 백업 정책 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveBackupPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: BackupPolicy) => backupPolicyRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
