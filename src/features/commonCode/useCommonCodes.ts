import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commonCodeRepo } from '@/data/commonCode/commonCode.repo';
import type { CommonCode } from '@/domain/commonCode/schema';

/**
 * 공통코드 데이터 훅 — 화면·enum 소비자가 호출하는 React 바인딩.
 * ([[data-layer-pattern]] 정본 패턴)
 */
const KEY = 'commonCodes';

/** 그룹 뷰(공통코드 화면용). */
export function useCommonCodeGroups() {
  return useQuery({ queryKey: [KEY, 'groups'], queryFn: () => commonCodeRepo.listGroups() });
}

/** 특정 그룹의 사용중 코드 — 다른 화면의 Select 옵션 원천(enum 대체). */
export function useCodeOptions(groupCode: string) {
  return useQuery({
    queryKey: [KEY, 'group', groupCode],
    queryFn: () => commonCodeRepo.listByGroup(groupCode),
  });
}

export function useSaveCommonCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: CommonCode) => commonCodeRepo.save(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRemoveCommonCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupCode, code }: { groupCode: string; code: string }) =>
      commonCodeRepo.remove(groupCode, code),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
