import type { ComponentType } from 'react';
import { normalizeLayout, rowsFor, type WidgetSize, type WidgetSlot } from './dashboard';
import {
  ApprovalWidget,
  AttendanceWidget,
  AwayTodayWidget,
  BirthdayWidget,
  LeaveWidget,
  MyDraftsWidget,
  NoticeWidget,
  PendingApprovalWidget,
  ProjectWidget,
  RecentPostsWidget,
  ResourceTodayWidget,
  ResourceWidget,
  TeamWidget,
  TodayCommuteWidget,
  TodayWidget,
  WeekHoursWidget,
  WeekScheduleWidget,
} from './widgets';

/** 경영 현황 위젯 목록과 저장된 배치 읽기 — 웹(모눈 배치)과 모바일(차례로 쌓기)이 함께 쓴다 */

/** sizes — 고를 수 있는 폭(가장 좁은 것이 최소 폭), minH — 내용이 다 보이는 높이(px). 이 높이가 들어가는 칸 수가 기본이자 최소 칸 수 */
/** mini — 휴대폰에서 반 칸(요약)으로 둘 수 있는가 */
interface WidgetDef { title: string; module: string; size: WidgetSize; sizes: readonly WidgetSize[]; minH: number; mini?: boolean; Component: ComponentType }

export const WIDGETS = {
  today: { title: '오늘 일정', module: '일정', size: 12, sizes: [8, 12], minH: 220, Component: TodayWidget },
  weekSchedule: { title: '이번 주 내 일정', module: '일정', size: 6, sizes: [4, 6, 8, 12], minH: 260, Component: WeekScheduleWidget },
  attendance: { title: '내 근태', module: '근태', size: 8, sizes: [8, 12], minH: 420, Component: AttendanceWidget },
  todayCommute: { title: '오늘 출퇴근', module: '근태', size: 4, sizes: [4, 6], minH: 180, mini: true, Component: TodayCommuteWidget },
  weekHours: { title: '이번 주 근무시간', module: '근태', size: 4, sizes: [4, 6, 8], minH: 220, mini: true, Component: WeekHoursWidget },
  leave: { title: '연차', module: '근태', size: 4, sizes: [4, 6], minH: 120, mini: true, Component: LeaveWidget },
  approval: { title: '전자결재 현황', module: '전자결재', size: 4, sizes: [4, 6, 8], minH: 240, mini: true, Component: ApprovalWidget },
  approvalPending: { title: '결재 대기', module: '전자결재', size: 4, sizes: [4, 6, 8], minH: 200, Component: PendingApprovalWidget },
  approvalMine: { title: '내가 올린 문서', module: '전자결재', size: 4, sizes: [4, 6, 8], minH: 200, Component: MyDraftsWidget },
  resource: { title: '내 자원예약', module: '자원예약', size: 4, sizes: [4, 6], minH: 180, Component: ResourceWidget },
  resourceToday: { title: '오늘 자원 사용', module: '자원예약', size: 8, sizes: [6, 8, 12], minH: 180, Component: ResourceTodayWidget },
  team: { title: '우리 부서', module: '조직도', size: 4, sizes: [4, 6, 8], minH: 200, Component: TeamWidget },
  awayToday: { title: '오늘 휴가·외근', module: '조직도', size: 4, sizes: [4, 6, 8], minH: 160, mini: true, Component: AwayTodayWidget },
  birthday: { title: '이달의 생일자', module: '조직도', size: 4, sizes: [4, 6], minH: 200, mini: true, Component: BirthdayWidget },
  notice: { title: '공지사항', module: '게시판', size: 12, sizes: [4, 6, 8, 12], minH: 150, Component: NoticeWidget },
  recentPosts: { title: '최근 게시글', module: '게시판', size: 6, sizes: [4, 6, 8, 12], minH: 180, Component: RecentPostsWidget },
  project: { title: '프로젝트', module: '프로젝트', size: 4, sizes: [4, 6], minH: 220, Component: ProjectWidget },
} satisfies Record<string, WidgetDef>;

export type WidgetId = keyof typeof WIDGETS;
export const WIDGET_IDS = Object.keys(WIDGETS) as WidgetId[];
export const MODULES = [...new Set(WIDGET_IDS.map((id) => WIDGETS[id].module))];

export const DEFAULT_LAYOUT: WidgetSlot<WidgetId>[] = [
  { id: 'today', size: 12 },
  { id: 'attendance', size: 8 },
  { id: 'approval', size: 4 },
  { id: 'resource', size: 4 },
  { id: 'team', size: 4 },
  { id: 'project', size: 4 },
  { id: 'notice', size: 12 },
];

/** 휴대폰 기본 — size 6 은 반 칸(요약), 12 는 한 줄 전체 */
export const MOBILE_DEFAULT_LAYOUT: WidgetSlot<WidgetId>[] = [
  { id: 'todayCommute', size: 6 },
  { id: 'approval', size: 6 },
  { id: 'today', size: 12 },
  { id: 'leave', size: 6 },
  { id: 'birthday', size: 6 },
  { id: 'notice', size: 12 },
];
/** 휴대폰에서 반 칸인가 — 요약을 지원하는 위젯만 */
export const isHalf = (slot: WidgetSlot<WidgetId>) => slot.size <= 6 && Boolean((WIDGETS[slot.id] as WidgetDef).mini);
export const mobileStorageKey = (userId: string) => `workfit.execDashboard.mobile.${userId}`;

export const storageKey = (userId: string) => `workfit.execDashboard.layout.${userId}`;

/** 이 브라우저에 저장된 배치 — 없거나 망가졌으면 fallback */
export function loadLayout(userId: string | undefined, fallback: WidgetSlot<WidgetId>[] = DEFAULT_LAYOUT, key = storageKey): WidgetSlot<WidgetId>[] {
  if (!userId) return fallback;
  try {
    const raw = localStorage.getItem(key(userId));
    return normalizeLayout(raw ? JSON.parse(raw) : null, WIDGET_IDS, fallback);
  } catch {
    return fallback;
  }
}

/** 위젯의 최소(기본) 세로 칸 수 */
export const minRowsOf = (id: WidgetId) => rowsFor(WIDGETS[id].minH);
/** 위젯의 최소 가로 칸 수 */
export const minColsOf = (id: WidgetId) => Math.min(...WIDGETS[id].sizes);
/** 위젯이 차지하는 세로 칸 수 */
export const rowsOf = (slot: WidgetSlot<WidgetId>) => Math.max(slot.rows ?? 0, minRowsOf(slot.id));
/** fit — 내용이 실제로 차지하는 칸 수. 정한 칸보다 내용이 길면 그만큼 늘려 위젯 안에 스크롤이 생기지 않게 한다 */
export const placementsOf = (list: WidgetSlot<WidgetId>[], fit: Partial<Record<WidgetId, number>> = {}) =>
  list.map((s) => ({ id: s.id, w: Math.max(s.size, minColsOf(s.id)), h: Math.max(rowsOf(s), fit[s.id] ?? 0), x: s.x, y: s.y }));

