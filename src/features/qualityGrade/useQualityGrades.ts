import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qualityGradeRepo, type QualityGradeFilter } from '@/data/qualityGrade/qualityGrade.repo';
import type { QualityGrade } from '@/domain/qualityGrade/schema';

/**
 * 품질등급 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'qualityGrades';

/** 품질등급 목록(필터 포함) 조회. */
export function useQualityGrades(filter?: QualityGradeFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => qualityGradeRepo.list(filter),
  });
}

/** 품질등급 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveQualityGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: QualityGrade) => qualityGradeRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** 품질등급 삭제. */
export function useRemoveQualityGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => qualityGradeRepo.remove(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
