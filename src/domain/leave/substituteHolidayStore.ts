/**
 * 대체휴무(대휴) 발생 및 일괄 부여 트랜잭션 저장소
 *
 * [엄격 규칙: rule-readonly.md]
 * 기존 실제 DB(appwrite, garage s3)의 결재 문서 및 마스터 데이터를 일체 수정하지 않고,
 * 관리자가 전사 또는 특정 대상자에게 부여한 대체휴무 발생 내역을 독립적으로 안전하게 격리 보관합니다.
 *
 * [옵션 B: 시스템 프리셋 미지원]
 * 시스템 기본 하드코딩 프리셋을 두지 않으며, 관리자가 화면을 통해 직접 부여한 내역만 관리합니다.
 */

export interface SubstituteHolidayGrant {
  id: string;
  targetScope: 'ALL' | string[]; // 'ALL': 전체 임직원, string[]: 대상 사번/ID/성명
  targetScopeLabel: string; // "전체 임직원" 또는 "개발본부 (5명)" 등
  occurrenceDate: string; // 휴일근무 발생일 (YYYY-MM-DD, 예: "2026-08-17")
  expirationDate: string; // 사용 유효만료일 (YYYY-MM-DD, 기본 발생일 + 1년)
  days: number; // 부여 일수 (1.0, 0.5 등)
  reason: string; // 발생 사유 (예: "8/17 대체공휴일 특근", "8/29 토요 특근")
  grantedBy: string; // 부여 등록 관리자명
  grantedAt: string; // ISO string 또는 YYYY-MM-DD
  createdAt: string; // 등록 일시 ISO string
}

export interface SubstituteHolidayItemInput {
  id: string;
  occurrenceDate: string;
  expirationDate: string;
  reason: string;
  days: number;
}

const STORAGE_KEY = 'workfit_substitute_holidays_v1';
export const SUBSTITUTE_HOLIDAY_UPDATED_EVENT = 'workfit-substitute-holiday-updated';

let memoryStorage: SubstituteHolidayGrant[] = [];

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
    return (globalThis as any).localStorage;
  }
  return null;
}

/**
 * 브라우저 로컬 스토리지에서 대체휴무 부여 목록 안전 조회
 * (초기값: 빈 배열 [], 프리셋 없음)
 */
export function getStoredSubstituteHolidays(): SubstituteHolidayGrant[] {
  const storage = getStorage();
  if (!storage) return memoryStorage;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SubstituteHolidayGrant[];
  } catch (err) {
    console.error('Failed to read substitute holidays:', err);
    return [];
  }
}

/**
 * 신규 대체휴무 부여 저장
 */
export function saveSubstituteHolidayGrant(
  grant: Omit<SubstituteHolidayGrant, 'id' | 'createdAt'>,
): SubstituteHolidayGrant {
  const current = getStoredSubstituteHolidays();
  const newGrant: SubstituteHolidayGrant = {
    ...grant,
    id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };

  const updated = [newGrant, ...current];
  const storage = getStorage();

  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save substitute holiday grant:', err);
    }
  } else {
    memoryStorage = updated;
  }

  // 커스텀 이벤트 발송으로 전사 리액티브 동기화
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(SUBSTITUTE_HOLIDAY_UPDATED_EVENT));
  }

  return newGrant;
}

/**
 * 대체휴무 부여 건 삭제/회수
 */
export function deleteSubstituteHolidayGrant(id: string): boolean {
  const current = getStoredSubstituteHolidays();
  const filtered = current.filter((g) => g.id !== id);
  if (filtered.length === current.length) return false;

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (err) {
      console.error('Failed to delete substitute holiday grant:', err);
      return false;
    }
  } else {
    memoryStorage = filtered;
  }

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(SUBSTITUTE_HOLIDAY_UPDATED_EVENT));
  }
  return true;
}

/** 테스트 환경용 메모리 스토리지 초기화 헬퍼 */
export function _resetSubstituteHolidayStoreForTest(): void {
  memoryStorage = [];
  const storage = getStorage();
  if (storage) {
    storage.removeItem(STORAGE_KEY);
  }
}

/**
 * 특정 사용자(사원)에게 적용되는 대체휴무 원천 목록 조회
 * (전체 임직원 ALL 대상이거나 사원 ID/성명이 포함된 건)
 *
 * [규칙: 발생일 기준 미입사자 자동 제외]
 * 입사일(hireDate)이 휴일 특근 발생일(occurrenceDate)보다 나중인 경우 자동으로 제외합니다.
 */
export function getSubstituteHolidaysForUser(
  userId?: string | null,
  userName?: string | null,
  hireDate?: string | null,
  allGrants: SubstituteHolidayGrant[] = getStoredSubstituteHolidays(),
): SubstituteHolidayItemInput[] {
  if (!allGrants.length) return [];

  const norm = (s?: string | null) => (s || '').trim().toLowerCase();
  const targetId = norm(userId);
  const targetName = norm(userName);
  const cleanHireDate = (hireDate || '').trim();

  return allGrants
    .filter((g) => {
      // 발생일 기준 미입사자 (입사일이 발생일보다 나중인 사원) 자동 제외
      if (cleanHireDate && cleanHireDate.length === 10 && g.occurrenceDate && g.occurrenceDate.length === 10) {
        if (cleanHireDate > g.occurrenceDate) {
          return false;
        }
      }

      if (g.targetScope === 'ALL') return true;
      if (Array.isArray(g.targetScope)) {
        return g.targetScope.some((t) => {
          const normT = norm(t);
          return (targetId && normT === targetId) || (targetName && normT === targetName);
        });
      }
      return false;
    })
    .map((g) => ({
      id: g.id,
      occurrenceDate: g.occurrenceDate,
      expirationDate: g.expirationDate,
      reason: g.reason,
      days: g.days,
    }))
    .sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate)); // 선입선출(FIFO) 적용을 위한 발생일 오름차순 정렬
}
