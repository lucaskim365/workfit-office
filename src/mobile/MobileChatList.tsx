import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { useChatRooms, useUnreadCounts } from '@/features/chat/useChatRooms';
import { useUsers } from '@/features/user/useUsers';
import { enablePushForUser } from '@/shared/lib/messaging';
import { getRoomDisplayName, fmtTime } from './chatUtils';
import { MobileActionSheet, type SheetAction } from './MobileActionSheet';

// 데스크톱 QuickDock 과 동일 localStorage 키 — 고정/숨김 상태를 두 화면이 공유.
const PIN_KEY = 'workfit-pinned-rooms';
const hiddenKeyOf = (me: string) => `workfit-hidden-rooms-${me}`;

function loadIds(key: string): string[] {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : [];
  } catch {
    return [];
  }
}

/** 모바일 채팅방 목록 — 검색·상대 이름·상단 고정·숨김·새 대화. */
export default function MobileChatList() {
  const { user, signOutUser } = useAuth();
  const nav = useNavigate();
  const me = user!.id;
  const { data: rooms = [] } = useChatRooms(me);
  const { data: unread = {} } = useUnreadCounts(me);
  const { data: users = [] } = useUsers();
  const [notice, setNotice] = useState('');
  const [q, setQ] = useState('');
  const [sheetRoom, setSheetRoom] = useState<{ id: string; type: string } | null>(null);

  const [pinnedIds, setPinnedIds] = useState<string[]>(() => loadIds(PIN_KEY));
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => loadIds(hiddenKeyOf(me)));

  const togglePin = (roomId: string) => {
    const next = pinnedIds.includes(roomId) ? pinnedIds.filter((id) => id !== roomId) : [...pinnedIds, roomId];
    setPinnedIds(next);
    localStorage.setItem(PIN_KEY, JSON.stringify(next));
  };

  const hideRoom = (roomId: string) => {
    if (hiddenIds.includes(roomId)) return;
    const next = [...hiddenIds, roomId];
    setHiddenIds(next);
    localStorage.setItem(hiddenKeyOf(me), JSON.stringify(next));
  };

  const enablePush = async () => {
    setNotice('알림 설정 중…');
    const res = await enablePushForUser(me);
    setNotice(res.ok ? '✅ 알림이 켜졌습니다.' : `⚠️ 알림 실패 — ${res.error}`);
    setTimeout(() => setNotice(''), 8000);
  };

  const kw = q.trim().toLowerCase();

  const sortedRooms = useMemo(() => {
    // 숨김 방은 미읽음이 있을 때만 다시 노출(데스크톱과 동일).
    const visible = rooms.filter((r) => !hiddenIds.includes(r.id) || (unread[r.id] ?? 0) > 0);
    const named = visible.map((r) => ({ ...r, displayName: getRoomDisplayName(r, me, users) }));
    const filtered = kw ? named.filter((r) => r.displayName.toLowerCase().includes(kw)) : named;
    return [...filtered].sort((a, b) => {
      const ap = pinnedIds.includes(a.id);
      const bp = pinnedIds.includes(b.id);
      if (ap && !bp) return -1;
      if (!ap && bp) return 1;
      const at = a.lastMessage?.at ? new Date(a.lastMessage.at).getTime() : 0;
      const bt = b.lastMessage?.at ? new Date(b.lastMessage.at).getTime() : 0;
      return bt - at;
    });
  }, [rooms, hiddenIds, unread, users, me, kw, pinnedIds]);

  const sheetActions: SheetAction[] = sheetRoom
    ? [
        { label: pinnedIds.includes(sheetRoom.id) ? '📌 고정 해제' : '📌 상단 고정', onClick: () => togglePin(sheetRoom.id) },
        ...(sheetRoom.type === 'direct'
          ? [{ label: '채팅방 삭제', danger: true, onClick: () => hideRoom(sheetRoom.id) }]
          : []),
      ]
    : [];

  return (
    <div className="flex h-full flex-col" style={{ background: '#faf6f0' }}>
      <header className="flex items-center gap-2 px-4 py-3 text-white" style={{ background: '#101830' }}>
        <img src="/icons/icon-192.png" alt="" className="h-6 w-6 rounded" />
        <span className="text-[15px] font-bold">워크핏 메신저</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={enablePush} title="알림 켜기" className="grid h-8 w-8 place-items-center rounded-lg text-[15px] hover:bg-white/10">🔔</button>
          <button onClick={() => void signOutUser()} title="로그아웃" className="grid h-8 w-8 place-items-center rounded-lg text-[15px] hover:bg-white/10">⎋</button>
        </div>
      </header>

      {notice && <div className="px-4 py-2 text-[11.5px] text-navy" style={{ background: '#c7ecc5' }}>{notice}</div>}

      {/* 검색 + 새 대화 */}
      <div className="flex items-center gap-2 border-b border-black/5 bg-white px-4 py-2.5">
        <div className="flex flex-1 items-center gap-2 rounded-full bg-black/5 px-3.5 py-2">
          <span className="text-[12px] text-ink3">🔍</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이름, 채팅방 검색"
            className="w-full bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink3"
          />
        </div>
        <button onClick={() => nav('/m/new')} title="새 대화" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[20px] leading-none text-white" style={{ background: '#e6960c' }}>＋</button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {sortedRooms.length === 0 && (
          <div className="py-16 text-center text-[12px] text-ink3">{kw ? '검색 결과가 없습니다.' : '대화방이 없습니다.'}</div>
        )}
        {sortedRooms.map((r) => {
          const n = unread[r.id] ?? 0;
          const isPinned = pinnedIds.includes(r.id);
          return (
            <div
              key={r.id}
              className={`flex items-center border-b border-black/5 bg-white active:bg-black/5 ${isPinned ? 'bg-[#faf6f0]' : ''}`}
            >
              <button
                onClick={() => nav(`/m/room/${r.id}`)}
                className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left"
              >
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[15px] font-bold text-white"
                  style={{ background: r.color || '#101830' }}
                >
                  {r.type === 'direct' ? r.displayName[0] : r.type === 'group' ? '👥' : (r.displayName[0] ?? '#')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[14px] font-bold text-ink">
                      {r.displayName}
                      {isPinned && <span className="ml-1 text-[10px]">📌</span>}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-ink3">{fmtTime(r.lastMessage?.at)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] text-ink3">{r.lastMessage?.text ?? '대화를 시작하세요'}</span>
                    {n > 0 && (
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: '#e0483b' }}>{n}</span>
                    )}
                  </span>
                </span>
              </button>
              <button
                onClick={() => setSheetRoom({ id: r.id, type: r.type })}
                title="더보기"
                className="grid h-full shrink-0 place-items-center px-3 text-[16px] text-ink3 active:bg-black/5"
              >
                ⋮
              </button>
            </div>
          );
        })}
      </div>

      {sheetRoom && <MobileActionSheet actions={sheetActions} onClose={() => setSheetRoom(null)} />}
    </div>
  );
}
