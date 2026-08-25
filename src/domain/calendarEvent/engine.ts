import type { CalendarEvent } from './schema';

/**
 * 일정 접근 판정에 필요한 사용자 정보.
 *
 * 업무관리 `ProjectAccessContext`와 같은 모양에 `projectIds`만 더했다. 프로젝트 공유는
 * "이 사람이 그 프로젝트 참여자인가"를 물어야 하는데, 판정 함수가 프로젝트를 직접 조회하면
 * 순수 함수가 아니게 되고 테스트도 못 한다. 참여 프로젝트는 부르는 쪽에서 한 번 모아 넘긴다.
 */
export interface CalendarAccessContext {
  userId: string;
  /** 소속 부서 ID. `user.dept`(이름)를 부서 목록으로 옮긴 값이다. 없으면 null. */
  deptId: string | null;
  /** 참여 중인 프로젝트 ID 목록. */
  projectIds: string[];
  active: boolean;
}

/**
 * 이 일정을 볼 수 있는가.
 *
 * 소유자는 공개 범위와 무관하게 항상 본다. 그 외에는 범위별로 갈린다.
 * `deptId`·`projectId`는 해당 범위일 때만 본다 — 범위를 바꿔도 예전 값이 남아 있을 수 있어서,
 * 범위를 먼저 확인하지 않으면 `PRIVATE`인데 부서에 새는 일이 생긴다.
 */
export function canViewEvent(actor: CalendarAccessContext, event: CalendarEvent): boolean {
  if (!actor.active) return false;
  if (event.ownerUserId === actor.userId) return true;

  switch (event.visibility) {
    case 'PRIVATE':
      return false;
    case 'COMPANY':
      return true;
    case 'TEAM':
      return actor.deptId !== null && actor.deptId === event.deptId;
    case 'PROJECT':
      return event.projectId !== null && actor.projectIds.includes(event.projectId);
    default:
      // 모르는 범위는 닫는다. 새 범위가 생겼는데 여기를 안 고쳤다면 안 보이는 편이 낫다.
      return false;
  }
}

/**
 * 이 일정을 고치거나 지울 수 있는가.
 *
 * 소유자만이다. 공유는 **보여주기**까지이고 남의 일정을 고치지는 못한다 —
 * 부서 공유 일정을 부서원 아무나 지울 수 있으면 공유를 못 쓰게 된다.
 */
export function canManageEvent(actor: CalendarAccessContext, event: CalendarEvent): boolean {
  return actor.active && event.ownerUserId === actor.userId;
}

/** 내가 만든 일정인가. 화면이 공유받은 일정과 내 일정을 다르게 그리는 데 쓴다. */
export const isOwnEvent = (actor: CalendarAccessContext, event: CalendarEvent): boolean =>
  event.ownerUserId === actor.userId;
