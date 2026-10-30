import { scheduleChip, STATUS_TONES } from '@/domain/commute/statusDisplay';
import type { CalendarEventType } from '@/domain/calendarEvent/schema';
import type { DayEntry } from '@/domain/workPlan/dayEntries';
import { TAG_COLOR_PRESETS } from '@/features/workPlan/useWorkPlanConfig';
import { PERSON_TONES } from '@/shared/theme/statusColors';
import { outsideChipLabel } from './outsideChipLabel';

/* 업무계획 칸 항목의 글·색 — PC 표 칩과 모바일 목록이 같이 쓴다. */

/** 회의 칩 색 — 사람 상태 색([[statusColors]]) */
const MEETING_CHIP_CLASS = PERSON_TONES.meeting.badge;
/** 결재 정보가 없는 칸 */
const FALLBACK_TAG_CHIP_CLASS = 'bg-slate-500/10 text-slate-600 border border-slate-500/30 dark:text-slate-400';
/** 일반 업무 칩 — 바탕·글은 같고 태그는 색 점으로만 가른다 */
const ITEM_CHIP_CLASS = 'bg-panel text-ink border border-border';
/** 모르는·지운 태그의 점 */
const FALLBACK_TAG_DOT_CLASS = 'bg-slate-400';
/** 캘린더 일정 종류별 칩 색 — 휴가는 휴가 색, 외근은 외근 색, 나머지는 회의 색 */
const CALENDAR_CHIP_CLASS: Record<CalendarEventType, string> = {
  GENERAL: MEETING_CHIP_CLASS,
  MEETING: MEETING_CHIP_CLASS,
  COMPANY_EVENT: MEETING_CHIP_CLASS,
  OUTSIDE: PERSON_TONES.outside.badge,
  VACATION: PERSON_TONES.leave.badge,
};
const CALENDAR_CHIP_TAG: Record<CalendarEventType, string> = {
  GENERAL: '회의',
  MEETING: '회의',
  COMPANY_EVENT: '사내행사',
  OUTSIDE: '외근',
  VACATION: '휴가',
};

/**
 * 칩 글과 색 — 일반은 검정 글·흰 바탕에 태그 색 점(`dotClass`)만, 회의·외근·출장·휴가는 사람 상태 색([[statusColors]]).
 * `hint` = 마우스를 올렸을 때 보일 글(일반은 태그 이름을 앞에 붙인다).
 */
export function chipLook(entry: DayEntry): { label: string; badgeClass: string; dotClass?: string; hint: string } {
  const look = chipLookOf(entry);
  return { ...look, hint: look.hint ?? look.label };
}

function chipLookOf(entry: DayEntry): { label: string; badgeClass: string; dotClass?: string; hint?: string } {
  switch (entry.source) {
    case 'ITEM': {
      const tag = entry.tag;
      const preset = tag && !tag.unknown ? TAG_COLOR_PRESETS.find((p) => p.id === tag.colorId) : undefined;
      return {
        label: entry.title,
        badgeClass: ITEM_CHIP_CLASS,
        dotClass: preset?.dotColor ?? FALLBACK_TAG_DOT_CLASS,
        hint: `[${tag?.name ?? '일반'}] ${entry.title}`,
      };
    }
    case 'MEETING':
      return { label: `[회의] ${entry.title}`, badgeClass: MEETING_CHIP_CLASS };
    case 'CALENDAR':
      return {
        label: `[${entry.event ? CALENDAR_CHIP_TAG[entry.event.eventType] : '회의'}] ${entry.title}`,
        badgeClass: entry.event ? CALENDAR_CHIP_CLASS[entry.event.eventType] : MEETING_CHIP_CLASS,
      };
    case 'OUTSIDE': {
      const view = entry.outside;
      const category = view?.category ?? 'OUTSIDE';
      const chip = scheduleChip({ category, subType: view?.subType });
      // 동행자 칸은 '동행 · 등록자' 표시(근태에는 반영하지 않는다). 행선지는 칩에 넣지 않는다(열어서 본다)
      const label = outsideChipLabel({
        category,
        subType: view?.subType,
        purpose: view?.purpose,
        companionOwnerName: entry.companionOf ? view?.ownerName ?? '' : null,
      });
      return { label, badgeClass: STATUS_TONES[chip.kind].badge };
    }
    case 'APPROVAL': {
      const s = entry.schedule;
      if (!s) return { label: entry.title, badgeClass: FALLBACK_TAG_CHIP_CLASS };
      const chip = scheduleChip(s);
      if (s.category === 'LEAVE') return { label: `[휴가] ${chip.label}`, badgeClass: STATUS_TONES[chip.kind].badge };
      return {
        label: outsideChipLabel({ category: s.category, subType: s.subType, purpose: s.purpose }),
        badgeClass: STATUS_TONES[chip.kind].badge,
      };
    }
  }
}

/** 시각 없는 칸 글 — 업무는 '미정'(시간을 모르는 일), 그 밖(외근·출장·휴가 등)은 '종일' */
const noTimeOf = (entry: DayEntry) => (entry.source === 'ITEM' ? '미정' : '종일');
export const timeOf = (entry: DayEntry) => (entry.allDay || !entry.startTime ? noTimeOf(entry) : entry.startTime);
/** 종료 미정이면 '10:00~' */
export const timeRangeOf = (entry: DayEntry) =>
  entry.allDay || !entry.startTime ? noTimeOf(entry) : `${entry.startTime}~${entry.endTime ?? ''}`;
