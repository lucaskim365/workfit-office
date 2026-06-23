import { lazy, type ComponentType } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './shell/AppShell';
import PlaceholderScreen from '@/modules/common/PlaceholderScreen';
import { flattenScreens } from './routes';

const SCREENS = flattenScreens();
const HOME = '/ops/dashboard';

/**
 * 구현된 화면 레지스트리 (url → 컴포넌트).
 * 각 화면은 React.lazy 로 분리되어 별도 청크로 온디맨드 로드된다(번들 분할).
 * 미구현 화면은 PlaceholderScreen(eager) 사용.
 */
const SCREEN_COMPONENTS: Record<string, ComponentType> = {
  // 운영 현황
  '/ops/dashboard': lazy(() => import('@/modules/ops/dashboard/DashboardScreen')),
  // 기준 정보
  '/base/user': lazy(() => import('@/modules/base/user/UserScreen')),
  '/base/vendor': lazy(() => import('@/modules/base/vendor/VendorScreen')),
  '/base/item': lazy(() => import('@/modules/base/item/ItemScreen')),
  '/base/equip': lazy(() => import('@/modules/base/equip/EquipScreen')),
  '/base/defect': lazy(() => import('@/modules/base/defect/DefectScreen')),
  '/base/code': lazy(() => import('@/modules/base/code/CodeScreen')),
  '/base/process': lazy(() => import('@/modules/base/process/ProcessScreen')),
  '/base/auth': lazy(() => import('@/modules/base/auth/AuthScreen')),
  '/base/routing': lazy(() => import('@/modules/base/routing/RoutingScreen')),
  // 시스템 관리
  '/sys/user': lazy(() => import('@/modules/sys/user/UserAdminScreen')),
  '/sys/auth': lazy(() => import('@/modules/sys/auth/AuthMgmtScreen')),
  '/sys/menu': lazy(() => import('@/modules/sys/menu/MenuMgmtScreen')),
  '/sys/log': lazy(() => import('@/modules/sys/log/LogMgmtScreen')),
  '/sys/i18n': lazy(() => import('@/modules/sys/i18n/I18nScreen')),
  '/sys/calendar': lazy(() => import('@/modules/sys/calendar/CalendarScreen')),
  '/sys/env': lazy(() => import('@/modules/sys/env/EnvScreen')),
  '/sys/backup': lazy(() => import('@/modules/sys/backup/BackupScreen')),
  '/sys/interface': lazy(() => import('@/modules/sys/interface/InterfaceScreen')),
  // 생산 관리
  '/prod/plan': lazy(() => import('@/modules/prod/plan/ProdPlanScreen')),
  '/prod/wo': lazy(() => import('@/modules/prod/wo/WorkOrderScreen')),
  '/prod/wo-change': lazy(() => import('@/modules/prod/wo-change/WorkOrderEditScreen')),
  '/prod/schedule': lazy(() => import('@/modules/prod/schedule/ScheduleScreen')),
  '/prod/urgent': lazy(() => import('@/modules/prod/urgent/UrgentScreen')),
  '/prod/monitor': lazy(() => import('@/modules/prod/monitor/LineMonitorScreen')),
  '/prod/wip': lazy(() => import('@/modules/prod/wip/WipScreen')),
  '/prod/job': lazy(() => import('@/modules/prod/job/JobStartEndScreen')),
  '/prod/result': lazy(() => import('@/modules/prod/result/ProdResultScreen')),
  '/prod/material': lazy(() => import('@/modules/prod/material/MaterialLoadScreen')),
  '/prod/move': lazy(() => import('@/modules/prod/move/MoveScreen')),
  '/prod/defect': lazy(() => import('@/modules/prod/defect/ProdDefectScreen')),
  '/prod/material-request': lazy(() => import('@/modules/prod/material-request/MaterialReqScreen')),
};

export default function App() {
  return (
    <Routes>
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
        <Route path="*" element={<PlaceholderScreen />} />
      </Route>
    </Routes>
  );
}
