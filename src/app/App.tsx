import { lazy as reactLazy, type ComponentType } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
  '/base/vendor': lazy(() => import('@/modules/base/vendor/VendorScreen')),
  '/base/item': lazy(() => import('@/modules/base/item/ItemScreen')),
  '/base/equip': lazy(() => import('@/modules/base/equip/EquipScreen')),
  '/base/defect': lazy(() => import('@/modules/base/defect/DefectScreen')),
  '/base/code': lazy(() => import('@/modules/base/code/CodeScreen')),
  '/base/process': lazy(() => import('@/modules/base/process/ProcessScreen')),
  '/base/auth': lazy(() => import('@/modules/base/auth/AuthScreen')),
  '/base/routing': lazy(() => import('@/modules/base/routing/RoutingScreen')),
  // 시스템 관리
  '/sys/company': lazy(() => import('@/modules/sys/company/CompanyScreen')),
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
  '/prod/trace': lazy(() => import('@/modules/prod/trace/LotTraceScreen')),
  '/prod/downtime': lazy(() => import('@/modules/prod/downtime/DowntimeScreen')),
  '/prod/oee': lazy(() => import('@/modules/prod/oee/OeeScreen')),
  '/prod/closing': lazy(() => import('@/modules/prod/closing/ProdClosingScreen')),
  '/prod/plan-vs-actual': lazy(() => import('@/modules/prod/plan-vs-actual/PlanVsActualScreen')),
  '/prod/leadtime': lazy(() => import('@/modules/prod/leadtime/LeadtimeScreen')),
  '/prod/subcon-order': lazy(() => import('@/modules/prod/subcon-order/SubconOrderScreen')),
  '/prod/subcon-issue': lazy(() => import('@/modules/prod/subcon-issue/SubconIssueScreen')),
  '/prod/subcon-receipt': lazy(() => import('@/modules/prod/subcon-receipt/SubconReceiptScreen')),
  '/prod/bom': lazy(() => import('@/modules/prod/bom/BomViewScreen')),
  '/prod/routing': lazy(() => import('@/modules/prod/routing/RoutingMasterScreen')),
  '/prod/workcenter': lazy(() => import('@/modules/prod/workcenter/WorkcenterMapScreen')),
  '/prod/shift': lazy(() => import('@/modules/prod/shift/ShiftMgmtScreen')),
  // 설비 관리 — 기준정보
  '/equip/master': lazy(() => import('@/modules/equip/master/EquipMasterScreen')),
  '/equip/spec': lazy(() => import('@/modules/equip/spec/EquipSpecScreen')),
  '/equip/bom': lazy(() => import('@/modules/equip/bom/EquipBomScreen')),
  '/equip/check-item': lazy(() => import('@/modules/equip/check/EquipCheckScreen')),
  '/equip/error-code': lazy(() => import('@/modules/equip/error-code/EquipErrorCodeScreen')),
  '/equip/vendor': lazy(() => import('@/modules/equip/vendor/EquipVendorScreen')),
  // 설비 관리 — 상태 모니터링
  '/equip/andon': lazy(() => import('@/modules/equip/andon/EquipAndonScreen')),
  '/equip/oee': lazy(() => import('@/modules/equip/oee/EquipOeeScreen')),
  '/equip/alarm': lazy(() => import('@/modules/equip/alarm/EquipAlarmMonScreen')),
  '/equip/param': lazy(() => import('@/modules/equip/param/EquipParamScreen')),
  '/equip/downtime': lazy(() => import('@/modules/equip/downtime/EquipDowntimeScreen')),
  // 설비 관리 — 보전 및 점검
  '/equip/pm': lazy(() => import('@/modules/equip/pm/EquipPmPlanScreen')),
  '/equip/daily-check': lazy(() => import('@/modules/equip/daily-check/EquipDailyCheckScreen')),
  '/equip/regular-check': lazy(() => import('@/modules/equip/regular-check/EquipPeriodicCheckScreen')),
  '/equip/bm': lazy(() => import('@/modules/equip/bm/EquipBmScreen')),
  '/equip/pdm': lazy(() => import('@/modules/equip/pdm/EquipPdmScreen')),
  '/equip/outsourcing': lazy(() => import('@/modules/equip/outsourcing/EquipOutsourceScreen')),
  // 설비 관리 — 예비품·스페어 파트
  '/equip/spare-master': lazy(() => import('@/modules/equip/spare-master/SpareMasterScreen')),
  '/equip/spare-io': lazy(() => import('@/modules/equip/spare-io/SpareIoScreen')),
  '/equip/spare-stock': lazy(() => import('@/modules/equip/spare-stock/SpareStockScreen')),
  '/equip/spare-safety': lazy(() => import('@/modules/equip/spare-safety/SpareSafetyScreen')),
  '/equip/spare-scrap': lazy(() => import('@/modules/equip/spare-scrap/SpareScrapScreen')),
  // 설비 관리 — 금형 및 치공구
  '/equip/mold-master': lazy(() => import('@/modules/equip/mold-master/MoldMasterScreen')),
  '/equip/mold-shot': lazy(() => import('@/modules/equip/mold-shot/MoldShotScreen')),
  '/equip/mold-repair': lazy(() => import('@/modules/equip/mold-repair/MoldRepairScreen')),
  '/equip/mold-location': lazy(() => import('@/modules/equip/mold-location/MoldLocationScreen')),
  // 설비 관리 — 계측기 및 검교정
  '/equip/gage-master': lazy(() => import('@/modules/equip/gage-master/GageMasterScreen')),
  '/equip/cal-plan': lazy(() => import('@/modules/equip/cal-plan/CalPlanScreen')),
  '/equip/cal-result': lazy(() => import('@/modules/equip/cal-result/CalResultScreen')),
  '/equip/cal-fail': lazy(() => import('@/modules/equip/cal-fail/CalFailScreen')),
  // 설비 관리 — 분석 및 통계 리포트
  '/equip/mtbf-mttr': lazy(() => import('@/modules/equip/mtbf-mttr/MtbfMttrScreen')),
  '/equip/rate-analysis': lazy(() => import('@/modules/equip/rate-analysis/RateAnalysisScreen')),
  '/equip/pareto': lazy(() => import('@/modules/equip/pareto/ParetoScreen')),
  '/equip/fault-analysis': lazy(() => import('@/modules/equip/fault-analysis/FaultAnalysisScreen')),
  '/equip/maint-cost': lazy(() => import('@/modules/equip/maint-cost/MaintCostScreen')),
  // 품질 관리 — 품질 기준정보
  '/qual/insp-item': lazy(() => import('@/modules/qual/insp-item/QualInspItemScreen')),
  '/qual/insp-spec': lazy(() => import('@/modules/qual/insp-spec/QualInspSpecScreen')),
  '/qual/defect-code': lazy(() => import('@/modules/qual/defect-code/QualDefectCodeScreen')),
  '/qual/sampling-rule': lazy(() => import('@/modules/qual/sampling-rule/QualSamplingRuleScreen')),
  '/qual/grade': lazy(() => import('@/modules/qual/grade/QualGradeScreen')),
  // 품질 관리 — 수입검사(IQC)
  '/qual/iqc-wait': lazy(() => import('@/modules/qual/iqc-wait/QualIqcWaitScreen')),
  '/qual/iqc-result': lazy(() => import('@/modules/qual/iqc-result/QualIqcResultScreen')),
  '/qual/iqc-return': lazy(() => import('@/modules/qual/iqc-return/QualIqcReturnScreen')),
  '/qual/iqc-vendor': lazy(() => import('@/modules/qual/iqc-vendor/QualIqcVendorScreen')),
  // 품질 관리 — 공정검사(PQC)
  '/qual/pqc-fml': lazy(() => import('@/modules/qual/pqc-fml/QualPqcFmlScreen')),
  '/qual/pqc-self': lazy(() => import('@/modules/qual/pqc-self/QualPqcSelfScreen')),
  '/qual/pqc-patrol': lazy(() => import('@/modules/qual/pqc-patrol/QualPqcPatrolScreen')),
  '/qual/pqc-interface': lazy(() => import('@/modules/qual/pqc-interface/QualPqcInterfaceScreen')),
  // 품질 관리 — 출하검사(OQC)
  '/qual/oqc-wait': lazy(() => import('@/modules/qual/oqc-wait/QualOqcWaitScreen')),
  '/qual/oqc-release': lazy(() => import('@/modules/qual/oqc-release/QualOqcReleaseScreen')),
  '/qual/oqc-coa': lazy(() => import('@/modules/qual/oqc-coa/QualOqcCoaScreen')),
  // 품질 관리 — 부적합·불량 관리
  '/qual/ncr': lazy(() => import('@/modules/qual/ncr/QualNcrScreen')),
  '/qual/mrb': lazy(() => import('@/modules/qual/mrb/QualMrbScreen')),
  '/qual/rework': lazy(() => import('@/modules/qual/rework/QualReworkScreen')),
  '/qual/capa': lazy(() => import('@/modules/qual/capa/QualCapaScreen')),
  // 품질 관리 — 통계적 공정관리(SPC)
  '/qual/spc-chart': lazy(() => import('@/modules/qual/spc-chart/QualSpcChartScreen')),
  '/qual/spc-cpk': lazy(() => import('@/modules/qual/spc-cpk/QualSpcCpkScreen')),
  '/qual/spc-alarm': lazy(() => import('@/modules/qual/spc-alarm/QualSpcAlarmScreen')),
  // 품질 관리 — 품질 추적·사후관리
  '/qual/trace-lot': lazy(() => import('@/modules/qual/trace-lot/QualTraceLotScreen')),
  '/qual/voc': lazy(() => import('@/modules/qual/voc/QualVocScreen')),
  '/qual/8d-report': lazy(() => import('@/modules/qual/8d-report/Qual8dReportScreen')),
  // 품질 관리 — 계측기·신뢰성 관리
  '/qual/gage-master': lazy(() => import('@/modules/qual/gage-master/QualGageMasterScreen')),
  '/qual/cal': lazy(() => import('@/modules/qual/cal/QualCalScreen')),
  '/qual/gage-rr': lazy(() => import('@/modules/qual/gage-rr/QualGageRrScreen')),
  // 자재 관리 — 입고·창고
  '/mat/receipt': lazy(() => import('@/modules/mat/receipt/MatReceiptScreen')),
  '/mat/label': lazy(() => import('@/modules/mat/label/MatLabelScreen')),
  '/mat/holding': lazy(() => import('@/modules/mat/holding/MatHoldingScreen')),
  '/mat/return': lazy(() => import('@/modules/mat/return/MatReturnScreen')),
  '/mat/location': lazy(() => import('@/modules/mat/location/MatLocationScreen')),
  '/mat/putaway': lazy(() => import('@/modules/mat/putaway/MatPutawayScreen')),
  // 자재 관리 — 이송·불출·출하·재고
  '/mat/transfer': lazy(() => import('@/modules/mat/transfer/MatTransferScreen')),
  '/mat/request': lazy(() => import('@/modules/mat/request/MatRequestScreen')),
  '/mat/picking': lazy(() => import('@/modules/mat/picking/MatPickingScreen')),
  '/mat/issuing': lazy(() => import('@/modules/mat/issuing/MatIssuingScreen')),
  '/mat/shipping': lazy(() => import('@/modules/mat/shipping/MatShippingScreen')),
  '/mat/stock': lazy(() => import('@/modules/mat/stock/MatStockScreen')),
  // 자재 관리 — 재고관리·물류설비
  '/mat/count': lazy(() => import('@/modules/mat/count/MatCountScreen')),
  '/mat/adjust': lazy(() => import('@/modules/mat/adjust/MatAdjustScreen')),
  '/mat/aging': lazy(() => import('@/modules/mat/aging/MatAgingScreen')),
  '/mat/pallet': lazy(() => import('@/modules/mat/pallet/MatPalletScreen')),
  '/mat/agv': lazy(() => import('@/modules/mat/agv/MatAgvScreen')),
  // 자재 관리 — 기준정보·연동·외주·키팅·폐기
  '/mat/safety-stock': lazy(() => import('@/modules/mat/safety-stock/MatSafetyStockScreen')),
  '/mat/fifo-rule': lazy(() => import('@/modules/mat/fifo-rule/MatFifoRuleScreen')),
  '/mat/iqc-link': lazy(() => import('@/modules/mat/iqc-link/MatIqcLinkScreen')),
  '/mat/lot-split': lazy(() => import('@/modules/mat/lot-split/MatLotSplitScreen')),
  '/mat/kitting': lazy(() => import('@/modules/mat/kitting/MatKittingScreen')),
  '/mat/subcon-issue': lazy(() => import('@/modules/mat/subcon-issue/MatSubconIssueScreen')),
  '/mat/subcon-stock': lazy(() => import('@/modules/mat/subcon-stock/MatSubconStockScreen')),
  '/mat/scrap': lazy(() => import('@/modules/mat/scrap/MatScrapScreen')),

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
  useNotifications(user?.id);

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
