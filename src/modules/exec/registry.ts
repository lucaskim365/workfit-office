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
interface WidgetDef { title: string; module: string; size: WidgetSize; sizes: readonly WidgetSize[]; minH: number; Component: ComponentType }

export const WIDGETS = {
  today: { title: '오늘 일정', module: '일정', size: 12, sizes: [8, 12], minH: 220, Component: TodayWidget },
  weekSchedule: { title: '이번 주 내 일정', module: '일정', size: 6, sizes: [4, 6, 8, 12], minH: 260, Component: WeekScheduleWidget },
  attendance: { title: '내 근태', module: '근태', size: 8, sizes: [8, 12], minH: 420, Component: AttendanceWidget },
  todayCommute: { title: '오늘 출퇴근', module: '근태', size: 4, sizes: [4, 6], minH: 180, Component: TodayCommuteWidget },
  weekHours: { title: '이번 주 근무시간', module: '근태', size: 4, sizes: [4, 6, 8], minH: 220, Component: WeekHoursWidget },
  leave: { title: '연차', module: '근태', size: 4, sizes: [4, 6], minH: 120, Component: LeaveWidget },
  approval: { title: '전자결재 현황', module: '전자결재', size: 4, sizes: [4, 6, 8], minH: 240, Component: ApprovalWidget },
  approvalPending: { title: '결재 대기', module: '전자결재', size: 4, sizes: [4, 6, 8], minH: 200, Component: PendingApprovalWidget },
  approvalMine: { title: '내가 올린 문서', module: '전자결재', size: 4, sizes: [4, 6, 8], minH: 200, Component: MyDraftsWidget },
  resource: { title: '내 자원예약', module: '자원예약', size: 4, sizes: [4, 6], minH: 180, Component: ResourceWidget },
  resourceToday: { title: '오늘 자원 사용', module: '자원예약', size: 8, sizes: [6, 8, 12], minH: 180, Component: ResourceTodayWidget },
  team: { title: '우리 부서', module: '조직도', size: 4, sizes: [4, 6, 8], minH: 200, Component: TeamWidget },
  awayToday: { title: '오늘 휴가·외근', module: '조직도', size: 4, sizes: [4, 6, 8], minH: 160, Component: AwayTodayWidget },
  birthday: { title: '이달의 생일자', module: '조직도', size: 4, sizes: [4, 6], minH: 200, Component: BirthdayWidget },
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

/** 휴대폰 기본 — 한 줄로 쌓아 보기 좋은 것만 */
export const MOBILE_DEFAULT_LAYOUT: WidgetSlot<WidgetId>[] = [
  { id: 'todayCommute', size: 12 },
  { id: 'today', size: 12 },
  { id: 'approval', size: 12 },
  { id: 'notice', size: 12 },
  { id: 'birthday', size: 12 },
];

export const storageKey = (userId: string) => `workfit.execDashboard.layout.${userId}`;

/** 이 브라우저에 저장된 배치 — 없거나 망가졌으면 fallback */
export function loadLayout(userId: string | undefined, fallback: WidgetSlot<WidgetId>[] = DEFAULT_LAYOUT): WidgetSlot<WidgetId>[] {
  if (!userId) return fallback;
  try {
    const raw = localStorage.getItem(storageKey(userId));
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
export const placementsOf = (list: WidgetSlot<WidgetId>[]) =>
  list.map((s) => ({ id: s.id, w: Math.max(s.size, minColsOf(s.id)), h: rowsOf(s), x: s.x, y: s.y }));

