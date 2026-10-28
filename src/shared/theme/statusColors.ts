/**
 * 사람 상태 색 — 앱 전체의 단일 정의.
 * 프로필 상태·근태·캘린더·업무계획(표 칩·시간표·태그)이 모두 여기서 색을 가져다 쓴다.
 * 색을 바꿀 때는 이 파일만 고친다. (Tailwind 가 읽을 수 있게 클래스는 문자열 그대로 적는다)
 *
 * 근무중·정상 초록 / 휴일근무 청록 / 휴가 노랑 / 외근 파랑 / 출장 남색 / 회의 보라 / 자리비움 주황 / 집중근무 빨강 / 오프라인 회색
 */
export type PersonTone = 'work' | 'leave' | 'outside' | 'trip' | 'meeting' | 'away' | 'focus' | 'offline';

export interface PersonToneClasses {
  /** 테두리 있는 배지 (근태 칩·업무계획 칩·상태 배지) */
  badge: string;
  /** 연한 배지 — 반차·반반차처럼 덜 강조할 때 */
  badgeLight: string;
  /** 테두리 없는 옅은 칩 (캘린더 월간 칩) */
  chip: string;
  /** 글자색 */
  text: string;
  /** 점 */
  dot: string;
  /** 업무계획 시간표 블록 */
  block: string;
  /** 업무계획 태그 색 id (TAG_COLOR_PRESETS) */
  tagColorId: string;
}

/** 근태 휴일근무 — 근무의 한 종류라 초록 계열이되 정상과 구분되는 청록 */
export const HOLIDAY_WORK_TONE = {
  badge: 'bg-teal-500/10 border-teal-500/30 text-teal-700 dark:text-teal-400',
  text: 'text-teal-700 dark:text-teal-400',
  dot: 'bg-teal-500',
};

export const PERSON_TONES: Record<PersonTone, PersonToneClasses> = {
  work: {
    badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
    badgeLight: 'bg-emerald-500/[0.07] border-emerald-500/25 text-emerald-700 dark:text-emerald-400',
    chip: 'bg-emerald-500/[0.07] text-emerald-700 dark:text-emerald-400',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    block: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    tagColorId: 'emerald',
  },
  leave: {
    badge: 'bg-yellow-400/20 border-yellow-500/45 text-yellow-700 dark:text-yellow-300',
    badgeLight: 'bg-yellow-400/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-300',
    chip: 'bg-yellow-400/15 text-yellow-700 dark:text-yellow-300',
    text: 'text-yellow-700 dark:text-yellow-300',
    dot: 'bg-yellow-400',
    block: 'border-yellow-500/45 bg-yellow-400/15 text-yellow-700 dark:text-yellow-300',
    tagColorId: 'yellow',
  },
  outside: {
    badge: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400',
    badgeLight: 'bg-blue-500/[0.07] border-blue-500/25 text-blue-700 dark:text-blue-400',
    chip: 'bg-blue-500/[0.07] text-blue-700 dark:text-blue-400',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
    block: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400',
    tagColorId: 'blue',
  },
  trip: {
    badge: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-400',
    badgeLight: 'bg-indigo-500/[0.07] border-indigo-500/25 text-indigo-700 dark:text-indigo-400',
    chip: 'bg-indigo-500/[0.07] text-indigo-700 dark:text-indigo-400',
    text: 'text-indigo-700 dark:text-indigo-400',
    dot: 'bg-indigo-500',
    block: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
    tagColorId: 'indigo',
  },
  meeting: {
    badge: 'bg-purple-500/15 border-purple-500/30 text-purple-700 dark:text-purple-400',
    badgeLight: 'bg-purple-500/[0.07] border-purple-500/25 text-purple-700 dark:text-purple-400',
    chip: 'bg-purple-500/[0.07] text-purple-700 dark:text-purple-400',
    text: 'text-purple-700 dark:text-purple-400',
    dot: 'bg-purple-500',
    block: 'border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-400',
    tagColorId: 'purple',
  },
  away: {
    badge: 'bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400',
    badgeLight: 'bg-orange-500/[0.07] border-orange-500/25 text-orange-700 dark:text-orange-400',
    chip: 'bg-orange-500/[0.07] text-orange-700 dark:text-orange-400',
    text: 'text-orange-700 dark:text-orange-400',
    dot: 'bg-orange-500',
    block: 'border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400',
    tagColorId: 'amber',
  },
  focus: {
    badge: 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400',
    badgeLight: 'bg-red-500/[0.07] border-red-500/25 text-red-600 dark:text-red-400',
    chip: 'bg-red-500/[0.07] text-red-600 dark:text-red-400',
    text: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
    block: 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400',
    tagColorId: 'rose',
  },
  offline: {
    badge: 'bg-zinc-400/10 border-zinc-400/30 text-zinc-600 dark:text-zinc-400',
    badgeLight: 'bg-zinc-400/[0.07] border-zinc-400/25 text-zinc-600 dark:text-zinc-400',
    chip: 'bg-zinc-400/[0.07] text-zinc-600 dark:text-zinc-400',
    text: 'text-zinc-500 dark:text-zinc-400',
    dot: 'bg-zinc-400',
    block: 'border-zinc-400/40 bg-zinc-400/10 text-zinc-600 dark:text-zinc-400',
    tagColorId: 'slate',
  },
};

/**
 * 일반 태그(업무·보고·마감 등)가 고를 수 있는 색 — 사람 상태 색(초록·노랑·파랑·남색·보라)과 겹치지 않는 것만.
 * 업무계획 칩에서 태그와 외근·휴가 같은 상태가 섞여 보여도 구분되게 한다.
 */
export const GENERAL_TAG_COLOR_IDS = ['slate', 'teal', 'amber', 'rose', 'pink'] as const;
