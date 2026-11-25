import { z } from 'zod';

/**
 * 전자결재 문서 읽음 기록 — "누가 어떤 문서를 언제 처음 열었는지" 한 행.
 * 안읽음 표시(domain/approvalDoc/unread)의 원천. 한 번 기록되면 바뀌지 않는다.
 * docId 가 `BASELINE_DOC_ID`·`REJECT_BASELINE_DOC_ID` 인 행은 '기준선을 남겼음' 표시다(문서 아님).
 */
export const approvalReadSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  docId: z.string().min(1),
  readAt: z.string().min(1),
});
export type ApprovalRead = z.infer<typeof approvalReadSchema>;

export const BASELINE_DOC_ID = '__baseline__';

/** 반려함 기준선을 남겼음 표시 — 반려함 기존 문서를 처음 조회할 때 한 번 읽음으로 남긴다(2026-11-25) */
export const REJECT_BASELINE_DOC_ID = '__baseline_reject__';

const MARKER_DOC_IDS: ReadonlySet<string> = new Set([BASELINE_DOC_ID, REJECT_BASELINE_DOC_ID]);
/** 기준선 표시 행인지(문서 아님) */
export const isMarkerDocId = (docId: string) => MARKER_DOC_IDS.has(docId);

export const approvalReadId = (userId: string, docId: string) => `${userId}__${docId}`;
