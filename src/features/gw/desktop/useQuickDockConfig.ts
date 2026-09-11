import { useState, useEffect, useCallback } from 'react';

// 필수 모듈 4개 고정 키 (최상단 1행 고정)
export const REQUIRED_MODULE_KEYS = ['approval', 'mail', 'work-plan', 'commute'] as const;

// 일반 모듈 8개 기본 순서 키 (2~3행 배치)
export const DEFAULT_NORMAL_MODULE_KEYS = [
  'calendar',   // 일정관리
  'board',      // 사내게시판
  'employee',   // 인명관리
  'gallery',    // 회사 갤러리
  'task',       // 프로젝트
  'resource',   // 자원예약
  'survey',     // 전자설문
  'orgchart',   // 조직도
] as const;

const STORAGE_PREFIX = 'workfit_quickdock_normal_order_';

export function useQuickDockConfig(userId?: string) {
  const storageKey = `${STORAGE_PREFIX}${userId || 'guest'}`;

  // 저장된 일반 모듈 순서 불러오기 (없으면 기본값)
  const getInitialOrder = useCallback((): string[] => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 유효한 키들만 추리고, 혹시 새로 추가된 키가 있다면 뒤에 병합
          const validKeys = parsed.filter((k): k is string =>
            DEFAULT_NORMAL_MODULE_KEYS.includes(k as any)
          );
          const missingKeys = DEFAULT_NORMAL_MODULE_KEYS.filter(
            (k) => !validKeys.includes(k)
          );
          return [...validKeys, ...missingKeys];
        }
      }
    } catch (e) {
      console.error('Failed to load quickdock config from localStorage:', e);
    }
    return [...DEFAULT_NORMAL_MODULE_KEYS];
  }, [storageKey]);

  const [normalOrder, setNormalOrder] = useState<string[]>(getInitialOrder);

  // 사용자 ID 변경 시 재로드
  useEffect(() => {
    setNormalOrder(getInitialOrder());
  }, [getInitialOrder]);

  // 특정 위치로 이동 (스왑 또는 재배치)
  const moveNormalItem = useCallback((fromIndex: number, toIndex: number) => {
    setNormalOrder((prev) => {
      if (
        fromIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex < 0 ||
        toIndex >= prev.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }
      const updated = [...prev];
      const [movedItem] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedItem);

      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save quickdock config to localStorage:', e);
      }
      return updated;
    });
  }, [storageKey]);

  // 기본 순서로 초기화
  const resetNormalOrder = useCallback(() => {
    const defaultOrder = [...DEFAULT_NORMAL_MODULE_KEYS];
    setNormalOrder(defaultOrder);
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.error('Failed to clear quickdock config from localStorage:', e);
    }
  }, [storageKey]);

  return {
    normalOrder,
    moveNormalItem,
    resetNormalOrder,
  };
}
