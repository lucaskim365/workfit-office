import { lazy as reactLazy, useEffect, type ComponentType } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import AppShell from './shell/AppShell';
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
      return new Promise<{ default: T }>(() => {});
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
const GwLeave = lazy(() => import('@/modules/gw/leave/LeaveScreen'));
const GwComingSoon = lazy(() => import('@/modules/gw/common/GwComingSoon'));
const ProfileScreen = lazy(() => import('@/modules/profile/ProfileScreen'));

const SCREEN_COMPONENTS: Record<string, ComponentType> = {
  // 경영 현황 (로그인 후 랜딩) — 성과 관리 섹션 포함(통합)
  '/exec': lazy(() => import('@/modules/exec/ExecDashboardScreen')),
  // 운영 현황
  '/ops/dashboard': lazy(() => import('@/modules/ops/dashboard/DashboardScreen')),
  '/ops/line': lazy(() => import('@/modules/ops/line/LineStatusScreen')),
  // 기준 정보
  '/base/user': lazy(() => import('@/modules/base/user/UserScreen')),
  '/base/department': lazy(() => import('@/modules/base/department/DepartmentScreen')),
  '/base/position': lazy(() => import('@/modules/base/position/PositionScreen')),
  '/base/approval-rule': lazy(() => import('@/modules/base/approvalRule/ApprovalRuleScreen')),
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
  '/sales/shipment': lazy(() => import('@/modules/sales/shipment/SalesShipmentScreen')),
  '/sales/revenue': lazy(() => import('@/modules/sales/revenue/SalesRevenueScreen')),
  '/sales/tax-invoice': lazy(() => import('@/modules/sales/tax-invoice/SalesTaxInvoiceScreen')),
  '/sales/collection': lazy(() => import('@/modules/sales/collection/SalesCollectionScreen')),
  '/sales/ar': lazy(() => import('@/modules/sales/ar/SalesArScreen')),
  '/sales/credit': lazy(() => import('@/modules/sales/credit/SalesCreditScreen')),
  '/sales/rev-period': lazy(() => import('@/modules/sales/rev-period/SalesRevPeriodScreen')),
  '/sales/item-rank': lazy(() => import('@/modules/sales/item-rank/SalesItemRankScreen')),
  '/sales/kpi': lazy(() => import('@/modules/sales/kpi/SalesKpiScreen')),

  '/report/catalog': lazy(() => import('@/modules/report/catalog/ReportCatalogScreen')),
  '/report/prod-daily': lazy(() => import('@/modules/report/prod-daily/ReportProdDailyScreen')),
  '/report/prod-pva': lazy(() => import('@/modules/report/prod-pva/ReportProdPvaScreen')),
  '/report/wo-progress': lazy(() => import('@/modules/report/wo-progress/ReportWoProgressScreen')),
  '/report/line-output': lazy(() => import('@/modules/report/line-output/ReportLineOutputScreen')),
  '/report/prod-trend': lazy(() => import('@/modules/report/prod-trend/ReportProdTrendScreen')),
  '/report/insp-pass': lazy(() => import('@/modules/report/insp-pass/ReportInspPassScreen')),
  '/report/defect-pareto': lazy(() => import('@/modules/report/defect-pareto/ReportDefectParetoScreen')),
  '/report/cpk': lazy(() => import('@/modules/report/cpk/ReportCpkScreen')),
  '/report/vendor-score': lazy(() => import('@/modules/report/vendor-score/ReportVendorScoreScreen')),
  '/report/coa': lazy(() => import('@/modules/report/coa/ReportCoaScreen')),
  '/report/oee': lazy(() => import('@/modules/report/oee/ReportOeeScreen')),
  '/report/util': lazy(() => import('@/modules/report/util/ReportUtilScreen')),
  '/report/mtbf': lazy(() => import('@/modules/report/mtbf/ReportMtbfScreen')),
  '/report/maint-cost': lazy(() => import('@/modules/report/maint-cost/ReportMaintCostScreen')),
  '/report/stock-ledger': lazy(() => import('@/modules/report/stock-ledger/ReportStockLedgerScreen')),
  '/report/stock-value': lazy(() => import('@/modules/report/stock-value/ReportStockValueScreen')),
  '/report/turnover': lazy(() => import('@/modules/report/turnover/ReportTurnoverScreen')),
  '/report/safety-order': lazy(() => import('@/modules/report/safety-order/ReportSafetyOrderScreen')),
  '/report/subcon-ledger': lazy(() => import('@/modules/report/subcon-ledger/ReportSubconLedgerScreen')),
  '/report/cost': lazy(() => import('@/modules/report/cost/ReportCostScreen')),
  '/report/yield': lazy(() => import('@/modules/report/yield/ReportYieldScreen')),
  '/report/leadtime': lazy(() => import('@/modules/report/leadtime/ReportLeadtimeScreen')),
  '/report/energy': lazy(() => import('@/modules/report/energy/ReportEnergyScreen')),
  '/report/trace': lazy(() => import('@/modules/report/trace/ReportTraceScreen')),
  '/report/dhr': lazy(() => import('@/modules/report/dhr/ReportDhrScreen')),
  '/report/audit': lazy(() => import('@/modules/report/audit/ReportAuditScreen')),
  '/report/voc': lazy(() => import('@/modules/report/voc/ReportVocScreen')),
  '/report/kpi': lazy(() => import('@/modules/report/kpi/ReportKpiScreen')),
  '/report/period': lazy(() => import('@/modules/report/period/ReportPeriodScreen')),
  '/report/scorecard': lazy(() => import('@/modules/report/scorecard/ReportScorecardScreen')),
};

import { useAuth } from '@/app/auth/AuthProvider';
import { useNotifications } from '@/features/notification/useNotifications';

export default function App() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useNotifications(user?.id);

  // 초기 비밀번호(mes1234)를 사용하는 계정 감지 시 비밀번호 변경 유도 및 프로필 화면 이동
  useEffect(() => {
    const defaultHash = '06c4371239ef075e099d6d84de05e43ad7f649fc75350eac00ce55bc859cf218';
    if (user && (user.password === 'mes1234' || user.password === defaultHash)) {
      window.alert('보안을 위해 초기 비밀번호(mes1234)를 반드시 변경해 주세요.');
      navigate('/profile');
    }
  }, [user, navigate]);

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
        {/* 그룹웨어(도크 전용) — 조직도 실화면 + 나머지 준비중 랜딩 */}
        <Route path="/gw/orgchart" element={<GwOrgChart />} />
        <Route path="/gw/approval" element={<GwApproval />} />
        <Route path="/gw/leave" element={<GwLeave />} />
        <Route path="/gw/:app" element={<GwComingSoon />} />
        {/* 개인 프로필 설정 */}
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="*" element={<PlaceholderScreen />} />
      </Route>
    </Routes>
  );
}
