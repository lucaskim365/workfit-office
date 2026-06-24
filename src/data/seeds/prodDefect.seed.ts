import type { ProdDefect } from '@/domain/prodDefect/schema';

/**
 * 생산 불량실적 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 defect-reg.jsx 의 인라인 TX 배열 이관. PK=no)
 */
export const PROD_DEFECT_SEED: ProdDefect[] = [
  { no: 'DF-2606-052', date: '06-21 13:30', lot: 'LOT-2606-A12', name: '커넥터 하우징', proc: 'OP20 디버링', code: 'D-EXT', qty: 24, action: '재작업', by: '김품질' },
  { no: 'DF-2606-051', date: '06-21 12:10', lot: 'LOT-2606-D09', name: '센서 모듈 PCB', proc: 'OP30 AOI', code: 'D-SLD', qty: 40, action: '재작업', by: '이검사' },
  { no: 'DF-2606-050', date: '06-21 11:05', lot: 'LOT-2606-C03', name: '커넥터 어셈블리', proc: 'OP50 기능검사', code: 'D-FUN', qty: 24, action: '폐기', by: '김품질' },
  { no: 'DF-2606-049', date: '06-21 10:20', lot: 'LOT-2606-B07', name: '터미널 핀', proc: 'OP30 압착', code: 'D-DIM', qty: 60, action: '폐기', by: '박작업' },
  { no: 'DF-2606-048', date: '06-21 09:15', lot: 'LOT-2606-E02', name: '센서 모듈', proc: 'OP50 기능검사', code: 'D-FUN', qty: 28, action: '특채', by: '이검사' },
  { no: 'DF-2606-047', date: '06-21 08:40', lot: 'LOT-2606-A11', name: '커넥터 하우징', proc: 'OP10 사출', code: 'D-EXT', qty: 40, action: '재작업', by: '김품질' },
];
