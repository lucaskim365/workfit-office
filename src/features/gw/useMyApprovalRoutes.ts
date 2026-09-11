import { useState, useEffect, useCallback } from 'react';
import type { ApprovalStep } from '@/domain/approvalDoc/schema';
import {
  type MyApprovalRoute,
  toMyRouteSteps,
  myApprovalRouteSchema,
} from '@/domain/myApprovalRoute/schema';

const STORAGE_PREFIX = 'workfit:my_approval_routes:';
const EVENT_NAME = 'workfit_my_routes_updated';

function getStorageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function loadRoutesFromStorage(userId: string): MyApprovalRoute[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const result = myApprovalRouteSchema.safeParse(item);
        return result.success ? result.data : null;
      })
      .filter((r): r is MyApprovalRoute => r !== null);
  } catch (err) {
    console.error(`[useMyApprovalRoutes] Error loading routes for user ${userId}:`, err);
    return [];
  }
}

function saveRoutesToStorage(userId: string, routes: MyApprovalRoute[]) {
  if (!userId) return;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(routes));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { userId } }));
  } catch (err) {
    console.error(`[useMyApprovalRoutes] Error saving routes for user ${userId}:`, err);
  }
}

/**
 * 사용자별 개인 맞춤 '내 결재선' 전용 훅.
 * 각 사용자(userId) 기준으로 완전히 격리된 결재선 목록을 관리합니다.
 * 기존 실제 데이터베이스(approvalDocs, approvalForms)에 일체 영향을 주지 않습니다.
 */
export function useMyApprovalRoutes(userId: string | null | undefined) {
  const effectiveUserId = userId || '';
  const [routes, setRoutes] = useState<MyApprovalRoute[]>(() =>
    loadRoutesFromStorage(effectiveUserId)
  );

  const refresh = useCallback(() => {
    if (effectiveUserId) {
      setRoutes(loadRoutesFromStorage(effectiveUserId));
    } else {
      setRoutes([]);
    }
  }, [effectiveUserId]);

  useEffect(() => {
    refresh();

    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ userId: string }>;
      if (customEvent.detail?.userId === effectiveUserId) {
        refresh();
      }
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === getStorageKey(effectiveUserId)) {
        refresh();
      }
    };

    window.addEventListener(EVENT_NAME, handleCustomEvent);
    window.addEventListener('storage', handleStorageEvent);
    return () => {
      window.removeEventListener(EVENT_NAME, handleCustomEvent);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [effectiveUserId, refresh]);

  /** 현재 결재선을 내 결재선으로 신규 등록 */
  const saveRoute = useCallback(
    async (name: string, steps: ApprovalStep[], description = '') => {
      if (!effectiveUserId) throw new Error('로그인된 사용자 정보가 없습니다.');
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error('결재선 이름을 입력해 주세요.');

      const validSteps = steps.filter((s) => s.approverId && s.approverId.trim() !== '');
      if (validSteps.length === 0) {
        throw new Error('결재선에 최소 1명 이상의 결재자가 필요합니다.');
      }

      const existing = loadRoutesFromStorage(effectiveUserId);
      const newRoute: MyApprovalRoute = {
        id: `my_route_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userId: effectiveUserId,
        name: trimmedName,
        description,
        steps: toMyRouteSteps(validSteps),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updated = [newRoute, ...existing];
      saveRoutesToStorage(effectiveUserId, updated);
      setRoutes(updated);
      return newRoute;
    },
    [effectiveUserId]
  );

  /** 내 결재선 삭제 */
  const removeRoute = useCallback(
    async (routeId: string) => {
      if (!effectiveUserId) return;
      const existing = loadRoutesFromStorage(effectiveUserId);
      const updated = existing.filter((r) => r.id !== routeId);
      saveRoutesToStorage(effectiveUserId, updated);
      setRoutes(updated);
    },
    [effectiveUserId]
  );

  /** 내 결재선 이름 변경 */
  const renameRoute = useCallback(
    async (routeId: string, newName: string) => {
      if (!effectiveUserId) return;
      const trimmed = newName.trim();
      if (!trimmed) throw new Error('결재선 이름을 입력해 주세요.');

      const existing = loadRoutesFromStorage(effectiveUserId);
      const updated = existing.map((r) =>
        r.id === routeId
          ? { ...r, name: trimmed, updatedAt: new Date().toISOString() }
          : r
      );
      saveRoutesToStorage(effectiveUserId, updated);
      setRoutes(updated);
    },
    [effectiveUserId]
  );

  return {
    routes,
    saveRoute,
    removeRoute,
    renameRoute,
    refresh,
  };
}
