import type { ApprovalDoc } from '@/domain/approvalDoc/schema';
import { extractApprovedSchedules } from '@/domain/approvalDoc/scheduleEngine';
import { scheduleChip } from '@/domain/commute/statusDisplay';
import { outsideTitleOf, type OutsideWork } from '@/domain/outsideWork/schema';
import { fromApprovalSchedule, fromOutsideWork, type OutsideScheduleView } from '@/domain/outsideWork/view';
import type { CalendarEvent, CalendarEventType } from './schema';

interface ScheduleUser {
  name: string;
  position?: string | null;
}

export interface ScheduleEventsResult {
  /** 결재 승인(휴가·외근·출장)과 직접 등록한 외근·출장을 날짜별 일정으로 펼친 것 */
  scheduleEvents: CalendarEvent[];
  /** 외근·출장 일정 id → 상세. 이 일정을 누르면 일정 창 대신 외근·출장 상세를 연다. */
  outsideViewByEventId: Map<string, OutsideScheduleView>;
}

/** 결재 승인 일정 id 접두어. 이 일정은 결재 문서에서만 취소·변경할 수 있다. */
export const APPROVAL_EVENT_PREFIX = 'CAL-APPR-';

function eachDate(startDate: string, endDate: string, visit: (date: string) => void) {
  const curr = new Date(startDate + 'T00:00:00');
  const last = new Date(endDate + 'T00:00:00');
  if (Number.isNaN(curr.getTime()) || Number.isNaN(last.getTime())) return;
  while (curr <= last) {
    visit(`${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`);
    curr.setDate(curr.getDate() + 1);
  }
}

/**
 * 캘린더에 함께 그릴 휴가·외근·출장 일정을 만든다 (웹·PWA 공통).
 * 퇴사자 일정은 뺀다. 휴가는 사유를 비공개로 두고 종류(연차·반차 등)만 보인다.
 */
export function buildScheduleEvents(
  approvalDocs: ApprovalDoc[],
  outsideWorks: OutsideWork[],
  userMap: Map<string, ScheduleUser>,
  activeUserIds: Set<string>,
): ScheduleEventsResult {
  const scheduleEvents: CalendarEvent[] = [];
  const outsideViewByEventId = new Map<string, OutsideScheduleView>();
  const nameWithPos = (userId: string, fallbackName = '') => {
    const user = userMap.get(userId);
    const name = fallbackName || user?.name || '';
    return user?.position ? `${name} ${user.position}` : name;
  };

  for (const s of extractApprovedSchedules(approvalDocs)) {
    if (s.drafterId && !activeUserIds.has(s.drafterId)) continue;

    const isLeave = s.category === 'LEAVE';
    const eventType: CalendarEventType = isLeave ? 'VACATION' : 'OUTSIDE';
    const who = nameWithPos(s.drafterId, s.drafterName);
    // 외근·출장은 업무계획과 같이 제목(목적 첫 줄)만 — 행선지는 상세에서
    const subject = outsideTitleOf(s.purpose);
    const title = isLeave
      ? `[휴가] ${who} (${scheduleChip(s).label})`
      : `${s.category === 'TRIP' ? '[출장]' : '[외근]'} ${who}${subject ? ` · ${subject}` : ''}`;
    const isAllDay = !s.startTime || !s.endTime || s.startTime >= s.endTime;
    const outsideView = fromApprovalSchedule(s);

    eachDate(s.startDate, s.endDate, (date) => {
      const id = `${APPROVAL_EVENT_PREFIX}${s.docId}-${date}`;
      if (outsideView) outsideViewByEventId.set(id, outsideView);
      scheduleEvents.push({
        id,
        ownerUserId: s.drafterId,
        title,
        date,
        allDay: isAllDay,
        startTime: isAllDay ? null : s.startTime!,
        endTime: isAllDay ? null : s.endTime!,
        memo: isLeave ? '' : (s.body ? `업무: ${s.body}` : ''),
        visibility: 'COMPANY',
        eventType,
        attendeeUserIds: [],
        deptId: null,
        projectId: null,
        reminded: true,
        location: null,
        reservationId: null,
        createdAt: s.startDate,
        updatedAt: s.startDate,
      });
    });
  }

  for (const w of outsideWorks) {
    if (!activeUserIds.has(w.ownerUserId)) continue;
    const view = fromOutsideWork(w, (id) => userMap.get(id)?.name);
    const tag = w.category === 'TRIP' ? '[출장]' : '[외근]';
    const subject = outsideTitleOf(w.purpose);
    const title = `${tag} ${nameWithPos(w.ownerUserId)}${subject ? ` · ${subject}` : ''}`;
    eachDate(w.startDate, w.endDate, (date) => {
      const id = `CAL-SELF-${w.id}-${date}`;
      outsideViewByEventId.set(id, view);
      scheduleEvents.push({
        id,
        ownerUserId: w.ownerUserId,
        title,
        date,
        allDay: w.allDay,
        startTime: w.allDay ? null : w.startTime,
        endTime: w.allDay ? null : w.endTime,
        // 목적은 제목에 들어가므로 메모는 등록한 메모
        memo: w.memo,
        visibility: 'COMPANY',
        eventType: 'OUTSIDE',
        attendeeUserIds: [],
        deptId: null,
        projectId: null,
        reminded: true,
        location: null,
        reservationId: null,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      });
    });
  }

  return { scheduleEvents, outsideViewByEventId };
}
