import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import {
  type UserPresence,
  type UserPresenceStatus,
  USER_PRESENCE_META,
} from '@/domain/userPresence/schema';

const STORAGE_KEY = 'workfit:user_presence_map';
const EVENT_NAME = 'workfit:presence_change';

function readPresenceMap(): Record<string, UserPresence> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, UserPresence>;
    }
    return {};
  } catch {
    return {};
  }
}

function writePresenceMap(map: Record<string, UserPresence>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: map }));
  } catch {
    // ignore
  }
}

/**
 * 전사 사용자들의 현재 실시간 상태 맵 훅
 */
export function useAllUserPresences(): Record<string, UserPresence> {
  const [presenceMap, setPresenceMap] = useState<Record<string, UserPresence>>(() => readPresenceMap());

  useEffect(() => {
    const handleUpdate = () => {
      setPresenceMap(readPresenceMap());
    };

    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  return presenceMap;
}

/**
 * 로그인한 사용자의 현재 실시간 상태 관리 훅
 */
export function useMyPresence() {
  const { user } = useAuth();
  const userId = user?.id ?? 'guest';
  const presences = useAllUserPresences();

  const myPresence: UserPresence = presences[userId] ?? {
    userId,
    status: 'ONLINE',
    message: '',
    updatedAt: new Date().toISOString(),
  };

  const updatePresence = useCallback(
    (status: UserPresenceStatus, message?: string) => {
      const currentMap = readPresenceMap();
      const existing = currentMap[userId] ?? {
        userId,
        status: 'ONLINE',
        message: '',
        updatedAt: new Date().toISOString(),
      };

      const updated: UserPresence = {
        userId,
        status,
        message: message !== undefined ? message.trim() : existing.message,
        updatedAt: new Date().toISOString(),
      };

      currentMap[userId] = updated;
      writePresenceMap(currentMap);
    },
    [userId],
  );

  const meta = USER_PRESENCE_META[myPresence.status] ?? USER_PRESENCE_META.ONLINE;

  return {
    presence: myPresence,
    meta,
    updatePresence,
  };
}

/**
 * 특정 사용자 ID의 실시간 상태를 조회하는 헬퍼 훅
 */
export function useUserPresence(userId?: string | null) {
  const presences = useAllUserPresences();
  if (!userId) return null;
  const presence = presences[userId];
  if (!presence) return null;
  return {
    presence,
    meta: USER_PRESENCE_META[presence.status] ?? USER_PRESENCE_META.ONLINE,
  };
}
