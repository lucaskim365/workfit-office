import type { CapsIngestPayload } from './schema';
import { attendanceDocId, holidayDocId, type CapsStore } from './store';

/**
 * 멱등 upsert — 계약 §4·§5.
 *
 * 에이전트는 최근 N일 창을 통째로 다시 보내므로, 결정적 ID + merge로 몇 번을 받아도
 * 결과가 같아야 한다. 삭제는 하지 않는다(창 밖 데이터 보호). `raw`는 원본 코드
 * 보존용이라 그대로 저장한다 — status 매핑이 추정이라 나중에 재해석할 안전망이다.
 */
export interface CapsUpsertCounts {
  attendance: number;
  employees: number;
  holidays: number;
}

export async function upsertCapsPayload(
  store: CapsStore,
  payload: CapsIngestPayload,
  now: Date = new Date(),
): Promise<CapsUpsertCounts> {
  for (const row of payload.employees) {
    store.mergeSet('employees', String(row.empId), {
      empId: row.empId,
      name: row.name,
      active: row.active,
      retireDate: row.retireDate,
      updatedAt: now,
    });
  }

  for (const row of payload.attendance) {
    store.mergeSet('attendance', attendanceDocId(row.empId, row.date), {
      empId: row.empId,
      date: row.date,
      // ISO 문자열 → Date. Firestore Admin SDK는 Date를 Timestamp로 저장한다(계약 §5).
      inAt: row.inAt ? new Date(row.inAt) : null,
      outAt: row.outAt ? new Date(row.outAt) : null,
      basicMin: row.basicMin,
      overMin: row.overMin,
      nightMin: row.nightMin,
      lateMin: row.lateMin,
      totalMin: row.totalMin,
      status: row.status,
      raw: row.raw,
      updatedAt: now,
    });
  }

  for (const row of payload.holidays) {
    const id = holidayDocId(row);
    if (id === '' || id === 'md_') continue; // 스키마가 걸러주지만 ID가 비면 저장하지 않는다.
    store.mergeSet('holidays', id, {
      recurring: row.recurring,
      monthDay: row.monthDay,
      date: row.date,
      name: row.name,
    });
  }

  const counts: CapsUpsertCounts = {
    attendance: payload.attendance.length,
    employees: payload.employees.length,
    holidays: payload.holidays.length,
  };

  // 실행 메타는 마지막에. 본문 저장이 실패하면 여기까지 오지 않아 lastRunAt이 남지 않는다.
  store.mergeSet('syncMeta', 'caps', {
    lastRunAt: now,
    windowStart: payload.windowStart,
    counts,
    lastError: null,
  });

  await store.flush();
  return counts;
}
