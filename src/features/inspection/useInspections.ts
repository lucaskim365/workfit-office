import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inspectionRepo, type InspectionFilter } from '@/data/inspection/inspection.repo';
import type { Inspection, InspectionLine } from '@/domain/inspection/schema';

/**
 * 검사 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 상태 전이·판정은 mutation으로, 성공 시 목록 캐시 무효화.
 * ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'inspections';

/** 검사 목록(stage·status·검색 필터) 조회. */
export function useInspections(filter?: InspectionFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => inspectionRepo.list(filter),
  });
}

/** 상태 전이(검사 착수·보류·재개). */
export function useTransitionInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recv, to }: { recv: string; to: Inspection['status'] }) =>
      inspectionRepo.transition(recv, to),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** 판정 등록(측정 실적 + 최종 판정 → 판정완료). */
export function useJudgeInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      recv,
      judgement,
      items,
    }: {
      recv: string;
      judgement: NonNullable<Inspection['judgement']>;
      items: InspectionLine[];
    }) => inspectionRepo.judge(recv, judgement, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
