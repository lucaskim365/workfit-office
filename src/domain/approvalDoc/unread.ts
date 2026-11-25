import type { ApprovalBox, ApprovalDoc } from './schema';
import type { ApprovalPostReadShare } from '@/domain/approvalPostRead/schema';

/**
 * 전자결재 안읽음 규칙 — 웹·PWA 공용.
 *
 * - 안읽음 = 대기·참조·수신·반려·후열함에 있으면서 **내가 한 번도 열지 않은** 문서.
 * - 한 번 열면 끝 — 문서가 다시 움직여도 안읽음으로 돌아가지 않는다(결정: 2026-10-02).
 * - 읽음 기록의 원천은 DB(`approvalReads`). 예전 후열 기록(공유 readAt, 결재선 postReadAt)도 읽음으로 인정한다.
 */

export const UNREAD_TRACKED_BOXES = ['대기', '참조', '수신', '반려', '후열'] as const satisfies readonly ApprovalBox[];
export type UnreadTrackedBox = (typeof UNREAD_TRACKED_BOXES)[number];

/** 처음 적용할 때 기존 문서를 읽음으로 간주하는 결재함 — 반려함도 기존 문서는 빨간 동그라미 없이 시작한다(2026-11-25) */
const BASELINE_BOXES = ['대기', '참조', '수신', '반려'] as const satisfies readonly ApprovalBox[];

export function isDocRead(
  doc: ApprovalDoc,
  userId: string,
  readDocIds: ReadonlySet<string>,
  postReadShares: readonly ApprovalPostReadShare[],
): boolean {
  if (readDocIds.has(doc.id)) return true;
  if (postReadShares.some((s) => s.docId === doc.id && s.toUserId === userId && s.readAt)) return true;
  return doc.steps.some((s) => s.delegatedFromId === userId && Boolean(s.postReadAt));
}

export function unreadByBox(
  byBox: Record<ApprovalBox, ApprovalDoc[]>,
  userId: string,
  readDocIds: ReadonlySet<string>,
  postReadShares: readonly ApprovalPostReadShare[],
): Record<UnreadTrackedBox, { ids: Set<string>; count: number }> {
  const out = {} as Record<UnreadTrackedBox, { ids: Set<string>; count: number }>;
  for (const box of UNREAD_TRACKED_BOXES) {
    const ids = new Set(
      (byBox[box] ?? []).filter((d) => !isDocRead(d, userId, readDocIds, postReadShares)).map((d) => d.id),
    );
    out[box] = { ids, count: ids.size };
  }
  return out;
}

/**
 * 처음 적용할 때 읽음으로 남길 문서 — 대기·참조·수신·반려함의 기존 문서(이미 알고 있다고 본다).
 * 이게 없으면 배포 직후 모든 기존 문서가 안읽음으로 뜬다.
 */
export function baselineReadDocIds(byBox: Record<ApprovalBox, ApprovalDoc[]>): string[] {
  const ids = new Set<string>();
  for (const box of BASELINE_BOXES) for (const d of byBox[box] ?? []) ids.add(d.id);
  return [...ids];
}

/**
 * 반려함 기준선으로 읽음 처리할 문서 — 기준선을 이미 남긴 사람이 반려함을 처음 조회할 때의 반려함 기존 문서.
 * 예전에는 반려함은 브라우저 열람 기록만 옮겨서, 열어본 적 없는 예전 반려 문서가 전부 빨간 동그라미로 떴다.
 */
export function rejectBaselineDocIds(byBox: Record<ApprovalBox, ApprovalDoc[]>): string[] {
  return [...new Set((byBox['반려'] ?? []).map((d) => d.id))];
}
