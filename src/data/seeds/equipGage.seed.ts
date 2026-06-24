import type { EquipGage } from '@/domain/equipGage/schema';

/**
 * 설비 부착 계측기 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 gage-master.jsx 의 인라인 GAGES 이관)
 */
export const EQUIP_GAGE_SEED: EquipGage[] = [
  { sn: 'CAL-2401-001', name: '디지털 버니어캘리퍼스', cat: '캘리퍼스', maker: 'Mitutoyo', model: 'CD-15APX', intro: '2024-01-12', range: '0–150 mm', tol: '±0.02 mm', unit: 'mm', loc: '계측실 G-01', dept: '품질팀', cycle: 12, lastCal: '2025-12-10', nextCal: '2026-12-10', state: '사용중' },
  { sn: 'CAL-2312-014', name: '정밀 전자저울', cat: '저울', maker: 'A&D', model: 'GF-3000', intro: '2023-12-03', range: '0–3,000 g', tol: '±0.1 g', unit: 'g', loc: '검사실 Q-02', dept: '품질팀', cycle: 6, lastCal: '2026-01-05', nextCal: '2026-07-05', state: '사용중' },
  { sn: 'CAL-2305-007', name: '디지털 압력계', cat: '압력계', maker: 'WIKA', model: 'CPG500', intro: '2023-05-20', range: '0–25 bar', tol: '±0.25 %FS', unit: 'bar', loc: '설비동 E-04', dept: '설비팀', cycle: 12, lastCal: '2025-06-18', nextCal: '2026-06-18', state: '검교정중' },
  { sn: 'CAL-2402-022', name: '표준 온도센서(RTD)', cat: '온도센서', maker: 'Fluke', model: '1551A', intro: '2024-02-28', range: '−50–160 ℃', tol: '±0.05 ℃', unit: '℃', loc: '계측실 G-03', dept: '품질팀', cycle: 12, lastCal: '2025-07-01', nextCal: '2026-07-01', state: '사용중' },
  { sn: 'CAL-2208-003', name: '하이트게이지', cat: '하이트게이지', maker: 'Mitutoyo', model: 'HDS-H60C', intro: '2022-08-15', range: '0–600 mm', tol: '±0.03 mm', unit: 'mm', loc: '계측실 G-02', dept: '품질팀', cycle: 12, lastCal: '2025-09-12', nextCal: '2026-09-12', state: '사용중' },
  { sn: 'CAL-2403-019', name: '외측 마이크로미터', cat: '마이크로미터', maker: 'Mitutoyo', model: '293-340', intro: '2024-03-10', range: '0–25 mm', tol: '±0.001 mm', unit: 'mm', loc: '계측실 G-01', dept: '품질팀', cycle: 12, lastCal: '2025-05-20', nextCal: '2026-05-20', state: '사용중지' },
  { sn: 'CAL-2310-011', name: '디지털 토크렌치', cat: '토크렌치', maker: 'Tohnichi', model: 'CEM100N3', intro: '2023-10-08', range: '20–100 N·m', tol: '±3 %', unit: 'N·m', loc: '설비동 E-01', dept: '설비팀', cycle: 6, lastCal: '2026-02-14', nextCal: '2026-08-14', state: '사용중' },
  { sn: 'CAL-2406-030', name: '다이얼게이지', cat: '다이얼게이지', maker: 'Teclock', model: 'TM-110', intro: '2024-06-22', range: '0–10 mm', tol: '±0.01 mm', unit: 'mm', loc: '검사실 Q-01', dept: '품질팀', cycle: 12, lastCal: '2025-10-30', nextCal: '2026-10-30', state: '사용중' },
];
