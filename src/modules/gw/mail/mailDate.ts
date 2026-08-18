/**
 * 메일 화면의 KST 표기.
 *
 * 받은메일 목록은 시각을 자주 보여주므로 오늘·올해 기준으로 표기를 줄인다.
 * 설문·자원예약 모듈에도 비슷한 헬퍼가 있지만 모듈 간 결합을 만들지 않으려고 따로 둔다.
 */
const KST_OFFSET_MINUTES = 9 * 60;
const pad = (value: number) => String(value).padStart(2, '0');

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function kstParts(iso: string): Parts {
  const shifted = new Date(new Date(iso).getTime() + KST_OFFSET_MINUTES * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

const sameDay = (a: Parts, b: Parts) => a.year === b.year && a.month === b.month && a.day === b.day;

/** 목록용 짧은 표기 — 오늘은 시각만, 올해는 월·일, 그 외는 연도까지. */
export function formatMailListTime(iso: string, now = new Date()): string {
  const parts = kstParts(iso);
  const today = kstParts(now.toISOString());
  if (sameDay(parts, today)) return `${pad(parts.hour)}:${pad(parts.minute)}`;
  if (parts.year === today.year) return `${parts.month}월 ${parts.day}일`;
  return `${parts.year}.${pad(parts.month)}.${pad(parts.day)}`;
}

/** 상세용 전체 표기. */
export function formatMailFullTime(iso: string): string {
  const parts = kstParts(iso);
  return `${parts.year}.${pad(parts.month)}.${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}`;
}

/**
 * 목록 날짜 구분 라벨 — 오늘·어제·이번 주·그 이전(월 단위).
 *
 * 목록은 최신순이라 라벨이 바뀌는 지점이 곧 날짜 경계다. `이번 주`는 월요일 시작
 * (달력 모듈과 같은 규칙)으로 계산한다.
 */
export function mailDateGroupLabel(iso: string, now = new Date()): string {
  const parts = kstParts(iso);
  const today = kstParts(now.toISOString());
  if (sameDay(parts, today)) return '오늘';

  const dayNumber = (value: Parts) => Date.UTC(value.year, value.month - 1, value.day) / 86_400_000;
  const diff = dayNumber(today) - dayNumber(parts);
  if (diff === 1) return '어제';

  // 월요일 시작 주. getUTCDay(): 일=0 → 월요일부터 지난 일수는 (day + 6) % 7.
  const weekday = (new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay() + 6) % 7;
  if (diff > 1 && diff <= weekday) return '이번 주';

  if (parts.year === today.year) return `${parts.month}월`;
  return `${parts.year}년 ${parts.month}월`;
}
