import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import {
  type UserPresence,
  type UserPresenceStatus,
  USER_PRESENCE_META,
  USER_PRESENCE_STATUSES,
} from '@/domain/userPresence/schema';
import {
  client as appwriteClient,
  databases as appwriteDatabases,
  APPWRITE_DATABASE_ID,
  isAppwriteConfigured,
  safeDocId,
  Query,
} from '@/shared/lib/appwrite';

const COLLECTION_ID = 'user_presences';
const STORAGE_KEY = 'workfit:user_presence_map';
const EVENT_NAME = 'workfit:presence_change';

function readLocalPresenceMap(): Record<string, UserPresence> {
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

function writeLocalPresenceMap(map: Record<string, UserPresence>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: map }));
  } catch {
    // ignore
  }
}

function parsePresenceDoc(doc: Record<string, unknown>): UserPresence {
  const rawStatus = String(doc.status || '');
  const status = (USER_PRESENCE_STATUSES.includes(rawStatus as UserPresenceStatus)
    ? rawStatus
    : 'OFFLINE') as UserPresenceStatus;

  return {
    userId: String(doc.userId || doc.$id || ''),
    status,
    message: String(doc.message || ''),
    updatedAt: String(doc.updatedAt || doc.$updatedAt || new Date().toISOString()),
  };
}

/**
 * 전사 사용자들의 현재 실시간 상태 맵 훅 (Appwrite Realtime + 로컬 캐시 연동)
 */
export function useAllUserPresences(): Record<string, UserPresence> {
  const [presenceMap, setPresenceMap] = useState<Record<string, UserPresence>>(() => readLocalPresenceMap());

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    async function initAppwrite() {
      if (!isAppwriteConfigured || !appwriteClient || !appwriteDatabases || !APPWRITE_DATABASE_ID) {
        return;
      }

      try {
        // 1. Appwrite에서 기존 사용자 근무 상태 전체 목록 조회 (전사 인원 상한 500명)
        const res = await appwriteDatabases.listDocuments(APPWRITE_DATABASE_ID, COLLECTION_ID, [
          Query.limit(500),
        ]);
        const remoteMap: Record<string, UserPresence> = {};
        res.documents.forEach((doc) => {
          const p = parsePresenceDoc(doc as Record<string, unknown>);
          if (p.userId) {
            remoteMap[p.userId] = p;
          }
        });

        if (Object.keys(remoteMap).length > 0) {
          setPresenceMap((prev) => {
            const merged = { ...prev, ...remoteMap };
            writeLocalPresenceMap(merged);
            return merged;
          });
        }

        // 2. Appwrite Realtime WebSocket 채널 구독 (팀원 상태 변경 실시간 브로드캐스트)
        const channel = `databases.${APPWRITE_DATABASE_ID}.collections.${COLLECTION_ID}.documents`;
        unsubscribe = appwriteClient.subscribe(channel, (response) => {
          const payload = response.payload as Record<string, unknown>;
          if (payload) {
            const p = parsePresenceDoc(payload);
            if (p.userId) {
              setPresenceMap((prev) => {
                const next = { ...prev, [p.userId]: p };
                writeLocalPresenceMap(next);
                return next;
              });
            }
          }
        });
      } catch (err) {
        console.warn('[userPresence] Appwrite realtime/fetch not available, fallback to local storage:', err);
      }
    }

    void initAppwrite();

    const handleLocalChange = () => {
      setPresenceMap(readLocalPresenceMap());
    };

    window.addEventListener(EVENT_NAME, handleLocalChange);
    window.addEventListener('storage', handleLocalChange);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      window.removeEventListener(EVENT_NAME, handleLocalChange);
      window.removeEventListener('storage', handleLocalChange);
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
    async (status: UserPresenceStatus, message?: string) => {
      const currentMap = readLocalPresenceMap();
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

      // 1. 즉시 로컬 캐시 반영 (반응성 0ms)
      currentMap[userId] = updated;
      writeLocalPresenceMap(currentMap);

      // 2. Appwrite 컬렉션 실시간 동기화 (모바일 앱과 공유)
      if (isAppwriteConfigured && appwriteDatabases && APPWRITE_DATABASE_ID) {
        const docId = safeDocId(userId);
        const payload = {
          userId: updated.userId,
          status: updated.status,
          message: updated.message,
          updatedAt: updated.updatedAt,
        };

        try {
          await appwriteDatabases.updateDocument(
            APPWRITE_DATABASE_ID,
            COLLECTION_ID,
            docId,
            payload,
          );
        } catch (err: unknown) {
          // 문서가 존재하지 않는 경우 신규 생성 시도
          try {
            await appwriteDatabases.createDocument(
              APPWRITE_DATABASE_ID,
              COLLECTION_ID,
              docId,
              payload,
            );
          } catch (createErr) {
            console.warn('[userPresence] Appwrite save failed:', createErr);
          }
        }
      }
    },
    [userId],
  );

  // 최초 1회: DB/로컬에 상태 기록이 전혀 없는 신규 사용자일 때만 기본 'ONLINE' 행 생성
  useEffect(() => {
    if (!user || user.status !== '사용' || userId === 'guest') return;

    const currentMap = readLocalPresenceMap();
    if (!currentMap[userId]) {
      void updatePresence('ONLINE', '');
    }
  }, [user, userId, updatePresence]);

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
  const presence = presences[userId] ?? {
    userId,
    status: 'OFFLINE',
    message: '',
    updatedAt: '',
  };
  return {
    presence,
    meta: USER_PRESENCE_META[presence.status] ?? USER_PRESENCE_META.OFFLINE,
  };
}

