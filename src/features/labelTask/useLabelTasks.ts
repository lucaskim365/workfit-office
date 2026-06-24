import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { labelTaskRepo, type LabelTaskFilter } from '@/data/labelTask/labelTask.repo';
import type { LabelTask } from '@/domain/labelTask/schema';

/**
 * 라벨 발행 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'labelTasks';

/** 라벨 발행 목록(필터 포함) 조회. */
export function useLabelTasks(filter?: LabelTaskFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => labelTaskRepo.list(filter),
  });
}

/** 라벨 발행 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveLabelTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: LabelTask) => labelTaskRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
