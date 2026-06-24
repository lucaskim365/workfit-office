import type { HoldingStock } from '@/domain/holdingStock/schema';

/**
 * 입고 보류 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 wms-screens.jsx 의 인라인 ROWS 이관)
 */
export const HOLDING_STOCK_SEED: HoldingStock[] = [
  { lot: 'LOT-RES-1120', code: 'RES-PR-22', name: '포토레지스트', reason: 'IQC 대기', loc: '격리구역 A', qty: 40, status: '검사대기' },
  { lot: 'LOT-CHM-0099', code: 'CHM-GAS-02', name: '공정 가스', reason: '불합격', loc: '격리구역 B', qty: 15, status: '보류' },
  { lot: 'LOT-PKG-3320', code: 'PKG-BGA-14', name: 'BGA 기판', reason: 'IQC 대기', loc: '격리구역 A', qty: 500, status: '검사대기' },
  { lot: 'LOT-RAW-8830', code: 'WF-200-A', name: '200mm 웨이퍼', reason: '조건부 합격', loc: '대기구역 C', qty: 300, status: '보류' },
];
