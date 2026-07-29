import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { onForegroundMessage } from '@/shared/lib/messaging';
import MobileLogin from './MobileLogin';
import MobileChatList from './MobileChatList';
import MobileChatThread from './MobileChatThread';

/**
 * 모바일 메신저 PWA 셸 — 데스크톱 AppShell 밖의 전체화면 라우트(/m).
 * 자체 로그인 게이트 + 기존 채팅 훅 재사용. iOS 는 "홈 화면에 추가" 시 앱처럼 실행/푸시.
 */
export default function MobileApp() {
  const { user, loading } = useAuth();

  // 포그라운드 수신 → 브라우저 알림(간단 표시).
  useEffect(() => {
    if (!user) return;
    void onForegroundMessage((p) => {
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(p.title, { body: p.body, icon: '/icons/icon-192.png' });
        }
      } catch {
        /* 무시 */
      }
    });
  }, [user]);

  return (
    <div className="fixed inset-0 z-[100] flex justify-center bg-black/10">
      <div className="flex h-full w-full max-w-[480px] flex-col overflow-hidden bg-panel shadow-xl">
        {loading ? (
          <div className="grid flex-1 place-items-center text-[13px] text-ink3">불러오는 중…</div>
        ) : !user ? (
          <MobileLogin />
        ) : (
          <Routes>
            <Route index element={<MobileChatList />} />
            <Route path="room/:roomId" element={<MobileChatThread />} />
            <Route path="*" element={<Navigate to="/m" replace />} />
          </Routes>
        )}
      </div>
    </div>
  );
}
