import type { SpcCapability } from '@/domain/spcCapability/schema';

/**
 * SPC 공정능력 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 qual-spc-cpk.jsx 의 인라인 mock(CPK_CHARS) 이관)
 */
export const SPC_CAPABILITY_SEED: SpcCapability[] = [
  { id: 'BRK-OD', prod: '브래킷 ASSY-A', code: 'FG-BRK-A', char: '외경(O.D)', unit: 'mm', proc: 'CNC-03', n: 125, mean: 25.013, sigma: 0.0128, lsl: 24.95, usl: 25.05, target: 25.0 },
  { id: 'CVR-T', prod: '커버 플레이트 B', code: 'FG-CVR-B', char: '두께(t)', unit: 'mm', proc: 'PRS-07', n: 100, mean: 2.001, sigma: 0.0112, lsl: 1.95, usl: 2.05, target: 2.0 },
  { id: 'HSG-WT', prod: '하우징 C-Type', code: 'FG-HSG-C', char: '중량', unit: 'g', proc: 'INJ-02', n: 150, mean: 50.12, sigma: 0.52, lsl: 48.0, usl: 52.0, target: 50.0 },
  { id: 'TRQ', prod: '체결 토크', code: 'PROC-ASM', char: '토크', unit: 'N·m', proc: 'ASM-05', n: 80, mean: 11.62, sigma: 0.47, lsl: 10.5, usl: 13.5, target: 12.0 },
];
