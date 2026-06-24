import type { MatScrap } from '@/domain/matScrap/schema';

/**
 * 자재 폐기 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 wms-screens-4.jsx 의 인라인 ROWS 이관)
 */
export const MAT_SCRAP_SEED: MatScrap[] = [
  { no: 'SC-260611-02', code: 'RES-PR-19', name: '포토레지스트(구)', lot: 'LOT-RES-0901', qty: 18, reason: '보존기한 만료', approval: '승인완료', status: '반출완료', urgent: true },
  { no: 'SC-260611-03', code: 'CHM-GAS-02', name: '공정 가스', lot: 'LOT-CHM-0099', qty: 15, reason: '품질 불량', approval: '승인대기', status: '대기' },
  { no: 'SC-260610-15', code: 'PKG-BGA-09', name: 'BGA 기판(구)', lot: 'LOT-PKG-2210', qty: 240, reason: '설계 변경(EO)', approval: '승인완료', status: '반출대기' },
  { no: 'SC-260610-08', code: 'WF-200-A', name: '200mm 웨이퍼', lot: 'LOT-RAW-7740', qty: 12, reason: '파손', approval: '반려', status: '종결' },
];
