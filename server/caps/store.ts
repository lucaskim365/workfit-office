import type { CapsHoliday } from './schema';

/**
 * 저장 계층 추상화.
 *
 * 지금 개발 환경에는 Firebase가 없어서(프론트 전용) 파일 저장소([[fileStore.ts]])로
 * 검증하고, 마이그레이션 때 Firestore 저장소([[firestoreStore.ts]] — Admin SDK 필요)로
 * 갈아끼운다. 검증·스키마·ID 결정·멱등 규칙은 저장소와 무관하게 동일하다.
 */
export type CapsCollection = 'employees' | 'attendance' | 'holidays' | 'syncMeta';

export interface CapsStore {
  /** 결정적 문서 ID에 merge upsert. 삭제는 하지 않는다(계약 §4). */
  mergeSet(collection: CapsCollection, id: string, data: Record<string, unknown>): void;
  /** 쌓인 쓰기를 반영한다. Firestore 구현은 여기서 writeBatch(≤500)로 나눠 commit한다. */
  flush(): Promise<void>;
}

/** attendance 문서 ID: `{empId}_{YYYYMMDD}` (계약 §4). */
export const attendanceDocId = (empId: number, date: string): string =>
  `${empId}_${date.replaceAll('-', '')}`;

/** holidays 문서 ID: 반복 `md_{MMDD}` / 특정일 `{YYYYMMDD}` (계약 §4). */
export const holidayDocId = (holiday: Pick<CapsHoliday, 'recurring' | 'monthDay' | 'date'>): string =>
  holiday.recurring && holiday.monthDay
    ? `md_${holiday.monthDay.replace('-', '')}`
    : (holiday.date ?? '').replaceAll('-', '');
