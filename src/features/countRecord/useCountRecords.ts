import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { countRecordRepo, type CountRecordFilter } from '@/data/countRecord/countRecord.repo';
import type { CountRecord } from '@/domain/countRecord/schema';

/**
 * 재고 실사 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'countRecords';

/** 재고 실사 목록(필터 포함) 조회. */
export function useCountRecords(filter?: CountRecordFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => countRecordRepo.list(filter),
  });
}

/** 재고 실사 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveCountRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: CountRecord) => countRecordRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
