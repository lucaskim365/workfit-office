import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { useChatRooms, useUnreadCounts } from '@/features/chat/useChatRooms';
import { enablePushForUser } from '@/shared/lib/messaging';

/** 모바일 채팅방 목록. */
export default function MobileChatList() {
  const { user, signOutUser } = useAuth();
  const nav = useNavigate();
  const { data: rooms = [] } = useChatRooms(user!.id);
  const { data: unread = {} } = useUnreadCounts(user!.id);
  const [notice, setNotice] = useState('');

  const sorted = [...rooms].sort((a, b) =>
    (b.lastMessage?.at ?? '').localeCompare(a.lastMessage?.at ?? ''),
  );

  const enablePush = async () => {
    setNotice('알림 설정 중…');
    const res = await enablePushForUser(user!.id);
    setNotice(res.ok ? '✅ 알림이 켜졌습니다.' : `⚠️ 알림 실패 — ${res.error}`);
    setTimeout(() => setNotice(''), 8000);
  };

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

      <div className="min-h-0 flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="py-16 text-center text-[12px] text-ink3">대화방이 없습니다.</div>
        )}
        {sorted.map((r) => {
          const n = unread[r.id] ?? 0;
          return (
            <button
              key={r.id}
              onClick={() => nav(`/m/room/${r.id}`)}
              className="flex w-full items-center gap-3 border-b border-black/5 bg-white px-4 py-3 text-left active:bg-black/5"
            >
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[15px] font-bold text-white"
                style={{ background: r.color || '#101830' }}
              >
                {r.name?.[0] ?? '#'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold text-ink">{r.name}</span>
                <span className="block truncate text-[12px] text-ink3">{r.lastMessage?.text ?? '대화를 시작하세요'}</span>
              </span>
              {n > 0 && (
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: '#e0483b' }}>
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
