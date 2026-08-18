export const RESOURCE_TIME_ZONE = 'Asia/Seoul';
export const RESOURCE_UTC_OFFSET = '+09:00';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: RESOURCE_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export interface ResourceTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function resourceTimeParts(date: Date): ResourceTimeParts {
  const values = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

export function resourceDateKey(date: Date): string {
  const parts = resourceTimeParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function resourceMinuteOfDay(date: Date): number {
  const parts = resourceTimeParts(date);
  return parts.hour * 60 + parts.minute;
}
