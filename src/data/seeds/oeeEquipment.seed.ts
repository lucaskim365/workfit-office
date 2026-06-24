import type { OeeEquipment } from '@/domain/oeeEquipment/schema';

/**
 * 설비 OEE 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 equip-oee.jsx 의 인라인 EQ_OEE 행 배열 이관)
 */
export const OEE_EQUIPMENT_SEED: OeeEquipment[] = [
  { code: 'EQ-PHO05', name: 'Photo 05호기', line: 'A', a: 96, p: 97, q: 99, st: '가동', tr: [90, 91, 92, 91, 93, 92] },
  { code: 'EQ-CMP02', name: 'CMP 02호기', line: 'A', a: 94, p: 96, q: 98, st: '가동', tr: [86, 87, 88, 87, 89, 88] },
  { code: 'EQ-CLN04', name: 'Clean 04호기', line: 'C', a: 95, p: 94, q: 98, st: '가동', tr: [85, 86, 88, 87, 88, 88] },
  { code: 'EQ-IMP02', name: 'Implant 02호기', line: 'B', a: 93, p: 95, q: 97, st: '가동', tr: [84, 85, 86, 85, 86, 86] },
  { code: 'EQ-ETCH01', name: 'Etch 01호기', line: 'A', a: 90, p: 93, q: 96, st: '대기', tr: [79, 80, 81, 80, 81, 80] },
  { code: 'EQ-DEP03', name: 'Depo 03호기', line: 'B', a: 85, p: 91, q: 94, st: '정지', tr: [74, 73, 72, 73, 72, 73] },
  { code: 'EQ-OVEN05', name: 'Thermal 05호기', line: 'C', a: 70, p: 88, q: 92, st: '고장', tr: [62, 60, 58, 57, 56, 57] },
];
