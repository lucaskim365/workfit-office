/*
  휴일근로 신청서 같은 날 중복 막기 — 한 사람이 같은 근무 일자로 낸 휴일근로 문서가 이미 결재 중이거나 끝났으면 또 낼 수 없다.
  반려·회수·취소·임시저장·삭제된 문서는 세지 않는다(다시 낼 수 있어야 하므로).
*/

/** 휴일근로 신청서 서식 코드 — 예전 문서는 '연장근로' */
export const HOLIDAY_WORK_DOC_TYPES: readonly string[] = ['휴일근무', '연장근로'];

/** 같은 날 또 낼 수 없게 막는 상태 — 결재 중이거나 끝난 문서 */
const ACTIVE_STATUSES: readonly string[] = ['진행중', '완료', '시행대기'];

interface DocLike {
  id: string;
  docNo?: string;
  docType: string;
  drafterId: string;
  status: string;
  fieldValues?: Record<string, unknown> | null;
}

export function holidayWorkDateOf(doc: Pick<DocLike, 'docType' | 'fieldValues'>): string | null {
  if (!HOLIDAY_WORK_DOC_TYPES.includes(doc.docType)) return null;
  const date = String(doc.fieldValues?.workDate ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

/** 이 문서를 상신하면 같은 날 중복이 되는 기존 문서 — 없으면 null */
export function findHolidayWorkDuplicate<T extends DocLike>(doc: DocLike, docs: readonly T[]): T | null {
  const date = holidayWorkDateOf(doc);
  if (!date) return null;
  return (
    docs.find(
      (d) =>
        d.id !== doc.id &&
        d.drafterId === doc.drafterId &&
        ACTIVE_STATUSES.includes(d.status) &&
        holidayWorkDateOf(d) === date
    ) ?? null
  );
}

export function holidayWorkDuplicateMessage(date: string, dup: Pick<DocLike, 'docNo' | 'status'>): string {
  return `${date} 휴일근로 신청서를 이미 냈습니다${dup.docNo ? `(${dup.docNo}, ${dup.status})` : ''}. 같은 날은 한 번만 신청할 수 있습니다.`;
}
