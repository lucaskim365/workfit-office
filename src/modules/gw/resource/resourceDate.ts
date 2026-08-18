import type { Resource } from '@/domain/resource/schema';
import { RESOURCE_UTC_OFFSET, resourceDateKey, resourceTimeParts } from '@/domain/reservation/time';

const pad = (value: number) => String(value).padStart(2, '0');

export function toDateInput(date: Date): string {
  return resourceDateKey(date);
}

export function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function startOfWeek(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - weekday + 1);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function combineLocalDateTime(date: string, time: string): string {
  return new Date(`${date}T${time}:00${RESOURCE_UTC_OFFSET}`).toISOString();
}

export function formatResourceDateTime(iso: string): string {
  const parts = resourceTimeParts(new Date(iso));
  return `${parts.month}.${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatResourceFullDateTime(iso: string): string {
  const parts = resourceTimeParts(new Date(iso));
  return `${parts.year}.${pad(parts.month)}.${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatResourceTime(iso: string): string {
  const parts = resourceTimeParts(new Date(iso));
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function isSameLocalDate(iso: string, date: string): boolean {
  return toDateInput(new Date(iso)) === date;
}

export function dateRangeIso(date: string): { from: string; to: string } {
  return {
    from: new Date(`${date}T00:00:00${RESOURCE_UTC_OFFSET}`).toISOString(),
    to: new Date(`${addDays(date, 1)}T00:00:00${RESOURCE_UTC_OFFSET}`).toISOString(),
  };
}

export function defaultReservationWindow(resource: Resource, preferredDate?: string): { date: string; start: string; end: string } {
  const now = new Date();
  let date = preferredDate && preferredDate >= toDateInput(now) ? preferredDate : toDateInput(now);
  const nowParts = resourceTimeParts(now);
  const [openHour, openMinute] = resource.availableFrom.split(':').map(Number);
  const [closeHour, closeMinute] = resource.availableTo.split(':').map(Number);
  const step = resource.slotMinutes;
  let startMinutes = openHour * 60 + openMinute;

  if (date === toDateInput(now)) {
    const minutesSinceOpen = Math.max(0, nowParts.hour * 60 + nowParts.minute + 15 - startMinutes);
    startMinutes += Math.ceil(minutesSinceOpen / step) * step;
  }
  const closeMinutes = closeHour * 60 + closeMinute;
  if (startMinutes + step > closeMinutes) {
    date = addDays(date, 1);
    startMinutes = openHour * 60 + openMinute;
  }
  const minimumWindow = Math.ceil(Math.max(step, resource.minDurationMinutes) / step) * step;
  const endMinutes = Math.min(closeMinutes, startMinutes + minimumWindow);
  return {
    date,
    start: `${pad(Math.floor(startMinutes / 60))}:${pad(startMinutes % 60)}`,
    end: `${pad(Math.floor(endMinutes / 60))}:${pad(endMinutes % 60)}`,
  };
}
