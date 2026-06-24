import type { MatReturn } from '@/domain/matReturn/schema';

/**
 * 자재 반품 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 wms-screens.jsx 의 인라인 mock 이관)
 */
export const MAT_RETURN_SEED: MatReturn[] = [
  { no: 'RT-260611-01', code: 'CHM-GAS-02', name: '공정 가스', type: '협력사 반품', vendor: '대한가스', qty: '15', reason: '품질 불량', status: '처리완료', urgent: true },
  { no: 'RT-260611-02', code: 'RES-PR-22', name: '포토레지스트', type: '창고 환수', vendor: '내부창고', qty: '12', reason: '잔여 자재', status: '진행중' },
  { no: 'RT-260610-08', code: 'WF-200-A', name: '200mm 웨이퍼', type: '협력사 반품', vendor: '동진정밀', qty: '50', reason: '규격 불일치', status: '처리완료' },
];
