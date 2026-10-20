import { useMemo } from 'react';
import { extractApprovedSchedules } from '@/domain/approvalDoc/scheduleEngine';
import { RESOURCE_UTC_OFFSET } from '@/domain/reservation/time';
import type { User } from '@/domain/user/schema';
import { indexDayEntries, type DayCell, type DayEntryInput } from '@/domain/workPlan/dayEntries';
import type { WorkPlan } from '@/domain/workPlan/schema';
import { useCalendarEvents } from '@/features/calendar/useCalendarEvents';
import { useAllApprovals } from '@/features/gw/useApprovals';
import { useOutsideWorks } from '@/features/outsideWork/useOutsideWorks';
import { useReservations } from '@/features/resource/useReservations';
import { useWorkPlanItems, useWorkPlanTags } from '@/features/workPlan/useWorkPlanItems';
import { useAllWorkPlans } from '@/features/workPlan/useWorkPlans';

const DAY_MS = 24 * 60 * 60 * 1000;

interface DayEntryIndexOptions {
  actor: User;
  deptId?: string | null;
  /** 칸을 만들 사람 — 결재 기안자를 이름으로 잇는 데도 쓴다 */
  members: User[];
  /** 칸을 만들 날짜(오름차순). 조회 범위 = 첫 날 ~ 마지막 날 */
  dates: string[];
}

/**
 * 업무계획 칸 조립(PC 표·모바일 공용) — 일반 항목·회의/공인 일정·외근출장·결재 일정·이전 글·연결 예약을
 * 읽어 (사람, 날짜) → 칸 조회 함수를 만든다. `workPlans`는 예전 글 원본(전사 공통 일정 줄에도 쓴다).
 */
export function useDayEntryIndex({ actor, deptId, members, dates }: DayEntryIndexOptions): {
  cellOf: (userId: string, date: string) => DayCell;
  workPlans: WorkPlan[];
} {
  const from = dates[0] ?? '';
  const to = dates[dates.length - 1] ?? '';
  const range = useMemo(() => ({ from, to }), [from, to]);
  const enabled = Boolean(from && to);

  const plansQuery = useAllWorkPlans(range, enabled);
  const itemsQuery = useWorkPlanItems(range, enabled);
  const tagsQuery = useWorkPlanTags();
  const approvalsQuery = useAllApprovals();
  const calendarActor = useMemo(
    () => ({ userId: actor.id, active: actor.status === '사용', deptId }),
    [actor.id, actor.status, deptId],
  );
  const calendarEventsQuery = useCalendarEvents(calendarActor, range, enabled);
  // 결재 없이 직접 등록한 외근·출장 (전사 공개)
  const outsideWorksQuery = useOutsideWorks(range, enabled);
  // 회의의 연결 예약 상태(대기·반려) — 예약 시각은 ISO(UTC)라 앞뒤 하루씩 넉넉히 읽는다
  const reservationRange = useMemo(() => {
    const start = new Date(`${from}T00:00:00${RESOURCE_UTC_OFFSET}`).getTime();
    const end = new Date(`${to}T00:00:00${RESOURCE_UTC_OFFSET}`).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) return undefined;
    return { from: new Date(start - DAY_MS).toISOString(), to: new Date(end + 2 * DAY_MS).toISOString() };
  }, [from, to]);
  const reservationsQuery = useReservations(reservationRange);

  /** (사람, 날짜) → 칸 목록. 한 번 훑어 만들고 칸마다 조회만 한다. */
  const cellOf = useMemo(() => {
    const input: DayEntryInput = {
      items: itemsQuery.data ?? [],
      tags: tagsQuery.data ?? [],
      events: calendarEventsQuery.data ?? [],
      outsideWorks: outsideWorksQuery.data ?? [],
      approvedSchedules: extractApprovedSchedules(approvalsQuery.data ?? []),
      legacyPlans: plansQuery.data ?? [],
      reservations: reservationsQuery.data ?? [],
      members: members.map((m) => ({ id: m.id, name: m.name })),
    };
    return indexDayEntries(input, dates);
  }, [
    itemsQuery.data,
    tagsQuery.data,
    calendarEventsQuery.data,
    outsideWorksQuery.data,
    approvalsQuery.data,
    plansQuery.data,
    reservationsQuery.data,
    members,
    dates,
  ]);

  return { cellOf, workPlans: plansQuery.data ?? [] };
}
