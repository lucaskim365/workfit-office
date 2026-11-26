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

/** 반려된 문서인지(반려·긴급 조치 사후 검토 반려·시행반송) */
export function isRejectedDoc(doc: ApprovalDoc): boolean {
  return doc.status === '반려' || doc.status === '긴급 조치 사후 검토 반려' || doc.status === '시행반송';
}

/**
 * 상신함 반려 알림의 읽음 기록 키 — 반려될 때마다 새 키(반려 시각 포함)라서
 * 반려 전에 열어 본 기록이나 지난번 반려를 읽은 기록으로는 꺼지지 않는다. 반려 문서가 아니면 null.
 */
export function rejectionReadKey(doc: ApprovalDoc): string | null {
  if (!isRejectedDoc(doc)) return null;
  const times = doc.steps
    .filter((s) => s.decision === '반려' && s.decidedAt)
    .map((s) => Date.parse(s.decidedAt as string))
    .filter((t) => Number.isFinite(t));
  const at = times.length ? Math.max(...times).toString(36) : '0';
  return `rj:${doc.id}:${at}`;
}

/** 상신함 반려 문서를 반려된 뒤로 아직 열어 보지 않았는지 */
export function isRejectionUnread(doc: ApprovalDoc, readDocIds: ReadonlySet<string>): boolean {
  const key = rejectionReadKey(doc);
  return key !== null && !readDocIds.has(key);
}

/**
 * 반려함 기준선으로 읽음 처리할 문서 — 기준선을 이미 남긴 사람이 반려함을 처음 조회할 때의 반려함 기존 문서.
 * 예전에는 반려함은 브라우저 열람 기록만 옮겨서, 열어본 적 없는 예전 반려 문서가 전부 빨간 동그라미로 떴다.
 */
export function rejectBaselineDocIds(byBox: Record<ApprovalBox, ApprovalDoc[]>): string[] {
  return [...new Set((byBox['반려'] ?? []).map((d) => d.id))];
}
