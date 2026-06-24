import type { SpareMovement } from '@/domain/spareMovement/schema';

/**
 * 예비품 입출고 원장 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 spare-io.jsx 의 인라인 SPIO_TX 이관)
 */
export const SPARE_MOVEMENT_SEED: SpareMovement[] = [
  { no: 'IO-2606-052', type: '출고', date: '06-10 09:15', code: 'SP-HTR-3K', name: '튜브 히터 어셈블리', qty: 1, unit: 'EA', after: 2, reason: 'BM 수리 (BM-2606-031)', who: '박보전', ref: 'Thermal 05호기' },
  { no: 'IO-2606-051', type: '입고', date: '06-10 08:40', code: 'SP-PAD-IC', name: '연마 패드', qty: 20, unit: 'EA', after: 24, reason: '정기 구매입고 (PO-26-0612)', who: '김자재', ref: 'DuPont' },
  { no: 'IO-2606-050', type: '출고', date: '06-09 16:50', code: 'SP-MB-200', name: '캐리어 멤브레인', qty: 2, unit: 'EA', after: 6, reason: 'PM 교체 (CMP 02호기)', who: '김설비', ref: 'CMP 02호기' },
  { no: 'IO-2606-049', type: '출고', date: '06-09 14:05', code: 'SP-FIL-IM', name: '이온소스 필라멘트', qty: 1, unit: 'EA', after: 0, reason: 'BM 수리 (BM-2606-028)', who: '이정비', ref: 'Implant 02호기' },
  { no: 'IO-2606-048', type: '입고', date: '06-09 10:20', code: 'SP-ORK-A', name: 'O-Ring 키트', qty: 12, unit: 'SET', after: 24, reason: '정기 구매입고 (PO-26-0608)', who: '김자재', ref: 'AMAT' },
  { no: 'IO-2606-047', type: '출고', date: '06-08 11:30', code: 'SP-ORK-A', name: 'O-Ring 키트', qty: 2, unit: 'SET', after: 12, reason: 'BM 수리 (BM-2606-026)', who: '이정비', ref: 'Depo 03호기' },
  { no: 'IO-2606-046', type: '입고', date: '06-07 09:00', code: 'SP-HTR-3K', name: '튜브 히터 어셈블리', qty: 1, unit: 'EA', after: 3, reason: '긴급 발주입고 (PO-26-0605)', who: '김자재', ref: 'ASM' },
  { no: 'IO-2606-045', type: '출고', date: '06-06 15:40', code: 'SP-PAD-IC', name: '연마 패드', qty: 4, unit: 'EA', after: 4, reason: 'PM 교체 (CMP 02호기)', who: '김설비', ref: 'CMP 02호기' },
];
