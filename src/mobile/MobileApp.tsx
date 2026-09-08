import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { onForegroundMessage } from '@/shared/lib/messaging';
import MobileLogin from './MobileLogin';
import MobileChatList from './MobileChatList';
import MobileChatThread from './MobileChatThread';
import MobileNewRoom from './MobileNewRoom';
import MobileApprovalList from './MobileApprovalList';
import MobileApprovalDetail from './MobileApprovalDetail';
import IosPwaGuideModal, { checkDeviceEnvironment, isGuideDismissedToday } from './IosPwaGuideModal';

/**
 * 모바일 메신저 PWA 셸 — 데스크톱 AppShell 밖의 전체화면 라우트(/m).
 * 자체 로그인 게이트 + 기존 채팅 훅 재사용. iOS 는 "홈 화면에 추가" 시 앱처럼 실행/푸시.
 */
export default function MobileApp() {
  const { user, loading } = useAuth();
  const [showGuide, setShowGuide] = useState(false);

  // /m 접속 시: 홈 화면에 아직 추가하지 않은 브라우저 상태이고 오늘 닫은 적이 없다면 가이드 모달 자동 노출
  useEffect(() => {
    const env = checkDeviceEnvironment();
    const isDismissed = isGuideDismissedToday();
    if (!env.isStandalone && !isDismissed) {
      setShowGuide(true);
    }
  }, []);

  // 외부 컴포넌트(MobileLogin, MobileChatList 등)에서 언제든 가이드 모달을 열 수 있도록 커스텀 이벤트 지원
  useEffect(() => {
    const handleOpen = () => setShowGuide(true);
    window.addEventListener('open-pwa-guide', handleOpen);
    return () => window.removeEventListener('open-pwa-guide', handleOpen);
  }, []);

  // 포그라운드 수신 → 알림 표시. 서비스워커 showNotification 을 쓰면 iOS PWA 에서도
  // 표시되고, 탭 시 라우팅은 SW 의 notificationclick(결재/채팅 딥링크)이 처리한다.
  useEffect(() => {
    if (!user) return;
    void onForegroundMessage(async (p) => {
      try {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
        const isChat = Boolean(p.roomId || p.type === '메신저');
        const body = isChat ? '새로운 메시지가 도착했습니다.' : p.body;
        const data = { type: p.type, roomId: p.roomId, docId: p.docId, linkUrl: p.linkUrl };
        const reg = await navigator.serviceWorker?.getRegistration();
        if (reg) {
          await reg.showNotification(p.title, {
            body,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            data,
            tag: p.roomId || p.docId || undefined,
          });
        } else {
          // 폴백(구형 브라우저): 페이지 컨텍스트 알림.
          new Notification(p.title, { body, icon: '/icons/icon-192.png' });
        }
      } catch {
        /* iOS 등 미지원 환경 무시 */
      }
    });
  }, [user]);

  return (
    <div className="fixed inset-0 z-[100] flex justify-center bg-black/10">
      <div
        className="flex h-full w-full max-w-[480px] flex-col overflow-hidden shadow-xl"
        style={{ background: '#101830', paddingTop: 'env(safe-area-inset-top)' }}
      >
        {loading ? (
          <div className="grid flex-1 place-items-center text-[13px] text-ink3">불러오는 중…</div>
        ) : !user ? (
          <MobileLogin />
        ) : (
          <Routes>
            <Route index element={<MobileChatList />} />
            <Route path="new" element={<MobileNewRoom />} />
            <Route path="room/:roomId" element={<MobileChatThread />} />
            <Route path="approval" element={<MobileApprovalList />} />
            <Route path="approval/:id" element={<MobileApprovalDetail />} />
            <Route path="*" element={<Navigate to="/m" replace />} />
          </Routes>
        )}
      </div>

      <IosPwaGuideModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        onDismissToday={() => setShowGuide(false)}
      />
    </div>
  );
}
