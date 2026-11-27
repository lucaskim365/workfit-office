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

/** 처음 적용할 때 기존 문서를 읽음으로 간주하는 결재함(반려는 브라우저에 남은 열람 기록만 옮긴다) */
const BASELINE_BOXES = ['대기', '참조', '수신'] as const satisfies readonly ApprovalBox[];

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
 * 처음 적용할 때 읽음으로 남길 문서 — 대기·참조·수신함의 기존 문서(이미 알고 있다고 본다)와
 * 브라우저에 남아 있던 반려 문서 열람 기록. 이게 없으면 배포 직후 모든 기존 문서가 안읽음으로 뜬다.
 */
export function baselineReadDocIds(
  byBox: Record<ApprovalBox, ApprovalDoc[]>,
  legacyReadRejectedIds: ReadonlySet<string>,
): string[] {
  const ids = new Set<string>();
  for (const box of BASELINE_BOXES) for (const d of byBox[box] ?? []) ids.add(d.id);
  for (const d of byBox['반려'] ?? []) if (legacyReadRejectedIds.has(d.id)) ids.add(d.id);
  return [...ids];
}

/** 반려된 문서인지(반려·긴급 조치 사후 검토 반려·시행반송) */
export function isRejectedDoc(doc: ApprovalDoc): boolean {
  return doc.status === '반려' || doc.status === '긴급 조치 사후 검토 반려' || doc.status === '시행반송';
}

/**
 * 상신함 반려 알림을 켜기 시작한 시각 — 이보다 먼저 반려된 문서는 알림(빨간 숫자)을 띄우지 않는다.
 * 앞으로 새로 반려되는 문서부터 적용(사용자 결정 2026-11-26).
 */
export const REJECTION_ALERT_SINCE = '2026-11-26T01:45:00.000Z'; // 2026-11-26 10:45 KST

/** 가장 최근 반려 시각(ms) — 반려 단계에 처리 시각이 없으면 null */
function lastRejectedAt(doc: ApprovalDoc): number | null {
  const times = doc.steps
    .filter((s) => s.decision === '반려' && s.decidedAt)
    .map((s) => Date.parse(s.decidedAt as string))
    .filter((t) => Number.isFinite(t));
  return times.length ? Math.max(...times) : null;
}

/**
 * 상신함 반려 알림의 읽음 기록 키 — 반려될 때마다 새 키(반려 시각 포함)라서
 * 반려 전에 열어 본 기록이나 지난번 반려를 읽은 기록으로는 꺼지지 않는다. 반려 문서가 아니면 null.
 */
export function rejectionReadKey(doc: ApprovalDoc): string | null {
  if (!isRejectedDoc(doc)) return null;
  const at = lastRejectedAt(doc);
  return `rj:${doc.id}:${at === null ? '0' : at.toString(36)}`;
}

/**
 * 상신함 반려 문서를 반려된 뒤로 아직 열어 보지 않았는지.
 * 알림 시작 시각(`REJECTION_ALERT_SINCE`) 전에 반려된 문서와 반려 시각을 모르는 문서는 알림 대상이 아니다.
 */
export function isRejectionUnread(
  doc: ApprovalDoc,
  readDocIds: ReadonlySet<string>,
  since: string = REJECTION_ALERT_SINCE,
): boolean {
  const key = rejectionReadKey(doc);
  const at = lastRejectedAt(doc);
  if (key === null || at === null || at < Date.parse(since)) return false;
  return !readDocIds.has(key);
}
