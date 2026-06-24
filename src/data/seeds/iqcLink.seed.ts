import type { IqcLink } from '@/domain/iqcLink/schema';

/**
 * IQC 연동 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 wms-screens-4.jsx 의 인라인 ROWS 이관)
 */
export const IQC_LINK_SEED: IqcLink[] = [
  { lot: 'LOT-RES-1120', code: 'RES-PR-22', name: '포토레지스트', qty: 40, iqcStatus: 'IQC 대기', available: false, status: '검사대기' },
  { lot: 'LOT-PKG-3320', code: 'PKG-BGA-14', name: 'BGA 기판', qty: 500, iqcStatus: 'IQC 진행', available: false, status: '검사중' },
  { lot: 'LOT-RAW-8821', code: 'WF-300-B', name: '300mm 웨이퍼', qty: 500, iqcStatus: 'IQC 합격', available: true, status: '가용전환' },
  { lot: 'LOT-CHM-0457', code: 'CHM-SL-05', name: '슬러리 SL-05', qty: 60, iqcStatus: 'IQC 합격', available: true, status: '가용전환' },
  { lot: 'LOT-CHM-0099', code: 'CHM-GAS-02', name: '공정 가스', qty: 15, iqcStatus: 'IQC 불합격', available: false, status: '보류/반품' },
];
