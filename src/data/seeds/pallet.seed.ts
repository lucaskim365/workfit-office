import type { Pallet } from '@/domain/pallet/schema';

/**
 * 파렛트/용기 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (MatPalletScreen 의 인라인 ROWS 이관)
 */
export const PALLET_SEED: Pallet[] = [
  { id: 'PLT-0012', type: 'Pallet', code: 'WF-300-B', lot: 'LOT-RAW-8821', loc: 'A-1-2-1', status: '사용중', urgent: true },
  { id: 'PLT-0013', type: 'Pallet', code: 'WF-300-B', lot: 'LOT-RAW-8822', loc: 'A-1-2-2', status: '사용중' },
  { id: 'CRT-0044', type: '대차', code: 'CHM-SL-05', lot: 'LOT-CHM-0457', loc: 'C-라인대기', status: '사용중' },
  { id: 'MAG-0102', type: '매거진', code: '—', lot: '—', loc: '대차장', status: '공용기' },
  { id: 'PLT-0009', type: 'Pallet', code: '—', lot: '—', loc: '대차장', status: '공용기' },
];
