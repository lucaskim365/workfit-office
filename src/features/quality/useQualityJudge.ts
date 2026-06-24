import { useMutation, useQueryClient } from '@tanstack/react-query';
import { qualityService } from '@/services/quality.service';
import type { Inspection, InspectionLine } from '@/domain/inspection/schema';

/**
 * 수입검사 판정(cross-entity) 훅 — qualityService 호출 후 관련 캐시 전부 무효화.
 * 검사(inspections) + 재고(stock) + 부적합(nonconformances) 화면이 함께 갱신된다.
 * ([[비즈니스_로직_개발_전략.md]] 계층 구조 / cross-entity 서비스 패턴)
 */
export function useJudgeIncoming() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      recv: string;
      judgement: NonNullable<Inspection['judgement']>;
      items: InspectionLine[];
      at: string;
    }) => qualityService.judgeIncomingInspection(args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inspections'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      qc.invalidateQueries({ queryKey: ['nonconformances'] });
    },
  });
}
