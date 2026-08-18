import type { Reservation } from '@/domain/reservation/schema';
import { RESOURCE_UTC_OFFSET, resourceDateKey } from '@/domain/reservation/time';

function upcomingWindow(startHour: number, endHour: number): [string, string] {
  const now = new Date();
  let date = resourceDateKey(now);
  let start = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00${RESOURCE_UTC_OFFSET}`);
  if (start.getTime() <= now.getTime()) {
    const next = new Date(`${date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    date = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
    start = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00${RESOURCE_UTC_OFFSET}`);
  }
  const end = new Date(`${date}T${String(endHour).padStart(2, '0')}:00:00${RESOURCE_UTC_OFFSET}`);
  return [start.toISOString(), end.toISOString()];
}

const CREATED_AT = new Date(Date.now() - 3_600_000).toISOString();
const ROOM_WINDOW = upcomingWindow(10, 11);
const VEHICLE_WINDOW = upcomingWindow(13, 16);
const LAPTOP_WINDOW = upcomingWindow(14, 18);

export const RESERVATION_SEED: Reservation[] = [
  {
    id: 'RSV-DEMO-0001', resourceId: 'RES-0001', resourceCodeSnapshot: 'ROOM-A', resourceNameSnapshot: '대회의실',
    requesterUserId: 'U011', requesterDeptId: 'D240', title: '주간 개발회의', purpose: '개발 진행사항 공유',
    startAt: ROOM_WINDOW[0], endAt: ROOM_WINDOW[1], quantity: 1, attendeeCount: 8, attendeeUserIds: ['U011', 'U012'],
    status: 'CONFIRMED', approvalModeSnapshot: 'INSTANT', approverUserId: null, approvedAt: CREATED_AT,
    rejectedAt: null, rejectionReason: null, cancelledAt: null, cancelReason: null, version: 1,
    createdAt: CREATED_AT, updatedAt: CREATED_AT,
  },
  {
    id: 'RSV-DEMO-0002', resourceId: 'RES-0003', resourceCodeSnapshot: 'CAR-01', resourceNameSnapshot: '법인차량 1호',
    requesterUserId: 'U012', requesterDeptId: 'D240', title: '고객사 방문', purpose: '현장 요구사항 협의',
    startAt: VEHICLE_WINDOW[0], endAt: VEHICLE_WINDOW[1], quantity: 1, attendeeCount: null, attendeeUserIds: [],
    status: 'PENDING', approvalModeSnapshot: 'APPROVAL', approverUserId: 'U009', approvedAt: null,
    rejectedAt: null, rejectionReason: null, cancelledAt: null, cancelReason: null, version: 1,
    createdAt: CREATED_AT, updatedAt: CREATED_AT,
  },
  {
    id: 'RSV-DEMO-0003', resourceId: 'RES-0005', resourceCodeSnapshot: 'LAPTOP-POOL', resourceNameSnapshot: '공용 노트북',
    requesterUserId: 'U007', requesterDeptId: 'D210', title: '신입사원 교육', purpose: '교육 실습 장비 대여',
    startAt: LAPTOP_WINDOW[0], endAt: LAPTOP_WINDOW[1], quantity: 2, attendeeCount: null, attendeeUserIds: [],
    status: 'CONFIRMED', approvalModeSnapshot: 'APPROVAL', approverUserId: 'U011', approvedAt: CREATED_AT,
    rejectedAt: null, rejectionReason: null, cancelledAt: null, cancelReason: null, version: 1,
    createdAt: CREATED_AT, updatedAt: CREATED_AT,
  },
];
