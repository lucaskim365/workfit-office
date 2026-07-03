import type { MenuNode } from '@/shared/types/menu';

/**
 * 메뉴 트리 (모듈 → 그룹 → 화면) — 와이어프레임 `mes layout/mes/menu-tree.js` 정본 이관.
 * 8개 모듈 / 약 40개 그룹 / 약 170개 화면. 상단 모듈 내비·좌측 사이드바·라우팅이 공유.
 */
export const MENU_TREE: MenuNode[] = [
  /* ── 경영 현황 (로그인 후 랜딩, 운영 현황 통합) ── */
  { id: 'M_EXEC', name: '경영 현황', icon: '▦', order: 5, use: true, children: [
    { id: 'G_EXEC_DASH', name: '대시보드', icon: '▦', order: 10, use: true, children: [
      { id: 'S_EXEC_DASH', name: '경영 대시보드', url: '/exec', icon: '▦', order: 10, use: true },
    ] },
    { id: 'G_OPS_MON', name: '모니터링', icon: '◫', order: 20, use: true, children: [
      { id: 'S_OPS_DASH', name: '통합 모니터링', url: '/ops/dashboard', icon: '◫', order: 10, use: true },
      { id: 'S_OPS_LINE', name: '라인 가동 현황', url: '/ops/line', icon: '◷', order: 20, use: true },
    ] },
  ] },

  /* ── 기준 정보 ── */
  { id: 'M_BASE', name: '기준 정보', icon: '▤', order: 20, use: true, children: [
    { id: 'G_BASE_USER', name: '사용자/거래처', icon: '◫', order: 10, use: true, children: [
      { id: 'S_BASE_USER', name: '사용자관리', url: '/base/user', icon: '◫', order: 10, use: true },
      { id: 'S_BASE_VENDOR', name: '거래처관리', url: '/base/vendor', icon: '▤', order: 20, use: true },
      { id: 'S_BASE_AUTH', name: '그룹권한관리', url: '/base/auth', icon: '✦', order: 30, use: true },
    ] },
    { id: 'G_BASE_MASTER', name: '마스터 정보', icon: '▦', order: 20, use: true, children: [
      { id: 'S_BASE_CODE', name: '공통코드정보', url: '/base/code', icon: '⌗', order: 10, use: true },
      { id: 'S_BASE_ITEM', name: '품목정보', url: '/base/item', icon: '▦', order: 20, use: true },
      { id: 'S_BASE_EQUIP', name: '설비정보', url: '/base/equip', icon: '◷', order: 30, use: true },
      { id: 'S_BASE_DEFECT', name: '불량항목정보', url: '/base/defect', icon: '⚠', order: 40, use: true },
    ] },
    { id: 'G_BASE_PROC', name: '공정 정보', icon: '⚙', order: 30, use: true, children: [
      { id: 'S_BASE_PROCREG', name: '공정등록', url: '/base/process', icon: '⚙', order: 10, use: true },
      { id: 'S_BASE_ROUTING', name: '공정라우팅', url: '/base/routing', icon: '⛓', order: 20, use: true },
    ] },
    { id: 'G_SYS_USER', name: '사용자/권한', icon: '◫', order: 40, use: true, children: [
      { id: 'S_SYS_USER', name: '사용자 관리', url: '/sys/user', icon: '◫', order: 10, use: true },
      { id: 'S_SYS_AUTH', name: '권한 관리', url: '/sys/auth', icon: '✦', order: 20, use: true },
      { id: 'S_SYS_MENU', name: '메뉴 관리', url: '/sys/menu', icon: '▦', order: 30, use: true },
      { id: 'S_SYS_LOG', name: '로그 관리', url: '/sys/log', icon: '◷', order: 40, use: true },
    ] },
    { id: 'G_SYS_GLOBAL', name: '글로벌/운영', icon: '⌗', order: 50, use: true, children: [
      { id: 'S_SYS_COMPANY', name: '회사 정보', url: '/sys/company', icon: '◎', order: 5, use: true },
      { id: 'S_SYS_I18N', name: '다국어 관리', url: '/sys/i18n', icon: '⌗', order: 10, use: true },
      { id: 'S_SYS_CAL', name: '공장 달력', url: '/sys/calendar', icon: '▤', order: 20, use: true },
      { id: 'S_SYS_ENV', name: '환경 설정', url: '/sys/env', icon: '⚙', order: 30, use: true },
      { id: 'S_SYS_BACKUP', name: '데이터 백업', url: '/sys/backup', icon: '⛁', order: 40, use: true },
      { id: 'S_SYS_IF', name: '인터페이스 관리', url: '/sys/interface', icon: '⇄', order: 50, use: true },
    ] },
  ] },

  /* ── 영업 관리 ── */
  { id: 'M_SALES', name: '영업 관리', icon: '₩', order: 25, use: true, children: [
    { id: 'G_SALES_ORDER', name: '영업수주 관리', icon: '✎', order: 10, use: true, children: [
      { id: 'S_SALES_QUOTE', name: '견적서 입력/관리', url: '/sales/quote', icon: '✎', order: 10, use: true },
      { id: 'S_SALES_SO', name: '수주/주문서 입력', url: '/sales/order', icon: '⊞', order: 20, use: true },
      { id: 'S_SALES_SOSTAT', name: '주문서 현황', url: '/sales/order-status', icon: '◷', order: 30, use: true },
    ] },
    { id: 'G_SALES_SHIP', name: '출하 및 매출 관리', icon: '⇪', order: 20, use: true, children: [
      { id: 'S_SALES_SHIP', name: '출하/출고 입력', url: '/sales/shipment', icon: '⇪', order: 10, use: true },
      { id: 'S_SALES_REV', name: '매출 입력', url: '/sales/revenue', icon: '₩', order: 20, use: true },
      { id: 'S_SALES_TAX', name: '세금계산서/거래명세서', url: '/sales/tax-invoice', icon: '▤', order: 30, use: true },
    ] },
    { id: 'G_SALES_COLLECT', name: '수금 및 채권 관리', icon: '⚖', order: 30, use: true, children: [
      { id: 'S_SALES_RECEIPT', name: '수금 입력', url: '/sales/collection', icon: '⤓', order: 10, use: true },
      { id: 'S_SALES_AR', name: '채권/미수금 현황', url: '/sales/ar', icon: '⚠', order: 20, use: true },
      { id: 'S_SALES_CREDIT', name: '여신 관리', url: '/sales/credit', icon: '◫', order: 30, use: true },
    ] },
    { id: 'G_SALES_REPORT', name: '영업 통계 및 분석', icon: '▦', order: 40, use: true, children: [
      { id: 'S_SALES_PERIOD', name: '기간별 매출 현황', url: '/sales/rev-period', icon: '↗', order: 10, use: true },
      { id: 'S_SALES_RANK', name: '품목별 판매 순위', url: '/sales/item-rank', icon: '⊞', order: 20, use: true },
      { id: 'S_SALES_KPI', name: '목표 대비 실적(KPI)', url: '/sales/kpi', icon: '▦', order: 30, use: true },
    ] },
  ] },

  /* ── 생산 관리 ── */
  { id: 'M_PROD', name: '생산 관리', icon: '⚙', order: 30, use: true, children: [
    { id: 'G_PROD_MASTER', name: '생산 기준정보', icon: '⌗', order: 10, use: true, children: [
      { id: 'S_PROD_BOM', name: 'BOM(자재명세서) 조회', url: '/prod/bom', icon: '⌗', order: 10, use: true },
      { id: 'S_PROD_ROUTING', name: '공정(Routing) 마스터', url: '/prod/routing', icon: '⚙', order: 20, use: true },
      { id: 'S_PROD_WCMAP', name: '작업장 및 설비 매핑', url: '/prod/workcenter', icon: '◫', order: 30, use: true },
      { id: 'S_PROD_SHIFT', name: '근무조(Shift) 관리', url: '/prod/shift', icon: '◷', order: 40, use: true },
    ] },
    { id: 'G_PROD_PLAN', name: '계획/지시', icon: '▦', order: 20, use: true, children: [
      { id: 'S_PROD_PLAN', name: '생산계획 관리', url: '/prod/plan', icon: '▦', order: 10, use: true },
      { id: 'S_PROD_WO', name: '작업지시 관리', url: '/prod/wo', icon: '⚙', order: 20, use: true },
      { id: 'S_PROD_WOCHG', name: '작업지시 변경/취소', url: '/prod/wo-change', icon: '↻', order: 30, use: true },
      { id: 'S_PROD_SCHED', name: '일일 생산 스케줄링', url: '/prod/schedule', icon: '◷', order: 40, use: true },
      { id: 'S_PROD_URGENT', name: '긴급/재작업 지시 발령', url: '/prod/urgent', icon: '⚠', order: 50, use: true },
    ] },
    { id: 'G_PROD_EXEC', name: '실행/실적', icon: '◫', order: 30, use: true, children: [
      { id: 'S_PROD_MON', name: '생산 현황 모니터링', url: '/prod/monitor', icon: '◫', order: 10, use: true },
      { id: 'S_PROD_WIP', name: 'WIP 재공 관리', url: '/prod/wip', icon: '◷', order: 20, use: true },
      { id: 'S_PROD_JOB', name: '작업 시작/종료', url: '/prod/job', icon: '⏱', order: 30, use: true },
      { id: 'S_PROD_RESULT', name: '생산실적 등록', url: '/prod/result', icon: '✓', order: 40, use: true },
      { id: 'S_PROD_MAT', name: '자재 투입 관리', url: '/prod/material', icon: '⊞', order: 50, use: true },
      { id: 'S_PROD_MOVE', name: '공정 이동 처리', url: '/prod/move', icon: '⇄', order: 60, use: true },
      { id: 'S_PROD_DEFECT', name: '불량 내역 등록', url: '/prod/defect', icon: '⚠', order: 70, use: true },
      { id: 'S_PROD_MATREQ', name: '자재 청구/불출 요청', url: '/prod/material-request', icon: '✉', order: 80, use: true },
    ] },
    { id: 'G_PROD_TRACE', name: '추적/분석', icon: '▤', order: 40, use: true, children: [
      { id: 'S_PROD_LOT', name: '생산 이력 추적', url: '/prod/trace', icon: '⛓', order: 10, use: true },
      { id: 'S_PROD_DOWN', name: '비가동 관리', url: '/prod/downtime', icon: '⚠', order: 20, use: true },
      { id: 'S_PROD_OEE', name: '생산성/종합효율', url: '/prod/oee', icon: '▤', order: 30, use: true },
      { id: 'S_PROD_CLOSE', name: '생산 마감 관리', url: '/prod/closing', icon: '⚑', order: 40, use: true },
      { id: 'S_PROD_PVA', name: '계획 대비 실적 분석', url: '/prod/plan-vs-actual', icon: '▦', order: 50, use: true },
      { id: 'S_PROD_LT', name: '공정별 리드타임 분석', url: '/prod/leadtime', icon: '⏱', order: 60, use: true },
    ] },
    { id: 'G_PROD_SUBCON', name: '외주 생산 관리', icon: '⇄', order: 50, use: true, children: [
      { id: 'S_PROD_SUBORDER', name: '외주 작업 지시', url: '/prod/subcon-order', icon: '⚙', order: 10, use: true },
      { id: 'S_PROD_SUBISSUE', name: '외주 자재 출고 관리', url: '/prod/subcon-issue', icon: '⊟', order: 20, use: true },
      { id: 'S_PROD_SUBRECV', name: '외주 실적/입고 등록', url: '/prod/subcon-receipt', icon: '✓', order: 30, use: true },
    ] },
  ] },

  /* ── 설비 관리 ── */
  { id: 'M_EQ', name: '설비 관리', icon: '◷', order: 40, use: true, children: [
    { id: 'G_EQ_BASE', name: '설비 기준정보 관리', icon: '▤', order: 10, use: true, children: [
      { id: 'S_EQ_MASTER', name: '설비 마스터 등록', url: '/equip/master', icon: '◫', order: 10, use: true },
      { id: 'S_EQ_SPEC', name: '설비 스펙·제원 관리', url: '/equip/spec', icon: '⊞', order: 20, use: true },
      { id: 'S_EQ_BOM', name: '설비 계층 구조(BOM)', url: '/equip/bom', icon: '⌗', order: 30, use: true },
      { id: 'S_EQ_CHKITEM', name: '설비별 점검 항목', url: '/equip/check-item', icon: '✓', order: 40, use: true },
      { id: 'S_EQ_ERRCODE', name: '알람/에러 코드 마스터', url: '/equip/error-code', icon: '⚠', order: 50, use: true },
      { id: 'S_EQ_VENDOR', name: '협력사/유지보수 업체', url: '/equip/vendor', icon: '◷', order: 60, use: true },
    ] },
    { id: 'G_EQ_MON', name: '설비 상태 모니터링', icon: '◷', order: 20, use: true, children: [
      { id: 'S_EQ_OEE', name: '종합 설비 효율(OEE) 현황', url: '/equip/oee', icon: '▦', order: 10, use: true },
      { id: 'S_EQ_ANDON', name: '실시간 설비 가동(Andon)', url: '/equip/andon', icon: '◫', order: 20, use: true },
      { id: 'S_EQ_ALARM', name: '설비 알람/장애 모니터링', url: '/equip/alarm', icon: '⚠', order: 30, use: true },
      { id: 'S_EQ_PARAM', name: '설비 파라미터/조건 현황', url: '/equip/param', icon: '✦', order: 40, use: true },
      { id: 'S_EQ_DOWN', name: '비가동(Downtime) 현황', url: '/equip/downtime', icon: '◷', order: 50, use: true },
    ] },
    { id: 'G_EQ_MAINT', name: '설비 보전 및 점검', icon: '⚒', order: 30, use: true, children: [
      { id: 'S_EQ_PM', name: '예방보전(PM) 계획', url: '/equip/pm', icon: '▤', order: 10, use: true },
      { id: 'S_EQ_DAILY', name: '일상 점검 관리', url: '/equip/daily-check', icon: '✓', order: 20, use: true },
      { id: 'S_EQ_REGULAR', name: '정기 점검 현황', url: '/equip/regular-check', icon: '◷', order: 30, use: true },
      { id: 'S_EQ_BM', name: '사후보전(BM) 조치', url: '/equip/bm', icon: '⚒', order: 40, use: true },
      { id: 'S_EQ_PDM', name: '예지보전(PdM) 이상 감지', url: '/equip/pdm', icon: '✦', order: 50, use: true },
      { id: 'S_EQ_OUTSRC', name: '외부 수리(외주 보전) 이력', url: '/equip/outsourcing', icon: '↩', order: 60, use: true },
    ] },
    { id: 'G_EQ_SPARE', name: '예비품/스페어 파트', icon: '⬓', order: 40, use: true, children: [
      { id: 'S_EQ_SPMASTER', name: '예비품 마스터 관리', url: '/equip/spare-master', icon: '◫', order: 10, use: true },
      { id: 'S_EQ_SPIO', name: '예비품 입고/출고', url: '/equip/spare-io', icon: '⇄', order: 20, use: true },
      { id: 'S_EQ_SPSTOCK', name: '예비품 재고 조회', url: '/equip/spare-stock', icon: '◷', order: 30, use: true },
      { id: 'S_EQ_SPSAFE', name: '안전재고 미달 알림', url: '/equip/spare-safety', icon: '⚠', order: 40, use: true },
      { id: 'S_EQ_SPSCRAP', name: '폐기 및 불용품 관리', url: '/equip/spare-scrap', icon: '⊟', order: 50, use: true },
    ] },
    { id: 'G_EQ_MOLD', name: '금형 및 치공구 관리', icon: '▥', order: 50, use: true, children: [
      { id: 'S_EQ_MOLDMASTER', name: '금형/치공구 마스터', url: '/equip/mold-master', icon: '◫', order: 10, use: true },
      { id: 'S_EQ_SHOT', name: '금형 타수(Shot) 관리', url: '/equip/mold-shot', icon: '⊞', order: 20, use: true },
      { id: 'S_EQ_MOLDREPAIR', name: '금형 수리/세척 이력', url: '/equip/mold-repair', icon: '⚒', order: 30, use: true },
      { id: 'S_EQ_MOLDLOC', name: '금형 입/출고·위치 관리', url: '/equip/mold-location', icon: '▤', order: 40, use: true },
    ] },
    { id: 'G_EQ_CALIB', name: '계측기 및 검교정 관리', icon: '⚖', order: 55, use: true, children: [
      { id: 'S_EQ_GAGEMASTER', name: '계측기 마스터 등록', url: '/equip/gage-master', icon: '◫', order: 10, use: true },
      { id: 'S_EQ_CALPLAN', name: '검교정 주기/계획 관리', url: '/equip/cal-plan', icon: '◷', order: 20, use: true },
      { id: 'S_EQ_CALRESULT', name: '검교정 실적 등록', url: '/equip/cal-result', icon: '✓', order: 30, use: true },
      { id: 'S_EQ_CALFAIL', name: '검교정 불합격 자산 처리', url: '/equip/cal-fail', icon: '⚠', order: 40, use: true },
    ] },
    { id: 'G_EQ_ANAL', name: '분석 및 통계 리포트', icon: '▦', order: 60, use: true, children: [
      { id: 'S_EQ_MTBF', name: 'MTBF / MTTR 분석', url: '/equip/mtbf-mttr', icon: '▦', order: 10, use: true },
      { id: 'S_EQ_RATE', name: '설비별/기간별 가동률 분석', url: '/equip/rate-analysis', icon: '◷', order: 20, use: true },
      { id: 'S_EQ_PARETO', name: '비가동 사유별 파레토 분석', url: '/equip/pareto', icon: '⊞', order: 30, use: true },
      { id: 'S_EQ_FAULT', name: '고장 유형/부위별 분석', url: '/equip/fault-analysis', icon: '⚠', order: 40, use: true },
      { id: 'S_EQ_COST', name: '유지보수 비용(Cost) 분석', url: '/equip/maint-cost', icon: '⚖', order: 50, use: true },
    ] },
  ] },

  /* ── 품질 관리 ── */
  { id: 'M_QUAL', name: '품질 관리', icon: '✦', order: 50, use: true, children: [
    { id: 'G_QUAL_MASTER', name: '품질 기준정보', icon: '⌗', order: 10, use: true, children: [
      { id: 'S_QUAL_ITEM', name: '품질 검사 항목 마스터', url: '/qual/insp-item', icon: '⌗', order: 10, use: true },
      { id: 'S_QUAL_SPEC', name: '제품/공정별 검사 기준 설정', url: '/qual/insp-spec', icon: '▦', order: 20, use: true },
      { id: 'S_QUAL_DEFCODE', name: '불량 코드 마스터', url: '/qual/defect-code', icon: '⚠', order: 30, use: true },
      { id: 'S_QUAL_SAMPLE', name: '샘플링 룰(Sampling Rule) 관리', url: '/qual/sampling-rule', icon: '⊞', order: 40, use: true },
      { id: 'S_QUAL_GRADE', name: '품질 등급/조건 마스터', url: '/qual/grade', icon: '✦', order: 50, use: true },
    ] },
    { id: 'G_QUAL_IQC', name: '수입검사 (IQC)', icon: '⊞', order: 20, use: true, children: [
      { id: 'S_QUAL_IQC_WAIT', name: '수입검사 대기/대상 현황', url: '/qual/iqc-wait', icon: '◷', order: 10, use: true },
      { id: 'S_QUAL_IQC_RESULT', name: '수입검사 실적 및 판정 등록', url: '/qual/iqc-result', icon: '✓', order: 20, use: true },
      { id: 'S_QUAL_IQC_RETURN', name: '수입검사 불량/반품 처리', url: '/qual/iqc-return', icon: '↩', order: 30, use: true },
      { id: 'S_QUAL_IQC_VENDOR', name: '협력사 품질 등급 평가', url: '/qual/iqc-vendor', icon: '▦', order: 40, use: true },
    ] },
    { id: 'G_QUAL_PQC', name: '공정검사 (PQC)', icon: '⚙', order: 30, use: true, children: [
      { id: 'S_QUAL_PQC_FML', name: '초/중/종물 검사 관리', url: '/qual/pqc-fml', icon: '⊞', order: 10, use: true },
      { id: 'S_QUAL_PQC_SELF', name: '자주검사 실적 등록', url: '/qual/pqc-self', icon: '✓', order: 20, use: true },
      { id: 'S_QUAL_PQC_PATROL', name: '공정 순회(Patrol) 검사', url: '/qual/pqc-patrol', icon: '⇄', order: 30, use: true },
      { id: 'S_QUAL_PQC_IF', name: '설비/계측 데이터 인터페이스', url: '/qual/pqc-interface', icon: '⚇', order: 40, use: true },
    ] },
    { id: 'G_QUAL_OQC', name: '출하검사 (OQC)', icon: '⊟', order: 40, use: true, children: [
      { id: 'S_QUAL_OQC_WAIT', name: '출하검사 대기 현황', url: '/qual/oqc-wait', icon: '◷', order: 10, use: true },
      { id: 'S_QUAL_OQC_RELEASE', name: '출하검사 판정 및 승인', url: '/qual/oqc-release', icon: '✓', order: 20, use: true },
      { id: 'S_QUAL_OQC_COA', name: '출하 성적서(COA) 자동 발행', url: '/qual/oqc-coa', icon: '▦', order: 30, use: true },
    ] },
    { id: 'G_QUAL_NCR', name: '부적합/불량 관리', icon: '⚠', order: 50, use: true, children: [
      { id: 'S_QUAL_NCR', name: '부적합품 발생 보고서(NCR)', url: '/qual/ncr', icon: '⚠', order: 10, use: true },
      { id: 'S_QUAL_MRB', name: 'MRB(부적합 심의) 현황', url: '/qual/mrb', icon: '◫', order: 20, use: true },
      { id: 'S_QUAL_REWORK', name: '재작업(Rework)/폐기 지시', url: '/qual/rework', icon: '↻', order: 30, use: true },
      { id: 'S_QUAL_CAPA', name: '시정 및 예방 조치(CAPA)', url: '/qual/capa', icon: '✦', order: 40, use: true },
    ] },
    { id: 'G_QUAL_SPC', name: '통계적 공정 관리(SPC)', icon: '▦', order: 60, use: true, children: [
      { id: 'S_QUAL_SPC_CHART', name: '관리도(Control Chart) 모니터링', url: '/qual/spc-chart', icon: '▦', order: 10, use: true },
      { id: 'S_QUAL_SPC_CPK', name: '공정능력 지수(Cp, Cpk) 분석', url: '/qual/spc-cpk', icon: '⊞', order: 20, use: true },
      { id: 'S_QUAL_SPC_ALARM', name: '품질 이상 실시간 알람(OOS/OOC)', url: '/qual/spc-alarm', icon: '⚠', order: 30, use: true },
    ] },
    { id: 'G_QUAL_TRACE', name: '품질 추적 및 사후관리', icon: '⛓', order: 70, use: true, children: [
      { id: 'S_QUAL_TRACE_LOT', name: '로트(Lot) 품질 이력 역추적', url: '/qual/trace-lot', icon: '⛓', order: 10, use: true },
      { id: 'S_QUAL_VOC', name: '고객 클레임(VOC) 접수 관리', url: '/qual/voc', icon: '✉', order: 20, use: true },
      { id: 'S_QUAL_8D', name: '8D Report 발행/관리', url: '/qual/8d-report', icon: '▦', order: 30, use: true },
    ] },
    { id: 'G_QUAL_CAL', name: '계측기/신뢰성 관리', icon: '⚖', order: 80, use: true, children: [
      { id: 'S_QUAL_GAGE', name: '계측기/검사 장비 마스터', url: '/qual/gage-master', icon: '◫', order: 10, use: true },
      { id: 'S_QUAL_CAL', name: '검교정 계획 및 실적', url: '/qual/cal', icon: '◷', order: 20, use: true },
      { id: 'S_QUAL_GAGERR', name: 'Gage R&R (측정시스템 분석)', url: '/qual/gage-rr', icon: '⚖', order: 30, use: true },
    ] },
  ] },

  /* ── 자재관리 ── */
  { id: 'M_MAT', name: '자재관리', icon: '⬓', order: 60, use: true, children: [
    { id: 'G_MAT_BASE', name: '기준정보/설정', icon: '⌗', order: 5, use: true, children: [
      { id: 'S_MAT_SAFETY', name: '안전재고 및 발주점 관리', url: '/mat/safety-stock', icon: '⚠', order: 10, use: true },
      { id: 'S_MAT_FIFO', name: '자재 선입선출(FIFO) 룰 관리', url: '/mat/fifo-rule', icon: '⇄', order: 20, use: true },
    ] },
    { id: 'G_MAT_IN', name: '입고', icon: '⊞', order: 10, use: true, children: [
      { id: 'S_MAT_RECV', name: '구매 입고 등록', url: '/mat/receipt', icon: '⊞', order: 10, use: true },
      { id: 'S_MAT_LABEL', name: '입고 라벨 발행', url: '/mat/label', icon: '▦', order: 20, use: true },
      { id: 'S_MAT_HOLD', name: '입고 대기/보류', url: '/mat/holding', icon: '⊟', order: 30, use: true },
      { id: 'S_MAT_IQC', name: '수입검사(IQC) 상태 연동', url: '/mat/iqc-link', icon: '⚇', order: 40, use: true },
      { id: 'S_MAT_RETURN', name: '반품/환수 관리', url: '/mat/return', icon: '↩', order: 50, use: true },
    ] },
    { id: 'G_MAT_WH', name: '창고/위치', icon: '▤', order: 20, use: true, children: [
      { id: 'S_MAT_LOC', name: '창고 위치 관리', url: '/mat/location', icon: '▤', order: 10, use: true },
      { id: 'S_MAT_PUT', name: '적치 지시/등록', url: '/mat/putaway', icon: '⤓', order: 20, use: true },
      { id: 'S_MAT_TRANS', name: '창고 간 이송', url: '/mat/transfer', icon: '⇄', order: 30, use: true },
      { id: 'S_MAT_SPLIT', name: '자재 LOT 분할/병합', url: '/mat/lot-split', icon: '⊞', order: 40, use: true },
    ] },
    { id: 'G_MAT_ISSUE', name: '불출', icon: '◫', order: 30, use: true, children: [
      { id: 'S_MAT_REQ', name: '자재 청구/요청', url: '/mat/request', icon: '✉', order: 10, use: true },
      { id: 'S_MAT_PICK', name: '피킹 지시/작업', url: '/mat/picking', icon: '✓', order: 20, use: true },
      { id: 'S_MAT_KIT', name: '생산 불출 관리', url: '/mat/issuing', icon: '◫', order: 30, use: true },
      { id: 'S_MAT_KITTING', name: '자재 키팅(Kitting) 작업 관리', url: '/mat/kitting', icon: '⊞', order: 40, use: true },
    ] },
    { id: 'G_MAT_SUBCON', name: '외주 자재 관리', icon: '⇄', order: 35, use: true, children: [
      { id: 'S_MAT_SUBISSUE', name: '외주(사급) 자재 출고 관리', url: '/mat/subcon-issue', icon: '⊟', order: 10, use: true },
      { id: 'S_MAT_SUBSTOCK', name: '외주처 재고 현황 모니터링', url: '/mat/subcon-stock', icon: '◷', order: 20, use: true },
    ] },
    { id: 'G_MAT_SHIP', name: '출하/재고', icon: '⇪', order: 40, use: true, children: [
      { id: 'S_MAT_SHIP', name: '완제품 출하 관리', url: '/mat/shipping', icon: '⇪', order: 10, use: true },
      { id: 'S_MAT_STOCK', name: '실시간 재고 조회', url: '/mat/stock', icon: '◷', order: 20, use: true },
    ] },
    { id: 'G_MAT_COUNT', name: '실사/조정', icon: '⚖', order: 50, use: true, children: [
      { id: 'S_MAT_PHYS', name: '재고 실사 계획/등록', url: '/mat/count', icon: '⚖', order: 10, use: true },
      { id: 'S_MAT_ADJ', name: '재고 조정 등록', url: '/mat/adjust', icon: '±', order: 20, use: true },
      { id: 'S_MAT_AGE', name: '재고 보존 기한', url: '/mat/aging', icon: '⏳', order: 30, use: true },
      { id: 'S_MAT_SCRAP', name: '불용 및 폐기 자재 관리', url: '/mat/scrap', icon: '⊟', order: 40, use: true },
    ] },
    { id: 'G_MAT_ROBOT', name: '용기/로봇', icon: '▥', order: 60, use: true, children: [
      { id: 'S_MAT_PALLET', name: '대차/파레트 관리', url: '/mat/pallet', icon: '▥', order: 10, use: true },
      { id: 'S_MAT_AGV', name: 'AGV/AMR 연동', url: '/mat/agv', icon: '⚇', order: 20, use: true },
    ] },
  ] },

  /* ── 리포트 ── */
  { id: 'M_REP', name: '리포트', icon: '▦', order: 70, use: true, children: [
    { id: 'G_REP_HOME', name: '리포트 홈', icon: '▦', order: 5, use: true, children: [
      { id: 'S_REP_CATALOG', name: '리포트 카탈로그', url: '/report/catalog', icon: '▦', order: 10, use: true },
    ] },
    { id: 'G_REP_PROD', name: '생산 리포트', icon: '⚙', order: 10, use: true, children: [
      { id: 'S_REP_DAILY', name: '일일 생산 실적 보고서', url: '/report/prod-daily', icon: '▤', order: 10, use: true },
      { id: 'S_REP_PVA', name: '생산계획 대비 실적', url: '/report/prod-pva', icon: '▦', order: 20, use: true },
      { id: 'S_REP_WOPROG', name: '작업지시 진척 현황', url: '/report/wo-progress', icon: '◷', order: 30, use: true },
      { id: 'S_REP_LINEOUT', name: '라인/공정별 생산량 집계', url: '/report/line-output', icon: '⊞', order: 40, use: true },
      { id: 'S_REP_PRODTREND', name: '제품별 생산 추이', url: '/report/prod-trend', icon: '↗', order: 50, use: true },
    ] },
    { id: 'G_REP_QUAL', name: '품질 리포트', icon: '✦', order: 20, use: true, children: [
      { id: 'S_REP_INSPPASS', name: '검사 합격률(IQC/PQC/OQC)', url: '/report/insp-pass', icon: '✓', order: 10, use: true },
      { id: 'S_REP_PARETO', name: '불량 유형 파레토', url: '/report/defect-pareto', icon: '⊞', order: 20, use: true },
      { id: 'S_REP_CPK', name: '공정능력(Cp/Cpk) 요약', url: '/report/cpk', icon: '▦', order: 30, use: true },
      { id: 'S_REP_VENDORQ', name: '협력사 품질 스코어카드', url: '/report/vendor-score', icon: '▤', order: 40, use: true },
      { id: 'S_REP_COA', name: '출하 성적서(COA)', url: '/report/coa', icon: '▤', order: 50, use: true },
    ] },
    { id: 'G_REP_EQ', name: '설비 리포트', icon: '◷', order: 30, use: true, children: [
      { id: 'S_REP_OEE', name: 'OEE 종합 리포트', url: '/report/oee', icon: '▦', order: 10, use: true },
      { id: 'S_REP_UTIL', name: '가동률·비가동 분석', url: '/report/util', icon: '◷', order: 20, use: true },
      { id: 'S_REP_MTBF', name: 'MTBF/MTTR 신뢰성', url: '/report/mtbf', icon: '↗', order: 30, use: true },
      { id: 'S_REP_MAINTCOST', name: '보전 실적·비용', url: '/report/maint-cost', icon: '⚖', order: 40, use: true },
    ] },
    { id: 'G_REP_MAT', name: '자재·재고 리포트', icon: '⬓', order: 40, use: true, children: [
      { id: 'S_REP_LEDGER', name: '자재 수불부', url: '/report/stock-ledger', icon: '▤', order: 10, use: true },
      { id: 'S_REP_STOCKVAL', name: '재고 현황·자산 평가', url: '/report/stock-value', icon: '⊞', order: 20, use: true },
      { id: 'S_REP_TURNOVER', name: '재고 회전율·장기재고', url: '/report/turnover', icon: '⏳', order: 30, use: true },
      { id: 'S_REP_SAFETY', name: '안전재고·발주 현황', url: '/report/safety-order', icon: '⚠', order: 40, use: true },
      { id: 'S_REP_SUBLEDGER', name: '외주 자재 수불', url: '/report/subcon-ledger', icon: '⇄', order: 50, use: true },
    ] },
    { id: 'G_REP_COST', name: '원가·효율 리포트', icon: '⚖', order: 50, use: true, children: [
      { id: 'S_REP_COST', name: '제조원가 집계', url: '/report/cost', icon: '⚖', order: 10, use: true },
      { id: 'S_REP_YIELD', name: '수율(Yield)·Loss 분석', url: '/report/yield', icon: '▦', order: 20, use: true },
      { id: 'S_REP_LEADTIME', name: '공정 리드타임 분석', url: '/report/leadtime', icon: '⏱', order: 30, use: true },
      { id: 'S_REP_ENERGY', name: '에너지·유틸리티 사용', url: '/report/energy', icon: '↗', order: 40, use: true },
    ] },
    { id: 'G_REP_TRACE', name: '추적·규제 리포트', icon: '⛓', order: 60, use: true, children: [
      { id: 'S_REP_TRACE', name: '로트 추적 계보', url: '/report/trace', icon: '⛓', order: 10, use: true },
      { id: 'S_REP_DHR', name: '제품 이력 카드(DHR)', url: '/report/dhr', icon: '▤', order: 20, use: true },
      { id: 'S_REP_AUDIT', name: '감사추적 로그', url: '/report/audit', icon: '◷', order: 30, use: true },
      { id: 'S_REP_VOC', name: '고객 클레임(VOC)·8D', url: '/report/voc', icon: '✉', order: 40, use: true },
    ] },
    { id: 'G_REP_EXEC', name: '경영 대시보드', icon: '▦', order: 70, use: true, children: [
      { id: 'S_REP_KPI', name: '종합 KPI 대시보드', url: '/report/kpi', icon: '▦', order: 10, use: true },
      { id: 'S_REP_PERIOD', name: '기간 비교 트렌드', url: '/report/period', icon: '↗', order: 20, use: true },
      { id: 'S_REP_SCORE', name: '부서/라인 스코어카드', url: '/report/scorecard', icon: '✦', order: 30, use: true },
    ] },
  ] },
];

/** 모듈의 첫 화면 URL (상단 내비 클릭 시 진입점). */
export function moduleEntryUrl(mod: MenuNode): string {
  return mod.children?.[0]?.children?.[0]?.url ?? '/';
}

/** 모듈의 경로 prefix (예: '/prod'). 현재 활성 모듈 판별에 사용. */
export function modulePrefix(mod: MenuNode): string {
  const first = moduleEntryUrl(mod);
  return '/' + first.split('/')[1];
}
