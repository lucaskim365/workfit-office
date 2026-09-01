import { lazy as reactLazy, useEffect, type ComponentType } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import AppShell from './shell/AppShell';
import MobileApp from '@/mobile/MobileApp';
import PlaceholderScreen from '@/modules/common/PlaceholderScreen';
import { flattenScreens } from './routes';

/**
 * Custom lazy loading wrapper that catches chunk loading failures
 * (usually caused by file hash mismatch after a new Vercel deployment)
 * and automatically triggers a window reload to fetch the latest assets.
 */
function lazy<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return reactLazy(async () => {
    try {
      return await factory();
    } catch (error) {
      console.error('Failed to load component chunk, reloading page...', error);
      window.location.reload();
      // Return a pending promise to prevent rendering broken components during reload
      return new Promise<{ default: T }>(() => { });
    }
  });
}

const SCREENS = flattenScreens();
const HOME = '/exec';

/**
 * 구현된 화면 레지스트리 (url → 컴포넌트).
 * 각 화면은 React.lazy 로 분리되어 별도 청크로 온디맨드 로드된다(번들 분할).
 * 미구현 화면은 PlaceholderScreen(eager) 사용.
 */
// 그룹웨어(도크 전용, menu-tree 밖) — 명시적 라우트로 등록.
const GwOrgChart = lazy(() => import('@/modules/gw/orgchart/OrgChartScreen'));
const GwApproval = lazy(() => import('@/modules/gw/approval/ApprovalScreen'));
const GwApprovalDraft = lazy(() => import('@/modules/gw/approval/ApprovalDraftScreen'));
const GwLeave = lazy(() => import('@/modules/gw/leave/LeaveScreen'));
const GwBoard = lazy(() => import('@/modules/gw/board/BoardScreen'));
const GwDocument = lazy(() => import('@/modules/gw/document/DocumentScreen'));
const GwCommunity = lazy(() => import('@/modules/gw/community/CommunityScreen'));
const GwEmployee = lazy(() => import('@/modules/gw/employee/EmployeeScreen'));
const GwCalendar = lazy(() => import('@/modules/gw/calendar/CalendarScreen'));
const GwResource = lazy(() => import('@/modules/gw/resource/ResourceScreen'));
const GwTask = lazy(() => import('@/modules/gw/task/TaskScreen'));
const GwWorkPlan = lazy(() => import('@/modules/gw/task/WorkPlanScreen'));
const GwSurvey = lazy(() => import('@/modules/gw/survey/SurveyScreen'));
const GwMail = lazy(() => import('@/modules/gw/mail/MailScreen'));
const GwCommute = lazy(() => import('@/modules/gw/commute/CommuteScreen'));
const GwComingSoon = lazy(() => import('@/modules/gw/common/GwComingSoon'));
const ProfileScreen = lazy(() => import('@/modules/profile/ProfileScreen'));
const SettingsScreen = lazy(() => import('@/modules/settings/SettingsScreen'));

const SCREEN_COMPONENTS: Record<string, ComponentType> = {
  // 경영 현황 (로그인 후 랜딩) — 성과 관리 섹션 포함(통합)
  '/exec': lazy(() => import('@/modules/exec/ExecDashboardScreen')),
  // 운영 현황
  '/ops/dashboard': lazy(() => import('@/modules/ops/dashboard/DashboardScreen')),
  '/ops/line': lazy(() => import('@/modules/ops/line/LineStatusScreen')),
  // 기준 정보
  '/base/user': lazy(() => import('@/modules/base/user/UserScreen')),
  '/sys/user': lazy(() => import('@/modules/base/user/UserScreen')),
  '/base/department': lazy(() => import('@/modules/base/department/DepartmentScreen')),
  '/base/position': lazy(() => import('@/modules/base/position/PositionScreen')),

  '/base/approval-process': lazy(() => import('@/modules/base/approvalProcess/ApprovalProcessScreen')),
  '/base/approval-form': lazy(() => import('@/modules/base/approvalForm/ApprovalFormScreen')),
  '/base/approval-monitor': lazy(() => import('@/modules/base/approvalMonitor/ApprovalMonitorScreen')),
  '/base/vendor': lazy(() => import('@/modules/base/vendor/VendorScreen')),
  '/base/code': lazy(() => import('@/modules/base/code/CodeScreen')),
  '/base/auth': lazy(() => import('@/modules/base/auth/AuthScreen')),
  // 시스템 관리
  '/sys/company': lazy(() => import('@/modules/sys/company/CompanyScreen')),
  '/sys/menu': lazy(() => import('@/modules/sys/menu/MenuMgmtScreen')),
  '/sys/log': lazy(() => import('@/modules/sys/log/LogMgmtScreen')),
  '/sys/i18n': lazy(() => import('@/modules/sys/i18n/I18nScreen')),
  '/sys/env': lazy(() => import('@/modules/sys/env/EnvScreen')),
  '/sys/backup': lazy(() => import('@/modules/sys/backup/BackupScreen')),
  '/sys/interface': lazy(() => import('@/modules/sys/interface/InterfaceScreen')),
  '/sales/quote': lazy(() => import('@/modules/sales/quote/SalesQuoteScreen')),
  '/sales/order': lazy(() => import('@/modules/sales/order/SalesOrderScreen')),
  '/sales/order-status': lazy(() => import('@/modules/sales/order-status/SalesOrderStatusScreen')),
};

import { useAuth } from '@/app/auth/AuthProvider';
import { useNotifications } from '@/features/notification/useNotifications';
import { syncPushToken, onForegroundMessage } from '@/shared/lib/messaging';

export default function App() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useNotifications(user?.id);
  const isMobilePwa = location.pathname.startsWith('/m');

  // 로그인 시 FCM 토큰 동기화(권한 허용된 기기 한정, 팝업 없음).
  // 데스크톱/모바일 공통 루트라 채팅을 열지 않는 결재 사용자도 푸시를 받는다.
  useEffect(() => {
    if (user?.id) void syncPushToken(user.id);
  }, [user?.id]);

  // 데스크톱 포그라운드(앱 활성) 수신 → OS 알림 표시. 웹은 포그라운드 메시지가 onMessage 로만
  // 들어오고 자동 배너가 없으므로 SW 등록으로 직접 표시한다(백그라운드와 동일한 Workfit 로고·유지).
  // 모바일 PWA(/m)는 MobileApp 이 처리하므로 여기서는 제외(중복 방지).
  useEffect(() => {
    if (!user?.id || isMobilePwa) return;
    void onForegroundMessage(async (p) => {
      try {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
        const data = { type: p.type, roomId: p.roomId, docId: p.docId, linkUrl: p.linkUrl };
        const reg = await navigator.serviceWorker?.getRegistration();
        if (reg) {
          await reg.showNotification(p.title, {
            body: p.body,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            data,
            tag: p.roomId || p.docId || undefined,
            requireInteraction: true,
          });
        } else {
          new Notification(p.title, { body: p.body, icon: '/icons/icon-192.png' });
        }
      } catch {
        /* 미지원 환경(iOS 비PWA 등) 무시 */
      }
    });
  }, [user?.id, isMobilePwa]);

  // 로컬 스토리지에 저장된 폰트 크기 설정을 감지하여 앱 전체(HTML/Body)에 바인딩.
  // 단, 모바일 PWA(/m)는 자체 px 디자인이므로 데스크톱 확대(zoom, 기본 1.1875)를 적용하면
  // 아이폰 화면보다 크게 렌더되어 축소해야 하는 문제가 생긴다 → PWA 는 항상 1(확대 없음).
  useEffect(() => {
    if (isMobilePwa) {
      document.documentElement.style.setProperty('--font-scale', '1');
      return;
    }
    const savedScale = localStorage.getItem('custom_font_scale') ?? '1.1875';
    document.documentElement.style.setProperty('--font-scale', savedScale);
  }, [isMobilePwa]);

  // 초기 비밀번호(mes1234)를 사용하는 계정 감지 시 비밀번호 변경 유도 및 프로필 화면 이동.
  // 단, 모바일 PWA(/m)는 자체 흐름을 쓰므로 이 데스크톱 리다이렉트를 건너뛴다.
  useEffect(() => {
    if (isMobilePwa) return;
    const defaultHash = '06c4371239ef075e099d6d84de05e43ad7f649fc75350eac00ce55bc859cf218';
    if (user && (user.password === 'mes1234' || user.password === defaultHash)) {
      window.alert('보안을 위해 초기 비밀번호(mes1234)를 반드시 변경해 주세요.');
      navigate('/profile');
    }
  }, [user, navigate, isMobilePwa]);

  return (
    <Routes>
      {/* 모바일 메신저 PWA — 데스크톱 셸 밖의 전체화면 라우트 */}
      <Route path="/m/*" element={<MobileApp />} />
      <Route element={<AppShell />}>
        <Route index element={<Navigate to={HOME} replace />} />
        {SCREENS.map((screen) => {
          const Impl = SCREEN_COMPONENTS[screen.url];
          return (
            <Route
              key={screen.id}
              path={screen.url}
              element={Impl ? <Impl /> : <PlaceholderScreen screen={screen} />}
            />
          );
        })}
        {/* 그룹웨어(도크 전용) — 조직도 실화면 + 전자결재 독립 라우트 */}
        <Route path="/gw/orgchart" element={<GwOrgChart />} />
        <Route path="/gw/approval/new" element={<GwApprovalDraft />} />
        <Route path="/gw/approval/edit/:id" element={<GwApprovalDraft />} />
        <Route path="/gw/approval" element={<GwApproval />} />
        <Route path="/gw/leave" element={<GwLeave />} />
        <Route path="/gw/board" element={<GwBoard />} />
        <Route path="/gw/document" element={<GwDocument />} />
        <Route path="/gw/community" element={<GwCommunity />} />
        <Route path="/gw/employee" element={<GwEmployee />} />
        <Route path="/gw/calendar" element={<GwCalendar />} />
        <Route path="/gw/resource" element={<GwResource />} />
        <Route path="/gw/task" element={<GwTask />} />
        <Route path="/gw/work-plan" element={<GwWorkPlan />} />
        <Route path="/gw/survey" element={<GwSurvey />} />
        <Route path="/gw/mail" element={<GwMail />} />
        <Route path="/gw/commute" element={<GwCommute />} />
        <Route path="/gw/:app" element={<GwComingSoon />} />
        {/* 개인 프로필 설정 */}
        <Route path="/profile" element={<ProfileScreen />} />
        {/* 환경설정 */}
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<PlaceholderScreen />} />
      </Route >
    </Routes >
  );
}
