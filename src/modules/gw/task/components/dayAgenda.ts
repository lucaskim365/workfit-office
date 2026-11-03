import type { User } from '@/domain/user/schema';
import { sourceIdOf, type DayCell, type DayEntry } from '@/domain/workPlan/dayEntries';
import { entryKindOf, type EntryKind } from './entryKind';

/** 하루 목록 한 줄 — 같은 일정(회의 참석자·동행 외근)은 한 줄로 묶고 사람을 모은다 */
export interface AgendaRow {
  key: string;
  entry: DayEntry;
  kind: EntryKind;
  people: User[];
}

/** 시각 없는 것(종일·미정) 먼저, 그다음 시작 시각 순 */
const compareRows = (a: AgendaRow, b: AgendaRow) => {
  const aTimed = !a.entry.allDay && Boolean(a.entry.startTime);
  const bTimed = !b.entry.allDay && Boolean(b.entry.startTime);
  if (aTimed !== bTimed) return aTimed ? 1 : -1;
  return (a.entry.startTime ?? '').localeCompare(b.entry.startTime ?? '');
};

/**
 * 여러 사람의 하루 칸을 한 목록으로 — 사람 순서(members)를 지키며 같은 원본은 한 줄로 묶는다.
 * 묶인 줄의 대표 항목은 등록자 칸 것(동행 칸 글 '동행 · 등록자'가 아니게).
 */
export function collectDayRows(
  members: User[],
  date: string,
  cellOf: (userId: string, date: string) => DayCell,
): AgendaRow[] {
  const rows = new Map<string, AgendaRow>();
  for (const member of members) {
    for (const entry of cellOf(member.id, date).entries) {
      const key = sourceIdOf(entry);
      const row = rows.get(key);
      if (!row) {
        rows.set(key, { key, entry, kind: entryKindOf(entry), people: [member] });
        continue;
      }
      if (!row.people.some((p) => p.id === member.id)) row.people.push(member);
      if (row.entry.companionOf && !entry.companionOf) row.entry = entry;
    }
  }
  return [...rows.values()].sort(compareRows);
}

/** 갈래별 사람 수(회의·업무는 건수) — 하루 요약 줄 */
export function countRows(rows: AgendaRow[]): Record<EntryKind, number> {
  const counts: Record<EntryKind, number> = { meeting: 0, outside: 0, trip: 0, leave: 0, item: 0 };
  for (const row of rows) {
    counts[row.kind] += row.kind === 'meeting' || row.kind === 'item' ? 1 : row.people.length;
  }
  return counts;
}

/** '홍길동, 김철수' / 넷 이상이면 '홍길동 외 3명' */
export function peopleLabel(people: User[]): string {
  if (people.length <= 3) return people.map((p) => p.name).join(', ');
  return `${people[0].name} 외 ${people.length - 1}명`;
}
