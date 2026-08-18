/**
 * 설문 화면의 KST 표기·입력 변환.
 *
 * 자원예약 모듈에도 비슷한 헬퍼가 있지만, 병렬 개발 중 모듈 간 결합을 만들지 않기 위해
 * 상수 하나를 공유하는 대신 설문 모듈 안에 둔다.
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

/** ISO → `<input type="datetime-local">` 값. 비어 있으면 빈 문자열. */
export function toDateTimeInput(iso: string | null): string {
  if (!iso) return '';
  const parts = kstParts(iso);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

/** `<input type="datetime-local">` 값 → ISO. 비어 있으면 null. */
export function fromDateTimeInput(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}:00+09:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function formatSurveyDate(iso: string | null): string {
  if (!iso) return '미정';
  const parts = kstParts(iso);
  return `${parts.year}.${pad(parts.month)}.${pad(parts.day)}`;
}

export function formatSurveyDateTime(iso: string | null): string {
  if (!iso) return '미정';
  const parts = kstParts(iso);
  return `${parts.year}.${pad(parts.month)}.${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatSurveyPeriod(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt && !endsAt) return '기간 미정';
  return `${formatSurveyDate(startsAt)} ~ ${formatSurveyDate(endsAt)}`;
}

/** 마감까지 남은 일수. 이미 지났으면 음수, 기간이 없으면 null. */
export function daysUntil(endsAt: string | null, now = new Date()): number | null {
  if (!endsAt) return null;
  return Math.ceil((new Date(endsAt).getTime() - now.getTime()) / 86_400_000);
}

/** 기본 응답 기간 — 내일 09:00부터 7일간. 새 설문 초안에서 쓴다. */
export function defaultSurveyPeriod(now = new Date()): { startsAt: string; endsAt: string } {
  const start = new Date(now.getTime() + KST_OFFSET_MINUTES * 60_000);
  start.setUTCDate(start.getUTCDate() + 1);
  start.setUTCHours(9, 0, 0, 0);
  const startsAt = new Date(start.getTime() - KST_OFFSET_MINUTES * 60_000);
  const endsAt = new Date(startsAt.getTime() + 7 * 86_400_000);
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}
