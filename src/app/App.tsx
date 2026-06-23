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
