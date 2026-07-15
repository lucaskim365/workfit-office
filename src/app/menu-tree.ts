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
    { id: 'G_BASE_ORG', name: '조직·결재 기준정보', icon: '◫', order: 15, use: true, children: [
      { id: 'S_BASE_DEPT', name: '부서/조직관리', url: '/base/department', icon: '▤', order: 10, use: true },
      { id: 'S_BASE_POSITION', name: '직급관리', url: '/base/position', icon: '◫', order: 20, use: true },
      { id: 'S_BASE_APRULE', name: '결재선 규칙관리', url: '/base/approval-rule', icon: '⚖', order: 30, use: true },
      { id: 'S_BASE_APFORM', name: '결재서식 관리', url: '/base/approval-form', icon: '📄', order: 40, use: true },
      { id: 'S_BASE_APMON', name: '결재문서 모니터링', url: '/base/approval-monitor', icon: '🔍', order: 50, use: true },
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

  /* ── 퀵 도크 (그룹웨어, Widdy, 메신저) ── */
  { id: 'M_GW', name: '그룹웨어', icon: '🌐', order: 80, use: true, children: [] },
  { id: 'M_WIDDY', name: 'Widdy', icon: '✦', order: 85, use: true, children: [] },
  { id: 'M_MSG', name: '메신저', icon: '👤', order: 90, use: true, children: [] },
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
