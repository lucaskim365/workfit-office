/**
 * Firestore 시드 러너 — src/data/seeds/* 의 정적 시드를 실제 Firestore(named DB)에 1회 적재한다.
 *
 * 설계: repo의 메서드 의미(save/create/addMovement…)에 의존하지 않고,
 *   { 컬렉션, 시드배열, id함수 } 매핑 테이블로 균일하게 upsert(setDoc) 한다.
 *   문서 ID는 각 repo가 쓰는 키와 동일하게 맞춰 재실행해도 중복이 생기지 않는다(idempotent).
 *
 * 인증: Firestore 보안 룰을 우회하는 Admin SDK 사용 → 서비스 계정 키 필요.
 *   - GOOGLE_APPLICATION_CREDENTIALS=<service-account.json 경로> 또는
 *   - 프로젝트 루트의 ./serviceAccount.json (gitignore 됨)
 *   Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성.
 *
 * 실행:
 *   npm run seed -- --dry     # Firestore 접근 없이 시드 건수만 검증
 *   npm run seed              # 실제 적재
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { ITEM_SEED } from '@/data/seeds/item.seed';
import { VENDOR_SEED } from '@/data/seeds/vendor.seed';
import { COMMON_CODE_SEED } from '@/data/seeds/commonCode.seed';
import { USER_SEED } from '@/data/seeds/user.seed';
import { ROLE_GROUP_SEED } from '@/data/seeds/roleGroup.seed';
import { SHIFT_SEED, SHIFT_ROTATION_SEED } from '@/data/seeds/shift.seed';
import { WORK_CENTER_SEED } from '@/data/seeds/workCenter.seed';
import { BOM_SEED } from '@/data/seeds/bom.seed';
import { ROUTING_SEED } from '@/data/seeds/routing.seed';
import { STOCK_MOVEMENT_SEED } from '@/data/seeds/stock.seed';
import { WORK_ORDER_SEED } from '@/data/seeds/workOrder.seed';
import { SALES_ORDER_SEED } from '@/data/seeds/salesOrder.seed';
import { SHIPMENT_SEED } from '@/data/seeds/shipment.seed';
import { RECEIPT_SEED } from '@/data/seeds/receipt.seed';
import { ISSUE_SEED } from '@/data/seeds/issue.seed';
import { INSPECTION_ITEM_SEED } from '@/data/seeds/inspectionItem.seed';
import { INSPECTION_STANDARD_SEED } from '@/data/seeds/inspectionStandard.seed';
import { DEFECT_CODE_SEED } from '@/data/seeds/defectCode.seed';
import { QUALITY_GRADE_SEED } from '@/data/seeds/qualityGrade.seed';
import { INSPECTION_SEED } from '@/data/seeds/inspection.seed';
import { NONCONFORMANCE_SEED } from '@/data/seeds/nonconformance.seed';
import { MRB_CASE_SEED } from '@/data/seeds/mrbCase.seed';
import { REWORK_ORDER_SEED } from '@/data/seeds/reworkOrder.seed';
import { CAPA_SEED } from '@/data/seeds/capa.seed';
import { SPC_CHART_SEED } from '@/data/seeds/spcChart.seed';
import { SPC_CAPABILITY_SEED } from '@/data/seeds/spcCapability.seed';
import { SPC_ALARM_SEED } from '@/data/seeds/spcAlarm.seed';
import { TRACE_NODE_SEED } from '@/data/seeds/traceNode.seed';
import { VOC_SEED } from '@/data/seeds/voc.seed';
import { D8_REPORT_SEED } from '@/data/seeds/d8Report.seed';
import { GAGE_SEED } from '@/data/seeds/gage.seed';
import { CALIBRATION_SEED } from '@/data/seeds/calibration.seed';
import { GAGE_RR_SEED } from '@/data/seeds/gageRr.seed';
import { PQC_FML_SEED } from '@/data/seeds/pqcFml.seed';
import { PQC_SELF_SEED } from '@/data/seeds/pqcSelf.seed';
import { PQC_PATROL_SEED } from '@/data/seeds/pqcPatrol.seed';
import { PQC_DEVICE_SEED } from '@/data/seeds/pqcDevice.seed';
import { COA_SEED } from '@/data/seeds/coa.seed';
import { EQUIPMENT_SEED } from '@/data/seeds/equipment.seed';
import { EQUIPMENT_SPEC_SEED } from '@/data/seeds/equipmentSpec.seed';
import { EQUIP_BOM_SEED } from '@/data/seeds/equipBom.seed';
import { EQUIP_CHECK_SEED } from '@/data/seeds/equipCheckItem.seed';
import { ALARM_MASTER_SEED } from '@/data/seeds/alarmMaster.seed';
import { EQUIP_VENDOR_SEED } from '@/data/seeds/equipVendor.seed';
import { PM_PLAN_SEED } from '@/data/seeds/pmPlan.seed';
import { DAILY_CHECK_SEED } from '@/data/seeds/dailyCheck.seed';
import { PERIODIC_CHECK_SEED } from '@/data/seeds/periodicCheck.seed';
import { BM_ACTION_SEED } from '@/data/seeds/bmAction.seed';
import { PDM_EQUIPMENT_SEED } from '@/data/seeds/pdmEquipment.seed';
import { MAINT_OUTSOURCING_SEED } from '@/data/seeds/maintOutsourcing.seed';
import { SPARE_PART_SEED } from '@/data/seeds/sparePart.seed';
import { SPARE_MOVEMENT_SEED } from '@/data/seeds/spareMovement.seed';
import { SPARE_STOCK_SEED } from '@/data/seeds/spareStock.seed';
import { SPARE_SAFETY_SEED } from '@/data/seeds/spareSafety.seed';
import { SPARE_SCRAP_SEED } from '@/data/seeds/spareScrap.seed';
import { ANDON_STATUS_SEED } from '@/data/seeds/andonStatus.seed';
import { OEE_EQUIPMENT_SEED } from '@/data/seeds/oeeEquipment.seed';
import { LIVE_ALARM_SEED } from '@/data/seeds/liveAlarm.seed';
import { EQUIP_PARAM_SEED } from '@/data/seeds/equipParam.seed';
import { DOWNTIME_SEED } from '@/data/seeds/downtime.seed';
import { MOLD_SEED } from '@/data/seeds/mold.seed';
import { MOLD_SHOT_SEED } from '@/data/seeds/moldShot.seed';
import { MOLD_REPAIR_SEED } from '@/data/seeds/moldRepair.seed';
import { MOLD_LOCATION_SEED } from '@/data/seeds/moldLocation.seed';
import { EQUIP_GAGE_SEED } from '@/data/seeds/equipGage.seed';
import { CAL_PLAN_SEED } from '@/data/seeds/calPlan.seed';
import { CAL_RESULT_SEED } from '@/data/seeds/calResult.seed';
import { CAL_FAIL_SEED } from '@/data/seeds/calFail.seed';
import { PROD_PLAN_SEED } from '@/data/seeds/prodPlan.seed';
import { SCHEDULE_ENTRY_SEED } from '@/data/seeds/scheduleEntry.seed';
import { URGENT_ORDER_SEED } from '@/data/seeds/urgentOrder.seed';
import { PRODUCTION_RESULT_SEED } from '@/data/seeds/productionResult.seed';
import { JOB_LOG_SEED } from '@/data/seeds/jobLog.seed';
import { WIP_STATUS_SEED } from '@/data/seeds/wipStatus.seed';
import { LINE_MONITOR_SEED } from '@/data/seeds/lineMonitor.seed';
import { MOVE_WIP_SEED } from '@/data/seeds/moveWip.seed';
import { PROD_DEFECT_SEED } from '@/data/seeds/prodDefect.seed';
import { MATERIAL_LOAD_SEED } from '@/data/seeds/materialLoad.seed';
import { MATERIAL_REQUEST_SEED } from '@/data/seeds/materialRequest.seed';
import { PROD_LOT_TRACE_SEED } from '@/data/seeds/prodLotTrace.seed';
import { SUBCON_ORDER_SEED } from '@/data/seeds/subconOrder.seed';
import { SUBCON_ISSUE_SEED } from '@/data/seeds/subconIssue.seed';
import { SUBCON_RECEIPT_SEED } from '@/data/seeds/subconReceipt.seed';
import { WAREHOUSE_ZONE_SEED } from '@/data/seeds/warehouseZone.seed';
import { PUTAWAY_TASK_SEED } from '@/data/seeds/putawayTask.seed';
import { TRANSFER_SEED } from '@/data/seeds/transfer.seed';
import { COUNT_RECORD_SEED } from '@/data/seeds/countRecord.seed';
import { ADJUSTMENT_SEED } from '@/data/seeds/adjustment.seed';
import { AGING_STOCK_SEED } from '@/data/seeds/agingStock.seed';
import { LABEL_TASK_SEED } from '@/data/seeds/labelTask.seed';
import { HOLDING_STOCK_SEED } from '@/data/seeds/holdingStock.seed';
import { MAT_RETURN_SEED } from '@/data/seeds/matReturn.seed';
import { PICKING_LIST_SEED } from '@/data/seeds/pickingList.seed';
import { DELIVERY_ORDER_SEED } from '@/data/seeds/deliveryOrder.seed';

interface SeedTable<T> {
  coll: string;
  docs: readonly T[];
  /** 문서 ID — 해당 repo의 setDoc(doc(db, COLL, <여기>)) 키와 동일해야 한다. */
  id: (d: T) => string;
}

/** 컬렉션 적재 순서 = repo의 doc-id 규칙과 1:1로 맞춤. */
const TABLES: SeedTable<any>[] = [
  { coll: 'items', docs: ITEM_SEED, id: (d) => d.code },
  { coll: 'vendors', docs: VENDOR_SEED, id: (d) => d.code },
  { coll: 'commonCodes', docs: COMMON_CODE_SEED, id: (d) => `${d.groupCode}__${d.code}` },
  { coll: 'users', docs: USER_SEED, id: (d) => d.id },
  { coll: 'roleGroups', docs: ROLE_GROUP_SEED, id: (d) => d.code },
  { coll: 'shifts', docs: SHIFT_SEED, id: (d) => d.code },
  { coll: 'shiftRotations', docs: SHIFT_ROTATION_SEED, id: (d) => d.crew },
  { coll: 'workCenters', docs: WORK_CENTER_SEED, id: (d) => d.code },
  { coll: 'boms', docs: BOM_SEED, id: (d) => d.code },
  { coll: 'routings', docs: ROUTING_SEED, id: (d) => d.code },
  { coll: 'stockMovements', docs: STOCK_MOVEMENT_SEED, id: (d) => d.id },
  { coll: 'workOrders', docs: WORK_ORDER_SEED, id: (d) => d.no },
  { coll: 'salesOrders', docs: SALES_ORDER_SEED, id: (d) => d.no },
  { coll: 'shipments', docs: SHIPMENT_SEED, id: (d) => d.no },
  { coll: 'receipts', docs: RECEIPT_SEED, id: (d) => d.po },
  { coll: 'issues', docs: ISSUE_SEED, id: (d) => d.no },
  { coll: 'inspectionItems', docs: INSPECTION_ITEM_SEED, id: (d) => d.code },
  { coll: 'inspectionStandards', docs: INSPECTION_STANDARD_SEED, id: (d) => d.code },
  { coll: 'defectCodes', docs: DEFECT_CODE_SEED, id: (d) => d.code },
  { coll: 'qualityGrades', docs: QUALITY_GRADE_SEED, id: (d) => d.code },
  { coll: 'inspections', docs: INSPECTION_SEED, id: (d) => d.recv },
  { coll: 'nonconformances', docs: NONCONFORMANCE_SEED, id: (d) => d.no },
  { coll: 'mrbCases', docs: MRB_CASE_SEED, id: (d) => d.no },
  { coll: 'reworkOrders', docs: REWORK_ORDER_SEED, id: (d) => d.no },
  { coll: 'capaActions', docs: CAPA_SEED, id: (d) => d.no },
  { coll: 'spcCharts', docs: SPC_CHART_SEED, id: (d) => d.id },
  { coll: 'spcCapability', docs: SPC_CAPABILITY_SEED, id: (d) => d.id },
  { coll: 'spcAlarms', docs: SPC_ALARM_SEED, id: (d) => d.id },
  { coll: 'traceNodes', docs: TRACE_NODE_SEED, id: (d) => d.id },
  { coll: 'voc', docs: VOC_SEED, id: (d) => d.no },
  { coll: 'd8Reports', docs: D8_REPORT_SEED, id: (d) => d.no },
  { coll: 'gages', docs: GAGE_SEED, id: (d) => d.id },
  { coll: 'calibrations', docs: CALIBRATION_SEED, id: (d) => d.id },
  { coll: 'gageRrStudies', docs: GAGE_RR_SEED, id: (d) => d.id },
  { coll: 'pqcFmlChecks', docs: PQC_FML_SEED, id: (d) => d.wo },
  { coll: 'pqcSelfChecks', docs: PQC_SELF_SEED, id: (d) => d.wo },
  { coll: 'pqcPatrols', docs: PQC_PATROL_SEED, id: (d) => d.id },
  { coll: 'pqcDevices', docs: PQC_DEVICE_SEED, id: (d) => d.id },
  { coll: 'coaCertificates', docs: COA_SEED, id: (d) => d.no },
  { coll: 'equipments', docs: EQUIPMENT_SEED, id: (d) => d.code },
  { coll: 'equipmentSpecs', docs: EQUIPMENT_SPEC_SEED, id: (d) => d.type },
  { coll: 'equipBoms', docs: EQUIP_BOM_SEED, id: (d) => d.code },
  { coll: 'equipCheckItems', docs: EQUIP_CHECK_SEED, id: (d) => d.type },
  { coll: 'alarmMasters', docs: ALARM_MASTER_SEED, id: (d) => d.type },
  { coll: 'equipVendors', docs: EQUIP_VENDOR_SEED, id: (d) => d.code },
  { coll: 'pmPlans', docs: PM_PLAN_SEED, id: (d) => d.id },
  { coll: 'dailyChecks', docs: DAILY_CHECK_SEED, id: (d) => d.code },
  { coll: 'periodicChecks', docs: PERIODIC_CHECK_SEED, id: (d) => d.no },
  { coll: 'bmActions', docs: BM_ACTION_SEED, id: (d) => d.no },
  { coll: 'pdmEquipments', docs: PDM_EQUIPMENT_SEED, id: (d) => d.code },
  { coll: 'maintOutsourcing', docs: MAINT_OUTSOURCING_SEED, id: (d) => d.no },
  { coll: 'spareParts', docs: SPARE_PART_SEED, id: (d) => d.code },
  { coll: 'spareMovements', docs: SPARE_MOVEMENT_SEED, id: (d) => d.no },
  { coll: 'spareStocks', docs: SPARE_STOCK_SEED, id: (d) => d.code },
  { coll: 'spareSafety', docs: SPARE_SAFETY_SEED, id: (d) => d.code },
  // 미채번(no='–') 폐기건은 code를 문서ID로(충돌 방지).
  { coll: 'spareScraps', docs: SPARE_SCRAP_SEED, id: (d) => (d.no && d.no !== '–' ? d.no : d.code) },
  { coll: 'andonStatus', docs: ANDON_STATUS_SEED, id: (d) => d.code },
  { coll: 'oeeEquipments', docs: OEE_EQUIPMENT_SEED, id: (d) => d.code },
  { coll: 'liveAlarms', docs: LIVE_ALARM_SEED, id: (d) => d.id },
  { coll: 'equipParams', docs: EQUIP_PARAM_SEED, id: (d) => d.code },
  { coll: 'downtimes', docs: DOWNTIME_SEED, id: (d) => d.id },
  { coll: 'molds', docs: MOLD_SEED, id: (d) => d.code },
  { coll: 'moldShots', docs: MOLD_SHOT_SEED, id: (d) => d.code },
  { coll: 'moldRepairs', docs: MOLD_REPAIR_SEED, id: (d) => d.no },
  { coll: 'moldLocations', docs: MOLD_LOCATION_SEED, id: (d) => d.code },
  { coll: 'equipGages', docs: EQUIP_GAGE_SEED, id: (d) => d.sn },
  { coll: 'calPlans', docs: CAL_PLAN_SEED, id: (d) => d.sn },
  { coll: 'calResults', docs: CAL_RESULT_SEED, id: (d) => d.no },
  { coll: 'calFails', docs: CAL_FAIL_SEED, id: (d) => d.no },
  { coll: 'prodPlans', docs: PROD_PLAN_SEED, id: (d) => d.no },
  { coll: 'scheduleEntries', docs: SCHEDULE_ENTRY_SEED, id: (d) => d.wo },
  { coll: 'urgentOrders', docs: URGENT_ORDER_SEED, id: (d) => d.no },
  { coll: 'productionResults', docs: PRODUCTION_RESULT_SEED, id: (d) => d.no },
  { coll: 'jobLogs', docs: JOB_LOG_SEED, id: (d) => d.no },
  { coll: 'wipStatus', docs: WIP_STATUS_SEED, id: (d) => d.id },
  { coll: 'lineMonitors', docs: LINE_MONITOR_SEED, id: (d) => d.line },
  { coll: 'moveWip', docs: MOVE_WIP_SEED, id: (d) => d.lot },
  { coll: 'prodDefects', docs: PROD_DEFECT_SEED, id: (d) => d.no },
  { coll: 'materialLoads', docs: MATERIAL_LOAD_SEED, id: (d) => d.id },
  { coll: 'materialRequests', docs: MATERIAL_REQUEST_SEED, id: (d) => d.wo },
  { coll: 'prodLotTraces', docs: PROD_LOT_TRACE_SEED, id: (d) => d.id },
  { coll: 'subconOrders', docs: SUBCON_ORDER_SEED, id: (d) => d.no },
  { coll: 'subconIssues', docs: SUBCON_ISSUE_SEED, id: (d) => d.no },
  { coll: 'subconReceipts', docs: SUBCON_RECEIPT_SEED, id: (d) => d.no },
  { coll: 'warehouseZones', docs: WAREHOUSE_ZONE_SEED, id: (d) => d.z },
  { coll: 'putawayTasks', docs: PUTAWAY_TASK_SEED, id: (d) => d.lot },
  { coll: 'transfers', docs: TRANSFER_SEED, id: (d) => d.no },
  { coll: 'countRecords', docs: COUNT_RECORD_SEED, id: (d) => d.id },
  { coll: 'adjustments', docs: ADJUSTMENT_SEED, id: (d) => d.no },
  { coll: 'agingStock', docs: AGING_STOCK_SEED, id: (d) => d.lot },
  { coll: 'labelTasks', docs: LABEL_TASK_SEED, id: (d) => d.lot },
  { coll: 'holdingStock', docs: HOLDING_STOCK_SEED, id: (d) => d.lot },
  { coll: 'matReturns', docs: MAT_RETURN_SEED, id: (d) => d.no },
  { coll: 'pickingList', docs: PICKING_LIST_SEED, id: (d) => d.id },
  { coll: 'deliveryOrders', docs: DELIVERY_ORDER_SEED, id: (d) => d.no },
];

/** .env.local 의 VITE_FB_* 값을 읽어 named DB를 타깃팅한다. */
function readEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) return undefined;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\n]*)"?`));
    if (m) return m[1].trim();
  }
  return undefined;
}

const DRY = process.argv.includes('--dry');

async function main() {
  const total = TABLES.reduce((n, t) => n + t.docs.length, 0);
  console.log(`시드 ${TABLES.length}개 컬렉션 · 문서 ${total}건`);

  if (DRY) {
    for (const t of TABLES) console.log(`  ${t.coll.padEnd(16)} ${t.docs.length}건`);
    console.log('[dry] Firestore 접근 없이 검증만 수행했습니다.');
    return;
  }

  const projectId = readEnv('VITE_FB_PROJECT_ID');
  const databaseId = readEnv('VITE_FB_FIRESTORE_DB_ID');
  if (!projectId) throw new Error('VITE_FB_PROJECT_ID 를 찾을 수 없습니다 (.env.local).');

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? resolve(process.cwd(), 'serviceAccount.json');
  if (!existsSync(keyPath)) {
    throw new Error(
      `서비스 계정 키를 찾을 수 없습니다: ${keyPath}\n` +
        'Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성 후 ' +
        './serviceAccount.json 로 저장하거나 GOOGLE_APPLICATION_CREDENTIALS 로 경로를 지정하세요.',
    );
  }
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));

  const app = initializeApp({ credential: cert(serviceAccount), projectId });
  // named database( (default) 아님 )를 명시적으로 타깃팅.
  const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  console.log(`타깃: project=${projectId} db=${databaseId ?? '(default)'}`);

  for (const t of TABLES) {
    // Firestore batch 최대 500건 → 청크로 분할.
    for (let i = 0; i < t.docs.length; i += 450) {
      const batch = db.batch();
      for (const d of t.docs.slice(i, i + 450)) {
        batch.set(db.collection(t.coll).doc(t.id(d)), d as Record<string, unknown>);
      }
      await batch.commit();
    }
    console.log(`  ✔ ${t.coll.padEnd(16)} ${t.docs.length}건`);
  }
  console.log('완료.');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
