import { scheduleChip, STATUS_TONES } from '@/domain/commute/statusDisplay';
import type { CalendarEventType } from '@/domain/calendarEvent/schema';
import type { DayEntry } from '@/domain/workPlan/dayEntries';
import { TAG_COLOR_PRESETS } from '@/features/workPlan/useWorkPlanConfig';

/* 업무계획 칸 항목의 글·색 — PC 표 칩과 모바일 목록이 같이 쓴다. */

/** 회의(및 회의 외 캘린더 일정) 칩 색 — 기존 보라 그대로 */
const MEETING_CHIP_CLASS = 'bg-purple-500/15 text-purple-700 border-purple-500/30 dark:text-purple-400';
/** 모르는·지운 태그 */
const FALLBACK_TAG_CHIP_CLASS = 'bg-slate-500/10 text-slate-600 border border-slate-500/30 dark:text-slate-400';
const CALENDAR_CHIP_TAG: Record<CalendarEventType, string> = {
  GENERAL: '회의',
  MEETING: '회의',
  COMPANY_EVENT: '사내행사',
  OUTSIDE: '외근',
  VACATION: '휴가',
};

/** 칩 글(`[태그] 제목`)과 색 — 일반은 태그 색, 회의는 보라, 외근·결재는 근태와 같은 표준 정의([[statusDisplay]]) */
export function chipLook(entry: DayEntry): { label: string; badgeClass: string } {
  switch (entry.source) {
    case 'ITEM': {
      const tag = entry.tag;
      const preset = tag && !tag.unknown ? TAG_COLOR_PRESETS.find((p) => p.id === tag.colorId) : undefined;
      return { label: `[${tag?.name ?? '일반'}] ${entry.title}`, badgeClass: preset?.badgeClass ?? FALLBACK_TAG_CHIP_CLASS };
    }
    case 'MEETING':
      return { label: `[회의] ${entry.title}`, badgeClass: MEETING_CHIP_CLASS };
    case 'CALENDAR':
      return {
        label: `[${entry.event ? CALENDAR_CHIP_TAG[entry.event.eventType] : '회의'}] ${entry.title}`,
        badgeClass: MEETING_CHIP_CLASS,
      };
    case 'OUTSIDE': {
      const view = entry.outside;
      const chip = scheduleChip({ category: view?.category ?? 'OUTSIDE', subType: view?.subType });
      // 동행자 칸은 '동행 · 등록자' 표시(근태에는 반영하지 않는다)
      const label = entry.companionOf
        ? `[동행] ${chip.label} · ${view?.ownerName ?? ''} (${entry.title})`
        : `[${chip.short}] ${chip.label} (${entry.title})`;
      return { label, badgeClass: STATUS_TONES[chip.kind].badge };
    }
    case 'APPROVAL': {
      const s = entry.schedule;
      if (!s) return { label: entry.title, badgeClass: FALLBACK_TAG_CHIP_CLASS };
      const chip = scheduleChip(s);
      const tag = s.category === 'LEAVE' ? '휴가' : chip.short;
      return {
        label: `[${tag}] ${chip.label}${s.category !== 'LEAVE' && s.destination ? ` (${s.destination})` : ''}`,
        badgeClass: STATUS_TONES[chip.kind].badge,
      };
    }
  }
}

export const timeOf = (entry: DayEntry) => (entry.allDay || !entry.startTime ? '종일' : entry.startTime);
export const timeRangeOf = (entry: DayEntry) =>
  entry.allDay || !entry.startTime ? '종일' : entry.endTime ? `${entry.startTime}~${entry.endTime}` : entry.startTime;
