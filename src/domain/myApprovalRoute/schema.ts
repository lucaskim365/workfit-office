import { z } from 'zod';
import { STEP_KINDS, type ApprovalStep } from '@/domain/approvalDoc/schema';

/**
 * 사용자별 개인 맞춤 '내 결재선(자주 쓰는 결재선)' 도메인 스키마.
 * 각 사용자(userId)마다 완전히 격리되어 보관되며,
 * 기안 작성 시 반복해서 구성하는 결재자 목록을 1클릭으로 즉시 불러옵니다.
 */

export const myApprovalRouteStepSchema = z.object({
  seq: z.number().int().positive(),
  approverId: z.string().min(1),
  kind: z.enum(STEP_KINDS).default('결재'),
  parallelGroup: z.string().nullable().optional(),
  executionType: z.enum(['sequential', 'parallel']).default('sequential'),
});

export type MyApprovalRouteStep = z.infer<typeof myApprovalRouteStepSchema>;

export const myApprovalRouteSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1), // 사용자별 격리 키 (다른 사용자와 엄격히 분리)
  name: z.string().min(1, '결재선 이름을 입력하세요'), // 예: "주간보고 결재선", "출장비 품의선"
  description: z.string().optional().default(''),
  steps: z.array(myApprovalRouteStepSchema).min(1, '최소 1명 이상의 결재자가 필요합니다'),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type MyApprovalRoute = z.infer<typeof myApprovalRouteSchema>;

/**
 * 실제 ApprovalStep[] 형태를 MyApprovalRouteStep[] 으로 변환
 */
export function toMyRouteSteps(steps: ApprovalStep[]): MyApprovalRouteStep[] {
  return steps.map((s, idx) => ({
    seq: idx + 1,
    approverId: s.approverId,
    kind: s.kind,
    parallelGroup: s.parallelGroup ?? null,
    executionType: s.executionType ?? (s.parallelGroup ? 'parallel' : 'sequential'),
  }));
}

/**
 * MyApprovalRouteStep[] 을 기안 화면용 ApprovalStep[] 으로 복원
 */
export function fromMyRouteSteps(steps: MyApprovalRouteStep[]): ApprovalStep[] {
  return steps.map((s, idx) => ({
    seq: idx + 1,
    approverId: s.approverId,
    kind: s.kind,
    parallelGroup: s.parallelGroup ?? null,
    executionType: s.executionType ?? (s.parallelGroup ? 'parallel' : 'sequential'),
    delegatedFromId: null,
    decision: '대기' as const,
    decidedAt: null,
    comment: '',
  }));
}
