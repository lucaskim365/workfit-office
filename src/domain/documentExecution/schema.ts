import { z } from 'zod';

export const executionStatusSchema = z.enum([
  'WAITING',
  'UNASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'RETURNED',
  'CANCELLED'
]);

export type ExecutionStatus = z.infer<typeof executionStatusSchema>;

export const documentExecutionSchema = z.object({
  id: z.string(),                      // 고유 ID (UUID)
  documentId: z.string(),              // 원본 결재문서 ID
  docNo: z.string(),                   // 원본 문서 번호 (목록 조회 최적화용)
  docTitle: z.string(),                // 원본 문서 제목 (목록 조회 최적화용)
  docType: z.string(),                 // 문서 서식 코드
  drafterId: z.string(),               // 기안자 ID
  drafterName: z.string(),             // 기안자 이름
  
  targetDeptId: z.string(),            // 대상 부서 ID
  targetDeptNameSnapshot: z.string(),  // 대상 부서 이름
  
  assigneeId: z.string().nullable().default(null),
  assigneeNameSnapshot: z.string().nullable().default(null),
  
  status: executionStatusSchema.default('UNASSIGNED'),
  visibility: z.enum(['부서', '비공개', '전사']).default('부서'),
  
  dispatchedAt: z.string().nullable().default(null), // 최종 결재 승인 발송 시점 (ISO String)
  receivedAt: z.string().nullable().default(null),   // 부서 접수 일시
  assignedAt: z.string().nullable().default(null),   // 담당자 지정 일시
  completedAt: z.string().nullable().default(null),  // 완료/반송 일시
  updatedAt: z.string(),
  
  comment: z.string().nullable().default(null),       // 완료/반송 시 의견
  returnReasonType: z.enum(['SUPPLEMENT', 'APPROVAL_CHANGE']).nullable().default(null), // 반송 구분
});

export type DocumentExecution = z.infer<typeof documentExecutionSchema>;
